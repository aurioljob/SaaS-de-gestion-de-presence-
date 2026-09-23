import { supabase } from '../../config/supabase.js';
import { toast } from '../../components/toast.js';
import { navigate } from '../../router/router.js';

export async function loginPage(app) {
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <h1>Pointify</h1>
          <p>Présences. Contrôle. Performance.</p>
        </div>
        <form id="login-form">
          <div class="form-group">
            <label class="label">Email</label>
            <input type="email" class="input" name="email" required />
          </div>
          <div class="form-group">
            <label class="label">Mot de passe</label>
            <input type="password" class="input" name="password" required />
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;" id="login-btn">
            Se connecter
          </button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled = true; btn.textContent = 'Connexion…';

    const fd = new FormData(e.target);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: fd.get('email'),
      password: fd.get('password'),
    });

    if (error) {
      toast(error.message, 'error');
      btn.disabled = false; btn.textContent = 'Se connecter';
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('role').eq('id', data.user.id).single();

    if (profileError || !profile) {
      console.error('Profil introuvable après connexion', profileError);
      toast('Connexion réussie, mais votre profil est introuvable.', 'error');
      btn.disabled = false;
      btn.textContent = 'Se connecter';
      return;
    }

    toast('Connexion réussie', 'success');

    const role = profile?.role;
    if (role === 'super_admin') {
      navigate('/admin');
      return;
    }

    if (role === 'employee') {
      navigate('/my-dashboard');
      return;
    }

    if (['company_owner', 'company_admin', 'supervisor'].includes(role)) {
      const { data: members, error: membersError } = await supabase
        .from('company_members').select('company_id')
        .eq('user_id', data.user.id).eq('status', 'active').limit(1);

      if (membersError) {
        toast('Impossible de vérifier votre entreprise.', 'error');
        return;
      }

      if (members?.[0]) {
        const { count, error: sitesError } = await supabase
          .from('sites').select('*', { count: 'exact', head: true })
          .eq('company_id', members[0].company_id);

        if (sitesError) {
          toast('Impossible de vérifier votre entreprise.', 'error');
          return;
        }

        navigate(count === 0 ? '/onboarding' : '/dashboard');
      } else {
        navigate('/onboarding');
      }
      return;
    }

    toast(`Rôle utilisateur non reconnu : ${role || 'aucun'}`, 'error');
  });
}