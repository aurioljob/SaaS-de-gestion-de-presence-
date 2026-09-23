import { supabase } from '../../config/supabase.js';
import { toast } from '../../components/toast.js';
import { navigate } from '../../router/router.js';
import { icon } from '../../components/icons.js';

export async function registerPage(app) {
  const params = new URLSearchParams(location.search);
  const preselectedPlan = params.get('plan');

  const { data: plans } = await supabase
    .from('plans').select('*').eq('is_active', true).order('monthly_price');

  app.innerHTML = `
    <div class="auth-page" style="align-items:flex-start;padding-top:40px;">
      <div class="auth-card" style="max-width:520px;">
        <div class="auth-logo">
          <h1>Créer votre espace</h1>
          <p>14 jours d'essai · Sans carte bancaire</p>
        </div>

        <form id="register-form">
          <div class="form-row">
            <div class="form-group">
              <label class="label">Prénom *</label>
              <input class="input" name="first_name" required />
            </div>
            <div class="form-group">
              <label class="label">Nom *</label>
              <input class="input" name="last_name" required />
            </div>
          </div>

          <div class="form-group">
            <label class="label">Email professionnel *</label>
            <input class="input" type="email" name="email" required autocomplete="email" />
          </div>

          <div class="form-group">
            <label class="label">Mot de passe * (min. 8 caractères)</label>
            <input class="input" type="password" name="password" minlength="8" required autocomplete="new-password" />
          </div>

          <hr style="margin:24px 0;border:none;border-top:1px solid var(--pf-border);" />

          <div class="form-group">
            <label class="label">Nom de votre entreprise *</label>
            <input class="input" name="company_name" required placeholder="TechCorp SARL" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="label">Pays</label>
              <input class="input" name="country" value="Cameroun" />
            </div>
            <div class="form-group">
              <label class="label">Ville</label>
              <input class="input" name="city" placeholder="Douala" />
            </div>
          </div>

          <div class="form-group">
            <label class="label">Plan de départ</label>
            <select class="input" name="plan_id">
              ${(plans || []).map(p => `
                <option value="${p.id}" ${p.id === preselectedPlan ? 'selected' : ''}>
                  ${p.name} — ${p.monthly_price === 0 ? 'Gratuit' : Number(p.monthly_price).toLocaleString('fr-FR') + ' ' + p.currency + '/mois'}
                </option>
              `).join('')}
            </select>
          </div>

          <button type="submit" class="btn btn-primary" style="width:100%;padding:14px;font-size:15px;" id="register-btn">
            Créer mon espace ${icon('arrowRight',16)}
          </button>

          <p style="text-align:center;margin-top:20px;font-size:13px;color:var(--pf-text-muted);">
            Déjà un compte ? <a href="/login" data-link>Se connecter</a>
          </p>
        </form>
      </div>
    </div>
  `;

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('register-btn');
    btn.disabled = true; btn.textContent = 'Création…';

    const fd = new FormData(e.target);
    const email = fd.get('email');
    const password = fd.get('password');
    const firstName = fd.get('first_name');
    const lastName = fd.get('last_name');
    const companyName = fd.get('company_name');
    const country = fd.get('country');
    const city = fd.get('city');

    // 1. Créer le compte Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: `${firstName} ${lastName}` },
      },
    });

    if (authError) {
      toast(authError.message, 'error');
      btn.disabled = false; btn.textContent = 'Créer mon espace';
      return;
    }

    if (!authData.user) {
      toast('Erreur lors de la création du compte', 'error');
      btn.disabled = false; btn.textContent = 'Créer mon espace';
      return;
    }

    // 2. Créer l'entreprise (RPC)
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_company_for_user', {
      p_company_name: companyName,
      p_country: country,
      p_city: city,
    });

    if (rpcError || !rpcData?.success) {
      toast(rpcData?.error || rpcError?.message || 'Erreur création entreprise', 'error');
      btn.disabled = false; btn.textContent = 'Créer mon espace';
      return;
    }

    // 3. Mettre à jour le nom complet du profil
    await supabase.from('profiles').update({
      full_name: `${firstName} ${lastName}`,
    }).eq('id', authData.user.id);

    toast('Bienvenue sur Pointify ! 🎉', 'success');
    setTimeout(() => navigate('/onboarding'), 600);
  });
}