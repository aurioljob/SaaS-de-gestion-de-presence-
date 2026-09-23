let deferredPrompt = null;

export function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallWidget();
  });

  window.addEventListener('appinstalled', () => {
    hideInstallWidget();
    deferredPrompt = null;
  });

  // Vérifie si déjà installé
  if (window.matchMedia('(display-mode: standalone)').matches) {
    hideInstallWidget();
  }
}

function showInstallWidget() {
  if (document.getElementById('install-widget')) return;

  const el = document.createElement('div');
  el.id = 'install-widget';
  el.className = 'install-widget';
  el.innerHTML = `
    <div class="install-widget-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    </div>
    <div class="install-widget-text">
      <strong>Installer Pointify</strong>
      <span>Accès rapide depuis votre écran d'accueil</span>
    </div>
    <div class="install-widget-actions">
      <button class="install-btn-install" id="install-yes">Installer</button>
      <button class="install-btn-close" id="install-no">✕</button>
    </div>
  `;
  document.body.appendChild(el);

  document.getElementById('install-yes').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      hideInstallWidget();
    }
    deferredPrompt = null;
  });

  document.getElementById('install-no').addEventListener('click', () => {
    hideInstallWidget();
    localStorage.setItem('pointify_install_dismissed', '1');
  });
}

function hideInstallWidget() {
  const el = document.getElementById('install-widget');
  if (el) el.remove();
}