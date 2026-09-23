import { supabase } from '../../config/supabase.js';
import { requireEmployee } from '../../utils/guards.js';
import {
  employeeLayout,
  attachEmployeeHeaderEvents,
} from '../../components/employee-layout.js';
import { icon } from '../../components/icons.js';

export async function employeeAttendancePage(app) {
  const ctx = await requireEmployee();
  if (!ctx) return;
  const { profile, employee } = ctx;

  const { data: list } = await supabase
    .from('attendance')
    .select(`*, sites(name)`)
    .eq('employee_id', employee.id)
    .order('work_date', { ascending: false })
    .limit(60);

  const grouped = groupByMonth(list || []);

  const content = `
    <div class="emp-hero">
      <h1>Mon historique</h1>
      <p>Vos 60 derniers pointages</p>
    </div>

    ${Object.keys(grouped).length > 0 ? Object.entries(grouped).map(([monthLabel, items]) => `
      <div style="margin-bottom:20px;">
        <div style="font-size:12px;font-weight:700;color:var(--pf-text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;padding-left:4px;">
          ${monthLabel}
        </div>
        <div class="emp-history">
          ${items.map(r => {
            const dur = r.worked_minutes
              ? `${Math.floor(r.worked_minutes / 60)}h${String(r.worked_minutes % 60).padStart(2, '0')}`
              : '—';
            const ci = r.check_in ? new Date(r.check_in).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
            const co = r.check_out ? new Date(r.check_out).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
            return `
              <div class="emp-history-item">
                <div>
                  <div class="emp-history-date">${new Date(r.work_date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'short' })}</div>
                  <div class="emp-history-times">${ci} → ${co}</div>
                </div>
                <div class="emp-history-duration">${dur}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('') : `
      <div class="emp-history">
        <div class="emp-empty">
          <div style="color:var(--pf-text-light);margin-bottom:12px;">${icon('calendar', 48)}</div>
          Aucun pointage pour l'instant
        </div>
      </div>
    `}
  `;

  app.innerHTML = employeeLayout({ profile, active: '/my-attendance', content });
  attachEmployeeHeaderEvents();
}

function groupByMonth(list) {
  const grouped = {};
  for (const item of list) {
    const d = new Date(item.work_date);
    const key = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }
  return grouped;
}