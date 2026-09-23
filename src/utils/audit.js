import { supabase } from '../config/supabase.js';

/**
 * Enregistre une action dans audit_logs.
 * Usage: await logAction({ action: 'company.create', entity_type: 'companies', entity_id: id, new_values: {...} });
 */
export async function logAction({
  action,
  entity_type = null,
  entity_id = null,
  old_values = null,
  new_values = null,
  company_id = null,
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Récupère company_id du profil si non fourni
    let finalCompanyId = company_id;
    if (!finalCompanyId) {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single();

      if (profile?.role !== 'super_admin') {
        const { data: members } = await supabase
          .from('company_members').select('company_id')
          .eq('user_id', session.user.id).eq('status', 'active').limit(1);
        finalCompanyId = members?.[0]?.company_id || null;
      }
    }

    await supabase.from('audit_logs').insert({
      user_id: session.user.id,
      company_id: finalCompanyId,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values,
    });
  } catch (e) {
    // On ne bloque jamais l'action utilisateur à cause d'un log
    console.warn('[audit] log failed:', e);
  }
}