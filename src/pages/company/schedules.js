import { supabase } from '../../config/supabase.js';
import { requireCompany as guardCompany } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal, confirmModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export async function companySchedulesPage(app) {
  const ctx = await guardCompany();
  if (!ctx) return;
  const { profile, context } = ctx;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/schedules', 'company', {
  companyName: context.company.name,
  planName: context.plan?.name || 'Aucun plan',
  isImpersonating: context.isImpersonating,
})}
      <div class="main-content">
        ${renderTopbar(profile, 'Horaires',{
  isImpersonating: context.isImpersonating,
  companyName: context.company.name,
})}
        <main class="page">
          <div class="page-header"><h1>Horaires de travail</h1><p>Définissez les plages horaires par jour et par site.</p></div>
          <div class="toolbar">
            <select class="input" id="site-filter" style="max-width:220px;">
              <option value="">Tous les sites</option>
            </select>
            <div class="toolbar-spacer"></div>
            <button class="btn btn-primary" id="new-sched">+ Nouvel horaire</button>
          </div>
          <div id="sched-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();

  const { data: sites } = await supabase.from('sites')
    .select('id, name').eq('company_id', context.companyId).order('name');

  const filter = document.getElementById('site-filter');
  (sites || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.name;
    filter.appendChild(opt);
  });

  filter.addEventListener('change', () => load(context, filter.value));
  document.getElementById('new-sched').addEventListener('click', () => openForm(null, context, sites || []));
  await load(context, '');
}

async function load(context, siteId) {
  const list = document.getElementById('sched-list');
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  let query = supabase.from('work_schedules').select(`*, sites(name)`)
    .eq('company_id', context.companyId)
    .order('day_of_week');
  if (siteId) query = query.eq('site_id', siteId);

  const { data, error } = await query;
  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }
  if (!data || data.length === 0) { list.innerHTML = `<div class="empty"><h3>Aucun horaire</h3><p>Ajoutez un premier créneau.</p></div>`; return; }

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>Jour</th><th>Site</th><th>Début</th><th>Fin</th><th>Pause</th><th>Tolérance</th><th></th></tr></thead>
        <tbody>
          ${data.map(s => `
            <tr>
              <td><strong>${DAYS[s.day_of_week]}</strong></td>
              <td>${s.sites?.name || 'Tous'}</td>
              <td>${s.start_time?.slice(0,5) || '—'}</td>
              <td>${s.end_time?.slice(0,5) || '—'}</td>
              <td>${s.break_start ? `${s.break_start.slice(0,5)} - ${s.break_end?.slice(0,5)}` : '—'}</td>
              <td>${s.late_tolerance_minutes} min</td>
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

  list.querySelectorAll('[data-edit]').forEach(b => {
    const s = data.find(x => x.id === b.dataset.edit);
    b.addEventListener('click', async () => {
      const { data: sites } = await supabase.from('sites').select('id, name').eq('company_id', context.companyId).order('name');
      openForm(s, context, sites || []);
    });
  });
  list.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => {
      const s = data.find(x => x.id === b.dataset.del);
      confirmModal('Supprimer cet horaire ?', async () => {
        const { error } = await supabase.from('work_schedules').delete().eq('id', s.id);
        if (error) { toast(error.message, 'error'); return; }
        toast('Horaire supprimé', 'success');
        load(context, siteId);
      });
    })
  );
}

function openForm(sched, context, sites) {
  const isEdit = !!sched;
  const s = sched || {};

  const { close } = openModal({
    title: isEdit ? 'Modifier l\'horaire' : 'Nouvel horaire',
    body: `
      <div class="form-group">
        <label class="label">Site</label>
        <select class="input" id="sc-site">
          <option value="">Tous les sites</option>
          ${sites.map(site => `<option value="${site.id}" ${site.id === s.site_id ? 'selected' : ''}>${site.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="label">Jour *</label>
        <select class="input" id="sc-day">
          ${DAYS.map((d, i) => `<option value="${i}" ${i === (s.day_of_week ?? 1) ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Début *</label>
          <input class="input" type="time" id="sc-start" value="${s.start_time?.slice(0,5) || '08:00'}" />
        </div>
        <div class="form-group">
          <label class="label">Fin *</label>
          <input class="input" type="time" id="sc-end" value="${s.end_time?.slice(0,5) || '17:00'}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Début pause</label>
          <input class="input" type="time" id="sc-bs" value="${s.break_start?.slice(0,5) || ''}" />
        </div>
        <div class="form-group">
          <label class="label">Fin pause</label>
          <input class="input" type="time" id="sc-be" value="${s.break_end?.slice(0,5) || ''}" />
        </div>
      </div>
      <div class="form-group">
        <label class="label">Tolérance retard (minutes)</label>
        <input class="input" type="number" id="sc-tol" value="${s.late_tolerance_minutes || 10}" />
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
      company_id: context.companyId,
      site_id: document.getElementById('sc-site').value || null,
      day_of_week: Number(document.getElementById('sc-day').value),
      start_time: document.getElementById('sc-start').value,
      end_time: document.getElementById('sc-end').value,
      break_start: document.getElementById('sc-bs').value || null,
      break_end: document.getElementById('sc-be').value || null,
      late_tolerance_minutes: Number(document.getElementById('sc-tol').value),
    };

    let error;
    if (isEdit) ({ error } = await supabase.from('work_schedules').update(payload).eq('id', s.id));
    else ({ error } = await supabase.from('work_schedules').insert(payload));

    if (error) { toast(error.message, 'error'); return; }
    toast(isEdit ? 'Modifié' : 'Créé', 'success');
    close();
    load(context, '');
  });
}