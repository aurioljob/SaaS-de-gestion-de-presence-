import { supabase } from '../../config/supabase.js';
import { requireCompany as guardCompany } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { icon } from '../../components/icons.js';
import { formatMoney, formatDate } from '../../utils/format.js';
import { prepareCompanyLayout } from '../../utils/company-layout.js';
import { clearFeaturesCache, getMyFeatures } from '../../utils/company.js';

export async function companySubscriptionPage(app) {
  const ctx = await guardCompany();
  if (!ctx) return;
  const { profile, context } = ctx;

  const { data: sub } = await supabase.from('subscriptions')
    .select(`*, plans(*)`)
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle();

  const { data: plans } = await supabase.from('plans')
    .select('*').eq('is_active', true).order('monthly_price');

  const { data: payments } = await supabase.from('payments')
    .select('*').eq('company_id', context.companyId)
    .order('created_at', { ascending: false }).limit(20);
    const features = await getMyFeatures();
const planFeatures = await supabase
  .from('features').select('*').in('key', features);
const allFeatures = planFeatures.data || [];

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/dashboard', 'company', await prepareCompanyLayout(context))}
      <div class="main-content">
        ${renderTopbar(profile, 'Abonnement', {
          isImpersonating: context.isImpersonating,
          companyName: context.company.name,
        })}
        <main class="page">
          <div class="page-header"><h1>Mon abonnement</h1></div>

          ${sub ? `
            <div class="card" style="margin-bottom:24px;background:var(--pf-gradient);color:white;border:none;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
                <div>
                  <div style="font-size:12px;opacity:0.8;text-transform:uppercase;letter-spacing:0.06em;">Plan actuel</div>
                  <div style="font-size:2rem;font-weight:800;font-family:var(--pf-font-display);margin-top:4px;">
                    ${sub.plans?.name || '—'}
                  </div>
                  <div style="opacity:0.9;font-size:14px;margin-top:4px;">
                    ${formatMoney(sub.price, sub.currency)} / ${sub.billing_cycle === 'monthly' ? 'mois' : 'an'}
                  </div>
                </div>
                <div style="text-align:right;">
                  <span class="badge ${statusClass(sub.status)}" style="background:rgba(255,255,255,0.25);color:white;">
                    ${statusLabel(sub.status)}
                  </span>
                  ${sub.expires_at ? `<div style="font-size:12px;opacity:0.85;margin-top:8px;">Expire le ${formatDate(sub.expires_at)}</div>` : ''}
                </div>
              </div>
            </div>
          ` : ''}

          <h2 style="margin-bottom:16px;">Changer de plan</h2>
          <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));">
            ${(plans || []).map(p => `
              <div class="card">
                <div class="card-title">${p.name}</div>
                <div style="font-size:1.6rem;font-weight:800;font-family:var(--pf-font-display);margin:8px 0;">
                  ${formatMoney(p.monthly_price, p.currency)}
                  <span style="font-size:0.8rem;font-weight:400;color:var(--pf-text-muted);">/mois</span>
                </div>
                <p style="color:var(--pf-text-muted);font-size:13px;margin-bottom:12px;">${p.description || ''}</p>
                <ul style="list-style:none;font-size:13px;color:var(--pf-text-muted);margin-bottom:16px;">
                  <li>👥 ${p.max_employees} employés</li>
                  <li>📍 ${p.max_sites} sites</li>
                  <li>📅 ${p.history_days}j d'historique</li>
                </ul>
                <button class="btn btn-primary" style="width:100%;" data-plan="${p.id}" ${sub?.plan_id === p.id ? 'disabled' : ''}>
                  ${sub?.plan_id === p.id ? '✓ Plan actuel' : 'Choisir ce plan'}
                </button>
              </div>
            `).join('')}
          </div>
          <div class="card" style="margin-bottom:24px;">
            <div class="card-title">Vos fonctionnalités actuelles</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
                ${allFeatures.map(f => `
                <div style="display:flex;align-items:center;gap:8px;font-size:14px;">
                    <span style="color:var(--pf-success);">${icon('check',16)}</span>
                    ${f.name}
                </div>
                `).join('')}
            </div>
            </div>

          ${payments && payments.length > 0 ? `
            <h2 style="margin:32px 0 16px;">Historique des paiements</h2>
            <div class="table-wrapper">
              <table class="table">
                <thead><tr><th>Date</th><th>Montant</th><th>Statut</th><th>Référence</th></tr></thead>
                <tbody>
                  ${payments.map(p => `
                    <tr>
                      <td>${formatDate(p.created_at)}</td>
                      <td><strong>${formatMoney(p.amount, p.currency)}</strong></td>
                      <td>${paymentBadge(p.status)}</td>
                      <td><code style="font-size:12px;">${p.transaction_reference || '—'}</code></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();

  app.querySelectorAll('[data-plan]').forEach(btn =>
    btn.addEventListener('click', () => openCheckout(btn.dataset.plan, context, plans))
  );
}

function statusClass(s) {
  return { trial: 'badge-info', active: 'badge-success', past_due: 'badge-warning', expired: 'badge-danger' }[s] || 'badge-muted';
}
function statusLabel(s) {
  return { trial: 'Essai', active: 'Actif', past_due: 'En retard', cancelled: 'Annulé', expired: 'Expiré', suspended: 'Suspendu' }[s] || s;
}
function paymentBadge(s) {
  const map = {
    pending: '<span class="badge badge-warning">En attente</span>',
    paid: '<span class="badge badge-success">Payé</span>',
    failed: '<span class="badge badge-danger">Échoué</span>',
    refunded: '<span class="badge badge-muted">Remboursé</span>',
  };
  return map[s] || s;
}

async function openCheckout(planId, context, plans) {
  const plan = plans.find(p => p.id === planId);
  if (!plan) return;

  const { close } = openModal({
    title: `Souscrire au plan ${plan.name}`,
    body: `
      <div style="background:#f9fafb;padding:16px;border-radius:10px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:14px;">
          <span>${plan.name}</span>
          <strong>${formatMoney(plan.monthly_price, plan.currency)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--pf-text-muted);">
          <span>Cycle</span>
          <span>Mensuel</span>
        </div>
      </div>

      <div class="form-group">
        <label class="label">Code promo (optionnel)</label>
        <div style="display:flex;gap:8px;">
          <input class="input" id="coupon-input" placeholder="BIENVENUE10" />
          <button class="btn btn-secondary" id="apply-coupon">Appliquer</button>
        </div>
        <div id="coupon-feedback" style="margin-top:8px;font-size:13px;"></div>
      </div>

      <div id="total-block" style="border-top:1px solid var(--pf-border);padding-top:16px;margin-top:16px;">
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;">
          <span>Total</span>
          <span id="total-amount">${formatMoney(plan.monthly_price, plan.currency)}</span>
        </div>
      </div>

      <p style="font-size:12px;color:var(--pf-text-muted);margin-top:16px;">
        💡 <strong>V1 pédagogique</strong> — Le paiement est simulé. Un prestataire réel sera intégré ultérieurement.
      </p>
    `,
    footer: `
      <button class="btn btn-secondary" data-cancel>Annuler</button>
      <button class="btn btn-primary" data-pay>Payer et activer</button>
    `,
  });

  let appliedCoupon = null;

  document.getElementById('apply-coupon').addEventListener('click', async () => {
    const code = document.getElementById('coupon-input').value.trim();
    if (!code) return;

    const { data, error } = await supabase.rpc('validate_coupon', {
      p_code: code,
      p_plan_id: plan.id,
    });

    if (error) { toast(error.message, 'error'); return; }

    const feedback = document.getElementById('coupon-feedback');
    if (!data.valid) {
      feedback.innerHTML = `<span style="color:var(--pf-danger);">${data.error}</span>`;
      appliedCoupon = null;
      updateTotal(plan, null);
      return;
    }

    appliedCoupon = data;
    let discount = 0;
    if (data.discount_type === 'percentage') discount = plan.monthly_price * (data.discount_value / 100);
    else discount = data.discount_value;

    feedback.innerHTML = `<span style="color:var(--pf-success);">✓ Code appliqué : -${formatMoney(discount, plan.currency)}</span>`;
    updateTotal(plan, discount);
  });

  function updateTotal(p, discount) {
    const total = Math.max(0, p.monthly_price - (discount || 0));
    document.getElementById('total-amount').textContent = formatMoney(total, p.currency);
  }

  document.querySelector('[data-cancel]').addEventListener('click', close);

  document.querySelector('[data-pay]').addEventListener('click', async () => {
    const btn = document.querySelector('[data-pay]');
    btn.disabled = true; btn.textContent = 'Traitement…';

    let discount = 0;
    if (appliedCoupon) {
      if (appliedCoupon.discount_type === 'percentage') discount = plan.monthly_price * (appliedCoupon.discount_value / 100);
      else discount = appliedCoupon.discount_value;
    }
    const total = Math.max(0, plan.monthly_price - discount);

    // 1. Créer le paiement (simulé)
    const { data: payment, error: payError } = await supabase.from('payments').insert({
      company_id: context.companyId,
      amount: total,
      currency: plan.currency,
      status: 'paid',
      provider: 'simulation',
      transaction_reference: 'SIM-' + Date.now(),
      paid_at: new Date().toISOString(),
    }).select().single();

    if (payError) { toast(payError.message, 'error'); btn.disabled = false; btn.textContent = 'Payer et activer'; return; }

    // 2. Créer l'abonnement
    const { data: sub, error: subError } = await supabase.from('subscriptions').insert({
      company_id: context.companyId,
      plan_id: plan.id,
      status: 'active',
      billing_cycle: 'monthly',
      price: total,
      currency: plan.currency,
      starts_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      auto_renew: true,
    }).select().single();

    if (subError) { toast(subError.message, 'error'); btn.disabled = false; return; }

    // 3. Enregistrer la redemption du coupon
    if (appliedCoupon) {
      await supabase.from('coupon_redemptions').insert({
        coupon_id: appliedCoupon.coupon_id,
        company_id: context.companyId,
        payment_id: payment.id,
      });
    }

    // 4. Notification interne
    await supabase.from('notifications').insert({
      user_id: (await supabase.auth.getUser()).data.user.id,
      type: 'payment',
      title: 'Paiement réussi',
      message: `Abonnement ${plan.name} activé — ${formatMoney(total, plan.currency)}`,
    });

    toast('Paiement réussi ! Abonnement activé 🎉', 'success');
    clearFeaturesCache();
    location.reload();
    close();
    setTimeout(() => location.reload(), 900);
  });
}