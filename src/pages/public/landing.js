import { supabase } from '../../config/supabase.js';
import { icon } from '../../components/icons.js';

export async function landingPage(app) {
  const { data: plans } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('monthly_price');

  const year = new Date().getFullYear();

  app.innerHTML = `
    <div class="landing lp">
      <div class="lp-aurora" aria-hidden="true">
        <span class="lp-blob lp-blob-a"></span>
        <span class="lp-blob lp-blob-b"></span>
        <span class="lp-blob lp-blob-c"></span>
        <canvas id="lp-particles" class="lp-particles"></canvas>
      </div>

      <nav class="landing-nav lp-nav">
        <a href="/" data-link class="landing-nav-brand">Pointify</a>
        <div class="landing-nav-links" id="lp-nav-links">
          <a href="#features">Fonctionnalités</a>
          <a href="#how">Comment ça marche</a>
          <a href="#pricing">Tarifs</a>
          <a href="#faq">FAQ</a>
          <a href="/login" data-link class="btn btn-secondary">Connexion</a>
          <a href="/register" data-link class="btn btn-primary">Démarrer</a>
        </div>
        <button class="lp-burger" id="lp-burger" aria-label="Menu"><span></span><span></span><span></span></button>
      </nav>

      <section class="lp-hero">
        <div class="lp-hero-copy">
          <div class="landing-badge lp-badge">
            <span class="lp-badge-dot"></span>
            ${icon('sparkles', 14)} Pointage QR · GPS vérifié serveur
          </div>
          <h1>
            Présences en temps réel.<br>
            <span class="gradient-text">Zéro triche. Zéro papier.</span>
          </h1>
          <p>
            Pointify remplace les feuilles Excel par un rituel simple : scanner le QR du site,
            valider la position GPS, et voir l’équipe arriver en live — de Douala à Yaoundé.
          </p>
          <div class="landing-cta">
            <a href="/register" data-link class="btn btn-primary btn-lg lp-cta-main">
              Essai 14 jours gratuit ${icon('arrowRight', 16)}
            </a>
            <a href="#how" class="btn btn-secondary btn-lg">Voir le parcours</a>
          </div>
          <div class="landing-trust">
            <div>${icon('check', 14)} Sans carte bancaire</div>
            <div>${icon('check', 14)} PWA mobile</div>
            <div>${icon('check', 14)} Multi-sites · XAF</div>
          </div>
          <div class="lp-metrics">
            <div><strong>14 j</strong><span>d’essai</span></div>
            <div><strong>&lt; 8 s</strong><span>pour pointer</span></div>
            <div><strong>Live</strong><span>dashboard</span></div>
          </div>
        </div>

        <div class="lp-scene" id="lp-scene">
          <div class="lp-scene-glow"></div>
          <div class="lp-scene-stage" id="lp-stage">
            <div class="lp-float lp-float-gps">
              ${icon('mapPin', 14)} GPS ±12 m
            </div>
            <div class="lp-float lp-float-live">
              <span class="lp-live-dot"></span> 67 présents
            </div>
            <div class="lp-qr-cube" aria-hidden="true">
              <div class="lp-cube-face lp-cube-front">${icon('qrCode', 28)}</div>
              <div class="lp-cube-face lp-cube-back">${icon('qrCode', 28)}</div>
              <div class="lp-cube-face lp-cube-left"></div>
              <div class="lp-cube-face lp-cube-right"></div>
              <div class="lp-cube-face lp-cube-top"></div>
              <div class="lp-cube-face lp-cube-bottom"></div>
            </div>

            <div class="lp-phone">
              <div class="lp-phone-notch"></div>
              <div class="lp-phone-screen">
                <div class="lp-phone-bar">
                  <span>Pointer</span>
                  <span class="lp-phone-clock" id="lp-clock">08:03</span>
                </div>
                <div class="lp-scan">
                  <div class="lp-scan-frame">
                    <span></span><span></span><span></span><span></span>
                    <div class="lp-scan-line"></div>
                  </div>
                  <p>Scannez le QR du site</p>
                </div>
                <div class="lp-phone-ok">
                  ${icon('check', 16)} Arrivée enregistrée · Siège Douala
                </div>
              </div>
            </div>

            <div class="lp-dash">
              <div class="lp-dash-chrome">
                <span></span><span></span><span></span>
                <em>Pointify · Live</em>
              </div>
              <div class="lp-dash-stat">
                <div>Présents aujourd’hui</div>
                <strong>67<span> / 84</span></strong>
                <div class="lp-dash-bar"><i></i></div>
              </div>
              <div class="lp-dash-row">
                <b>JD</b>
                <div><strong>Jean Dupont</strong><small>08:03 — Siège Douala</small></div>
                <em class="ok">À l’heure</em>
              </div>
              <div class="lp-dash-row">
                <b class="warn">AM</b>
                <div><strong>Amina Moussa</strong><small>08:42 — Agence Yaoundé</small></div>
                <em class="late">Retard</em>
              </div>
              <div class="lp-dash-row">
                <b class="okb">SK</b>
                <div><strong>Serge Kamga</strong><small>07:58 — Siège Douala</small></div>
                <em class="ok">À l’heure</em>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="lp-logos" aria-label="Preuves">
        <p>Pensé pour les équipes terrain en Afrique centrale</p>
        <div class="lp-logo-row">
          <span>Siège · Douala</span>
          <span>Agence · Yaoundé</span>
          <span>Dépôt · Bafoussam</span>
          <span>Chantier · Kribi</span>
        </div>
      </section>

      <section id="features" class="landing-section">
        <div class="landing-section-header lp-reveal">
          <p class="lp-kicker">Plateforme</p>
          <h2>Tout ce dont une équipe a besoin, sans usine à gaz</h2>
          <p>QR, GPS, horaires, rapports — une seule interface pour l’admin, le manager et l’employé.</p>
        </div>
        <div class="landing-features">
          ${feature('qrCode', 'Pointage par QR', 'Un QR unique par site. Un scan depuis le téléphone enregistre l’arrivée ou la sortie.')}
          ${feature('mapPin', 'Géolocalisation serveur', 'La distance Haversine est calculée en base. Hors rayon, le pointage est refusé.')}
          ${feature('clock', 'Horaires & retards', 'Plages par jour et par site. Retards, sorties anticipées et minutes travaillées, automatiques.')}
          ${feature('trendingUp', 'Rapports & exports', 'Vues jour / semaine / mois. CSV et PDF pour la paie et le contrôle.')}
          ${feature('building', 'Multi-sites', 'Plusieurs agences, un seul cockpit. QR, GPS et horaires propres à chaque lieu.')}
          ${feature('shield', 'Isolation des données', 'Chaque entreprise ne voit que son périmètre. Auth + politiques d’accès par rôle.')}
        </div>
      </section>

      <section id="how" class="landing-section landing-section-alt">
        <div class="landing-section-header lp-reveal">
          <p class="lp-kicker">Parcours</p>
          <h2>Trois gestes. Une preuve de présence.</h2>
        </div>
        <div class="lp-steps">
          <article class="lp-step lp-reveal">
            <span>01</span>
            <h3>Affichez le QR</h3>
            <p>Générez un code pour chaque site et placez-le à l’entrée. Vous pouvez le faire expirer.</p>
          </article>
          <article class="lp-step lp-reveal">
            <span>02</span>
            <h3>L’employé scanne</h3>
            <p>Caméra + GPS. Si la personne est trop loin, le serveur refuse — pas de pointage à distance.</p>
          </article>
          <article class="lp-step lp-reveal">
            <span>03</span>
            <h3>Vous voyez le live</h3>
            <p>Présents, retards, flux du jour. Les rapports suivent pour la fin de mois.</p>
          </article>
        </div>
      </section>

      <section id="pricing" class="landing-section">
        <div class="landing-section-header lp-reveal">
          <p class="lp-kicker">Tarifs</p>
          <h2>Simple, en XAF, sans surprise</h2>
          <p>Commencez gratuitement, évoluez quand l’équipe grandit.</p>
        </div>
        <div class="landing-pricing">
          ${(plans || []).map((p) => `
            <div class="pricing-card ${p.name === 'BUSINESS' ? 'pricing-card-featured' : ''} lp-reveal">
              ${p.name === 'BUSINESS' ? '<div class="pricing-badge">Populaire</div>' : ''}
              <div class="pricing-name">${escapeHtml(p.name)}</div>
              <div class="pricing-price">
                ${Number(p.monthly_price) === 0 ? 'Gratuit' : Number(p.monthly_price).toLocaleString('fr-FR') + ' ' + escapeHtml(p.currency || 'XAF')}
                ${Number(p.monthly_price) > 0 ? '<span>/mois</span>' : ''}
              </div>
              <div class="pricing-desc">${escapeHtml(p.description || '')}</div>
              <ul class="pricing-features">
                <li>${icon('check', 14)} ${p.max_employees} employés</li>
                <li>${icon('check', 14)} ${p.max_sites} site${p.max_sites > 1 ? 's' : ''}</li>
                <li>${icon('check', 14)} ${p.max_admins} admin${p.max_admins > 1 ? 's' : ''}</li>
                <li>${icon('check', 14)} Historique ${p.history_days} jours</li>
              </ul>
              <a href="/register?plan=${encodeURIComponent(p.id)}" data-link class="btn ${p.name === 'BUSINESS' ? 'btn-primary' : 'btn-secondary'}" style="width:100%;">
                Choisir ${escapeHtml(p.name)}
              </a>
            </div>
          `).join('')}
        </div>
      </section>

      <section id="faq" class="landing-section landing-section-alt">
        <div class="landing-section-header lp-reveal">
          <p class="lp-kicker">FAQ</p>
          <h2>Questions fréquentes</h2>
        </div>
        <div class="landing-faq">
          <details open>
            <summary>Comment fonctionne le pointage par QR ?</summary>
            <p>Chaque site a un QR unique. L’employé le scanne. La position GPS est vérifiée côté serveur. Hors zone, le pointage est refusé.</p>
          </details>
          <details>
            <summary>Faut-il installer une application ?</summary>
            <p>Non. Pointify est une PWA. Installation en un tap depuis le navigateur, ou simple lien web.</p>
          </details>
          <details>
            <summary>Puis-je gérer plusieurs sites ?</summary>
            <p>Oui. Selon le plan : un site en découverte, jusqu’à des dizaines d’agences, chacune avec GPS, horaires et QR.</p>
          </details>
          <details>
            <summary>Comment sont protégées les données ?</summary>
            <p>Comptes isolés par entreprise, rôles (admin, superviseur, employé), communications HTTPS. Vous ne voyez que votre périmètre.</p>
          </details>
        </div>
      </section>

      <section class="landing-cta-final lp-final">
        <div class="lp-final-inner">
          <h2>Prêt à dire adieu au cahier de présence ?</h2>
          <p>Créez votre espace en deux minutes. 14 jours, sans carte.</p>
          <a href="/register" data-link class="btn btn-lg lp-final-btn">
            Démarrer gratuitement ${icon('arrowRight', 16)}
          </a>
        </div>
      </section>

      <footer class="landing-footer lp-footer">
        <div class="landing-nav-brand">Pointify</div>
        <div>© ${year} — Présences. Contrôle. Performance.</div>
        <div class="lp-footer-links">
          <a href="/pricing" data-link>Tarifs</a>
          <a href="/login" data-link>Connexion</a>
        </div>
      </footer>
    </div>
  `;

  initLandingMotion();
}

function feature(name, title, text) {
  return `
    <div class="feature-card lp-reveal">
      <div class="feature-icon">${icon(name, 24)}</div>
      <h3>${title}</h3>
      <p>${text}</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function initLandingMotion() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = document.getElementById('lp-scene');
  const stage = document.getElementById('lp-stage');
  const clock = document.getElementById('lp-clock');
  const burger = document.getElementById('lp-burger');
  const links = document.getElementById('lp-nav-links');

  const tick = () => {
    if (clock) {
      clock.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
  };
  tick();
  const clockId = setInterval(tick, 10000);

  burger?.addEventListener('click', () => links?.classList.toggle('is-open'));

  if (!reduced && scene && stage) {
    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    scene.addEventListener('pointermove', (e) => {
      const r = scene.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 18;
      ty = ((e.clientY - r.top) / r.height - 0.5) * -14;
    });
    scene.addEventListener('pointerleave', () => {
      tx = 0;
      ty = 0;
    });

    const loop = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      stage.style.transform = `rotateX(${8 + cy}deg) rotateY(${-18 + cx}deg)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener('pagehide', () => cancelAnimationFrame(raf), { once: true });
  }

  if (!reduced) {
    startParticles();
    document.querySelectorAll('.lp-reveal').forEach((el, i) => {
      el.style.setProperty('--lp-delay', `${Math.min(i * 0.06, 0.4)}s`);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16 });
    document.querySelectorAll('.lp-reveal').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.lp-reveal').forEach((el) => el.classList.add('is-in'));
  }

  window.addEventListener('pagehide', () => clearInterval(clockId), { once: true });
}

function startParticles() {
  const canvas = document.getElementById('lp-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dots = Array.from({ length: 42 }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.random(),
    s: 0.3 + Math.random() * 1.2,
  }));

  const resize = () => {
    canvas.width = canvas.offsetWidth * devicePixelRatio;
    canvas.height = canvas.offsetHeight * devicePixelRatio;
  };
  resize();
  window.addEventListener('resize', resize);

  let t = 0;
  let raf = 0;
  const draw = () => {
    t += 0.004;
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    dots.forEach((d) => {
      const x = (d.x + Math.sin(t + d.z * 8) * 0.03) * w;
      const y = (d.y + Math.cos(t * 0.7 + d.z * 5) * 0.04) * h;
      const r = d.s * devicePixelRatio;
      ctx.beginPath();
      ctx.fillStyle = `rgba(96, 165, 250, ${0.18 + d.z * 0.35})`;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  window.addEventListener('pagehide', () => cancelAnimationFrame(raf), { once: true });
}
