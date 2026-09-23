import { supabase } from '../../config/supabase.js';
import { requireEmployee } from '../../utils/guards.js';
import {
  employeeLayout,
  attachEmployeeHeaderEvents,
} from '../../components/employee-layout.js';
import { toast } from '../../components/toast.js';
import { setImpersonate } from '../../utils/company.js';

export async function employeeProfilePage(app) {
  const ctx = await requireEmployee();
  if (!ctx) return;
  const { profile, employee } = ctx;

  const content = `
    <div class="emp-hero">
      <h1>Mon profil</h1>
      <p>Mes informations</p>
    </div>

    <div style="text-align:center;margin-bottom:24px;">
      <div style="width:80px;height:80px;border-radius:50%;background:var(--pf-gradient);color:white;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:800;font-family:var(--pf-font-display);margin:0 auto 12px;">
        ${employee.first_name[0]}${employee.last_name[0]}
      </div>
      <div style="font-family:var(--pf-font-display);font-weight:700;font-size:1.2rem;">
        ${employee.first_name} ${employee.last_name}
      </div>
      <div style="font-size:13px;color:var(--pf-text-muted);">
        ${employee.position || 'Employé'}
      </div>
    </div>

    <div class="emp-history">
      <div class="emp-history-header">Informations</div>
      <div class="emp-history-item">
        <div class="emp-history-date">Email</div>
        <div style="font-size:13px;color:var(--pf-text-muted);">${employee.email || profile.email}</div>
      </div>
      <div class="emp-history-item">
        <div class="emp-history-date">Téléphone</div>
        <div style="font-size:13px;color:var(--pf-text-muted);">${employee.phone || '—'}</div>
      </div>
      <div class="emp-history-item">
        <div class="emp-history-date">Matricule</div>
        <div style="font-size:13px;color:var(--pf-text-muted);">${employee.employee_number || '—'}</div>
      </div>
      <div class="emp-history-item">
        <div class="emp-history-date">Site</div>
        <div style="font-size:13px;color:var(--pf-text-muted);">${employee.sites?.name || '—'}</div>
      </div>
      <div class="emp-history-item">
        <div class="emp-history-date">Entreprise</div>
        <div style="font-size:13px;color:var(--pf-text-muted);">${employee.companies?.name || '—'}</div>
      </div>
      <div class="emp-history-item">
        <div class="emp-history-date">Embauche</div>
        <div style="font-size:13px;color:var(--pf-text-muted);">${employee.hire_date || '—'}</div>
      </div>
    </div>

    <button class="btn btn-danger" id="emp-logout-big" style="width:100%;padding:16px;font-size:15px;margin-top:24px;">
      Se déconnecter
    </button>
  `;

  app.innerHTML = employeeLayout({ profile, active: '/profile', content });
  attachEmployeeHeaderEvents();

  document.getElementById('emp-logout-big').addEventListener('click', async () => {
    setImpersonate(null);
    await supabase.auth.signOut();
    window.location.href = '/login';
  });
}