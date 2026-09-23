import { supabase } from '../config/supabase.js';
import { navigate } from '../router/router.js';
import { getCompanyContext } from './company.js';

export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { navigate('/login', true); return null; }
  return session;
}

export async function requireRole(allowedRoles = []) {
  const session = await requireAuth();
  if (!session) return null;

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', session.user.id).single();

  if (!profile || !allowedRoles.includes(profile.role)) {
    navigate('/login', true);
    return null;
  }
  return profile;
}

export async function requireCompany(allowedRoles = ['company_owner', 'company_admin', 'supervisor']) {
  const session = await requireAuth();
  if (!session) return null;

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', session.user.id).single();

  if (!profile) { navigate('/login', true); return null; }

  // Super admin : accès libre (avec ou sans impersonation)
  if (profile.role === 'super_admin') {
    const context = await getCompanyContext();
    if (!context) { navigate('/admin/companies', true); return null; }
    return { profile, context };
  }

  if (!allowedRoles.includes(profile.role)) {
    navigate('/login', true);
    return null;
  }

  const context = await getCompanyContext();
  if (!context) {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="auth-page">
        <div class="auth-card" style="text-align:center;">
          <h1 style="font-family:var(--pf-font-display);">Aucune entreprise</h1>
          <p style="color:var(--pf-text-muted);margin:12px 0 20px;">
            Votre compte n'est rattaché à aucune entreprise. Contactez votre administrateur.
          </p>
          <button class="btn btn-secondary" onclick="location.reload()">Recharger</button>
        </div>
      </div>
    `;
    return null;
  }

  return { profile, context };
}

export async function requireEmployee() {
  const session = await requireAuth();
  if (!session) return null;

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', session.user.id).single();

  if (!profile) { navigate('/login', true); return null; }

  // Super admin → renvoyer vers admin
  if (profile.role === 'super_admin') {
    navigate('/admin', true);
    return null;
  }

  if (profile.role !== 'employee') {
    navigate('/login', true);
    return null;
  }

  const { data: employee, error } = await supabase
    .from('employees')
    .select('*, companies(name), sites(name)')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!employee) {
    console.error('Accès employé refusé', { error, userId: session.user.id });
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="auth-page">
        <div class="auth-card" style="text-align:center;">
          <h1 style="font-family:var(--pf-font-display);">Compte employé incomplet</h1>
          <p style="color:var(--pf-text-muted);margin:12px 0 20px;">
            Votre connexion est valide, mais votre compte n'est pas encore rattaché à une fiche employé active.
            Contactez l'administrateur de votre entreprise.
          </p>
          <button class="btn btn-secondary" onclick="location.href='/login'">Retour à la connexion</button>
        </div>
      </div>
    `;
    return null;
  }

  return { profile, employee };
}