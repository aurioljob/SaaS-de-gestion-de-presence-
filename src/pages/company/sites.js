import { supabase } from '../../config/supabase.js';
import { requireCompany as guardCompany } from '../../utils/guards.js';
import { checkPlanLimit } from '../../utils/company.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal, confirmModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';

export async function companySitesPage(app) {
  const ctx = await guardCompany();
  if (!ctx) return;
  const { profile, context } = ctx;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/sites', 'company', {
  companyName: context.company.name,
  planName: context.plan?.name || 'Aucun plan',
  isImpersonating: context.isImpersonating,
})}
      <div class="main-content">
        ${renderTopbar(profile, 'Sites',{
  isImpersonating: context.isImpersonating,
  companyName: context.company.name,
})}
        <main class="page">
          <div class="page-header"><h1>Sites</h1><p>Gérez vos lieux physiques et leurs zones de pointage.</p></div>
          <div class="toolbar">
            <div class="toolbar-spacer"></div>
            <button class="btn btn-primary" id="new-site">+ Nouveau site</button>
          </div>
          <div id="sites-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
  document.getElementById('new-site').addEventListener('click', () => openSiteForm(null, context));
  await load(context);
}

async function load(context) {
  const list = document.getElementById('sites-list');
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  const { data, error } = await supabase.from('sites')
    .select('*').eq('company_id', context.companyId).order('name');

  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }
  if (!data || data.length === 0) { list.innerHTML = `<div class="empty"><h3>Aucun site</h3><p>Créez votre premier lieu de travail.</p></div>`; return; }

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>Nom</th><th>Adresse</th><th>Coordonnées</th><th>Rayon</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          ${data.map(s => `
            <tr>
              <td><strong>${s.name}</strong></td>
              <td>${s.address || '—'}</td>
              <td>${s.latitude ? `${Number(s.latitude).toFixed(4)}, ${Number(s.longitude).toFixed(4)}` : '—'}</td>
              <td>${s.radius_meters} m</td>
              <td>${s.status === 'active' ? '<span class="badge badge-success">Actif</span>' : '<span class="badge badge-muted">Inactif</span>'}</td>
              <td>
                <div class="table-actions">
                  <button class="icon-btn" data-edit="${s.id}">✎</button>
                  <button class="icon-btn danger" data-del="${s.id}">🗑</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  list.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => openSiteForm(data.find(x => x.id === b.dataset.edit), context))
  );
  list.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => {
      const s = data.find(x => x.id === b.dataset.del);
      confirmModal(`Supprimer le site <strong>${s.name}</strong> ?`, async () => {
        const { error } = await supabase.from('sites').delete().eq('id', s.id);
        if (error) { toast(error.message, 'error'); return; }
        toast('Site supprimé', 'success');
        load(context);
      });
    })
  );
}

function openSiteForm(site, context) {
  const isEdit = !!site;
  const s = site || {};

  const { close } = openModal({
    title: isEdit ? 'Modifier le site' : 'Nouveau site',
    body: `
      <div class="form-group">
        <label class="label">Nom *</label>
        <input class="input" id="s-name" value="${s.name || ''}" />
      </div>
      <div class="form-group">
        <label class="label">Adresse</label>
        <input class="input" id="s-address" value="${s.address || ''}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Latitude</label>
          <input class="input" type="number" step="any" id="s-lat" value="${s.latitude || ''}" />
        </div>
        <div class="form-group">
          <label class="label">Longitude</label>
          <input class="input" type="number" step="any" id="s-lng" value="${s.longitude || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Rayon (mètres) *</label>
          <input class="input" type="number" id="s-radius" value="${s.radius_meters || 100}" />
        </div>
        <div class="form-group">
          <label class="label">Statut</label>
          <select class="input" id="s-status">
            <option value="active" ${s.status === 'active' ? 'selected' : ''}>Actif</option>
            <option value="inactive" ${s.status === 'inactive' ? 'selected' : ''}>Inactif</option>
          </select>
        </div>
      </div>
      <button class="btn btn-secondary" id="use-gps" style="width:100%;">📍 Utiliser ma position actuelle</button>
    `,
    footer: `
      <button class="btn btn-secondary" data-cancel>Annuler</button>
      <button class="btn btn-primary" data-save>${isEdit ? 'Enregistrer' : 'Créer'}</button>
    `,
  });

  document.querySelector('#use-gps').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Géolocalisation non supportée', 'error'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        document.getElementById('s-lat').value = pos.coords.latitude;
        document.getElementById('s-lng').value = pos.coords.longitude;
        toast('Position récupérée', 'success');
      },
      (err) => toast('Erreur : ' + err.message, 'error')
    );
  });

  document.querySelector('[data-cancel]').addEventListener('click', close);
  document.querySelector('[data-save]').addEventListener('click', async () => {
    if (!isEdit) {
      const limit = await checkPlanLimit('sites');
      if (!limit.allowed) { toast(`Limite atteinte : ${limit.current}/${limit.max} sites`, 'error'); return; }
    }

    const payload = {
      company_id: context.companyId,
      name: document.getElementById('s-name').value.trim(),
      address: document.getElementById('s-address').value.trim() || null,
      latitude: parseFloat(document.getElementById('s-lat').value) || null,
      longitude: parseFloat(document.getElementById('s-lng').value) || null,
      radius_meters: Number(document.getElementById('s-radius').value) || 100,
      status: document.getElementById('s-status').value,
    };

    if (!payload.name) { toast('Nom requis', 'error'); return; }

    let error;
    if (isEdit) ({ error } = await supabase.from('sites').update(payload).eq('id', s.id));
    else ({ error } = await supabase.from('sites').insert(payload));

    if (error) { toast(error.message, 'error'); return; }
    toast(isEdit ? 'Site modifié' : 'Site créé', 'success');
    close();
    load(context);
  });
}