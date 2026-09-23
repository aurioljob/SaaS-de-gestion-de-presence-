import { supabase } from '../../config/supabase.js';
import { requireRole } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';

export async function adminNotificationsPage(app) {
  const profile = await requireRole(['super_admin']);
  if (!profile) return;

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50);

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/admin/notifications')}
      <div class="main-content">
        ${renderTopbar(profile, 'Notifications')}
        <main class="page">
          <div class="page-header">
            <h1>Notifications</h1>
            <p>Vos dernières notifications système.</p>
          </div>
          ${error ? `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>` : `
            <div class="card">
              ${(data || []).length === 0
                ? '<div class="empty"><p>Aucune notification</p></div>'
                : data.map(notification => `
                  <div style="padding:14px 0;border-bottom:1px solid var(--pf-border);">
                    <strong>${notification.title}</strong>
                    <p style="margin:4px 0;color:var(--pf-text-muted);">${notification.message || ''}</p>
                    <small style="color:var(--pf-text-muted);">${new Date(notification.created_at).toLocaleString('fr-FR')}</small>
                  </div>
                `).join('')}
            </div>
          `}
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
}