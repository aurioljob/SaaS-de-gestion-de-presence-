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

    toast('Connexion réussie', 'success');

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', data.user.id).single();

    const role = profile?.role;
    if (role === 'company_owner' || role === 'company_admin') {
  // Vérifie si onboarding est nécessaire
  const { data: members } = await supabase
    .from('company_members').select('company_id')
    .eq('user_id', data.user.id).eq('status', 'active').limit(1);

  if (members && members[0]) {
    const { count } = await supabase
      .from('sites').select('*', { count: 'exact', head: true })
      .eq('company_id', members[0].company_id);

    if (count === 0) navigate('/onboarding');
    else navigate('/dashboard');
  } else {
    navigate('/onboarding');
  }
}
  });
}