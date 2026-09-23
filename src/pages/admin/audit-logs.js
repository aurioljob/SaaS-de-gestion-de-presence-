import { supabase } from '../../config/supabase.js';
import { requireRole } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal } from '../../components/modal.js';
import { formatDateTime, debounce } from '../../utils/format.js';
import { icon } from '../../components/icons.js';

let state = { search: '', action: '', page: 1, perPage: 50 };

export async function adminAuditLogsPage(app) {
  const profile = await requireRole(['super_admin']);
  if (!profile) return;

  state = { search: '', action: '', page: 1, perPage: 50 };

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/admin/audit-logs')}
      <div class="main-content">
        ${renderTopbar(profile, 'Audit logs')}
        <main class="page">
          <div class="page-header">
            <h1>Journal d'audit</h1>
            <p>Traçabilité complète des opérations sensibles</p>
          </div>

          <div class="toolbar">
            <input class="input" id="search" placeholder="Rechercher une entité, un ID…" style="max-width:300px;" />
            <input class="input" id="action-filter" placeholder="Filtrer par action (ex: company.create)" style="max-width:280px;" />
            <select class="input" id="entity-filter" style="max-width:200px;">
              <option value="">Toutes les entités</option>
              <option value="companies">Entreprises</option>
              <option value="plans">Plans</option>
              <option value="subscriptions">Abonnements</option>
              <option value="payments">Paiements</option>
              <option value="coupons">Coupons</option>
              <option value="employees">Employés</option>
              <option value="sites">Sites</option>
              <option value="attendance">Pointages</option>
            </select>
          </div>

          <div id="logs-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
  document.getElementById('search').addEventListener('input', debounce(e => { state.search = e.target.value; state.page = 1; load(); }));
  document.getElementById('action-filter').addEventListener('input', debounce(e => { state.action = e.target.value; state.page = 1; load(); }));
  document.getElementById('entity-filter').addEventListener('change', e => { state.entityFilter = e.target.value; state.page = 1; load(); });

  await load();
}

async function load() {
  const list = document.getElementById('logs-list');
  if (!list) return;
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  let query = supabase.from('audit_logs').select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (state.action) query = query.ilike('action', `%${state.action}%`);
  if (state.entityFilter) query = query.eq('entity_type', state.entityFilter);
  if (state.search) query = query.or(`entity_type.ilike.%${state.search}%,entity_id.ilike.%${state.search}%,action.ilike.%${state.search}%`);

  const from = (state.page - 1) * state.perPage;
  const to = from + state.perPage - 1;

  const { data, count, error } = await query.range(from, to);

  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }
  if (!data || data.length === 0) { list.innerHTML = `<div class="empty">
    <div style="color:var(--pf-text-light);margin-bottom:12px;">${icon('search',48)}</div>
    <h3>Aucun log</h3><p>Aucune activité correspondant aux filtres.</p></div>`; return; }

  const totalPages = Math.ceil((count || 0) / state.perPage);

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Action</th>
            <th>Entité</th>
            <th>ID</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${data.map(l => `
            <tr>
              <td style="white-space:nowrap;">${formatDateTime(l.created_at)}</td>
              <td><span class="badge ${actionBadge(l.action)}">${l.action}</span></td>
              <td>${l.entity_type || '—'}</td>
              <td><code style="font-size:11px;color:var(--pf-text-muted);">${(l.entity_id || '—').slice(0, 8)}</code></td>
              <td><button class="icon-btn" data-view="${l.id}" title="Voir détail">👁</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="pagination">
        <div>${count || 0} entrée(s) — Page ${state.page} / ${totalPages}</div>
        <div class="pagination-controls">
          <button class="btn btn-secondary" ${state.page <= 1 ? 'disabled' : ''} data-page="prev">← Précédent</button>
          <button class="btn btn-secondary" ${state.page >= totalPages ? 'disabled' : ''} data-page="next">Suivant →</button>
        </div>
      </div>
    </div>
  `;

  list.querySelectorAll('[data-view]').forEach(b =>
    b.addEventListener('click', () => showLogDetail(data.find(x => x.id === b.dataset.view)))
  );
  const prev = list.querySelector('[data-page="prev"]');
  const next = list.querySelector('[data-page="next"]');
  if (prev) prev.addEventListener('click', () => { state.page--; load(); });
  if (next) next.addEventListener('click', () => { state.page++; load(); });
}

function actionBadge(action) {
  if (action.includes('delete')) return 'badge-danger';
  if (action.includes('create') || action.includes('insert')) return 'badge-success';
  if (action.includes('update')) return 'badge-info';
  return 'badge-muted';
}

function showLogDetail(log) {
  const fmt = (obj) => obj ? JSON.stringify(obj, null, 2) : '—';

  openModal({
    title: 'Détail de l\'événement',
    body: `
      <div style="font-size:13px;line-height:1.8;">
        <div><strong>Action :</strong> <span class="badge ${actionBadge(log.action)}">${log.action}</span></div>
        <div><strong>Date :</strong> ${formatDateTime(log.created_at)}</div>
        <div><strong>Entité :</strong> ${log.entity_type || '—'} (${log.entity_id || '—'})</div>
        <div><strong>User ID :</strong> <code style="font-size:11px;">${log.user_id || '—'}</code></div>
        <div><strong>Company ID :</strong> <code style="font-size:11px;">${log.company_id || '—'}</code></div>
        ${log.ip_address ? `<div><strong>IP :</strong> ${log.ip_address}</div>` : ''}

        <div style="margin-top:16px;">
          <strong>Anciennes valeurs :</strong>
          <pre style="background:#f3f4f6;padding:12px;border-radius:8px;font-size:11px;overflow:auto;max-height:200px;margin-top:6px;">${fmt(log.old_values)}</pre>
        </div>
        <div style="margin-top:16px;">
          <strong>Nouvelles valeurs :</strong>
          <pre style="background:#f3f4f6;padding:12px;border-radius:8px;font-size:11px;overflow:auto;max-height:200px;margin-top:6px;">${fmt(log.new_values)}</pre>
        </div>
      </div>
    `,
    footer: `<button class="btn btn-secondary" data-close-modal>Fermer</button>`,
  });
  document.querySelector('[data-close-modal]').addEventListener('click', () => document.querySelector('.modal-overlay').remove());
}