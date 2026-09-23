import { supabase } from '../../config/supabase.js';
import { requireEmployee } from '../../utils/guards.js';
import {
  employeeLayout,
  attachEmployeeHeaderEvents,
} from '../../components/employee-layout.js';
import { icon } from '../../components/icons.js';

export async function employeeDashboardPage(app) {
  const ctx = await requireEmployee();
  if (!ctx) return;
  const { profile, employee } = ctx;

  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: todayAtt },
    { data: recent },
  ] = await Promise.all([
    supabase.from('attendance').select('*')
      .eq('employee_id', employee.id).eq('work_date', today).maybeSingle(),
    supabase.from('attendance').select('*')
      .eq('employee_id', employee.id)
      .order('work_date', { ascending: false })
      .limit(3),
  ]);

  const checkIn = todayAtt?.check_in
    ? new Date(todayAtt.check_in).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;
  const checkOut = todayAtt?.check_out
    ? new Date(todayAtt.check_out).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const isCheckedIn = checkIn && !checkOut;
  const isDone = checkIn && checkOut;

  // Bouton principal selon l'état
let buttonTitle = 'Pointer mon arrivée';
let buttonSub = 'Scannez le QR code de votre site';
let buttonIcon = 'camera';

  if (isCheckedIn) {
  buttonTitle = 'Pointer ma sortie';
  buttonSub = 'Bonne journée ! À bientôt';
  buttonIcon = 'logout';
} else if (isDone) {
  buttonTitle = 'Journée terminée';
  buttonSub = `Vous avez travaillé aujourd'hui, à demain !`;
  buttonIcon = 'check';
}

  const content = `
    <div class="emp-hero">
      <h1>Bonjour ${employee.first_name} 👋</h1>
      <p>${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    </div>

    <div class="emp-status-grid">
      <div class="emp-status-card">
        <div class="emp-status-label">
          <span class="emp-status-dot ${checkIn ? 'green' : ''}"></span>
          Arrivée
        </div>
        <div class="emp-status-value ${!checkIn ? 'muted' : ''}">${checkIn || '—'}</div>
      </div>
      <div class="emp-status-card">
        <div class="emp-status-label">
          <span class="emp-status-dot ${checkOut ? 'red' : ''}"></span>
          Sortie
        </div>
        <div class="emp-status-value ${!checkOut ? 'muted' : ''}">${checkOut || '—'}</div>
      </div>
    </div>

    ${!isDone ? `
      <a href="/check-in" data-link class="emp-big-button">
        <span class="emp-big-button-icon">${icon(buttonIcon, 48)}</span>
        <div class="emp-big-button-title">${buttonTitle}</div>
        <div class="emp-big-button-sub">${buttonSub}</div>
      </a>
    ` : `
      <div class="emp-big-button" style="opacity:0.7;cursor:default;">
        <span class="emp-big-button-icon">${icon('check', 48)}</span>
        <div class="emp-big-button-title">Journée terminée</div>
        <div class="emp-big-button-sub">Rendez-vous demain</div>
      </div>
    `}

    ${recent && recent.length > 0 ? `
      <div class="emp-history">
        <div class="emp-history-header">Historique récent</div>
        ${recent.map(r => {
          const dur = r.worked_minutes
            ? `${Math.floor(r.worked_minutes / 60)}h${String(r.worked_minutes % 60).padStart(2, '0')}`
            : '—';
          const ci = r.check_in ? new Date(r.check_in).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
          const co = r.check_out ? new Date(r.check_out).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
          return `
            <div class="emp-history-item">
              <div>
                <div class="emp-history-date">${new Date(r.work_date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}</div>
                <div class="emp-history-times">${ci} → ${co}</div>
              </div>
              <div class="emp-history-duration">${dur}</div>
            </div>
          `;
        }).join('')}
      </div>
    ` : `
      <div class="emp-history">
        <div class="emp-history-header">Historique récent</div>
        <div class="emp-empty">Aucun pointage pour l'instant</div>
      </div>
    `}
  `;

  app.innerHTML = employeeLayout({ profile, active: '/my-dashboard', content });
  attachEmployeeHeaderEvents();
}