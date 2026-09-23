import { supabase } from '../../config/supabase.js';
import { requireRole } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal } from '../../components/modal.js';
import { formatDate, debounce } from '../../utils/format.js';
import { icon } from '../../components/icons.js';

let state = { search: '', status: '', companyId: '', page: 1, perPage: 20 };
let companiesCache = [];

export async function adminEmployeesPage(app) {
  const profile = await requireRole(['super_admin']);
  if (!profile) return;

  state = { search: '', status: '', companyId: '', page: 1, perPage: 20 };

  // Charge la liste des entreprises pour le filtre
  const { data: companies } = await supabase.from('companies').select('id, name').order('name');
  companiesCache = companies || [];

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/admin/employees')}
      <div class="main-content">
        ${renderTopbar(profile, 'Employés')}
        <main class="page">
          <div class="page-header">
            <h1>Employés</h1>
            <p>Tous les employés enregistrés sur la plateforme</p>
          </div>

          <div class="toolbar">
            <input class="input" id="search" placeholder="Rechercher par nom, email, matricule…" style="max-width:300px;" />
            <select class="input" id="company-filter" style="max-width:220px;">
              <option value="">Toutes les entreprises</option>
              ${companiesCache.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
            <select class="input" id="status-filter" style="max-width:180px;">
              <option value="">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
              <option value="suspended">Suspendus</option>
              <option value="terminated">Terminés</option>
            </select>
            <div class="toolbar-spacer"></div>
            <div style="font-size:13px;color:var(--pf-text-muted);" id="total-count"></div>
          </div>

          <div id="employees-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
  document.getElementById('search').addEventListener('input', debounce(e => { state.search = e.target.value; state.page = 1; load(); }));
  document.getElementById('company-filter').addEventListener('change', e => { state.companyId = e.target.value; state.page = 1; load(); });
  document.getElementById('status-filter').addEventListener('change', e => { state.status = e.target.value; state.page = 1; load(); });

  await load();
}

async function load() {
  const list = document.getElementById('employees-list');
  if (!list) return;
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  let query = supabase
    .from('employees')
    .select(`
      *,
      companies(id, name, status),
      sites(name),
      departments(name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (state.companyId) query = query.eq('company_id', state.companyId);
  if (state.status) query = query.eq('status', state.status);
  if (state.search) {
    query = query.or(`first_name.ilike.%${state.search}%,last_name.ilike.%${state.search}%,email.ilike.%${state.search}%,employee_number.ilike.%${state.search}%`);
  }

  const from = (state.page - 1) * state.perPage;
  const to = from + state.perPage - 1;

  const { data, count, error } = await query.range(from, to);

  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty">
      <div style="color:var(--pf-text-light);margin-bottom:12px;">${icon('userCheck',48)}</div>
      <h3>Aucun employé</h3><p>Aucun employé ne correspond aux filtres.</p>
    </div>`;
    return;
  }

  const totalPages = Math.ceil((count || 0) / state.perPage);
  document.getElementById('total-count').textContent = `${count || 0} employé(s)`;

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Employé</th>
            <th>Entreprise</th>
            <th>Site</th>
            <th>Département</th>
            <th>Compte</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${data.map(e => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px;">
                  <div style="width:36px;height:36px;border-radius:50%;background:var(--pf-blue-600);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">
                    ${e.first_name[0]}${e.last_name[0]}
                  </div>
                  <div>
                    <strong>${e.first_name} ${e.last_name}</strong><br>
                    <small style="color:var(--pf-text-muted);">${e.email || 'Pas d\'email'}</small>
                  </div>
                </div>
              </td>
              <td>
                ${e.companies?.name || '—'}
                ${e.companies?.status !== 'active' ? `<br><small style="color:var(--pf-danger);">(${e.companies?.status})</small>` : ''}
              </td>
              <td>${e.sites?.name || '—'}</td>
              <td>${e.departments?.name || '—'}</td>
              <td>
                ${e.user_id
                  ? '<span style="font-size:11px;color:#065f46;">● Actif</span>'
                  : '<span style="font-size:11px;color:#92400e;">⚠ Non activé</span>'}
              </td>
              <td>${statusBadge(e.status)}</td>
              <td>
                <button class="icon-btn" data-view="${e.id}" title="Voir détail">${icon('search',16)}</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="pagination">
        <div>Page ${state.page} / ${totalPages}</div>
        <div class="pagination-controls">
          <button class="btn btn-secondary" ${state.page <= 1 ? 'disabled' : ''} data-page="prev">← Précédent</button>
          <button class="btn btn-secondary" ${state.page >= totalPages ? 'disabled' : ''} data-page="next">Suivant →</button>
        </div>
      </div>
    </div>
  `;

  list.querySelectorAll('[data-view]').forEach(b =>
    b.addEventListener('click', () => viewEmployee(data.find(x => x.id === b.dataset.view)))
  );
  const prev = list.querySelector('[data-page="prev"]');
  const next = list.querySelector('[data-page="next"]');
  if (prev) prev.addEventListener('click', () => { state.page--; load(); });
  if (next) next.addEventListener('click', () => { state.page++; load(); });
}

function statusBadge(status) {
  const map = {
    active: '<span class="badge badge-success">Actif</span>',
    inactive: '<span class="badge badge-muted">Inactif</span>',
    suspended: '<span class="badge badge-warning">Suspendu</span>',
    terminated: '<span class="badge badge-danger">Terminé</span>',
  };
  return map[status] || `<span class="badge badge-muted">${status}</span>`;
}

async function viewEmployee(emp) {
  // Charge les dernières présences
  const { data: attendances } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', emp.id)
    .order('work_date', { ascending: false })
    .limit(10);

  // Stats globales
  const { data: allAtt } = await supabase
    .from('attendance')
    .select('status, worked_minutes')
    .eq('employee_id', emp.id);

  const totalDays = allAtt?.length || 0;
  const totalMinutes = (allAtt || []).reduce((s, a) => s + (a.worked_minutes || 0), 0);
  const lateDays = (allAtt || []).filter(a => a.status === 'late').length;
  const fmtH = (min) => `${Math.floor(min/60)}h${String(min%60).padStart(2,'0')}`;

  openModal({
    title: `${emp.first_name} ${emp.last_name}`,
    body: `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="width:72px;height:72px;border-radius:50%;background:var(--pf-gradient);color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.5rem;font-family:var(--pf-font-display);margin:0 auto 12px;">
          ${emp.first_name[0]}${emp.last_name[0]}
        </div>
        <div style="font-weight:700;font-size:1.1rem;">${emp.first_name} ${emp.last_name}</div>
        <div style="color:var(--pf-text-muted);font-size:13px;">${emp.position || 'Poste non défini'}</div>
        <div style="margin-top:10px;">${statusBadge(emp.status)}</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
        <div style="text-align:center;padding:12px;background:#f9fafb;border-radius:8px;">
          <div style="font-size:1.2rem;font-weight:800;">${totalDays}</div>
          <div style="font-size:11px;color:var(--pf-text-muted);">Jours</div>
        </div>
        <div style="text-align:center;padding:12px;background:#f9fafb;border-radius:8px;">
          <div style="font-size:1.2rem;font-weight:800;">${fmtH(totalMinutes)}</div>
          <div style="font-size:11px;color:var(--pf-text-muted);">Total heures</div>
        </div>
        <div style="text-align:center;padding:12px;background:#f9fafb;border-radius:8px;">
          <div style="font-size:1.2rem;font-weight:800;color:${lateDays > 0 ? 'var(--pf-warning)' : 'inherit'};">${lateDays}</div>
          <div style="font-size:11px;color:var(--pf-text-muted);">Retards</div>
        </div>
      </div>

      <div style="display:grid;gap:8px;font-size:13px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;padding:8px 12px;background:#f9fafb;border-radius:8px;">
          <span style="color:var(--pf-text-muted);">Entreprise</span>
          <strong>${emp.companies?.name || '—'}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 12px;background:#f9fafb;border-radius:8px;">
          <span style="color:var(--pf-text-muted);">Site</span>
          <strong>${emp.sites?.name || '—'}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 12px;background:#f9fafb;border-radius:8px;">
          <span style="color:var(--pf-text-muted);">Département</span>
          <strong>${emp.departments?.name || '—'}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 12px;background:#f9fafb;border-radius:8px;">
          <span style="color:var(--pf-text-muted);">Email</span>
          <strong>${emp.email || '—'}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 12px;background:#f9fafb;border-radius:8px;">
          <span style="color:var(--pf-text-muted);">Matricule</span>
          <strong>${emp.employee_number || '—'}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 12px;background:#f9fafb;border-radius:8px;">
          <span style="color:var(--pf-text-muted);">Embauche</span>
          <strong>${emp.hire_date ? formatDate(emp.hire_date) : '—'}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 12px;background:${emp.user_id ? '#d1fae5' : '#fef3c7'};border-radius:8px;">
          <span style="color:${emp.user_id ? '#065f46' : '#92400e'};">Compte</span>
          <strong style="color:${emp.user_id ? '#065f46' : '#92400e'};">${emp.user_id ? '✓ Activé' : '⚠ Non activé'}</strong>
        </div>
      </div>

      ${attendances && attendances.length > 0 ? `
        <div style="margin-top:16px;">
          <div style="font-size:11px;color:var(--pf-text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Derniers pointages</div>
          <table class="table" style="font-size:12px;">
            <thead><tr><th>Date</th><th>Arrivée</th><th>Sortie</th><th>Durée</th></tr></thead>
            <tbody>
              ${attendances.map(a => {
                const dur = a.worked_minutes ? fmtH(a.worked_minutes) : '—';
                return `
                  <tr>
                    <td>${formatDate(a.work_date)}</td>
                    <td>${a.check_in ? new Date(a.check_in).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                    <td>${a.check_out ? new Date(a.check_out).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                    <td>${dur}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    `,
    footer: `<button class="btn btn-secondary" data-close-modal>Fermer</button>`,
  });
  document.querySelector('[data-close-modal]').addEventListener('click', () => document.querySelector('.modal-overlay').remove());
}