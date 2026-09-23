import { supabase } from '../../config/supabase.js';
import { requireRole } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal } from '../../components/modal.js';
import { formatDateTime } from '../../utils/format.js';
import { debounce } from '../../utils/format.js';

let state = { search: '', action: '' };

export async function adminAuditLogsPage(app) {
  const profile = await requireRole(['super_admin']);
  if (!profile) return;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/admin/audit-logs')}
      <div class="main-content">
        ${renderTopbar(profile, 'Audit logs')}
        <main class="page">
          <div class="page-header">
            <h1>Journal d'audit</h1>
            <p>Traçabilité de toutes les opérations sensibles.</p>
          </div>
          <div class="toolbar">
            <input class="input" id="search" placeholder="Rechercher une action, entité…" />
            <input class="input" id="action-filter" placeholder="Filtrer par action…" style="max-width:200px;" />
          </div>
          <div id="logs-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
  document.getElementById('search').addEventListener('input', debounce((e) => { state.search = e.target.value; loadLogs(); }));
  document.getElementById('action-filter').addEventListener('input', debounce((e) => { state.action = e.target.value; loadLogs(); }));
  await loadLogs();
}

async function loadLogs() {
  const list = document.getElementById('logs-list');
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
  if (state.action) query = query.ilike('action', `%${state.action}%`);
  if (state.search) query = query.or(`entity_type.ilike.%${state.search}%,entity_id.ilike.%${state.search}%`);

  const { data, error } = await query;
  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }
  if (!data || data.length === 0) { list.innerHTML = `<div class="empty"><h3>Aucun log</h3></div>`; return; }

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>Date</th><th>Action</th><th>Entité</th><th>ID</th><th></th></tr></thead>
        <tbody>
          ${data.map(l => `
            <tr>
              <td>${formatDateTime(l.created_at)}</td>
              <td><span class="badge badge-info">${l.action}</span></td>
              <td>${l.entity_type || '—'}</td>
              <td><code style="font-size:12px;">${(l.entity_id || '').slice(0,8)}</code></td>
              <td><button class="icon-btn" data-view="${l.id}">👁</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  list.querySelectorAll('[data-view]').forEach(b =>
    b.addEventListener('click', () => {
      const log = data.find(x => x.id === b.dataset.view);
      openModal({
        title: 'Détail du log',
        body: `
          <div style="font-size:13px;">
            <p><strong>Action :</strong> ${log.action}</p>
            <p><strong>Entité :</strong> ${log.entity_type || '—'} (${log.entity_id || '—'})</p>
            <p><strong>Date :</strong> ${formatDateTime(log.created_at)}</p>
            <p><strong>User ID :</strong> ${log.user_id || '—'}</p>
            <p><strong>Company ID :</strong> ${log.company_id || '—'}</p>
            <p><strong>Anciennes valeurs :</strong></p>
            <pre style="background:#f3f4f6;padding:10px;border-radius:6px;font-size:12px;overflow:auto;">${JSON.stringify(log.old_values, null, 2) || '—'}</pre>
            <p><strong>Nouvelles valeurs :</strong></p>
            <pre style="background:#f3f4f6;padding:10px;border-radius:6px;font-size:12px;overflow:auto;">${JSON.stringify(log.new_values, null, 2) || '—'}</pre>
          </div>
        `,
        footer: `<button class="btn btn-secondary" data-close-modal>Fermer</button>`,
      });
      document.querySelector('[data-close-modal]').addEventListener('click', () => document.querySelector('.modal-overlay').remove());
    })
  );
}