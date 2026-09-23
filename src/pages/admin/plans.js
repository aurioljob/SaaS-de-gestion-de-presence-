import { supabase } from '../../config/supabase.js';
import { requireRole } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal, confirmModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { formatMoney } from '../../utils/format.js';

export async function adminPlansPage(app) {
  const profile = await requireRole(['super_admin']);
  if (!profile) return;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/admin/plans')}
      <div class="main-content">
        ${renderTopbar(profile, 'Plans tarifaires')}
        <main class="page">
          <div class="page-header">
            <h1>Plans tarifaires</h1>
            <p>Créez et modifiez les plans. Aucun prix n'est codé en dur.</p>
          </div>
          <div class="toolbar">
            <div class="toolbar-spacer"></div>
            <button class="btn btn-primary" id="new-plan">+ Nouveau plan</button>
          </div>
          <div id="plans-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
  document.getElementById('new-plan').addEventListener('click', () => openPlanForm());
  await loadPlans();
}

async function loadPlans() {
  const list = document.getElementById('plans-list');
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  const { data: plans, error } = await supabase.from('plans').select('*').order('monthly_price');
  const { data: features } = await supabase.from('features').select('*').order('name');
  const { data: planFeatures } = await supabase.from('plan_features').select('*');

  if (error) {
    list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`;
    return;
  }

  if (!plans || plans.length === 0) {
    list.innerHTML = `<div class="empty"><h3>Aucun plan</h3><p>Créez votre premier plan tarifaire.</p></div>`;
    return;
  }

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Mensuel</th>
            <th>Annuel</th>
            <th>Employés</th>
            <th>Sites</th>
            <th>Admins</th>
            <th>Historique</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${plans.map(p => `
            <tr>
              <td><strong>${p.name}</strong><br><small style="color:var(--pf-text-muted);">${p.description || ''}</small></td>
              <td>${formatMoney(p.monthly_price, p.currency)}</td>
              <td>${formatMoney(p.yearly_price, p.currency)}</td>
              <td>${p.max_employees}</td>
              <td>${p.max_sites}</td>
              <td>${p.max_admins}</td>
              <td>${p.history_days} j</td>
              <td>${p.is_active ? '<span class="badge badge-success">Actif</span>' : '<span class="badge badge-muted">Inactif</span>'}</td>
              <td>
                <div class="table-actions">
                  <button class="icon-btn" title="Modifier" data-edit="${p.id}">✎</button>
                  <button class="icon-btn" title="Fonctionnalités" data-feat="${p.id}">✨</button>
                  <button class="icon-btn danger" title="Supprimer" data-del="${p.id}">🗑</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  list.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => openPlanForm(plans.find(p => p.id === btn.dataset.edit)))
  );
  list.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', () => deletePlan(plans.find(p => p.id === btn.dataset.del)))
  );
  list.querySelectorAll('[data-feat]').forEach(btn =>
    btn.addEventListener('click', () => openFeaturesLink(
      plans.find(p => p.id === btn.dataset.feat), features || [], planFeatures || []
    ))
  );
}

function openPlanForm(plan = null) {
  const isEdit = !!plan;
  const p = plan || {};
  const { close } = openModal({
    title: isEdit ? 'Modifier le plan' : 'Nouveau plan',
    body: `
      <div class="form-group">
        <label class="label">Nom *</label>
        <input class="input" id="p-name" value="${p.name || ''}" placeholder="STARTER" />
      </div>
      <div class="form-group">
        <label class="label">Description</label>
        <input class="input" id="p-desc" value="${p.description || ''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Prix mensuel</label>
          <input class="input" type="number" id="p-monthly" value="${p.monthly_price || 0}" />
        </div>
        <div class="form-group">
          <label class="label">Prix annuel</label>
          <input class="input" type="number" id="p-yearly" value="${p.yearly_price || 0}" />
        </div>
      </div>
      <div class="form-group">
        <label class="label">Devise</label>
        <input class="input" id="p-currency" value="${p.currency || 'XAF'}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Max employés</label>
          <input class="input" type="number" id="p-emp" value="${p.max_employees || 5}" />
        </div>
        <div class="form-group">
          <label class="label">Max sites</label>
          <input class="input" type="number" id="p-sites" value="${p.max_sites || 1}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Max admins</label>
          <input class="input" type="number" id="p-admins" value="${p.max_admins || 1}" />
        </div>
        <div class="form-group">
          <label class="label">Historique (jours)</label>
          <input class="input" type="number" id="p-history" value="${p.history_days || 30}" />
        </div>
      </div>
      <div class="form-group">
        <label class="label"><input type="checkbox" id="p-active" ${p.is_active !== false ? 'checked' : ''}/> Actif</label>
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
      name: document.getElementById('p-name').value.trim().toUpperCase(),
      description: document.getElementById('p-desc').value.trim() || null,
      monthly_price: Number(document.getElementById('p-monthly').value),
      yearly_price: Number(document.getElementById('p-yearly').value),
      currency: document.getElementById('p-currency').value.trim() || 'XAF',
      max_employees: Number(document.getElementById('p-emp').value),
      max_sites: Number(document.getElementById('p-sites').value),
      max_admins: Number(document.getElementById('p-admins').value),
      history_days: Number(document.getElementById('p-history').value),
      is_active: document.getElementById('p-active').checked,
    };
    if (!payload.name) { toast('Le nom est requis', 'error'); return; }

    let error;
    if (isEdit) ({ error } = await supabase.from('plans').update(payload).eq('id', p.id));
    else ({ error } = await supabase.from('plans').insert(payload));

    if (error) { toast(error.message, 'error'); return; }
    toast(isEdit ? 'Plan modifié' : 'Plan créé', 'success');
    close();
    loadPlans();
  });
}

function openFeaturesLink(plan, features, planFeatures) {
  const current = planFeatures.filter(pf => pf.plan_id === plan.id);

  const body = features.map(f => {
    const link = current.find(pf => pf.feature_id === f.id);
    const checked = link?.enabled ? 'checked' : '';
    return `
      <div class="form-group" style="display:flex;align-items:center;gap:10px;">
        <input type="checkbox" id="feat-${f.id}" ${checked} />
        <label for="feat-${f.id}" style="margin:0;cursor:pointer;">
          <strong>${f.name}</strong>
          <div style="font-size:12px;color:var(--pf-text-muted);">${f.description || f.key}</div>
        </label>
      </div>
    `;
  }).join('');

  const { close } = openModal({
    title: `Fonctionnalités — ${plan.name}`,
    body: body || '<p>Aucune fonctionnalité définie.</p>',
    footer: `
      <button class="btn btn-secondary" data-cancel>Annuler</button>
      <button class="btn btn-primary" data-save>Enregistrer</button>
    `,
  });

  document.querySelector('[data-cancel]').addEventListener('click', close);
  document.querySelector('[data-save]').addEventListener('click', async () => {
    for (const f of features) {
      const checked = document.getElementById(`feat-${f.id}`).checked;
      const existing = current.find(pf => pf.feature_id === f.id);
      if (checked && !existing) {
        await supabase.from('plan_features').insert({ plan_id: plan.id, feature_id: f.id, enabled: true });
      } else if (checked && existing && !existing.enabled) {
        await supabase.from('plan_features').update({ enabled: true }).eq('id', existing.id);
      } else if (!checked && existing) {
        await supabase.from('plan_features').delete().eq('id', existing.id);
      }
    }
    toast('Fonctionnalités mises à jour', 'success');
    close();
    loadPlans();
  });
}

function deletePlan(plan) {
  confirmModal(`Supprimer le plan <strong>${plan.name}</strong> ?`, async () => {
    const { error } = await supabase.from('plans').delete().eq('id', plan.id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Plan supprimé', 'success');
    loadPlans();
  });
}