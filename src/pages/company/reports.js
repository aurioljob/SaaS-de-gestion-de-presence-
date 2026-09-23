import { supabase } from '../../config/supabase.js';
import { requireCompany as guardCompany } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { icon } from '../../components/icons.js';
import { toast } from '../../components/toast.js';

export async function companyReportsPage(app) {
  const ctx = await guardCompany();
  if (!ctx) return;
  const { profile, context } = ctx;

  // Bornes par défaut : 30 derniers jours
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/reports', 'company', {
        companyName: context.company.name,
        planName: context.plan?.name || '—',
        isImpersonating: context.isImpersonating,
      })}
      <div class="main-content">
        ${renderTopbar(profile, 'Rapports', {
          isImpersonating: context.isImpersonating,
          companyName: context.company.name,
        })}
        <main class="page">
          <div class="page-header">
            <h1>Rapports & statistiques</h1>
            <p>Analysez les présences sur une période</p>
          </div>

          <div class="toolbar">
            <input type="date" class="input" id="from" value="${start.toISOString().slice(0,10)}" style="max-width:180px;" />
            <input type="date" class="input" id="to" value="${end.toISOString().slice(0,10)}" style="max-width:180px;" />
            <select class="input" id="site-filter" style="max-width:200px;">
              <option value="">Tous les sites</option>
            </select>
            <div class="toolbar-spacer"></div>
            <button class="btn btn-primary" id="generate">Générer</button>
            <button class="btn btn-secondary" id="export-csv">${icon('download',16)} CSV</button>
            <button class="btn btn-secondary" id="export-pdf">${icon('fileText',16)} PDF</button>
          </div>

          <div id="report-content">
            <div class="empty"><p>Cliquez sur « Générer » pour voir le rapport</p></div>
          </div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();

  const { data: sites } = await supabase.from('sites').select('id, name')
    .eq('company_id', context.companyId).order('name');
  const siteFilter = document.getElementById('site-filter');
  (sites || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.name;
    siteFilter.appendChild(opt);
  });

  document.getElementById('generate').addEventListener('click', () => generate(context));
  document.getElementById('export-csv').addEventListener('click', () => exportCsv(context));
  document.getElementById('export-pdf').addEventListener('click', () => exportPdf(context));

  await generate(context);
}

async function generate(context) {
  const content = document.getElementById('report-content');
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const siteId = document.getElementById('site-filter').value;

  content.innerHTML = `<div class="loading"><div class="spinner"></div>Analyse…</div>`;

  let query = supabase.from('attendance').select(`
    *, employees(first_name, last_name, employee_number), sites(name)
  `).eq('company_id', context.companyId).gte('work_date', from).lte('work_date', to);

  if (siteId) query = query.eq('site_id', siteId);

  const { data, error } = await query.order('work_date', { ascending: false });
  if (error) { content.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }

  if (!data || data.length === 0) {
    content.innerHTML = `<div class="empty"><h3>Aucune donnée</h3><p>Sur cette période</p></div>`;
    return;
  }

  // Statistiques
  const total = data.length;
  const present = data.filter(a => a.status === 'present').length;
  const late = data.filter(a => a.status === 'late').length;
  const absent = data.filter(a => a.status === 'absent').length;
  const totalMinutes = data.reduce((s, a) => s + (a.worked_minutes || 0), 0);
  const avgMinutes = total > 0 ? Math.round(totalMinutes / total) : 0;

  // Top employés
  const byEmployee = {};
  data.forEach(a => {
    const key = a.employee_id;
    if (!byEmployee[key]) {
      byEmployee[key] = {
        name: `${a.employees?.first_name || ''} ${a.employees?.last_name || ''}`.trim(),
        number: a.employees?.employee_number || '',
        days: 0, late: 0, minutes: 0,
      };
    }
    byEmployee[key].days++;
    if (a.status === 'late') byEmployee[key].late++;
    byEmployee[key].minutes += (a.worked_minutes || 0);
  });
  const topEmployees = Object.values(byEmployee)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10);

  const fmtH = (min) => `${Math.floor(min/60)}h${String(min%60).padStart(2,'0')}`;

  content.innerHTML = `
    <div class="stats-grid">
      <div class="card">
        <div class="card-title">Total pointages</div>
        <div class="card-value">${total}</div>
      </div>
      <div class="card">
        <div class="card-title">Présents</div>
        <div class="card-value" style="color:var(--pf-success);">${present}</div>
      </div>
      <div class="card">
        <div class="card-title">Retards</div>
        <div class="card-value" style="color:var(--pf-warning);">${late}</div>
      </div>
      <div class="card">
        <div class="card-title">Absents</div>
        <div class="card-value" style="color:var(--pf-danger);">${absent}</div>
      </div>
      <div class="card">
        <div class="card-title">Heures totales</div>
        <div class="card-value">${fmtH(totalMinutes)}</div>
      </div>
      <div class="card">
        <div class="card-title">Durée moyenne</div>
        <div class="card-value">${fmtH(avgMinutes)}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Top 10 employés (heures travaillées)</div>
      <table class="table">
        <thead><tr><th>#</th><th>Employé</th><th>Jours</th><th>Retards</th><th>Heures</th></tr></thead>
        <tbody>
          ${topEmployees.map((e, i) => `
            <tr>
              <td><strong>${i + 1}</strong></td>
              <td>${e.name}<br><small style="color:var(--pf-text-muted);">${e.number}</small></td>
              <td>${e.days}</td>
              <td>${e.late > 0 ? `<span class="badge badge-warning">${e.late}</span>` : '—'}</td>
              <td><strong>${fmtH(e.minutes)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function exportCsv(context) {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const siteId = document.getElementById('site-filter').value;

  let query = supabase.from('attendance').select(`
    *, employees(first_name, last_name, employee_number), sites(name)
  `).eq('company_id', context.companyId).gte('work_date', from).lte('work_date', to);
  if (siteId) query = query.eq('site_id', siteId);

  const { data } = await query.order('work_date', { ascending: false });
  if (!data || data.length === 0) { toast('Aucune donnée', 'warning'); return; }

  const headers = ['Date', 'Employé', 'Matricule', 'Site', 'Arrivée', 'Sortie', 'Durée (min)', 'Statut'];
  const rows = data.map(r => [
    r.work_date,
    `${r.employees?.first_name || ''} ${r.employees?.last_name || ''}`.trim(),
    r.employees?.employee_number || '',
    r.sites?.name || '',
    r.check_in ? new Date(r.check_in).toLocaleTimeString('fr-FR') : '',
    r.check_out ? new Date(r.check_out).toLocaleTimeString('fr-FR') : '',
    r.worked_minutes || 0,
    r.status,
  ]);

  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pointify-rapport-${from}_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportPdf(context) {
  toast('Génération PDF…', 'info');
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const siteId = document.getElementById('site-filter').value;

  let query = supabase.from('attendance').select(`
    *, employees(first_name, last_name, employee_number), sites(name)
  `).eq('company_id', context.companyId).gte('work_date', from).lte('work_date', to);
  if (siteId) query = query.eq('site_id', siteId);

  const { data } = await query.order('work_date', { ascending: false });
  if (!data || data.length === 0) { toast('Aucune donnée', 'warning'); return; }

  // Utilise jsPDF via CDN
  const { jsPDF } = await import('https://esm.sh/jspdf@2.5.1');
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(18);
  doc.text('Pointify — Rapport de présences', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${context.company.name} · Du ${from} au ${to}`, 14, 28);

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(14, 32, doc.internal.pageSize.width - 14, 32);

  let y = 42;
  const headers = ['Date', 'Employé', 'Matricule', 'Site', 'Arrivée', 'Sortie', 'Durée', 'Statut'];
  const colX = [14, 35, 80, 105, 145, 165, 185, 210];

  doc.setFontSize(9);
  doc.setTextColor(100);
  headers.forEach((h, i) => doc.text(h, colX[i], y));
  y += 5;

  doc.setTextColor(20);
  data.slice(0, 40).forEach((r) => {
    const dur = r.worked_minutes ? `${Math.floor(r.worked_minutes/60)}h${String(r.worked_minutes%60).padStart(2,'0')}` : '-';
    const row = [
      r.work_date,
      `${r.employees?.first_name || ''} ${r.employees?.last_name || ''}`.slice(0, 22),
      r.employees?.employee_number || '-',
      (r.sites?.name || '-').slice(0, 18),
      r.check_in ? new Date(r.check_in).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '-',
      r.check_out ? new Date(r.check_out).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '-',
      dur,
      r.status,
    ];
    row.forEach((c, i) => doc.text(String(c), colX[i], y));
    y += 6;
    if (y > doc.internal.pageSize.height - 20) { doc.addPage(); y = 20; }
  });

  doc.save(`pointify-rapport-${from}_${to}.pdf`);
  toast('PDF téléchargé', 'success');
}