import { icon } from './icons.js';

export function renderTopbar(profile = {}, title = '', extras = {}) {
  const initials = (profile.full_name || profile.email || '?')
    .split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  const impersonateBanner = extras.isImpersonating ? `
    <div class="impersonate-banner">
      <div>⚠️ Vous consultez l'espace de <strong>${extras.companyName}</strong> en tant que Super Admin</div>
      <button id="stop-impersonate">Quitter ce mode</button>
    </div>
  ` : '';

  return `
    ${impersonateBanner}
    <header class="topbar">
      <h2 style="font-size:1.1rem;">${title}</h2>
      <div class="topbar-user">
        <button class="icon-btn" id="notif-bell" style="position:relative;" title="Notifications">
          ${icon('bell', 20)}
          <span id="notif-badge" style="display:none;position:absolute;top:-4px;right:-4px;background:var(--pf-danger);color:white;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px;align-items:center;justify-content:center;padding:0 4px;">0</span>
        </button>
        <div style="text-align:right;">
          <div style="font-size:13px;font-weight:600;">${profile.full_name || profile.email}</div>
          <div style="font-size:11px;color:var(--pf-text-muted);">${profile.role}</div>
        </div>
        <div class="avatar">${initials}</div>
        <button class="btn btn-ghost" id="logout-btn" title="Déconnexion">${icon('logout', 18)}</button>
      </div>
    </header>
  `;
}

export function attachTopbarEvents() {
  const btn = document.getElementById('logout-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      const { supabase } = await import('../config/supabase.js');
      const { setImpersonate } = await import('../utils/company.js');
      setImpersonate(null);
      await supabase.auth.signOut();
      window.location.href = '/login';
    });
  }

  const stopBtn = document.getElementById('stop-impersonate');
  if (stopBtn) {
    stopBtn.addEventListener('click', async () => {
      const { setImpersonate } = await import('../utils/company.js');
      setImpersonate(null);
      window.location.href = '/admin/companies';
    });
  }

  // Charge les notifications
  loadNotifCount();

  // Bell click → redirige
  const bell = document.getElementById('notif-bell');
  if (bell) {
    bell.addEventListener('click', () => {
      const path = window.location.pathname;
      if (path.startsWith('/admin')) window.location.href = '/admin/notifications';
      else window.location.href = '/notifications';
    });
  }
}

async function loadNotifCount() {
  const { supabase } = await import('../config/supabase.js');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .is('read_at', null);

  const badge = document.getElementById('notif-badge');
  if (badge && count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'flex';
  }
}