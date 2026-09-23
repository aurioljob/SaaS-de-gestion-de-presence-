import { supabase } from '../config/supabase.js';

let cachedContext = null;

export async function getCompanyContext() {
  if (cachedContext) return cachedContext;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  // Vérifie si l'utilisateur est super admin
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single();

  const impersonateId = getImpersonate();

  // Cas 1 : super admin en mode impersonation
  if (profile?.role === 'super_admin' && impersonateId) {
    const { data: company } = await supabase
      .from('companies').select('*').eq('id', impersonateId).single();

    if (!company) { setImpersonate(null); return null; }

    const { data: sub } = await supabase
      .from('subscriptions').select('*, plans(*)')
      .eq('company_id', impersonateId)
      .in('status', ['trial', 'active'])
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle();

    cachedContext = {
      company,
      companyId: company.id,
      role: 'super_admin',
      subscription: sub,
      plan: sub?.plans || null,
      isImpersonating: true,
    };
    return cachedContext;
  }

  // Cas 2 : utilisateur normal
  const { data: members } = await supabase
    .from('company_members')
    .select('company_id, role, companies(*)')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .limit(1);

  if (!members || members.length === 0) return null;

  const member = members[0];
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('company_id', member.company_id)
    .in('status', ['trial', 'active'])
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle();

  cachedContext = {
    company: member.companies,
    companyId: member.company_id,
    role: member.role,
    subscription: sub,
    plan: sub?.plans || null,
    isImpersonating: false,
  };
  return cachedContext;
}

export function clearCompanyContext() {
  cachedContext = null;
}

// export async function checkPlanLimit(resource) {
//   const ctx = await getCompanyContext();
//   if (!ctx) return { allowed: false, reason: 'no_company' };

//   const plan = ctx.plan;
//   if (!plan) return { allowed: true }; // pas d'abonnement → on laisse passer

//   if (resource === 'employees') {
//     const { count } = await supabase.from('employees')
//       .select('*', { count: 'exact', head: true })
//       .eq('company_id', ctx.companyId);
//     return { allowed: count < plan.max_employees, current: count, max: plan.max_employees };
//   }
//   if (resource === 'sites') {
//     const { count } = await supabase.from('sites')
//       .select('*', { count: 'exact', head: true })
//       .eq('company_id', ctx.companyId);
//     return { allowed: count < plan.max_sites, current: count, max: plan.max_sites };
//   }
//   return { allowed: true };
// }


// ... reste du fichier ...

const IMPERSONATE_KEY = 'pointify_impersonate_company';

export function setImpersonate(companyId) {
  if (companyId) localStorage.setItem(IMPERSONATE_KEY, companyId);
  else localStorage.removeItem(IMPERSONATE_KEY);
  cachedContext = null;
}

export function getImpersonate() {
  return localStorage.getItem(IMPERSONATE_KEY);
}

export function isImpersonating() {
  return !!getImpersonate();
}

// Ajoute à la fin du fichier

let featuresCache = null;
let subscriptionCache = null;

export async function getMyFeatures() {
  if (featuresCache) return featuresCache;

  const { data, error } = await supabase.rpc('my_features');
  if (error) {
    console.warn('my_features error:', error);
    featuresCache = [];
    return [];
  }
  featuresCache = data || [];
  return featuresCache;
}

export async function hasFeature(key) {
  const features = await getMyFeatures();
  return features.includes(key);
}

export function clearFeaturesCache() {
  featuresCache = null;
  subscriptionCache = null;
}

/**
 * Vérifie les limites du plan actuel
 * @returns { plan, current, max, allowed, reason }
 */
export async function checkLimit(resource) {
  const ctx = await getCompanyContext();
  if (!ctx) return { allowed: false, reason: 'no_company' };

  const plan = ctx.plan;
  if (!plan) return { allowed: true };

  if (resource === 'employees') {
    const { count } = await supabase.from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', ctx.companyId);
    return {
      allowed: count < plan.max_employees,
      current: count,
      max: plan.max_employees,
      remaining: Math.max(0, plan.max_employees - count),
    };
  }
  if (resource === 'sites') {
    const { count } = await supabase.from('sites')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', ctx.companyId);
    return {
      allowed: count < plan.max_sites,
      current: count,
      max: plan.max_sites,
      remaining: Math.max(0, plan.max_sites - count),
    };
  }
  if (resource === 'admins') {
    const { count } = await supabase.from('company_members')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', ctx.companyId)
      .in('role', ['company_owner', 'company_admin']);
    return {
      allowed: count < plan.max_admins,
      current: count,
      max: plan.max_admins,
      remaining: Math.max(0, plan.max_admins - count),
    };
  }
  return { allowed: true };
}