import { supabase } from '../../config/supabase.js';
import { requireRole } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal, confirmModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { formatDate, debounce } from '../../utils/format.js';

let state = { search: '', status: '', page: 1, perPage: 10 };

export async function adminCompaniesPage(app) {
  const profile = await requireRole(['super_admin']);
  if (!profile) return;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/admin/companies')}
      <div class="main-content">
        ${renderTopbar(profile, 'Entreprises')}
        <main class="page">
          <div class="page-header">
            <h1>Entreprises</h1>
            <p>Gérez les entreprises clientes de la plateforme</p>
          </div>

          <div class="toolbar">
            <input type="text" class="input" id="search" placeholder="Rechercher par nom, email, ville…" />
            <select class="select input" id="status-filter">
              <option value="">Tous les statuts</option>
              <option value="active">Actives</option>
              <option value="suspended">Suspendues</option>
              <option value="pending">En attente</option>
            </select>
            <div class="toolbar-spacer"></div>
            <button class="btn btn-primary" id="new-company">+ Nouvelle entreprise</button>
          </div>

          <div id="companies-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();

  document.getElementById('new-company').addEventListener('click', () => openCompanyForm());
  document.getElementById('search').addEventListener('input', debounce((e) => {
    state.search = e.target.value;
    state.page = 1;
    loadCompanies();
  }));
  document.getElementById('status-filter').addEventListener('change', (e) => {
    state.status = e.target.value;
    state.page = 1;
    loadCompanies();
  });

  await loadCompanies();
}

async function loadCompanies() {
  const list = document.getElementById('companies-list');
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  let query = supabase.from('companies').select('*', { count: 'exact' });

  if (state.search) {
    query = query.or(`name.ilike.%${state.search}%,email.ilike.%${state.search}%,city.ilike.%${state.search}%`);
  }
  if (state.status) query = query.eq('status', state.status);

  const from = (state.page - 1) * state.perPage;
  const to = from + state.perPage - 1;

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty"><h3>Aucune entreprise</h3><p>Créez la première entreprise de la plateforme.</p></div>`;
    return;
  }

  const totalPages = Math.ceil((count || 0) / state.perPage);

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Email</th>
            <th>Ville / Pays</th>
            <th>Statut</th>
            <th>Créée le</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${data.map(c => `
            <tr>
              <td><strong>${c.name}</strong></td>
              <td>${c.email || '—'}</td>
              <td>${[c.city, c.country].filter(Boolean).join(', ') || '—'}</td>
              <td>${badgeStatus(c.status)}</td>
              <td>${formatDate(c.created_at)}</td>
              <td>
                <div class="table-actions">
                  <button class="icon-btn" title="Modifier" data-edit="${c.id}">✎</button>
                  <button class="icon-btn" title="${c.status === 'active' ? 'Suspendre' : 'Réactiver'}" data-toggle="${c.id}">${c.status === 'active' ? '⏸' : '▶'}</button>
                  <button class="icon-btn danger" title="Supprimer" data-del="${c.id}">🗑</button>
                  <button class="icon-btn" title="Accéder en tant qu'admin" data-access="${c.id}">🚪</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="pagination">
        <div>${count || 0} entreprise(s) — Page ${state.page} / ${totalPages}</div>
        <div class="pagination-controls">
          <button class="btn btn-secondary" ${state.page <= 1 ? 'disabled' : ''} data-page="prev">← Précédent</button>
          <button class="btn btn-secondary" ${state.page >= totalPages ? 'disabled' : ''} data-page="next">Suivant →</button>
        </div>
      </div>
    </div>
  `;

  list.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => openCompanyForm(data.find(c => c.id === btn.dataset.edit)))
  );
  list.querySelectorAll('[data-toggle]').forEach(btn =>
    btn.addEventListener('click', () => toggleCompany(data.find(c => c.id === btn.dataset.toggle)))
  );
  list.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', () => deleteCompany(data.find(c => c.id === btn.dataset.del)))
  );
  list.querySelectorAll('[data-access]').forEach(b =>
  b.addEventListener('click', async () => {
    const { setImpersonate } = await import('../../utils/company.js');
    setImpersonate(b.dataset.access);
    window.location.href = '/dashboard';
  })
);
  const prev = list.querySelector('[data-page="prev"]');
  const next = list.querySelector('[data-page="next"]');
  if (prev) prev.addEventListener('click', () => { state.page--; loadCompanies(); });
  if (next) next.addEventListener('click', () => { state.page++; loadCompanies(); });
}

function badgeStatus(status) {
  const map = {
    active: '<span class="badge badge-success">Active</span>',
    suspended: '<span class="badge badge-danger">Suspendue</span>',
    pending: '<span class="badge badge-warning">En attente</span>',
  };
  return map[status] || `<span class="badge badge-muted">${status}</span>`;
}

function openCompanyForm(company = null) {
  const isEdit = !!company;
  const c = company || {};
  const { close } = openModal({
    title: isEdit ? 'Modifier l\'entreprise' : 'Nouvelle entreprise',
    body: `
      <div class="form-group">
        <label class="label">Nom *</label>
        <input class="input" id="f-name" value="${c.name || ''}" required />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Email</label>
          <input class="input" type="email" id="f-email" value="${c.email || ''}" />
        </div>
        <div class="form-group">
          <label class="label">Téléphone</label>
          <input class="input" id="f-phone" value="${c.phone || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Pays</label>
          <input class="input" id="f-country" value="${c.country || ''}" />
        </div>
        <div class="form-group">
          <label class="label">Ville</label>
          <input class="input" id="f-city" value="${c.city || ''}" />
        </div>
      </div>
      <div class="form-group">
        <label class="label">Adresse</label>
        <input class="input" id="f-address" value="${c.address || ''}" />
      </div>
      <div class="form-group">
        <label class="label">Statut</label>
        <select class="input" id="f-status">
          <option value="active" ${c.status === 'active' ? 'selected' : ''}>Active</option>
          <option value="suspended" ${c.status === 'suspended' ? 'selected' : ''}>Suspendue</option>
          <option value="pending" ${c.status === 'pending' ? 'selected' : ''}>En attente</option>
        </select>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-cancel>Annuler</button>
      <button class="btn btn-primary" data-save>${isEdit ? 'Enregistrer' : 'Créer'}</button>
    `,
  });

  document.querySelector('[data-cancel]').addEventListener('click', close);
  document.querySelector('[data-save]').addEventListener('click', async () => {
    const payload = {
      name: document.getElementById('f-name').value.trim(),
      email: document.getElementById('f-email').value.trim() || null,
      phone: document.getElementById('f-phone').value.trim() || null,
      country: document.getElementById('f-country').value.trim() || null,
      city: document.getElementById('f-city').value.trim() || null,
      address: document.getElementById('f-address').value.trim() || null,
      status: document.getElementById('f-status').value,
    };
    if (!payload.name) { toast('Le nom est requis', 'error'); return; }

    let error;
    if (isEdit) {
      ({ error } = await supabase.from('companies').update(payload).eq('id', c.id));
    } else {
      ({ error } = await supabase.from('companies').insert(payload));
    }

    if (error) { toast(error.message, 'error'); return; }
    toast(isEdit ? 'Entreprise modifiée' : 'Entreprise créée', 'success');
    close();
    loadCompanies();
  });
}

async function toggleCompany(company) {
  const newStatus = company.status === 'active' ? 'suspended' : 'active';
  const { error } = await supabase.from('companies').update({ status: newStatus }).eq('id', company.id);
  if (error) { toast(error.message, 'error'); return; }
  toast(`Entreprise ${newStatus === 'active' ? 'réactivée' : 'suspendue'}`, 'success');
  loadCompanies();
}

function deleteCompany(company) {
  confirmModal(`Supprimer définitivement <strong>${company.name}</strong> et toutes ses données ?`, async () => {
    const { error } = await supabase.from('companies').delete().eq('id', company.id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Entreprise supprimée', 'success');
    loadCompanies();
  });
}