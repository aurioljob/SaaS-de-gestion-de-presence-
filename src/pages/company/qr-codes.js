import { supabase } from '../../config/supabase.js';
import { requireCompany as guardCompany } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal, confirmModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { formatDate } from '../../utils/format.js';

export async function companyQrCodesPage(app) {
  const ctx = await guardCompany();
  if (!ctx) return;
  const { profile, context } = ctx;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/qr-codes', 'company', {
  companyName: context.company.name,
  planName: context.plan?.name || 'Aucun plan',
  isImpersonating: context.isImpersonating,
})}
      <div class="main-content">
        ${renderTopbar(profile, 'QR codes',{
  isImpersonating: context.isImpersonating,
  companyName: context.company.name,
})}
        <main class="page">
          <div class="page-header">
            <h1>QR codes</h1>
            <p>Un QR code unique par site pour vos employés.</p>
          </div>
          <div class="toolbar">
            <div class="toolbar-spacer"></div>
            <button class="btn btn-primary" id="gen-qr">+ Générer un QR pour un site</button>
          </div>
          <div id="qr-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
  document.getElementById('gen-qr').addEventListener('click', () => openGenerator(context));
  await load(context);
}

async function load(context) {
  const list = document.getElementById('qr-list');
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  const { data, error } = await supabase.from('qr_codes')
    .select(`*, sites!inner(name, company_id, address)`)
    .eq('sites.company_id', context.companyId)
    .order('created_at', { ascending: false });

  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }
  if (!data || data.length === 0) { list.innerHTML = `<div class="empty"><h3>Aucun QR code</h3><p>Générez votre premier QR code.</p></div>`; return; }

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>Site</th><th>Token</th><th>Expire le</th><th>Actif</th><th></th></tr></thead>
        <tbody>
          ${data.map(q => `
            <tr>
              <td><strong>${q.sites?.name || '—'}</strong></td>
              <td><code style="font-size:12px;">${q.token_hash.slice(0, 16)}…</code></td>
              <td>${q.expires_at ? formatDate(q.expires_at) : 'Jamais'}</td>
              <td>${q.is_active ? '<span class="badge badge-success">Actif</span>' : '<span class="badge badge-muted">Inactif</span>'}</td>
              <td>
                <div class="table-actions">
                  <button class="icon-btn" data-view="${q.id}" title="Afficher le QR">🔲</button>
                  <button class="icon-btn" data-toggle="${q.id}" title="Activer/Désactiver">${q.is_active ? '⏸' : '▶'}</button>
                  <button class="icon-btn danger" data-del="${q.id}">🗑</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  list.querySelectorAll('[data-view]').forEach(b =>
    b.addEventListener('click', () => showQr(data.find(q => q.id === b.dataset.view)))
  );
  list.querySelectorAll('[data-toggle]').forEach(b =>
    b.addEventListener('click', async () => {
      const q = data.find(x => x.id === b.dataset.toggle);
      const { error } = await supabase.from('qr_codes').update({ is_active: !q.is_active }).eq('id', q.id);
      if (error) { toast(error.message, 'error'); return; }
      toast('QR mis à jour', 'success');
      load(context);
    })
  );
  list.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => {
      const q = data.find(x => x.id === b.dataset.del);
      confirmModal('Supprimer ce QR code ? Les employés ne pourront plus pointer sur ce site avec.', async () => {
        const { error } = await supabase.from('qr_codes').delete().eq('id', q.id);
        if (error) { toast(error.message, 'error'); return; }
        toast('QR supprimé', 'success');
        load(context);
      });
    })
  );
}

async function openGenerator(context) {
  const { data: sites } = await supabase.from('sites')
    .select('id, name').eq('company_id', context.companyId).eq('status', 'active').order('name');

  if (!sites || sites.length === 0) { toast('Créez d\'abord un site actif', 'warning'); return; }

  const { close } = openModal({
    title: 'Générer un QR code',
    body: `
      <div class="form-group">
        <label class="label">Site *</label>
        <select class="input" id="qr-site">
          ${sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="label">Durée de validité (jours, 0 = illimité)</label>
        <input class="input" type="number" id="qr-days" value="0" />
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-cancel>Annuler</button>
      <button class="btn btn-primary" data-save>Générer</button>
    `,
  });

  document.querySelector('[data-cancel]').addEventListener('click', close);
  document.querySelector('[data-save]').addEventListener('click', async () => {
    const siteId = document.getElementById('qr-site').value;
    const days = Number(document.getElementById('qr-days').value);

    // Générer un token aléatoire
    const token = crypto.randomUUID() + '-' + crypto.randomUUID();
    const expiresAt = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;

    const { error } = await supabase.from('qr_codes').insert({
      site_id: siteId,
      token_hash: token,
      expires_at: expiresAt,
      is_active: true,
    });

    if (error) { toast(error.message, 'error'); return; }
    toast('QR code généré', 'success');
    close();
    load(context);
  });
}

function showQr(qr) {
  // Charge le QR via l'API externe (rendu simple, pas d'appel réseau pour la lib)
  const data = qr.token_hash;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data)}`;

  const { close } = openModal({
    title: `QR — ${qr.sites?.name || 'Site'}`,
    body: `
      <div style="text-align:center;">
        <img src="${qrUrl}" alt="QR code" style="border-radius:12px;border:4px solid white;box-shadow:var(--pf-shadow);" />
        <p style="margin-top:12px;font-size:12px;color:var(--pf-text-muted);word-break:break-all;">
          Token : ${qr.token_hash}
        </p>
        <p style="margin-top:6px;font-size:12px;color:var(--pf-text-muted);">
          Imprimez ce QR et affichez-le à l'entrée du site.
        </p>
        <a href="${qrUrl}" target="_blank" class="btn btn-secondary" style="margin-top:12px;" download>Télécharger</a>
      </div>
    `,
    footer: `<button class="btn btn-secondary" data-close-modal>Fermer</button>`,
  });

  document.querySelector('[data-close-modal]').addEventListener('click', close);
}