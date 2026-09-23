import { supabase } from '../../config/supabase.js';
import { requireRole } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';

export async function adminSettingsPage(app) {
  const profile = await requireRole(['super_admin']);
  if (!profile) return;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/admin/settings')}
      <div class="main-content">
        ${renderTopbar(profile, 'Paramètres')}
        <main class="page">
          <div class="page-header">
            <h1>Paramètres de la plateforme</h1>
            <p>Configuration globale de Pointify.</p>
          </div>
          <div class="toolbar">
            <div class="toolbar-spacer"></div>
            <button class="btn btn-primary" id="new-setting">+ Nouveau paramètre</button>
          </div>
          <div id="settings-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
  document.getElementById('new-setting').addEventListener('click', () => openSettingForm());
  await loadSettings();
}

async function loadSettings() {
  const list = document.getElementById('settings-list');
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  const { data, error } = await supabase.from('platform_settings').select('*').order('key');
  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }
  if (!data || data.length === 0) { list.innerHTML = `<div class="empty"><h3>Aucun paramètre</h3></div>`; return; }

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>Clé</th><th>Valeur</th><th></th></tr></thead>
        <tbody>
          ${data.map(s => `
            <tr>
              <td><code style="font-size:12px;background:#f3f4f6;padding:2px 6px;border-radius:4px;">${s.key}</code></td>
              <td><pre style="font-size:12px;margin:0;white-space:pre-wrap;">${JSON.stringify(s.value)}</pre></td>
              <td>
                <div class="table-actions">
                  <button class="icon-btn" data-edit="${s.id}">✎</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  list.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => openSettingForm(data.find(x => x.id === b.dataset.edit)))
  );
}

function openSettingForm(setting = null) {
  const isEdit = !!setting;
  const s = setting || {};
  const { close } = openModal({
    title: isEdit ? 'Modifier' : 'Nouveau paramètre',
    body: `
      <div class="form-group">
        <label class="label">Clé *</label>
        <input class="input" id="s-key" value="${s.key || ''}" ${isEdit ? 'disabled' : ''} />
      </div>
      <div class="form-group">
        <label class="label">Valeur (JSON) *</label>
        <textarea class="input" id="s-value" rows="4">${s.value ? JSON.stringify(s.value, null, 2) : ''}</textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-cancel>Annuler</button>
      <button class="btn btn-primary" data-save>${isEdit ? 'Enregistrer' : 'Créer'}</button>
    `,
  });

  document.querySelector('[data-cancel]').addEventListener('click', close);
  document.querySelector('[data-save]').addEventListener('click', async () => {
    let value;
    try { value = JSON.parse(document.getElementById('s-value').value); }
    catch { toast('La valeur doit être un JSON valide', 'error'); return; }

    const payload = { key: document.getElementById('s-key').value.trim(), value };
    if (!payload.key) { toast('Clé requise', 'error'); return; }

    let error;
    if (isEdit) ({ error } = await supabase.from('platform_settings').update({ value }).eq('id', s.id));
    else ({ error } = await supabase.from('platform_settings').insert(payload));

    if (error) { toast(error.message, 'error'); return; }
    toast('Paramètre enregistré', 'success');
    close();
    loadSettings();
  });
}