import { supabase } from '../../config/supabase.js';
import { requireCompany as guardCompany } from '../../utils/guards.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { icon } from '../../components/icons.js';
import { toast } from '../../components/toast.js';

let step = 1;

export async function companyOnboardingPage(app) {
  const ctx = await guardCompany();
  if (!ctx) return;
  const { profile, context } = ctx;

  step = 1;
  render(app, profile, context);
}

function render(app, profile, context) {
  app.innerHTML = `
    <div class="app-layout">
      <div class="main-content" style="margin-left:0;">
        <main class="page" style="max-width:720px;margin:0 auto;">
          <div style="text-align:center;margin-bottom:40px;">
            <div style="font-family:var(--pf-font-display);font-size:1.6rem;font-weight:800;background:var(--pf-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
              Pointify
            </div>
            <h1 style="margin-top:20px;">Bienvenue, ${profile.full_name?.split(' ')[0] || ''} ! 👋</h1>
            <p style="color:var(--pf-text-muted);">Configurons votre espace en 3 étapes rapides.</p>
          </div>

          <div style="display:flex;gap:8px;margin-bottom:32px;">
            ${[1,2,3].map(i => `
              <div style="flex:1;height:4px;border-radius:2px;background:${i <= step ? 'var(--pf-blue-500)' : 'var(--pf-border)'};transition:background 0.3s;"></div>
            `).join('')}
          </div>

          <div id="onboarding-content"></div>
        </main>
      </div>
    </div>
  `;

  const content = document.getElementById('onboarding-content');

  if (step === 1) {
    content.innerHTML = `
      <div class="card">
        <div class="card-title">Étape 1 / 3 — Créez votre premier site</div>
        <p style="color:var(--pf-text-muted);font-size:14px;margin-bottom:20px;">
          Un site représente un lieu physique : siège, agence, entrepôt. Chaque site a son propre QR code.
        </p>
        <div class="form-group">
          <label class="label">Nom du site *</label>
          <input class="input" id="s-name" placeholder="Siège principal" />
        </div>
        <div class="form-group">
          <label class="label">Adresse</label>
          <input class="input" id="s-address" placeholder="Rue, quartier…" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="label">Latitude</label>
            <input class="input" type="number" step="any" id="s-lat" />
          </div>
          <div class="form-group">
            <label class="label">Longitude</label>
            <input class="input" type="number" step="any" id="s-lng" />
          </div>
        </div>
        <button class="btn btn-secondary" id="use-gps" style="width:100%;">${icon('mapPin',14)} Utiliser ma position actuelle</button>
        <div class="form-group" style="margin-top:16px;">
          <label class="label">Rayon autorisé (mètres)</label>
          <input class="input" type="number" id="s-radius" value="100" />
        </div>
        <button class="btn btn-primary" id="next" style="width:100%;margin-top:20px;padding:14px;">Continuer ${icon('arrowRight',16)}</button>
      </div>
    `;

    document.getElementById('use-gps').addEventListener('click', () => {
      if (!navigator.geolocation) { toast('Géoloc. non supportée', 'error'); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          document.getElementById('s-lat').value = pos.coords.latitude;
          document.getElementById('s-lng').value = pos.coords.longitude;
          toast('Position récupérée', 'success');
        },
        (err) => toast(err.message, 'error')
      );
    });

    document.getElementById('next').addEventListener('click', async () => {
      const name = document.getElementById('s-name').value.trim();
      if (!name) { toast('Nom du site requis', 'error'); return; }

      const { error } = await supabase.from('sites').insert({
        company_id: context.companyId,
        name,
        address: document.getElementById('s-address').value.trim() || null,
        latitude: parseFloat(document.getElementById('s-lat').value) || null,
        longitude: parseFloat(document.getElementById('s-lng').value) || null,
        radius_meters: parseInt(document.getElementById('s-radius').value) || 100,
        status: 'active',
      });

      if (error) { toast(error.message, 'error'); return; }
      toast('Site créé', 'success');
      step = 2;
      render(app, profile, context);
    });
  }

  if (step === 2) {
    content.innerHTML = `
      <div class="card">
        <div class="card-title">Étape 2 / 3 — Ajoutez votre premier employé</div>
        <p style="color:var(--pf-text-muted);font-size:14px;margin-bottom:20px;">
          Vous pourrez en ajouter d'autres plus tard. Chaque employé recevra un accès pour pointer.
        </p>
        <div class="form-row">
          <div class="form-group">
            <label class="label">Prénom *</label>
            <input class="input" id="e-first" placeholder="Jean" />
          </div>
          <div class="form-group">
            <label class="label">Nom *</label>
            <input class="input" id="e-last" placeholder="Dupont" />
          </div>
        </div>
        <div class="form-group">
          <label class="label">Email</label>
          <input class="input" type="email" id="e-email" placeholder="jean@exemple.com" />
        </div>
        <div class="form-group">
          <label class="label">Poste</label>
          <input class="input" id="e-pos" placeholder="Développeur" />
        </div>
        <div style="display:flex;gap:12px;margin-top:20px;">
          <button class="btn btn-secondary" id="skip" style="flex:1;padding:14px;">Passer</button>
          <button class="btn btn-primary" id="next" style="flex:2;padding:14px;">Ajouter ${icon('arrowRight',16)}</button>
        </div>
      </div>
    `;

    document.getElementById('skip').addEventListener('click', () => { step = 3; render(app, profile, context); });

    document.getElementById('next').addEventListener('click', async () => {
      const firstName = document.getElementById('e-first').value.trim();
      const lastName = document.getElementById('e-last').value.trim();
      if (!firstName || !lastName) { toast('Prénom et nom requis', 'error'); return; }

      const { error } = await supabase.from('employees').insert({
        company_id: context.companyId,
        first_name: firstName,
        last_name: lastName,
        email: document.getElementById('e-email').value.trim() || null,
        position: document.getElementById('e-pos').value.trim() || null,
        status: 'active',
      });

      if (error) { toast(error.message, 'error'); return; }
      toast('Employé ajouté', 'success');
      step = 3;
      render(app, profile, context);
    });
  }

  if (step === 3) {
    content.innerHTML = `
      <div class="card" style="text-align:center;padding:40px 24px;">
        <div style="width:80px;height:80px;background:var(--pf-gradient);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:2.4rem;">
          ${icon('check',40)}
        </div>
        <h2 style="margin-bottom:12px;">Tout est prêt ! 🎉</h2>
        <p style="color:var(--pf-text-muted);margin-bottom:28px;">
          Votre espace Pointify est configuré. Vous pouvez maintenant gérer vos employés, générer des QR codes et suivre les présences.
        </p>
        <a href="/dashboard" data-link class="btn btn-primary" style="padding:14px 32px;">
          Accéder à mon tableau de bord ${icon('arrowRight',16)}
        </a>
      </div>
    `;
  }
}