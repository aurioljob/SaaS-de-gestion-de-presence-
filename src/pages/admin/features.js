import { supabase } from '../../config/supabase.js';
import { requireRole } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal, confirmModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';

export async function adminFeaturesPage(app) {
  const profile = await requireRole(['super_admin']);
  if (!profile) return;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/admin/features')}
      <div class="main-content">
        ${renderTopbar(profile, 'Fonctionnalités')}
        <main class="page">
          <div class="page-header">
            <h1>Fonctionnalités</h1>
            <p>Catalogue des fonctionnalités pouvant être activées par plan.</p>
          </div>
          <div class="toolbar">
            <div class="toolbar-spacer"></div>
            <button class="btn btn-primary" id="new-feat">+ Nouvelle fonctionnalité</button>
          </div>
          <div id="features-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
  document.getElementById('new-feat').addEventListener('click', () => openFeatureForm());
  await loadFeatures();
}

async function loadFeatures() {
  const list = document.getElementById('features-list');
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  const { data, error } = await supabase.from('features').select('*').order('name');
  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }
  if (!data || data.length === 0) { list.innerHTML = `<div class="empty"><h3>Aucune fonctionnalité</h3></div>`; return; }

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>Nom</th><th>Clé</th><th>Description</th><th></th></tr></thead>
        <tbody>
          ${data.map(f => `
            <tr>
              <td><strong>${f.name}</strong></td>
              <td><code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:12px;">${f.key}</code></td>
              <td>${f.description || '—'}</td>
              <td>
                <div class="table-actions">
                  <button class="icon-btn" data-edit="${f.id}">✎</button>
                  <button class="icon-btn danger" data-del="${f.id}">🗑</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  list.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => openFeatureForm(data.find(f => f.id === b.dataset.edit)))
  );
  list.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => {
      const f = data.find(x => x.id === b.dataset.del);
      confirmModal(`Supprimer <strong>${f.name}</strong> ?`, async () => {
        const { error } = await supabase.from('features').delete().eq('id', f.id);
        if (error) { toast(error.message, 'error'); return; }
        toast('Fonctionnalité supprimée', 'success');
        loadFeatures();
      });
    })
  );
}

function openFeatureForm(feature = null) {
  const isEdit = !!feature;
  const f = feature || {};
  const { close } = openModal({
    title: isEdit ? 'Modifier la fonctionnalité' : 'Nouvelle fonctionnalité',
    body: `
      <div class="form-group">
        <label class="label">Nom *</label>
        <input class="input" id="f-name" value="${f.name || ''}" />
      </div>
      <div class="form-group">
        <label class="label">Clé * (a-z, _)</label>
        <input class="input" id="f-key" value="${f.key || ''}" placeholder="qr_checkin" />
      </div>
      <div class="form-group">
        <label class="label">Description</label>
        <textarea class="input" id="f-desc" rows="2">${f.description || ''}</textarea>
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
      key: document.getElementById('f-key').value.trim(),
      description: document.getElementById('f-desc').value.trim() || null,
    };
    if (!payload.name || !payload.key) { toast('Nom et clé requis', 'error'); return; }

    let error;
    if (isEdit) ({ error } = await supabase.from('features').update(payload).eq('id', f.id));
    else ({ error } = await supabase.from('features').insert(payload));

    if (error) { toast(error.message, 'error'); return; }
    toast(isEdit ? 'Modifiée' : 'Créée', 'success');
    close();
    loadFeatures();
  });
}