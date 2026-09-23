import { supabase } from '../../config/supabase.js';
import { icon } from '../../components/icons.js';

export async function landingPage(app) {
  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('monthly_price');

  app.innerHTML = `
    <div class="landing">
      <!-- Nav -->
      <nav class="landing-nav">
        <div class="landing-nav-brand">Pointify</div>
        <div class="landing-nav-links">
          <a href="#features">Fonctionnalités</a>
          <a href="#pricing">Tarifs</a>
          <a href="#faq">FAQ</a>
          <a href="/login" data-link class="btn btn-secondary">Connexion</a>
          <a href="/register" data-link class="btn btn-primary">Démarrer</a>
        </div>
      </nav>

      <!-- Hero -->
      <section class="landing-hero">
        <div class="landing-hero-content">
          <div class="landing-badge">${icon('sparkles',14)} Nouveau · Multi-sites + QR dynamique</div>
          <h1>La gestion des présences<br><span class="gradient-text">enfin simple</span></h1>
          <p>Pointify remplace les feuilles Excel par un système de pointage moderne : QR code, géolocalisation, validation serveur, dashboards temps réel.</p>
          <div class="landing-cta">
            <a href="/register" data-link class="btn btn-primary btn-lg">Commencer gratuitement ${icon('arrowRight',16)}</a>
            <a href="#pricing" class="btn btn-secondary btn-lg">Voir les tarifs</a>
          </div>
          <div class="landing-trust">
            <div>${icon('check',14)} 14 jours d'essai</div>
            <div>${icon('check',14)} Sans carte bancaire</div>
            <div>${icon('check',14)} Multi-devises</div>
          </div>
        </div>
        <div class="landing-hero-visual">
          <div class="hero-mockup">
            <div class="hero-mockup-header">
              <div class="hero-mockup-dot"></div>
              <div class="hero-mockup-dot"></div>
              <div class="hero-mockup-dot"></div>
            </div>
            <div class="hero-mockup-body">
              <div class="hero-mockup-stat">
                <div class="hero-mockup-stat-label">Présents aujourd'hui</div>
                <div class="hero-mockup-stat-value">67 / 84</div>
              </div>
              <div class="hero-mockup-row">
                <div class="hero-mockup-avatar">JD</div>
                <div class="hero-mockup-info">
                  <div class="hero-mockup-name">Jean Dupont</div>
                  <div class="hero-mockup-time">08:03 — Siège Douala</div>
                </div>
                <div class="hero-mockup-badge">À l'heure</div>
              </div>
              <div class="hero-mockup-row">
                <div class="hero-mockup-avatar" style="background:#f59e0b;">AM</div>
                <div class="hero-mockup-info">
                  <div class="hero-mockup-name">Amina Moussa</div>
                  <div class="hero-mockup-time">08:42 — Agence Yaoundé</div>
                </div>
                <div class="hero-mockup-badge" style="background:#fef3c7;color:#92400e;">Retard</div>
              </div>
              <div class="hero-mockup-row">
                <div class="hero-mockup-avatar" style="background:#10b981;">SK</div>
                <div class="hero-mockup-info">
                  <div class="hero-mockup-name">Serge Kamga</div>
                  <div class="hero-mockup-time">07:58 — Siège Douala</div>
                </div>
                <div class="hero-mockup-badge">À l'heure</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Features -->
      <section id="features" class="landing-section">
        <div class="landing-section-header">
          <h2>Tout ce dont vous avez besoin</h2>
          <p>Une plateforme complète, pensée pour les entreprises africaines et internationales</p>
        </div>
        <div class="landing-features">
          <div class="feature-card">
            <div class="feature-icon">${icon('qrCode',24)}</div>
            <h3>Pointage par QR code</h3>
            <p>Chaque site a son QR unique. Un scan suffit pour enregistrer l'arrivée ou la sortie.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">${icon('mapPin',24)}</div>
            <h3>Géolocalisation</h3>
            <p>La position GPS de l'employé est vérifiée côté serveur. Impossible de pointer à distance.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">${icon('clock',24)}</div>
            <h3>Horaires & retards</h3>
            <p>Définissez les horaires par jour et par site. Les retards et heures sup sont calculés automatiquement.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">${icon('trendingUp',24)}</div>
            <h3>Rapports & exports</h3>
            <p>Rapports quotidiens, hebdomadaires, mensuels. Exports CSV et PDF en un clic.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">${icon('building',24)}</div>
            <h3>Multi-sites</h3>
            <p>Gérez plusieurs sites ou agences depuis une seule interface centralisée.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">${icon('shield',24)}</div>
            <h3>Sécurité & RLS</h3>
            <p>Isolation stricte des données. Chaque entreprise ne voit que ses propres informations.</p>
          </div>
        </div>
      </section>

      <!-- Pricing -->
      <section id="pricing" class="landing-section landing-section-alt">
        <div class="landing-section-header">
          <h2>Des tarifs simples et transparents</h2>
          <p>Commencez gratuitement, évoluez quand vous êtes prêt</p>
        </div>
        <div class="landing-pricing">
          ${(plans || []).map(p => `
            <div class="pricing-card ${p.name === 'BUSINESS' ? 'pricing-card-featured' : ''}">
              ${p.name === 'BUSINESS' ? '<div class="pricing-badge">Populaire</div>' : ''}
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
              </ul>
              <a href="/register?plan=${p.id}" data-link class="btn ${p.name === 'BUSINESS' ? 'btn-primary' : 'btn-secondary'}" style="width:100%;">
                Choisir ${p.name}
              </a>
            </div>
          `).join('')}
        </div>
      </section>

      <!-- FAQ -->
      <section id="faq" class="landing-section">
        <div class="landing-section-header">
          <h2>Questions fréquentes</h2>
        </div>
        <div class="landing-faq">
          <details>
            <summary>Comment fonctionne le pointage par QR code ?</summary>
            <p>Chaque site dispose d'un QR code unique. L'employé le scanne depuis son téléphone. Sa position GPS est vérifiée côté serveur avant enregistrement. Si l'employé est hors zone, le pointage est refusé.</p>
          </details>
          <details>
            <summary>Mes employés doivent-ils installer une application ?</summary>
            <p>Non. Pointify est une application web (PWA). Vos employés peuvent l'installer en un clic depuis leur navigateur, ou simplement l'utiliser via un lien web.</p>
          </details>
          <details>
            <summary>Puis-je gérer plusieurs sites ?</summary>
            <p>Oui. Selon votre plan, vous pouvez gérer de 1 à illimité de sites, chacun avec sa propre géolocalisation, horaires et QR code.</p>
          </details>
          <details>
            <summary>Comment sont protégées mes données ?</summary>
            <p>Pointify utilise PostgreSQL avec Row Level Security (RLS). Chaque entreprise ne peut accéder qu'à ses propres données. Toutes les communications sont chiffrées (HTTPS).</p>
          </details>
        </div>
      </section>

      <!-- CTA final -->
      <section class="landing-cta-final">
        <h2>Prêt à moderniser votre gestion des présences ?</h2>
        <p>Rejoignez les entreprises qui ont déjà dit adieu au papier.</p>
        <a href="/register" data-link class="btn btn-lg" style="background:white;color:var(--pf-blue-700);">Démarrer gratuitement ${icon('arrowRight',16)}</a>
      </section>

      <footer class="landing-footer">
        <div>© ${new Date().getFullYear()} Pointify — Présences. Contrôle. Performance.</div>
      </footer>
    </div>
  `;
}