import { supabase } from '../../config/supabase.js';
import { requireEmployee } from '../../utils/guards.js';
import {
  employeeLayout,
  attachEmployeeHeaderEvents,
} from '../../components/employee-layout.js';
import { toast } from '../../components/toast.js';
import { icon } from '../../components/icons.js';
import { requestNotificationPermission, showLocalNotification } from '../../utils/push.js';

let html5QrScanner = null;

export async function employeeCheckInPage(app) {
  const ctx = await requireEmployee();
  if (!ctx) return;
  const { profile, employee } = ctx;

  const content = `
    <div class="emp-hero">
      <h1>Pointer</h1>
      <p>Scannez le QR code de votre site</p>
    </div>

    <div id="geo-badge" class="emp-geo-badge">📍 Activation de la localisation…</div>

    <div class="emp-scanner-container">
      <div id="qr-reader" style="width:100%;height:100%;"></div>
      <div class="emp-scanner-overlay" id="scanner-overlay" style="display:none;">
        <div class="emp-scanner-frame"></div>
      </div>
      <div id="scanner-placeholder" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;text-align:center;padding:24px;">
        <div style="color:white;">${icon('camera', 56)}</div>
  <div style="font-size:16px;opacity:0.9;margin-top:16px;">Appuyez pour activer la caméra</div>
</div>
    </div>

    <button class="btn btn-primary" id="start-scan" style="width:100%;padding:16px;font-size:16px;margin-bottom:12px;">
      Activer la caméra
    </button>
    <button class="btn btn-secondary" id="stop-scan" style="display:none;width:100%;padding:16px;font-size:16px;">
      Arrêter
    </button>

    <div style="text-align:center;margin-top:20px;font-size:13px;color:var(--pf-text-muted);">
      Site : <strong>${employee.sites?.name || 'Non assigné'}</strong>
    </div>
  `;

  app.innerHTML = employeeLayout({ profile, active: '/check-in', content });
  attachEmployeeHeaderEvents();

  let currentPosition = null;

  const requestPosition = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Géolocalisation non supportée'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  const updateGeoBadge = (status, pos = null) => {
    const el = document.getElementById('geo-badge');
    if (status === 'ok') {
      el.className = 'emp-geo-badge ok';
      el.innerHTML = `✅ Position détectée · ±${Math.round(pos.coords.accuracy)} m`;
    } else if (status === 'error') {
      el.className = 'emp-geo-badge error';
      el.innerHTML = `❌ Localisation refusée`;
    } else {
      el.className = 'emp-geo-badge';
      el.innerHTML = `📍 Activation de la localisation…`;
    }
  };

  const startGeo = async () => {
    try {
      const pos = await requestPosition();
      currentPosition = pos;
      updateGeoBadge('ok', pos);
    } catch (err) {
      updateGeoBadge('error');
      toast('Géolocalisation impossible : ' + err.message, 'error');
    }
  };

  await startGeo();

  const startScan = async () => {
    if (!currentPosition) {
      toast('Localisation requise avant de scanner', 'warning');
      await startGeo();
      if (!currentPosition) return;
    }

    document.getElementById('scanner-placeholder').style.display = 'none';
    document.getElementById('scanner-overlay').style.display = 'flex';
    document.getElementById('start-scan').style.display = 'none';

    try {
      const { Html5Qrcode } = await import('https://esm.sh/html5-qrcode@2.3.8');
      html5QrScanner = new Html5Qrcode('qr-reader');

      await html5QrScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await handleQrDetected(decodedText, currentPosition);
        },
        () => {}
      );

      document.getElementById('stop-scan').style.display = 'block';
    } catch (err) {
      toast('Impossible d\'accéder à la caméra : ' + err.message, 'error');
      document.getElementById('scanner-placeholder').style.display = 'flex';
      document.getElementById('scanner-overlay').style.display = 'none';
      document.getElementById('start-scan').style.display = 'inline-flex';
    }
  };

  const stopScan = async () => {
    if (html5QrScanner) {
      try { await html5QrScanner.stop(); } catch {}
      try { await html5QrScanner.clear(); } catch {}
      html5QrScanner = null;
    }
    document.getElementById('scanner-placeholder').style.display = 'flex';
    document.getElementById('scanner-overlay').style.display = 'none';
    document.getElementById('start-scan').style.display = 'inline-flex';
    document.getElementById('stop-scan').style.display = 'none';
  };

  document.getElementById('start-scan').addEventListener('click', startScan);
  document.getElementById('stop-scan').addEventListener('click', stopScan);

  const handleQrDetected = async (qrToken, position) => {
    await stopScan();

    const token = qrToken.startsWith('pointify:') ? qrToken.slice(9) : qrToken;

    const { data: qr, error: qrError } = await supabase
      .from('qr_codes').select('site_id')
      .eq('token_hash', token).eq('is_active', true).maybeSingle();

    if (qrError) {
      console.error('Erreur de lecture du QR code', qrError);
      toast('Erreur de configuration du QR : ' + qrError.message, 'error', 6000);
      return;
    }

    if (!qr) { toast('QR code inconnu ou expiré', 'error'); return; }

    // Position fraîche
    let freshPosition = position;
    try {
      const pos = await requestPosition();
      freshPosition = pos;
      currentPosition = pos;
      updateGeoBadge('ok', pos);
    } catch {
      toast('Localisation rafraîchie impossible', 'error');
      return;
    }

    toast('Vérification en cours…', 'info');

    const { data, error } = await supabase.rpc('validate_check_in', {
      p_site_id: qr.site_id,
      p_latitude: freshPosition.coords.latitude,
      p_longitude: freshPosition.coords.longitude,
      p_accuracy: freshPosition.coords.accuracy,
      p_qr_token: token,
    });

    if (error) { toast('Erreur : ' + error.message, 'error'); return; }
    if (!data.success) { toast(data.error || 'Pointage refusé', 'error', 5000); return; }

    showSuccess(data);
  };

  const showSuccess = (data) => {
    const isCheckIn = data.event_type === 'check_in';
    const overlay = document.createElement('div');
    overlay.className = 'emp-success';
    overlay.innerHTML = `
      <div class="emp-success-inner">
        <div class="emp-success-icon">${isCheckIn ? '🟢' : '🔴'}</div>
        <div class="emp-success-label">${isCheckIn ? 'ARRIVÉE ENREGISTRÉE' : 'SORTIE ENREGISTRÉE'}</div>
        <div class="emp-success-time">${data.time}</div>
        <div class="emp-success-info">${data.site_name}</div>
        <div class="emp-success-badge">
          ${data.status === 'late' ? '⏰ EN RETARD' : '✓ À L\'HEURE'}
        </div>
        <div style="font-size:13px;opacity:0.8;margin-bottom:24px;">
          Distance : ${data.distance} m
        </div>
        <button class="emp-success-btn" id="close-success">Terminer</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('close-success').addEventListener('click', () => {
      overlay.remove();
      window.location.href = '/my-dashboard';
    });

    requestNotificationPermission().then(() => {
      showLocalNotification(
        isCheckIn ? 'Arrivée enregistrée' : 'Sortie enregistrée',
        { body: `${data.time} — ${data.site_name}`, tag: 'pointify-check' }
      );
    });
  };
}