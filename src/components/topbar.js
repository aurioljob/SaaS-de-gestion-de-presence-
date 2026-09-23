export function renderTopbar(profile = {}, title = '') {
  const initials = (profile.full_name || profile.email || '?')
    .split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return `
    <header class="topbar">
      <h2 style="font-size:1.1rem;">${title}</h2>
      <div class="topbar-user">
        <div style="text-align:right;">
          <div style="font-size:13px;font-weight:600;">${profile.full_name || profile.email}</div>
          <div style="font-size:11px;color:var(--pf-text-muted);">${profile.role}</div>
        </div>
        <div class="avatar">${initials}</div>
        <button class="btn btn-ghost" id="logout-btn" title="Déconnexion">⎋</button>
      </div>
    </header>
  `;
}

export function attachTopbarEvents() {
  const btn = document.getElementById('logout-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      const { supabase } = await import('../config/supabase.js');
      await supabase.auth.signOut();
      window.location.href = '/login';
    });
  }
}