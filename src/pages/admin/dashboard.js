import { supabase } from '../../config/supabase.js';
import { requireRole } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';

export async function adminDashboardPage(app) {
  const profile = await requireRole(['super_admin']);
  if (!profile) return;

  const [
    { count: companiesCount },
    { count: activeCompanies },
    { count: suspendedCompanies },
    { count: employeesCount },
    { count: activeSubs },
    { count: eventsToday },
    { data: monthRevenue },
  ] = await Promise.all([
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('companies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('companies').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
    supabase.from('employees').select('*', { count: 'exact', head: true }),
    supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('attendance_events').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date().toISOString().slice(0,10)),
    supabase.from('payments').select('amount, currency').eq('status', 'paid')
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);

  const revenue = (monthRevenue || []).reduce((s, p) => s + Number(p.amount || 0), 0);

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/admin')}
      <div class="main-content">
        ${renderTopbar(profile, 'Dashboard global')}
        <main class="page">
          <div class="page-header">
            <h1>Vue d'ensemble</h1>
            <p>Activité de la plateforme Pointify</p>
          </div>

          <div class="stats-grid">
            <div class="card">
              <div class="card-title">Entreprises actives</div>
              <div class="card-value">${activeCompanies ?? 0}</div>
            </div>
            <div class="card">
              <div class="card-title">Employés totaux</div>
              <div class="card-value">${employeesCount ?? 0}</div>
            </div>
            <div class="card">
              <div class="card-title">Abonnements actifs</div>
              <div class="card-value">${activeSubs ?? 0}</div>
            </div>
            <div class="card">
              <div class="card-title">Revenus du mois</div>
              <div class="card-value">${revenue.toLocaleString('fr-FR')} XAF</div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="card">
              <div class="card-title">Entreprises totales</div>
              <div class="card-value">${companiesCount ?? 0}</div>
            </div>
            <div class="card">
              <div class="card-title">Suspendues</div>
              <div class="card-value">${suspendedCompanies ?? 0}</div>
            </div>
            <div class="card">
              <div class="card-title">Pointages aujourd'hui</div>
              <div class="card-value">${eventsToday ?? 0}</div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Démarrage rapide</div>
            <p style="color:var(--pf-text-muted);font-size:14px;margin-bottom:16px;">
              Configurez vos premiers plans et fonctionnalités pour commencer.
            </p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <a href="/admin/plans" data-link class="btn btn-primary">Gérer les plans</a>
              <a href="/admin/features" data-link class="btn btn-secondary">Fonctionnalités</a>
              <a href="/admin/companies" data-link class="btn btn-secondary">Entreprises</a>
            </div>
          </div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
}