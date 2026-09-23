import { icon } from './icons.js';

export function renderSidebar(active = '', variant = 'admin', extras = {}) {
  if (variant === 'company') return renderCompanySidebar(active, extras);
  if (variant === 'employee') return renderEmployeeSidebar(active, extras);
  return renderAdminSidebar(active);
}

function renderAdminSidebar(active) {
  const links = [
    { section: 'Plateforme' },
    { href: '/admin', label: 'Dashboard', icon: 'layoutDashboard' },
    { href: '/admin/companies', label: 'Entreprises', icon: 'building' },
    { href: '/admin/users', label: 'Utilisateurs', icon: 'users' },
    { href: '/admin/employees', label: 'Employés', icon: 'userCheck' },
    { section: 'Monétisation' },
    { href: '/admin/plans', label: 'Plans', icon: 'creditCard' },
    { href: '/admin/features', label: 'Fonctionnalités', icon: 'sparkles' },
    { href: '/admin/subscriptions', label: 'Abonnements', icon: 'refreshCw' },
    { href: '/admin/payments', label: 'Paiements', icon: 'dollarSign' },
    { href: '/admin/coupons', label: 'Coupons', icon: 'tag' },
    { section: 'Système' },
    { href: '/admin/reports', label: 'Rapports', icon: 'trendingUp' },
    { href: '/admin/audit-logs', label: 'Audit logs', icon: 'search' },
    { href: '/admin/settings', label: 'Paramètres', icon: 'settings' },
  ];

  return `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <h1>Pointify</h1>
        <p>Admin Platform</p>
      </div>
      <nav class="sidebar-nav">
        ${links.map(l => l.section
          ? `<div class="sidebar-section">${l.section}</div>`
          : `<a href="${l.href}" data-link class="sidebar-link ${active === l.href ? 'active' : ''}">
               ${icon(l.icon, 18)}<span>${l.label}</span>
             </a>`
        ).join('')}
      </nav>
    </aside>
  `;
}

function renderCompanySidebar(active, extras = {}) {
  const links = [
    { section: 'Pilotage' },
    { href: '/dashboard', label: 'Dashboard', icon: 'layoutDashboard' },
    { href: '/attendance', label: 'Présences', icon: 'clock2' },
    { href: '/reports', label: 'Rapports', icon: 'trendingUp' },
    { section: 'Organisation' },
    { href: '/employees', label: 'Employés', icon: 'userCheck' },
    { href: '/departments', label: 'Départements', icon: 'tag' },
    { href: '/sites', label: 'Sites', icon: 'mapPin' },
    { href: '/schedules', label: 'Horaires', icon: 'clock' },
    { href: '/qr-codes', label: 'QR codes', icon: 'qrCode' },
    { section: 'Compte' },
    { href: '/subscription', label: 'Abonnement', icon: 'creditCard' },
    { href: '/notifications', label: 'Notifications', icon: 'bell' },
    { href: '/settings', label: 'Paramètres', icon: 'settings' },
  ];

  const companyName = extras.companyName || 'Mon entreprise';
  const planName = extras.planName || 'Aucun plan';

  return `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <h1>Pointify</h1>
        <div style="margin-top:6px;">
          <div style="font-size:12px;color:white;font-weight:600;word-break:break-word;">${companyName}</div>
          <div class="company-badge"><span class="plan-pill">${planName}</span></div>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${links.map(l => l.section
          ? `<div class="sidebar-section">${l.section}</div>`
          : `<a href="${l.href}" data-link class="sidebar-link ${active === l.href ? 'active' : ''}">
               ${icon(l.icon, 18)}<span>${l.label}</span>
             </a>`
        ).join('')}
        ${extras.isImpersonating ? `
          <div style="margin-top:16px;padding:12px;">
            <a href="/admin/companies" data-link class="btn btn-secondary" style="width:100%;font-size:12px;">
              ← Retour Admin
            </a>
          </div>
        ` : ''}
      </nav>
    </aside>
  `;
}

function renderEmployeeSidebar(active, extras = {}) {
  const links = [
    { href: '/my-dashboard', label: 'Accueil', icon: 'home' },
    { href: '/check-in', label: 'Pointer', icon: 'camera' },
    { href: '/my-attendance', label: 'Historique', icon: 'calendar' },
    { href: '/profile', label: 'Profil', icon: 'user' },
  ];

  const employeeName = extras.employeeName || 'Employé';

  return `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <h1>Pointify</h1>
        <div style="margin-top:6px;">
          <div style="font-size:12px;color:white;font-weight:600;">${employeeName}</div>
          <div class="company-badge"><span class="plan-pill">Employé</span></div>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${links.map(l => `
          <a href="${l.href}" data-link class="sidebar-link ${active === l.href ? 'active' : ''}">
            ${icon(l.icon, 18)}<span>${l.label}</span>
          </a>
        `).join('')}
      </nav>
    </aside>
  `;
}