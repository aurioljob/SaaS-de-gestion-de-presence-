import { supabase } from '../../config/supabase.js';
import { requireRole } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { formatDateTime, formatMoney } from '../../utils/format.js';

export async function adminPaymentsPage(app) {
  const profile = await requireRole(['super_admin']);
  if (!profile) return;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/admin/payments')}
      <div class="main-content">
        ${renderTopbar(profile, 'Paiements')}
        <main class="page">
          <div class="page-header">
            <h1>Paiements</h1>
            <p>Historique des paiements (simulés en V1).</p>
          </div>
          <div class="toolbar">
            <select class="input" id="status-filter" style="max-width:200px;">
              <option value="">Tous</option>
              <option value="pending">En attente</option>
              <option value="paid">Payés</option>
              <option value="failed">Échoués</option>
              <option value="refunded">Remboursés</option>
            </select>
            <div class="toolbar-spacer"></div>
            <button class="btn btn-primary" id="simulate-pay">+ Simuler un paiement</button>
          </div>
          <div id="payments-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
  document.getElementById('status-filter').addEventListener('change', loadPayments);
  document.getElementById('simulate-pay').addEventListener('click', simulatePayment);
  await loadPayments();
}

async function loadPayments() {
  const list = document.getElementById('payments-list');
  const status = document.getElementById('status-filter').value;
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  let query = supabase.from('payments').select(`*, companies(name)`).order('created_at', { ascending: false }).limit(100);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }
  if (!data || data.length === 0) { list.innerHTML = `<div class="empty"><h3>Aucun paiement</h3></div>`; return; }

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>Référence</th><th>Entreprise</th><th>Montant</th><th>Statut</th><th>Fournisseur</th><th>Date</th></tr></thead>
        <tbody>
          ${data.map(p => `
            <tr>
              <td><code style="font-size:12px;">${p.transaction_reference || p.id.slice(0,8)}</code></td>
              <td>${p.companies?.name || '—'}</td>
              <td><strong>${formatMoney(p.amount, p.currency)}</strong></td>
              <td>${badge(p.status)}</td>
              <td>${p.provider || '—'}</td>
              <td>${formatDateTime(p.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function badge(status) {
  const map = {
    pending: '<span class="badge badge-warning">En attente</span>',
    paid: '<span class="badge badge-success">Payé</span>',
    failed: '<span class="badge badge-danger">Échoué</span>',
    refunded: '<span class="badge badge-muted">Remboursé</span>',
  };
  return map[status] || `<span class="badge badge-muted">${status}</span>`;
}

async function simulatePayment() {
  const { data: companies } = await supabase.from('companies').select('id, name').order('name');

  const { close } = openModal({
    title: 'Simuler un paiement',
    body: `
      <div class="form-group">
        <label class="label">Entreprise</label>
        <select class="input" id="pay-company">
          ${(companies || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Montant</label>
          <input class="input" type="number" id="pay-amount" value="15000" />
        </div>
        <div class="form-group">
          <label class="label">Devise</label>
          <input class="input" id="pay-currency" value="XAF" />
        </div>
      </div>
      <div class="form-group">
        <label class="label">Statut</label>
        <select class="input" id="pay-status">
          <option value="paid">Payé</option>
          <option value="pending">En attente</option>
          <option value="failed">Échoué</option>
        </select>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-cancel>Annuler</button>
      <button class="btn btn-primary" data-save>Enregistrer</button>
    `,
  });

  document.querySelector('[data-cancel]').addEventListener('click', close);
  document.querySelector('[data-save]').addEventListener('click', async () => {
    const status = document.getElementById('pay-status').value;
    const payload = {
      company_id: document.getElementById('pay-company').value,
      amount: Number(document.getElementById('pay-amount').value),
      currency: document.getElementById('pay-currency').value,
      status,
      provider: 'simulation',
      transaction_reference: 'SIM-' + Date.now(),
      paid_at: status === 'paid' ? new Date().toISOString() : null,
    };
    const { error } = await supabase.from('payments').insert(payload);
    if (error) { toast(error.message, 'error'); return; }
    toast('Paiement enregistré', 'success');
    close();
    loadPayments();
  });
}