import { supabase } from '../../config/supabase.js';
import {  checkPlanLimit } from '../../utils/company.js';
import { requireCompany as guardCompany } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal, confirmModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { formatDate, debounce } from '../../utils/format.js';

let state = { search: '', status: '', siteId: '' };

export async function companyEmployeesPage(app) {
  const ctx = await guardCompany();
  if (!ctx) return;
  const { profile, context } = ctx;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/employees', 'company', {
  companyName: context.company.name,
  planName: context.plan?.name || 'Aucun plan',
  isImpersonating: context.isImpersonating,
})}
      <div class="main-content">
        ${renderTopbar(profile, 'Employés',{
  isImpersonating: context.isImpersonating,
  companyName: context.company.name,
})}
        <main class="page">
          <div class="page-header">
            <h1>Employés</h1>
            <p>Gérez les membres de votre équipe</p>
          </div>

          <div class="toolbar">
            <input class="input" id="search" placeholder="Rechercher un employé…" />
            <select class="input" id="status-filter" style="max-width:180px;">
              <option value="">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
              <option value="suspended">Suspendus</option>
              <option value="terminated">Terminés</option>
            </select>
            <select class="input" id="site-filter" style="max-width:180px;">
              <option value="">Tous les sites</option>
            </select>
            <div class="toolbar-spacer"></div>
            <button class="btn btn-primary" id="new-emp">+ Ajouter un employé</button>
          </div>

          <div id="employees-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();

  const { data: sites } = await supabase.from('sites').select('id, name')
    .eq('company_id', context.companyId).order('name');
  const siteFilter = document.getElementById('site-filter');
  (sites || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.name;
    siteFilter.appendChild(opt);
  });

  document.getElementById('new-emp').addEventListener('click', () => openEmployeeForm(null, context));
  document.getElementById('search').addEventListener('input', debounce(e => { state.search = e.target.value; loadEmployees(context); }));
  document.getElementById('status-filter').addEventListener('change', e => { state.status = e.target.value; loadEmployees(context); });
  siteFilter.addEventListener('change', e => { state.siteId = e.target.value; loadEmployees(context); });

  await loadEmployees(context);
}

async function loadEmployees(context) {
  const list = document.getElementById('employees-list');
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  let query = supabase.from('employees')
    .select(`*, departments(name), sites(name)`)
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false });

  if (state.search) {
    query = query.or(`first_name.ilike.%${state.search}%,last_name.ilike.%${state.search}%,email.ilike.%${state.search}%`);
  }
  if (state.status) query = query.eq('status', state.status);
  if (state.siteId) query = query.eq('site_id', state.siteId);

  const { data, error } = await query;
  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }

  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty">
      <h3>Aucun employé</h3>
      <p>Commencez par ajouter votre premier employé.</p>
    </div>`;
    return;
  }

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr><th>Nom</th><th>Email</th><th>Poste</th><th>Département</th><th>Site</th><th>Statut</th><th></th></tr>
        </thead>
        <tbody>
          ${data.map(e => `
            <tr>
              <td><strong>${e.first_name} ${e.last_name}</strong><br><small style="color:var(--pf-text-muted);">${e.employee_number || ''}</small></td>
              <td>${e.email || '—'}<br><small style="color:var(--pf-text-muted);">${e.phone || ''}</small></td>
              <td>${e.position || '—'}</td>
              <td>${e.departments?.name || '—'}</td>
              <td>${e.sites?.name || '—'}</td>
              <td>${badge(e.status)}</td>
              <td>
                <div class="table-actions">
                  <button class="icon-btn" data-edit="${e.id}">✎</button>
                  <button class="icon-btn danger" data-del="${e.id}">🗑</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  list.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => openEmployeeForm(data.find(x => x.id === b.dataset.edit), context))
  );
  list.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => {
      const e = data.find(x => x.id === b.dataset.del);
      confirmModal(`Supprimer <strong>${e.first_name} ${e.last_name}</strong> ?`, async () => {
        const { error } = await supabase.from('employees').delete().eq('id', e.id);
        if (error) { toast(error.message, 'error'); return; }
        toast('Employé supprimé', 'success');
        loadEmployees(context);
      });
    })
  );
}

function badge(status) {
  const map = {
    active: '<span class="badge badge-success">Actif</span>',
    inactive: '<span class="badge badge-muted">Inactif</span>',
    suspended: '<span class="badge badge-warning">Suspendu</span>',
    terminated: '<span class="badge badge-danger">Terminé</span>',
  };
  return map[status] || `<span class="badge badge-muted">${status}</span>`;
}

async function openEmployeeForm(emp, context) {
  const isEdit = !!emp;
  const e = emp || {};

  const [{ data: sites }, { data: deps }] = await Promise.all([
    supabase.from('sites').select('id, name').eq('company_id', context.companyId).order('name'),
    supabase.from('departments').select('id, name').eq('company_id', context.companyId).order('name'),
  ]);

  const { close } = openModal({
    title: isEdit ? 'Modifier l\'employé' : 'Nouvel employé',
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="label">Prénom *</label>
          <input class="input" id="e-first" value="${e.first_name || ''}" />
        </div>
        <div class="form-group">
          <label class="label">Nom *</label>
          <input class="input" id="e-last" value="${e.last_name || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Email</label>
          <input class="input" type="email" id="e-email" value="${e.email || ''}" />
        </div>
        <div class="form-group">
          <label class="label">Téléphone</label>
          <input class="input" id="e-phone" value="${e.phone || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Matricule</label>
          <input class="input" id="e-num" value="${e.employee_number || ''}" />
        </div>
        <div class="form-group">
          <label class="label">Poste</label>
          <input class="input" id="e-pos" value="${e.position || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Département</label>
          <select class="input" id="e-dep">
            <option value="">—</option>
            ${(deps || []).map(d => `<option value="${d.id}" ${d.id === e.department_id ? 'selected' : ''}>${d.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="label">Site principal</label>
          <select class="input" id="e-site">
            <option value="">—</option>
            ${(sites || []).map(s => `<option value="${s.id}" ${s.id === e.site_id ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Date d'embauche</label>
          <input class="input" type="date" id="e-hire" value="${e.hire_date || ''}" />
        </div>
        <div class="form-group">
          <label class="label">Statut</label>
          <select class="input" id="e-status">
            ${['active','inactive','suspended','terminated'].map(s =>
              `<option value="${s}" ${s === (e.status || 'active') ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-cancel>Annuler</button>
      <button class="btn btn-primary" data-save>${isEdit ? 'Enregistrer' : 'Ajouter'}</button>
    `,
  });

  document.querySelector('[data-cancel]').addEventListener('click', close);
  document.querySelector('[data-save]').addEventListener('click', async () => {
    // Vérification de la limite pour les nouveaux
    if (!isEdit) {
      const limit = await checkPlanLimit('employees');
      if (!limit.allowed) {
        toast(`Limite atteinte : ${limit.current}/${limit.max} employés`, 'error');
        return;
      }
    }

    const payload = {
      company_id: context.companyId,
      first_name: document.getElementById('e-first').value.trim(),
      last_name: document.getElementById('e-last').value.trim(),
      email: document.getElementById('e-email').value.trim() || null,
      phone: document.getElementById('e-phone').value.trim() || null,
      employee_number: document.getElementById('e-num').value.trim() || null,
      position: document.getElementById('e-pos').value.trim() || null,
      department_id: document.getElementById('e-dep').value || null,
      site_id: document.getElementById('e-site').value || null,
      hire_date: document.getElementById('e-hire').value || null,
      status: document.getElementById('e-status').value,
    };

    if (!payload.first_name || !payload.last_name) { toast('Prénom et nom requis', 'error'); return; }

    let error;
    if (isEdit) ({ error } = await supabase.from('employees').update(payload).eq('id', e.id));
    else ({ error } = await supabase.from('employees').insert(payload));

    if (error) { toast(error.message, 'error'); return; }
    toast(isEdit ? 'Employé modifié' : 'Employé ajouté', 'success');
    close();
    loadEmployees(context);
  });
}