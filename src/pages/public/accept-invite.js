import { supabase } from '../../config/supabase.js';
import { toast } from '../../components/toast.js';
import { navigate } from '../../router/router.js';
import { icon } from '../../components/icons.js';

export async function acceptInvitePage(app) {
  const params = new URLSearchParams(location.search);
  const token = params.get('token');

  if (!token) {
    renderError(app, 'Lien invalide', 'Ce lien ne contient pas de token.');
    return;
  }

  // Charge l'invitation
  const { data: invitation, error } = await supabase
    .from('invitations')
    .select('*, companies(name)')
    .eq('token', token)
    .maybeSingle();

  if (error || !invitation) {
    renderError(app, 'Invitation introuvable', 'Ce lien est invalide.');
    return;
  }

  if (invitation.status === 'accepted') {
    renderError(app, 'Invitation déjà utilisée', 
      'Ce lien a déjà été utilisé. Connectez-vous ou demandez une nouvelle invitation.');
    return;
  }

  if (invitation.status !== 'pending' || new Date(invitation.expires_at) < new Date()) {
    renderError(app, 'Invitation expirée', 
      'Ce lien a expiré. Contactez votre administrateur pour en recevoir un nouveau.');
    return;
  }

  // Affiche le formulaire
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card" style="max-width:460px;">
        <div class="auth-logo">
          <h1>Pointify</h1>
          <p>Rejoignez <strong>${invitation.companies?.name || 'votre entreprise'}</strong></p>
        </div>

        <div style="background:#dbeafe;border-radius:10px;padding:14px;margin-bottom:24px;font-size:13px;color:#1e40af;">
           Vous avez été invité(e) à rejoindre <strong>${invitation.companies?.name}</strong> en tant qu'employé(e).<br>
          Créez votre mot de passe pour activer votre compte.
        </div>

        <form id="invite-form">
          <div class="form-group">
            <label class="label">Email</label>
            <input class="input" value="${invitation.email}" disabled style="background:#f3f4f6;" />
          </div>
          <div class="form-group">
            <label class="label">Mot de passe * (min. 8 caractères)</label>
            <input class="input" type="password" id="password" minlength="8" required autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label class="label">Confirmer le mot de passe *</label>
            <input class="input" type="password" id="password2" minlength="8" required autocomplete="new-password" />
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;padding:14px;" id="submit-btn">
            Activer mon compte ${icon('arrowRight',16)}
          </button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('invite-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const pwd = document.getElementById('password').value;
    const pwd2 = document.getElementById('password2').value;

    if (pwd !== pwd2) { toast('Les mots de passe ne correspondent pas', 'error'); return; }
    if (pwd.length < 8) { toast('Le mot de passe doit faire au moins 8 caractères', 'error'); return; }

    btn.disabled = true;
    btn.textContent = 'Création du compte…';

    // 1. Créer le compte Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: invitation.email,
      password: pwd,
      options: {
        data: {
          full_name: `${invitation.email.split('@')[0]}`, // nom par défaut
        },
      },
    });

    if (authError) {
      // Cas particulier : utilisateur déjà existant
      if (authError.message.includes('already registered')) {
        toast('Cet email a déjà un compte. Connectez-vous à la place.', 'error');
      } else {
        toast(authError.message, 'error');
      }
      btn.disabled = false;
      btn.textContent = 'Activer mon compte';
      return;
    }

    if (!authData.user) {
      toast('Erreur de création du compte', 'error');
      btn.disabled = false;
      return;
    }

    // 2. Appeler la RPC accept_invitation
    const { data: rpcData, error: rpcError } = await supabase.rpc('accept_invitation', {
      p_token: token,
    });

    if (rpcError || !rpcData?.success) {
      toast(rpcData?.error || rpcError?.message || 'Erreur d\'acceptation', 'error');
      btn.disabled = false;
      btn.textContent = 'Activer mon compte';
      return;
    }

    // 3. Si Supabase demande une confirmation email, prévenir
    if (authData.user.identities?.length === 0) {
      toast('Compte déjà existant', 'warning');
      navigate('/login');
      return;
    }

    toast('Bienvenue ! Votre compte est activé 🎉', 'success');
    setTimeout(() => navigate('/my-dashboard'), 800);
  });
}

function renderError(app, title, message) {
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card" style="text-align:center;max-width:420px;">
        <div style="font-size:3rem;margin-bottom:16px;color:var(--pf-danger);">${icon('alertCircle',48)}</div>
        <h2>${title}</h2>
        <p style="color:var(--pf-text-muted);margin:16px 0 24px;">${message}</p>
        <a href="/login" data-link class="btn btn-primary">Aller à la connexion</a>
      </div>
    </div>
  `;
}