import { supabase } from '../../config/supabase.js';
import { requireRole } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal, confirmModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { formatDate, debounce } from '../../utils/format.js';
import { icon } from '../../components/icons.js';
import { logAction } from '../../utils/audit.js';

let state = { search: '', role: '', page: 1, perPage: 20 };

export async function adminUsersPage(app) {
  const profile = await requireRole(['super_admin']);
  if (!profile) return;

  state = { search: '', role: '', page: 1, perPage: 20 };

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/admin/users')}
      <div class="main-content">
        ${renderTopbar(profile, 'Utilisateurs')}
        <main class="page">
          <div class="page-header">
            <h1>Utilisateurs</h1>
            <p>Tous les comptes de la plateforme</p>
          </div>

          <div class="toolbar">
            <input class="input" id="search" placeholder="Rechercher par nom ou email…" style="max-width:300px;" />
            <select class="input" id="role-filter" style="max-width:200px;">
              <option value="">Tous les rôles</option>
              <option value="super_admin">Super Admin</option>
              <option value="company_owner">Propriétaire</option>
              <option value="company_admin">Admin entreprise</option>
              <option value="supervisor">Superviseur</option>
              <option value="employee">Employé</option>
            </select>
            <div class="toolbar-spacer"></div>
            <div style="font-size:13px;color:var(--pf-text-muted);" id="total-count"></div>
          </div>

          <div id="users-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
  document.getElementById('search').addEventListener('input', debounce(e => { state.search = e.target.value; state.page = 1; load(); }));
  document.getElementById('role-filter').addEventListener('change', e => { state.role = e.target.value; state.page = 1; load(); });

  await load();
}

async function load() {
  const list = document.getElementById('users-list');
  if (!list) return;
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  // Requête : profiles + company_members + companies
  let query = supabase
    .from('profiles')
    .select(`
      id, email, full_name, phone, avatar_url, role, created_at,
      company_members(company_id, role, status, companies(id, name, status))
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (state.role) query = query.eq('role', state.role);
  if (state.search) {
    query = query.or(`email.ilike.%${state.search}%,full_name.ilike.%${state.search}%`);
  }

  const from = (state.page - 1) * state.perPage;
  const to = from + state.perPage - 1;

  const { data, count, error } = await query.range(from, to);

  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty">
      <div style="color:var(--pf-text-light);margin-bottom:12px;">${icon('users',48)}</div>
      <h3>Aucun utilisateur</h3><p>Aucun compte ne correspond aux filtres.</p>
    </div>`;
    return;
  }

  const totalPages = Math.ceil((count || 0) / state.perPage);
  document.getElementById('total-count').textContent = `${count || 0} utilisateur(s)`;

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Utilisateur</th>
            <th>Rôle</th>
            <th>Entreprise</th>
            <th>Inscrit le</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${data.map(u => {
            const member = u.company_members?.[0];
            const company = member?.companies;
            return `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:36px;height:36px;border-radius:50%;background:var(--pf-gradient);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">
                      ${getInitials(u.full_name, u.email)}
                    </div>
                    <div>
                      <strong>${u.full_name || '(sans nom)'}</strong><br>
                      <small style="color:var(--pf-text-muted);">${u.email}</small>
                    </div>
                  </div>
                </td>
                <td>${roleBadge(u.role)}</td>
                <td>
                  ${company
                    ? `<strong>${company.name}</strong>${company.status !== 'active' ? `<br><small style="color:var(--pf-danger);">(${company.status})</small>` : ''}`
                    : '<span style="color:var(--pf-text-muted);">—</span>'}
                </td>
                <td>${formatDate(u.created_at)}</td>
                <td>
                  <div class="table-actions">
                    <button class="icon-btn" data-view="${u.id}" title="Voir détail">${icon('search',16)}</button>
                    ${u.role !== 'super_admin' ? `<button class="icon-btn danger" data-del="${u.id}" title="Supprimer">${icon('x',16)}</button>` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
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
    b.addEventListener('click', () => viewUser(data.find(x => x.id === b.dataset.view)))
  );
  list.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => deleteUser(data.find(x => x.id === b.dataset.del)))
  );
  const prev = list.querySelector('[data-page="prev"]');
  const next = list.querySelector('[data-page="next"]');
  if (prev) prev.addEventListener('click', () => { state.page--; load(); });
  if (next) next.addEventListener('click', () => { state.page++; load(); });
}

function getInitials(name, email) {
  if (name) return name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  return (email || '?')[0].toUpperCase();
}

function roleBadge(role) {
  const map = {
    super_admin: '<span class="badge" style="background:#7c3aed;color:white;">Super Admin</span>',
    company_owner: '<span class="badge badge-info">Propriétaire</span>',
    company_admin: '<span class="badge badge-info">Admin</span>',
    supervisor: '<span class="badge badge-warning">Superviseur</span>',
    employee: '<span class="badge badge-muted">Employé</span>',
  };
  return map[role] || `<span class="badge badge-muted">${role}</span>`;
}

async function viewUser(user) {
  // Charge plus d'infos : entreprise, employé lié, historique
  const [{ data: members }, { data: employeeData }, { data: attendances }] = await Promise.all([
    supabase.from('company_members').select('*, companies(*)').eq('user_id', user.id),
    supabase.from('employees').select('*, sites(name), departments(name), companies(name)').eq('user_id', user.id).maybeSingle(),
    supabase.from('attendance').select('*').eq('employee_id', (await supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle()).data?.id || 'none').order('work_date', { ascending: false }).limit(10),
  ]);

  const emp = employeeData;

  openModal({
    title: 'Détail utilisateur',
    body: `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="width:72px;height:72px;border-radius:50%;background:var(--pf-gradient);color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.5rem;font-family:var(--pf-font-display);margin:0 auto 12px;">
          ${getInitials(user.full_name, user.email)}
        </div>
        <div style="font-size:1.1rem;font-weight:700;">${user.full_name || '(sans nom)'}</div>
        <div style="color:var(--pf-text-muted);font-size:13px;">${user.email}</div>
        <div style="margin-top:10px;">${roleBadge(user.role)}</div>
      </div>

      <div style="display:grid;gap:12px;font-size:13px;">
        <div style="padding:10px;background:#f9fafb;border-radius:8px;">
          <div style="font-size:11px;color:var(--pf-text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Inscrit le</div>
          <div>${formatDate(user.created_at)}</div>
        </div>

        ${emp ? `
          <div style="padding:10px;background:#f9fafb;border-radius:8px;">
            <div style="font-size:11px;color:var(--pf-text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">Fiche employé</div>
            <div><strong>${emp.first_name} ${emp.last_name}</strong> — ${emp.position || 'Poste non défini'}</div>
            <div style="color:var(--pf-text-muted);font-size:12px;margin-top:2px;">
              ${emp.companies?.name || ''} · ${emp.sites?.name || ''} · ${emp.departments?.name || ''}
            </div>
            <div style="margin-top:6px;">
              Statut : ${emp.status === 'active' ? '<span class="badge badge-success">Actif</span>' : `<span class="badge badge-muted">${emp.status}</span>`}
            </div>
          </div>
        ` : '<div style="padding:10px;background:#fef3c7;border-radius:8px;font-size:12px;color:#92400e;">⚠️ Aucune fiche employé associée à ce compte</div>'}

        ${members && members.length > 0 ? `
          <div style="padding:10px;background:#f9fafb;border-radius:8px;">
            <div style="font-size:11px;color:var(--pf-text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Entreprises</div>
            ${members.map(m => `
              <div style="margin-bottom:6px;">
                <strong>${m.companies?.name || '—'}</strong>
                <span style="color:var(--pf-text-muted);font-size:12px;"> — ${m.role}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${attendances && attendances.length > 0 ? `
          <div style="padding:10px;background:#f9fafb;border-radius:8px;">
            <div style="font-size:11px;color:var(--pf-text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Derniers pointages</div>
            ${attendances.slice(0, 5).map(a => `
              <div style="font-size:12px;display:flex;justify-content:space-between;padding:3px 0;">
                <span>${formatDate(a.work_date)}</span>
                <span style="color:var(--pf-text-muted);">${a.check_in ? new Date(a.check_in).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '—'}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `,
    footer: `<button class="btn btn-secondary" data-close-modal>Fermer</button>`,
  });
  document.querySelector('[data-close-modal]').addEventListener('click', () => document.querySelector('.modal-overlay').remove());
}

function deleteUser(user) {
  confirmModal(
    `Supprimer définitivement <strong>${user.full_name || user.email}</strong> ?<br><br>
    <small style="color:var(--pf-text-muted);">Cette action supprime son compte, sa fiche employé et ses pointages. Irréversible.</small>`,
    async () => {
      // Suppression via l'API Supabase Admin (nécessite service_role) OU
      // On supprime uniquement le profil, l'auth reste (à gérer côté Supabase)
      // Pour la V1 pédagogique, on supprime le profil + employee
      const { error: empErr } = await supabase.from('employees').delete().eq('user_id', user.id);
      const { error: memErr } = await supabase.from('company_members').delete().eq('user_id', user.id);
      const { error: profErr } = await supabase.from('profiles').delete().eq('id', user.id);

      if (empErr || memErr || profErr) {
        toast('Erreur : ' + (empErr?.message || memErr?.message || profErr?.message), 'error');
        return;
      }

      // Log l'action
      await logAction({
        action: 'user.delete',
        entity_type: 'profiles',
        entity_id: user.id,
        old_values: { email: user.email, role: user.role },
      });

      toast('Utilisateur supprimé', 'success');
      load();
    }
  );
}