import { supabase } from '../../config/supabase.js';
import { requireCompany as guardCompany } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { subscribeToAttendance, unsubscribe } from '../../utils/realtime.js';
import { icon } from '../../components/icons.js';
import { toast } from '../../components/toast.js';

let channel = null;

export async function companyDashboardPage(app) {
  const ctx = await guardCompany();
  if (!ctx) return;
  const { profile, context } = ctx;
  const companyId = context.companyId;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/dashboard', 'company', {
        companyName: context.company.name,
        planName: context.plan?.name || 'Aucun plan',
        isImpersonating: context.isImpersonating,
      })}
      <div class="main-content">
        ${renderTopbar(profile, 'Tableau de bord', {
          isImpersonating: context.isImpersonating,
          companyName: context.company.name,
        })}
        <main class="page">
          <div class="page-header">
            <h1>Bonjour, ${profile.full_name?.split(' ')[0] || 'Admin'}</h1>
            <p style="display:flex;align-items:center;gap:8px;">
              ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 8px;background:#d1fae5;color:#065f46;border-radius:999px;font-weight:600;">
                <span style="width:6px;height:6px;background:#10b981;border-radius:50%;animation:livePulse 2s infinite;"></span>
                LIVE
              </span>
            </p>
          </div>

          <div id="dashboard-content">
            <div class="loading"><div class="spinner"></div>Chargement…</div>
          </div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();

  await loadDashboard(context);

  // Realtime
  channel = subscribeToAttendance(companyId, () => {
    loadDashboard(context, true);
  });
}

async function loadDashboard(context, silent = false) {
  const companyId = context.companyId;
  const today = new Date().toISOString().slice(0, 10);
  const content = document.getElementById('dashboard-content');
  if (!content) return;

  const [
    { count: employeesCount },
    { data: todayAttendance },
    { data: recentEvents },
    { data: sitesCount },
  ] = await Promise.all([
    supabase.from('employees').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('status', 'active'),
    supabase.from('attendance').select(`*, employees(first_name, last_name), sites(name)`)
      .eq('company_id', companyId).eq('work_date', today),
    supabase.from('attendance_events').select(`*, employees(first_name, last_name), sites(name)`)
      .in('site_id', await getCompanySiteIds(companyId))
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('sites').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('status', 'active'),
  ]);

  const present = (todayAttendance || []).filter(a => a.check_in).length;
  const late = (todayAttendance || []).filter(a => a.status === 'late').length;
  const absent = Math.max(0, (employeesCount || 0) - present);

  const statsHTML = `
    <div class="stats-grid">
      <div class="card">
        <div class="card-title">Employés actifs</div>
        <div class="card-value">${employeesCount || 0}</div>
      </div>
      <div class="card">
        <div class="card-title">Présents aujourd'hui</div>
        <div class="card-value" style="color:var(--pf-success);" id="stat-present">${present}</div>
      </div>
      <div class="card">
        <div class="card-title">En retard</div>
        <div class="card-value" style="color:var(--pf-warning);" id="stat-late">${late}</div>
      </div>
      <div class="card">
        <div class="card-title">Absents</div>
        <div class="card-value" style="color:var(--pf-danger);" id="stat-absent">${absent}</div>
      </div>
    </div>
  `;

  const eventsHTML = `
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;">
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;gap:8px;">
          ${icon('clock', 16)} Flux en direct
        </div>
        ${recentEvents && recentEvents.length > 0 ? `
          <div style="max-height:400px;overflow-y:auto;">
            ${recentEvents.map(e => `
              <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--pf-border);">
                <div style="width:36px;height:36px;border-radius:50%;background:${e.event_type === 'check_in' ? '#d1fae5' : '#fee2e2'};color:${e.event_type === 'check_in' ? '#065f46' : '#991b1b'};display:flex;align-items:center;justify-content:center;">
                  ${icon(e.event_type === 'check_in' ? 'arrowRight' : 'logout', 16)}
                </div>
                <div style="flex:1;">
                  <div style="font-weight:600;font-size:14px;">${e.employees?.first_name || '?'} ${e.employees?.last_name || ''}</div>
                  <div style="font-size:12px;color:var(--pf-text-muted);">${e.sites?.name || '—'}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-weight:700;font-size:14px;">${new Date(e.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}</div>
                  <div style="font-size:11px;color:var(--pf-text-muted);">${e.distance_meters ? Math.round(e.distance_meters) + ' m' : ''}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `<div class="empty" style="padding:30px;"><p>Aucun pointage aujourd'hui</p></div>`}
      </div>

      <div class="card">
        <div class="card-title">Actions rapides</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <a href="/employees" data-link class="btn btn-primary" style="justify-content:flex-start;">${icon('userCheck',16)} Ajouter un employé</a>
          <a href="/sites" data-link class="btn btn-secondary" style="justify-content:flex-start;">${icon('mapPin',16)} Gérer les sites</a>
          <a href="/qr-codes" data-link class="btn btn-secondary" style="justify-content:flex-start;">${icon('qrCode',16)} Générer un QR</a>
          <a href="/schedules" data-link class="btn btn-secondary" style="justify-content:flex-start;">${icon('clock',16)} Configurer horaires</a>
        </div>
      </div>
    </div>
  `;

  content.innerHTML = statsHTML + eventsHTML;

  if (!silent) {
    content.querySelectorAll('.card, .stat-value').forEach(el => el.classList.add('page-transition'));
  } else {
    // Feedback visuel quand le realtime pousse une maj
    const presentEl = document.getElementById('stat-present');
    if (presentEl) {
      presentEl.style.transition = 'color 0.3s';
      presentEl.style.color = '#10b981';
      setTimeout(() => presentEl.style.color = '', 600);
    }
  }
}

async function getCompanySiteIds(companyId) {
  const { data } = await supabase.from('sites').select('id').eq('company_id', companyId);
  return (data || []).map(s => s.id);
}

// Nettoyage
window.addEventListener('beforeunload', () => unsubscribe(channel));