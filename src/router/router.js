const routes = [];

export function register(path, handler) {
  routes.push({ path, handler });
}

export function navigate(path, replace = false) {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  resolve();
}

function matchRoute(path) {
  for (const r of routes) {
    if (r.path === path) return { route: r, params: {} };
    const rParts = r.path.split('/').filter(Boolean);
    const pParts = path.split('/').filter(Boolean);
    if (rParts.length !== pParts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < rParts.length; i++) {
      if (rParts[i].startsWith(':')) params[rParts[i].slice(1)] = pParts[i];
      else if (rParts[i] !== pParts[i]) { ok = false; break; }
    }
    if (ok) return { route: r, params };
  }
  return null;
}

export async function resolve() {
  const path = location.pathname || '/';
  const match = matchRoute(path);
  const app = document.getElementById('app');
  if (!match) {
    app.innerHTML = `<div class="empty"><h3>404</h3><p>${path}</p></div>`;
    return;
  }

  // Fade out rapide
  app.style.opacity = '0';
  app.style.transition = 'opacity 0.15s ease';
  await new Promise(r => setTimeout(r, 100));

  try {
    await match.route.handler(app, match.params);
  } catch (error) {
    console.error(`Erreur lors du chargement de ${path}`, error);
    app.innerHTML = `
      <div class="empty">
        <h3>Impossible de charger cette page</h3>
        <p>Actualisez la page ou consultez la console du navigateur pour plus de détails.</p>
      </div>
    `;
  } finally {
    // Fade in
    app.style.opacity = '1';
  }
}

window.addEventListener('popstate', resolve);
window.addEventListener('DOMContentLoaded', resolve);

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (!a) return;
  e.preventDefault();
  navigate(a.getAttribute('href'));
});