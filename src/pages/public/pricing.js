import { supabase } from '../../config/supabase.js';
import { icon } from '../../components/icons.js';

export async function pricingPage(app) {
  const { data: plans } = await supabase
    .from('plans').select('*, plan_features(enabled, features(*))')
    .eq('is_active', true).order('monthly_price');

  app.innerHTML = `
    <div class="landing">
      <nav class="landing-nav">
        <div class="landing-nav-brand">Pointify</div>
        <div class="landing-nav-links">
          <a href="/" data-link>Accueil</a>
          <a href="/login" data-link class="btn btn-secondary">Connexion</a>
          <a href="/register" data-link class="btn btn-primary">Démarrer</a>
        </div>
      </nav>

      <div style="max-width:1200px;margin:0 auto;padding:60px 32px;text-align:center;">
        <h1 style="font-size:2.5rem;margin-bottom:12px;">Tarifs simples et transparents</h1>
        <p style="color:var(--pf-text-muted);font-size:1.05rem;">Choisissez le plan adapté à votre équipe</p>
      </div>

      <div style="max-width:1200px;margin:0 auto;padding:0 32px 80px;">
        <div class="landing-pricing">
          ${(plans || []).map(p => `
            <div class="pricing-card ${p.name === 'BUSINESS' ? 'pricing-card-featured' : ''}">
              ${p.name === 'BUSINESS' ? '<div class="pricing-badge">Recommandé</div>' : ''}
              <div class="pricing-name">${p.name}</div>
              <div class="pricing-price">
                ${p.monthly_price === 0 ? 'Gratuit' : Number(p.monthly_price).toLocaleString('fr-FR') + ' ' + p.currency}
                ${p.monthly_price > 0 ? '<span>/mois</span>' : ''}
              </div>
              <div class="pricing-desc">${p.description || ''}</div>
              <ul class="pricing-features">
                <li>${icon('check',14)} ${p.max_employees} employés</li>
                <li>${icon('check',14)} ${p.max_sites} site${p.max_sites > 1 ? 's' : ''}</li>
                <li>${icon('check',14)} ${p.max_admins} admin${p.max_admins > 1 ? 's' : ''}</li>
                <li>${icon('check',14)} Historique ${p.history_days} jours</li>
                ${(p.plan_features || []).filter(pf => pf.enabled).map(pf => `
                  <li>${icon('check',14)} ${pf.features?.name || ''}</li>
                `).join('')}
              </ul>
              <a href="/register?plan=${p.id}" data-link class="btn ${p.name === 'BUSINESS' ? 'btn-primary' : 'btn-secondary'}" style="width:100%;">
                Choisir ${p.name}
              </a>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}