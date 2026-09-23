import { supabase } from '../../config/supabase.js';
import { requireCompany as guardCompany } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { subscribeToNotifications, unsubscribe } from '../../utils/realtime.js';
import { formatDateTime } from '../../utils/format.js';
import { icon } from '../../components/icons.js';
import { prepareCompanyLayout } from '../../utils/company-layout.js';

let channel = null;

export async function companyNotificationsPage(app) {
  const ctx = await guardCompany();
  if (!ctx) return;
  const { profile, context } = ctx;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/dashboard', 'company', await prepareCompanyLayout(context))}
      <div class="main-content">
        ${renderTopbar(profile, 'Notifications', {
          isImpersonating: context.isImpersonating,
          companyName: context.company.name,
        })}
        <main class="page">
          <div class="page-header">
            <h1>Notifications</h1>
            <p>Vos alertes et messages</p>
          </div>

          <div class="toolbar">
            <div class="toolbar-spacer"></div>
            <button class="btn btn-secondary" id="mark-all-read">${icon('check',16)} Tout marquer comme lu</button>
          </div>

          <div id="notifs-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
  document.getElementById('mark-all-read').addEventListener('click', () => markAllRead(profile.id));

  await load(profile.id);

  channel = subscribeToNotifications(profile.id, () => load(profile.id));
}

async function load(userId) {
  const list = document.getElementById('notifs-list');
  if (!list) return;

  const { data, error } = await supabase.from('notifications')
    .select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(50);

  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }
  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty">
      <div style="color:var(--pf-text-light);margin-bottom:12px;">${icon('bell',48)}</div>
      <h3>Aucune notification</h3>
      <p>Vous serez alerté en cas d'événement important.</p>
    </div>`;
    return;
  }

  list.innerHTML = `
    <div class="table-wrapper">
      ${data.map(n => `
        <div style="padding:16px 20px;border-bottom:1px solid var(--pf-border);display:flex;gap:14px;${n.read_at ? 'opacity:0.6;' : ''}">
          <div style="width:36px;height:36px;border-radius:50%;background:${n.read_at ? '#f3f4f6' : '#dbeafe'};color:${n.read_at ? '#6b7280' : '#1e40af'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            ${icon('bell',16)}
          </div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:14px;margin-bottom:2px;">${n.title}</div>
            <div style="font-size:13px;color:var(--pf-text-muted);">${n.message || ''}</div>
            <div style="font-size:11px;color:var(--pf-text-light);margin-top:6px;">${formatDateTime(n.created_at)}</div>
          </div>
          ${!n.read_at ? `<button class="icon-btn" data-read="${n.id}" title="Marquer comme lu">${icon('check',16)}</button>` : ''}
        </div>
      `).join('')}
    </div>
  `;

  list.querySelectorAll('[data-read]').forEach(b =>
    b.addEventListener('click', async () => {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', b.dataset.read);
      load(userId);
    })
  );
}

async function markAllRead(userId) {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() })
    .eq('user_id', userId).is('read_at', null);
  load(userId);
}

window.addEventListener('beforeunload', () => unsubscribe(channel));