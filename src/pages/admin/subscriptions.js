import { supabase } from '../../config/supabase.js';
import { requireRole } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { formatDate, formatMoney } from '../../utils/format.js';

export async function adminSubscriptionsPage(app) {
  const profile = await requireRole(['super_admin']);
  if (!profile) return;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/admin/subscriptions')}
      <div class="main-content">
        ${renderTopbar(profile, 'Abonnements')}
        <main class="page">
          <div class="page-header">
            <h1>Abonnements</h1>
            <p>Suivi des souscriptions des entreprises clientes.</p>
          </div>
          <div class="toolbar">
            <select class="input" id="status-filter" style="max-width:200px;">
              <option value="">Tous les statuts</option>
              <option value="trial">Essai</option>
              <option value="active">Actifs</option>
              <option value="past_due">En retard</option>
              <option value="cancelled">Annulés</option>
              <option value="expired">Expirés</option>
              <option value="suspended">Suspendus</option>
            </select>
          </div>
          <div id="subs-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
  document.getElementById('status-filter').addEventListener('change', () => loadSubs());
  await loadSubs();
}

async function loadSubs() {
  const list = document.getElementById('subs-list');
  const status = document.getElementById('status-filter').value;
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  let query = supabase.from('subscriptions').select(`
    *,
    companies(name, email),
    plans(name, currency)
  `).order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }
  if (!data || data.length === 0) { list.innerHTML = `<div class="empty"><h3>Aucun abonnement</h3></div>`; return; }

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr><th>Entreprise</th><th>Plan</th><th>Cycle</th><th>Prix</th><th>Statut</th><th>Expire le</th><th></th></tr>
        </thead>
        <tbody>
          ${data.map(s => `
            <tr>
              <td><strong>${s.companies?.name || '—'}</strong><br><small style="color:var(--pf-text-muted);">${s.companies?.email || ''}</small></td>
              <td>${s.plans?.name || '—'}</td>
              <td>${s.billing_cycle === 'monthly' ? 'Mensuel' : 'Annuel'}</td>
              <td>${formatMoney(s.price, s.currency)}</td>
              <td>${badge(s.status)}</td>
              <td>${formatDate(s.expires_at)}</td>
              <td>
                <div class="table-actions">
                  <button class="icon-btn" data-edit="${s.id}" title="Modifier">✎</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  list.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => openSubForm(data.find(s => s.id === b.dataset.edit)))
  );
}

function badge(status) {
  const map = {
    trial: '<span class="badge badge-info">Essai</span>',
    active: '<span class="badge badge-success">Actif</span>',
    past_due: '<span class="badge badge-warning">En retard</span>',
    cancelled: '<span class="badge badge-muted">Annulé</span>',
    expired: '<span class="badge badge-danger">Expiré</span>',
    suspended: '<span class="badge badge-danger">Suspendu</span>',
  };
  return map[status] || `<span class="badge badge-muted">${status}</span>`;
}

async function openSubForm(sub) {
  const { data: plans } = await supabase.from('plans').select('*').eq('is_active', true);

  const { close } = openModal({
    title: 'Modifier l\'abonnement',
    body: `
      <div class="form-group">
        <label class="label">Plan</label>
        <select class="input" id="s-plan">
          ${(plans || []).map(p => `<option value="${p.id}" ${p.id === sub.plan_id ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="label">Statut</label>
        <select class="input" id="s-status">
          ${['trial','active','past_due','cancelled','expired','suspended'].map(s =>
            `<option value="${s}" ${s === sub.status ? 'selected' : ''}>${s}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="label">Date d'expiration</label>
        <input class="input" type="date" id="s-exp" value="${sub.expires_at ? sub.expires_at.slice(0,10) : ''}" />
      </div>
      <div class="form-group">
        <label class="label"><input type="checkbox" id="s-renew" ${sub.auto_renew ? 'checked' : ''}/> Renouvellement automatique</label>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-cancel>Annuler</button>
      <button class="btn btn-primary" data-save>Enregistrer</button>
    `,
  });

  document.querySelector('[data-cancel]').addEventListener('click', close);
  document.querySelector('[data-save]').addEventListener('click', async () => {
    const exp = document.getElementById('s-exp').value;
    const payload = {
      plan_id: document.getElementById('s-plan').value,
      status: document.getElementById('s-status').value,
      expires_at: exp ? new Date(exp).toISOString() : null,
      auto_renew: document.getElementById('s-renew').checked,
    };
    const { error } = await supabase.from('subscriptions').update(payload).eq('id', sub.id);
    if (error) { toast(error.message, 'error'); return; }
    toast('Abonnement mis à jour', 'success');
    close();
    loadSubs();
  });
}