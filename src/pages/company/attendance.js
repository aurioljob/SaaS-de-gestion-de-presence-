import { supabase } from '../../config/supabase.js';
import { requireCompany as guardCompany } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { subscribeToAttendance, unsubscribe } from '../../utils/realtime.js';
import { icon } from '../../components/icons.js';
import { prepareCompanyLayout } from '../../utils/company-layout.js';

let channel = null;

export async function companyAttendancePage(app) {
  const ctx = await guardCompany();
  if (!ctx) return;
  const { profile, context } = ctx;

  const today = new Date().toISOString().slice(0, 10);

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/dashboard', 'company', await prepareCompanyLayout(context))}
      <div class="main-content">
        ${renderTopbar(profile, 'Présences', {
          isImpersonating: context.isImpersonating,
          companyName: context.company.name,
        })}
        <main class="page">
          <div class="page-header">
            <h1>Présences</h1>
            <p>Suivi des pointages en temps réel</p>
          </div>

          <div class="toolbar">
            <input type="date" class="input" id="date-filter" value="${today}" style="max-width:200px;" />
            <select class="input" id="status-filter" style="max-width:180px;">
              <option value="">Tous les statuts</option>
              <option value="present">Présents</option>
              <option value="late">En retard</option>
              <option value="absent">Absents</option>
            </select>
            <select class="input" id="site-filter" style="max-width:200px;">
              <option value="">Tous les sites</option>
            </select>
            <div class="toolbar-spacer"></div>
            <button class="btn btn-secondary" id="export-csv">${icon('download',16)} Exporter CSV</button>
          </div>

          <div id="attendance-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();

  // Sites
  const { data: sites } = await supabase.from('sites').select('id, name')
    .eq('company_id', context.companyId).order('name');
  const siteFilter = document.getElementById('site-filter');
  (sites || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.name;
    siteFilter.appendChild(opt);
  });

  document.getElementById('date-filter').addEventListener('change', () => load(context));
  document.getElementById('status-filter').addEventListener('change', () => load(context));
  siteFilter.addEventListener('change', () => load(context));
  document.getElementById('export-csv').addEventListener('click', () => exportCsv(context));

  await load(context);

  channel = subscribeToAttendance(context.companyId, () => load(context));
}

async function load(context) {
  const list = document.getElementById('attendance-list');
  const date = document.getElementById('date-filter').value;
  const status = document.getElementById('status-filter').value;
  const siteId = document.getElementById('site-filter').value;

  if (!list) return;

  let query = supabase.from('attendance').select(`
    *,
    employees(first_name, last_name, employee_number),
    sites(name)
  `).eq('company_id', context.companyId).eq('work_date', date);

  if (status) query = query.eq('status', status);
  if (siteId) query = query.eq('site_id', siteId);

  const { data, error } = await query.order('check_in', { ascending: false });
  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty">
      <h3>Aucun pointage</h3>
      <p>Pour la date sélectionnée</p>
    </div>`;
    return;
  }

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr><th>Employé</th><th>Site</th><th>Arrivée</th><th>Sortie</th><th>Durée</th><th>Statut</th></tr>
        </thead>
        <tbody>
          ${data.map(r => {
            const dur = r.worked_minutes
              ? `${Math.floor(r.worked_minutes/60)}h${String(r.worked_minutes%60).padStart(2,'0')}`
              : '—';
            const ci = r.check_in ? new Date(r.check_in).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}) : '—';
            const co = r.check_out ? new Date(r.check_out).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}) : '—';
            return `
              <tr>
                <td>
                  <strong>${r.employees?.first_name || '?'} ${r.employees?.last_name || ''}</strong><br>
                  <small style="color:var(--pf-text-muted);">${r.employees?.employee_number || ''}</small>
                </td>
                <td>${r.sites?.name || '—'}</td>
                <td>${ci}</td>
                <td>${co}</td>
                <td><strong>${dur}</strong></td>
                <td>${badge(r.status)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function badge(status) {
  const map = {
    present: '<span class="badge badge-success">Présent</span>',
    absent: '<span class="badge badge-danger">Absent</span>',
    late: '<span class="badge badge-warning">Retard</span>',
    early_leave: '<span class="badge badge-warning">Sortie anticipée</span>',
    partial: '<span class="badge badge-info">Partiel</span>',
  };
  return map[status] || `<span class="badge badge-muted">${status}</span>`;
}

async function exportCsv(context) {
  const date = document.getElementById('date-filter').value;
  const { data } = await supabase.from('attendance').select(`
    *, employees(first_name, last_name, employee_number), sites(name)
  `).eq('company_id', context.companyId).eq('work_date', date);

  if (!data || data.length === 0) return;

  const headers = ['Employé', 'Matricule', 'Site', 'Arrivée', 'Sortie', 'Durée (min)', 'Statut'];
  const rows = data.map(r => [
    `${r.employees?.first_name || ''} ${r.employees?.last_name || ''}`.trim(),
    r.employees?.employee_number || '',
    r.sites?.name || '',
    r.check_in ? new Date(r.check_in).toLocaleTimeString('fr-FR') : '',
    r.check_out ? new Date(r.check_out).toLocaleTimeString('fr-FR') : '',
    r.worked_minutes || 0,
    r.status,
  ]);

  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pointify-presences-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

window.addEventListener('beforeunload', () => unsubscribe(channel));