import { icon } from './icons.js';

export function renderEmployeeHeader(profile) {
  const initials = (profile.full_name || profile.email || '?')
    .split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return `
    <header class="emp-header">
      <div class="emp-header-brand">Pointify</div>
      <div class="emp-header-user">
        <div class="emp-header-name">${profile.full_name || profile.email}</div>
        <div class="emp-header-avatar">${initials}</div>
        <button class="emp-header-logout" id="emp-logout" title="Déconnexion">${icon('logout', 18)}</button>
      </div>
    </header>
  `;
}

export function renderEmployeeNav(active = '') {
  const links = [
    { href: '/my-dashboard', label: 'Accueil', icon: 'home' },
    { href: '/check-in', label: 'Pointer', icon: 'camera' },
    { href: '/my-attendance', label: 'Historique', icon: 'calendar' },
    { href: '/profile', label: 'Profil', icon: 'user' },
  ];

  return `
    <nav class="emp-nav">
      ${links.map(l => `
        <a href="${l.href}" data-link class="emp-nav-link ${active === l.href ? 'active' : ''}">
          <div class="emp-nav-icon">${icon(l.icon, 20)}</div>
          <div>${l.label}</div>
        </a>
      `).join('')}
    </nav>
  `;
}

export function attachEmployeeHeaderEvents() {
  const btn = document.getElementById('emp-logout');
  if (btn) {
    btn.addEventListener('click', async () => {
      const { supabase } = await import('../config/supabase.js');
      const { setImpersonate } = await import('../utils/company.js');
      setImpersonate(null);
      await supabase.auth.signOut();
      window.location.href = '/login';
    });
  }
}

export function employeeLayout({ profile, active, content }) {
  return `
    <div class="emp-app page-transition">
      ${renderEmployeeHeader(profile)}
      <main class="emp-content">
        ${content}
      </main>
      ${renderEmployeeNav(active)}
    </div>
  `;
}