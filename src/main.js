import { register } from './router/router.js';
import { loginPage } from './pages/public/login.js';
import { initInstallPrompt } from './components/install-widget.js';
import { landingPage } from './pages/public/landing.js';
import { registerPage } from './pages/public/register.js';
import { pricingPage } from './pages/public/pricing.js';
import { companyOnboardingPage } from './pages/company/onboarding.js';
import { acceptInvitePage } from './pages/public/accept-invite.js';

// Admin
import { adminDashboardPage } from './pages/admin/dashboard.js';
import { adminCompaniesPage } from './pages/admin/companies.js';
import { adminPlansPage } from './pages/admin/plans.js';
import { adminFeaturesPage } from './pages/admin/features.js';
import { adminSubscriptionsPage } from './pages/admin/subscriptions.js';
import { adminPaymentsPage } from './pages/admin/payments.js';
import { adminCouponsPage } from './pages/admin/coupons.js';
import { adminAuditLogsPage } from './pages/admin/audit-logs.js';
import { adminSettingsPage } from './pages/admin/settings.js';

// Entreprise
import { companyDashboardPage } from './pages/company/dashboard.js';
import { companyEmployeesPage } from './pages/company/employees.js';
import { companyDepartmentsPage } from './pages/company/departments.js';
import { companySitesPage } from './pages/company/sites.js';
import { companyQrCodesPage } from './pages/company/qr-codes.js';
import { companySchedulesPage } from './pages/company/schedules.js';
import { companySubscriptionPage } from './pages/company/subscription.js';
import { companySettingsPage } from './pages/company/settings.js';
import { companyAttendancePage } from './pages/company/attendance.js';
import { companyReportsPage } from './pages/company/reports.js';
import { companyNotificationsPage } from './pages/company/notifications.js';

import { employeeDashboardPage } from './pages/employee/dashboard.js';
import { employeeCheckInPage } from './pages/employee/check-in.js';
import { employeeAttendancePage } from './pages/employee/attendance.js';
import { employeeProfilePage } from './pages/employee/profile.js';

// Public
register('/', landingPage);
register('/login', loginPage);
register('/register', registerPage);
register('/pricing', pricingPage);
register('/onboarding', companyOnboardingPage);
register('/accept-invite', acceptInvitePage);

// Admin
register('/admin', adminDashboardPage);
register('/admin/companies', adminCompaniesPage);
register('/admin/plans', adminPlansPage);
register('/admin/features', adminFeaturesPage);
register('/admin/subscriptions', adminSubscriptionsPage);
register('/admin/payments', adminPaymentsPage);
register('/admin/coupons', adminCouponsPage);
register('/admin/audit-logs', adminAuditLogsPage);
register('/admin/settings', adminSettingsPage);

// Entreprise
register('/dashboard', companyDashboardPage);
register('/employees', companyEmployeesPage);
register('/departments', companyDepartmentsPage);
register('/sites', companySitesPage);
register('/qr-codes', companyQrCodesPage);
register('/schedules', companySchedulesPage);
register('/subscription', companySubscriptionPage);
register('/settings', companySettingsPage);

// Placeholders admin
const adminPlaceholder = (title) => async (app) => {
  const { renderSidebar } = await import('./components/sidebar.js');
  const { renderTopbar, attachTopbarEvents } = await import('./components/topbar.js');
  const { requireRole } = await import('./utils/guards.js');
  const profile = await requireRole(['super_admin']);
  if (!profile) return;
  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/admin')}
      <div class="main-content">
        ${renderTopbar(profile, title)}
        <main class="page">
          <div class="empty"><h3>${title}</h3><p>Section à venir.</p></div>
        </main>
      </div>
    </div>`;
  attachTopbarEvents();
};
register('/admin/users', adminPlaceholder('Utilisateurs'));
register('/admin/employees', adminPlaceholder('Employés'));
register('/admin/reports', adminPlaceholder('Rapports'));

// Placeholders entreprise
// const companyPlaceholder = (title) => async (app) => {
//   const { requireCompany } = await import('./utils/guards.js');
//   const { renderSidebar } = await import('./components/sidebar.js');
//   const { renderTopbar, attachTopbarEvents } = await import('./components/topbar.js');

//   const result = await requireCompany();
//   if (!result) return;

//   const { profile, context } = result;

//   app.innerHTML = `
//     <div class="app-layout">
//       ${renderSidebar('/dashboard', 'company', {
//         companyName: context.company.name,
//         planName: context.plan?.name || 'Aucun plan',
//         isImpersonating: context.isImpersonating,
//       })}
//       <div class="main-content">
//         ${renderTopbar(profile, title, {
//           isImpersonating: context.isImpersonating,
//           companyName: context.company.name,
//         })}
//         <main class="page">
//           <div class="empty"><h3>${title}</h3><p>Section à venir en Phase 3.</p></div>
//         </main>
//       </div>
//     </div>`;

//   attachTopbarEvents();
// };



register('/attendance', companyAttendancePage);
register('/reports', companyReportsPage);
register('/notifications', companyNotificationsPage);

// Employé
register('/my-dashboard', employeeDashboardPage);
register('/check-in', employeeCheckInPage);
register('/my-attendance', employeeAttendancePage);
register('/profile', employeeProfilePage);

initInstallPrompt();