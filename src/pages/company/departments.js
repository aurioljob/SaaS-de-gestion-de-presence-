import { supabase } from '../../config/supabase.js';
import { requireCompany as guardCompany } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal, confirmModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';

export async function companyDepartmentsPage(app) {
  const ctx = await guardCompany();
  if (!ctx) return;
  const { profile, context } = ctx;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/departments', 'company', {
  companyName: context.company.name,
  planName: context.plan?.name || 'Aucun plan',
  isImpersonating: context.isImpersonating,
})}
      <div class="main-content">
        ${renderTopbar(profile, 'Départements',{
  isImpersonating: context.isImpersonating,
  companyName: context.company.name,
})}
        <main class="page">
          <div class="page-header"><h1>Départements</h1><p>Organisez vos équipes par service.</p></div>
          <div class="toolbar">
            <div class="toolbar-spacer"></div>
            <button class="btn btn-primary" id="new-dep">+ Nouveau département</button>
          </div>
          <div id="deps-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
  document.getElementById('new-dep').addEventListener('click', () => openForm(null, context));
  await load(context);
}

async function load(context) {
  const list = document.getElementById('deps-list');
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  const { data, error } = await supabase.from('departments')
    .select('*').eq('company_id', context.companyId).order('name');

  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }
  if (!data || data.length === 0) { list.innerHTML = `<div class="empty"><h3>Aucun département</h3></div>`; return; }

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>Nom</th><th>Créé le</th><th></th></tr></thead>
        <tbody>
          ${data.map(d => `
            <tr>
              <td><strong>${d.name}</strong></td>
              <td>${new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
              <td>
                <div class="table-actions">
                  <button class="icon-btn" data-edit="${d.id}">✎</button>
                  <button class="icon-btn danger" data-del="${d.id}">🗑</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  list.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => openForm(data.find(x => x.id === b.dataset.edit), context))
  );
  list.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => {
      const d = data.find(x => x.id === b.dataset.del);
      confirmModal(`Supprimer <strong>${d.name}</strong> ?`, async () => {
        const { error } = await supabase.from('departments').delete().eq('id', d.id);
        if (error) { toast(error.message, 'error'); return; }
        toast('Département supprimé', 'success');
        load(context);
      });
    })
  );
}

function openForm(dep, context) {
  const isEdit = !!dep;
  const { close } = openModal({
    title: isEdit ? 'Modifier' : 'Nouveau département',
    body: `
      <div class="form-group">
        <label class="label">Nom *</label>
        <input class="input" id="d-name" value="${dep?.name || ''}" />
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-cancel>Annuler</button>
      <button class="btn btn-primary" data-save>${isEdit ? 'Enregistrer' : 'Créer'}</button>
    `,
  });

  document.querySelector('[data-cancel]').addEventListener('click', close);
  document.querySelector('[data-save]').addEventListener('click', async () => {
    const name = document.getElementById('d-name').value.trim();
    if (!name) { toast('Nom requis', 'error'); return; }

    let error;
    if (isEdit) ({ error } = await supabase.from('departments').update({ name }).eq('id', dep.id));
    else ({ error } = await supabase.from('departments').insert({ name, company_id: context.companyId }));

    if (error) { toast(error.message, 'error'); return; }
    toast(isEdit ? 'Modifié' : 'Créé', 'success');
    close();
    load(context);
  });
}