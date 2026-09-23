import { supabase } from '../../config/supabase.js';
import { requireRole } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal, confirmModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { formatDate } from '../../utils/format.js';

export async function adminCouponsPage(app) {
  const profile = await requireRole(['super_admin']);
  if (!profile) return;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/admin/coupons')}
      <div class="main-content">
        ${renderTopbar(profile, 'Coupons')}
        <main class="page">
          <div class="page-header">
            <h1>Coupons & promotions</h1>
            <p>Codes promotionnels pour vos clients.</p>
          </div>
          <div class="toolbar">
            <div class="toolbar-spacer"></div>
            <button class="btn btn-primary" id="new-coupon">+ Nouveau coupon</button>
          </div>
          <div id="coupons-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
  document.getElementById('new-coupon').addEventListener('click', () => openCouponForm());
  await loadCoupons();
}

async function loadCoupons() {
  const list = document.getElementById('coupons-list');
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }
  if (!data || data.length === 0) { list.innerHTML = `<div class="empty"><h3>Aucun coupon</h3></div>`; return; }

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>Code</th><th>Réduction</th><th>Validité</th><th>Usages max</th><th>Actif</th><th></th></tr></thead>
        <tbody>
          ${data.map(c => `
            <tr>
              <td><code style="background:#f3f4f6;padding:2px 8px;border-radius:4px;font-weight:600;">${c.code}</code></td>
              <td>${c.discount_type === 'percentage' ? c.discount_value + '%' : c.discount_value + ' (fixe)'}</td>
              <td>${formatDate(c.starts_at)} → ${formatDate(c.expires_at)}</td>
              <td>${c.max_uses || '∞'}</td>
              <td>${c.is_active ? '<span class="badge badge-success">Oui</span>' : '<span class="badge badge-muted">Non</span>'}</td>
              <td>
                <div class="table-actions">
                  <button class="icon-btn" data-edit="${c.id}">✎</button>
                  <button class="icon-btn danger" data-del="${c.id}">🗑</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  list.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => openCouponForm(data.find(x => x.id === b.dataset.edit)))
  );
  list.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => {
      const c = data.find(x => x.id === b.dataset.del);
      confirmModal(`Supprimer le coupon <strong>${c.code}</strong> ?`, async () => {
        const { error } = await supabase.from('coupons').delete().eq('id', c.id);
        if (error) { toast(error.message, 'error'); return; }
        toast('Coupon supprimé', 'success');
        loadCoupons();
      });
    })
  );
}

function openCouponForm(coupon = null) {
  const isEdit = !!coupon;
  const c = coupon || {};
  const { close } = openModal({
    title: isEdit ? 'Modifier le coupon' : 'Nouveau coupon',
    body: `
      <div class="form-group">
        <label class="label">Code *</label>
        <input class="input" id="c-code" value="${c.code || ''}" placeholder="BIENVENUE10" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Type de réduction</label>
          <select class="input" id="c-type">
            <option value="percentage" ${c.discount_type === 'percentage' ? 'selected' : ''}>Pourcentage</option>
            <option value="fixed" ${c.discount_type === 'fixed' ? 'selected' : ''}>Montant fixe</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Valeur</label>
          <input class="input" type="number" id="c-value" value="${c.discount_value || 10}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Début</label>
          <input class="input" type="date" id="c-start" value="${c.starts_at ? c.starts_at.slice(0,10) : ''}" />
        </div>
        <div class="form-group">
          <label class="label">Fin</label>
          <input class="input" type="date" id="c-end" value="${c.expires_at ? c.expires_at.slice(0,10) : ''}" />
        </div>
      </div>
      <div class="form-group">
        <label class="label">Usages max (vide = illimité)</label>
        <input class="input" type="number" id="c-max" value="${c.max_uses || ''}" />
      </div>
      <div class="form-group">
        <label class="label"><input type="checkbox" id="c-active" ${c.is_active !== false ? 'checked' : ''}/> Actif</label>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-cancel>Annuler</button>
      <button class="btn btn-primary" data-save>${isEdit ? 'Enregistrer' : 'Créer'}</button>
    `,
  });

  document.querySelector('[data-cancel]').addEventListener('click', close);
  document.querySelector('[data-save]').addEventListener('click', async () => {
    const start = document.getElementById('c-start').value;
    const end = document.getElementById('c-end').value;
    const maxUses = document.getElementById('c-max').value;
    const payload = {
      code: document.getElementById('c-code').value.trim().toUpperCase(),
      discount_type: document.getElementById('c-type').value,
      discount_value: Number(document.getElementById('c-value').value),
      starts_at: start ? new Date(start).toISOString() : null,
      expires_at: end ? new Date(end).toISOString() : null,
      max_uses: maxUses ? Number(maxUses) : null,
      is_active: document.getElementById('c-active').checked,
    };
    if (!payload.code) { toast('Code requis', 'error'); return; }

    let error;
    if (isEdit) ({ error } = await supabase.from('coupons').update(payload).eq('id', c.id));
    else ({ error } = await supabase.from('coupons').insert(payload));

    if (error) { toast(error.message, 'error'); return; }
    toast(isEdit ? 'Coupon modifié' : 'Coupon créé', 'success');
    close();
    loadCoupons();
  });
}