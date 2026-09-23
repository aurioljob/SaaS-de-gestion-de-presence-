import { supabase } from '../../config/supabase.js';
import { requireRole } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { icon } from '../../components/icons.js';
import { formatMoney } from '../../utils/format.js';

export async function adminReportsPage(app) {
  const profile = await requireRole(['super_admin']);
  if (!profile) return;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/admin/reports')}
      <div class="main-content">
        ${renderTopbar(profile, 'Rapports plateforme')}
        <main class="page">
          <div class="page-header">
            <h1>Rapports & Analytics</h1>
            <p>Vue d'ensemble des indicateurs SaaS</p>
          </div>

          <div class="toolbar">
            <select class="input" id="period" style="max-width:200px;">
              <option value="30">30 derniers jours</option>
              <option value="90">90 derniers jours</option>
              <option value="365">12 derniers mois</option>
              <option value="all">Tout l'historique</option>
            </select>
            <div class="toolbar-spacer"></div>
            <button class="btn btn-secondary" id="export">${icon('download',16)} Exporter CSV</button>
          </div>

          <div id="report-content">
            <div class="loading"><div class="spinner"></div>Analyse…</div>
          </div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();
  document.getElementById('period').addEventListener('change', () => load(profile));
  document.getElementById('export').addEventListener('click', () => exportCsv());

  await load(profile);
}

let currentData = null;

async function load(profile) {
  const content = document.getElementById('report-content');
  const period = document.getElementById('period').value;

  let since = null;
  if (period !== 'all') {
    since = new Date(Date.now() - Number(period) * 86400000).toISOString();
  }

  // Récupère toutes les données en parallèle
  const [
    companiesQuery,
    subsQuery,
    paymentsQuery,
    employeesQuery,
    attendancesQuery,
  ] = await Promise.all([
    supabase.from('companies').select('id, name, status, created_at'),
    supabase.from('subscriptions').select('id, company_id, plan_id, status, price, currency, billing_cycle, starts_at, plans(name)'),
    supabase.from('payments').select('id, company_id, amount, currency, status, paid_at, created_at'),
    supabase.from('employees').select('id, company_id, status'),
    supabase.from('attendance').select('id, company_id, work_date, status, worked_minutes'),
  ]);

  const companies = companiesQuery.data || [];
  const subs = subsQuery.data || [];
  const payments = paymentsQuery.data || [];
  const employees = employeesQuery.data || [];
  const attendances = attendancesQuery.data || [];

  // Filtre par période
  const filterSince = (arr, key) => since ? arr.filter(x => x[key] && x[key] >= since) : arr;
  const companiesF = filterSince(companies, 'created_at');
  const paymentsF = filterSince(payments, 'created_at');
  const attendancesF = filterSince(attendances, 'work_date');

  // KPIs
  const activeCompanies = companies.filter(c => c.status === 'active').length;
  const totalCompanies = companies.length;
  const totalEmployees = employees.filter(e => e.status === 'active').length;
  const paidPayments = paymentsF.filter(p => p.status === 'paid');
  const totalRevenue = paidPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const activeSubs = subs.filter(s => s.status === 'active');

  // MRR (Revenus Mensuels Récurrents)
  const mrr = activeSubs.reduce((sum, s) => {
    const monthly = s.billing_cycle === 'yearly' ? (s.price || 0) / 12 : (s.price || 0);
    return sum + Number(monthly);
  }, 0);
  const arr = mrr * 12;

  // Revenus par plan
  const revenueByPlan = {};
  activeSubs.forEach(s => {
    const planName = s.plans?.name || 'Inconnu';
    if (!revenueByPlan[planName]) revenueByPlan[planName] = { count: 0, mrr: 0 };
    revenueByPlan[planName].count++;
    const monthly = s.billing_cycle === 'yearly' ? (s.price || 0) / 12 : (s.price || 0);
    revenueByPlan[planName].mrr += Number(monthly);
  });

  // Top entreprises par employés
  const employeesByCompany = {};
  employees.forEach(e => {
    if (e.status !== 'active') return;
    employeesByCompany[e.company_id] = (employeesByCompany[e.company_id] || 0) + 1;
  });
  const topCompanies = companies
    .map(c => ({
      name: c.name,
      status: c.status,
      employees: employeesByCompany[c.id] || 0,
      revenue: activeSubs.filter(s => s.company_id === c.id).reduce((sum, s) => {
        const monthly = s.billing_cycle === 'yearly' ? (s.price || 0) / 12 : (s.price || 0);
        return sum + Number(monthly);
      }, 0),
    }))
    .sort((a, b) => b.employees - a.employees)
    .slice(0, 10);

  // Croissance : nouveaux clients par mois (12 derniers mois)
  const monthlyGrowth = {};
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    monthlyGrowth[key] = { clients: 0, revenue: 0 };
  }
  companies.forEach(c => {
    if (!c.created_at) return;
    const d = new Date(c.created_at);
    const key = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    if (monthlyGrowth[key]) monthlyGrowth[key].clients++;
  });
  paidPayments.forEach(p => {
    if (!p.created_at) return;
    const d = new Date(p.created_at);
    const key = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    if (monthlyGrowth[key]) monthlyGrowth[key].revenue += Number(p.amount || 0);
  });

  currentData = { companies, subs, payments, employees, attendances };

  const maxRevenue = Math.max(...Object.values(monthlyGrowth).map(m => m.revenue), 1);
  const maxClients = Math.max(...Object.values(monthlyGrowth).map(m => m.clients), 1);

  content.innerHTML = `
    <div class="stats-grid">
      <div class="card">
        <div class="card-title">MRR</div>
        <div class="card-value" style="color:var(--pf-success);">${formatMoney(mrr)}</div>
        <div style="font-size:12px;color:var(--pf-text-muted);margin-top:4px;">Revenus mensuels récurrents</div>
      </div>
      <div class="card">
        <div class="card-title">ARR</div>
        <div class="card-value">${formatMoney(arr)}</div>
        <div style="font-size:12px;color:var(--pf-text-muted);margin-top:4px;">Revenus annuels récurrents</div>
      </div>
      <div class="card">
        <div class="card-title">Entreprises actives</div>
        <div class="card-value">${activeCompanies} / ${totalCompanies}</div>
      </div>
      <div class="card">
        <div class="card-title">Employés gérés</div>
        <div class="card-value">${totalEmployees}</div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="card">
        <div class="card-title">Revenus période</div>
        <div class="card-value">${formatMoney(totalRevenue)}</div>
      </div>
      <div class="card">
        <div class="card-title">Paiements</div>
        <div class="card-value">${paidPayments.length}</div>
      </div>
      <div class="card">
        <div class="card-title">Abonnements actifs</div>
        <div class="card-value">${activeSubs.length}</div>
      </div>
      <div class="card">
        <div class="card-title">Pointages période</div>
        <div class="card-value">${attendancesF.length}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;">
      <div class="card-title">Croissance mensuelle</div>
      <div style="display:flex;align-items:flex-end;gap:8px;height:200px;padding:20px 0;">
        ${Object.entries(monthlyGrowth).map(([month, data]) => {
          const h = maxRevenue > 0 ? (data.revenue / maxRevenue) * 160 : 0;
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;">
              <div style="font-size:10px;color:var(--pf-text-muted);">${data.revenue > 0 ? Math.round(data.revenue/1000) + 'k' : ''}</div>
              <div style="width:100%;background:var(--pf-gradient);border-radius:6px 6px 0 0;height:${Math.max(h, 2)}px;min-height:2px;transition:height 0.3s;"></div>
              <div style="font-size:10px;color:var(--pf-text-muted);transform:rotate(-45deg);white-space:nowrap;">${month}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
      <div class="card">
        <div class="card-title">Revenus par plan</div>
        ${Object.keys(revenueByPlan).length > 0 ? `
          <table class="table">
            <thead><tr><th>Plan</th><th>Clients</th><th>MRR</th></tr></thead>
            <tbody>
              ${Object.entries(revenueByPlan).map(([plan, data]) => `
                <tr>
                  <td><strong>${plan}</strong></td>
                  <td>${data.count}</td>
                  <td>${formatMoney(data.mrr)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<div class="empty" style="padding:20px;"><p>Aucune donnée</p></div>'}
      </div>

      <div class="card">
        <div class="card-title">Top 10 entreprises</div>
        ${topCompanies.length > 0 ? `
          <table class="table">
            <thead><tr><th>#</th><th>Nom</th><th>Employés</th><th>MRR</th></tr></thead>
            <tbody>
              ${topCompanies.map((c, i) => `
                <tr>
                  <td><strong>${i + 1}</strong></td>
                  <td>${c.name}</td>
                  <td>${c.employees}</td>
                  <td>${formatMoney(c.revenue)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<div class="empty" style="padding:20px;"><p>Aucune donnée</p></div>'}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Répartition des statuts d'entreprises</div>
      <div style="display:flex;gap:20px;padding:10px 0;">
        ${['active', 'suspended', 'pending'].map(status => {
          const count = companies.filter(c => c.status === status).length;
          const pct = totalCompanies > 0 ? Math.round((count / totalCompanies) * 100) : 0;
          const color = status === 'active' ? 'var(--pf-success)' : status === 'suspended' ? 'var(--pf-danger)' : 'var(--pf-warning)';
          const label = status === 'active' ? 'Actives' : status === 'suspended' ? 'Suspendues' : 'En attente';
          return `
            <div style="flex:1;background:#f9fafb;border-radius:12px;padding:16px;text-align:center;">
              <div style="font-size:1.5rem;font-weight:800;color:${color};font-family:var(--pf-font-display);">${count}</div>
              <div style="font-size:12px;color:var(--pf-text-muted);margin-top:4px;">${label}</div>
              <div style="font-size:11px;color:var(--pf-text-muted);margin-top:2px;">${pct}%</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

async function exportCsv() {
  if (!currentData) return;
  const { companies, subs, payments, employees } = currentData;

  // Export global : 1 ligne par entreprise
  const rows = companies.map(c => {
    const sub = subs.find(s => s.company_id === c.id && s.status === 'active');
    const empCount = employees.filter(e => e.company_id === c.id && e.status === 'active').length;
    const revenue = payments
      .filter(p => p.company_id === c.id && p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return [
      c.name,
      c.status,
      empCount,
      sub?.plans?.name || '',
      revenue,
    ];
  });

  const headers = ['Entreprise', 'Statut', 'Employés actifs', 'Plan', 'Revenus totaux'];
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pointify-rapport-global-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}