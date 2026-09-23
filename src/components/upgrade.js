import { icon } from './icons.js';

/**
 * Bandeau d'avertissement quand une limite est presque atteinte
 */
export function renderLimitBanner({ resource, current, max, planName }) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;
  const isFull = current >= max;
  const isWarning = pct >= 80 && !isFull;

  if (!isFull && !isWarning) return '';

  const color = isFull ? 'var(--pf-danger)' : 'var(--pf-warning)';
  const bg = isFull ? '#fee2e2' : '#fef3c7';
  const textColor = isFull ? '#991b1b' : '#92400e';
  const label = resource === 'employees' ? 'employés'
               : resource === 'sites' ? 'sites'
               : 'administrateurs';

  return `
    <div style="background:${bg};border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;gap:14px;color:${textColor};">
      <div style="flex-shrink:0;">${icon('alertCircle', 20)}</div>
      <div style="flex:1;font-size:13px;">
        ${isFull
          ? `<strong>Limite atteinte : ${current}/${max} ${label}.</strong> Passez à un plan supérieur pour en ajouter davantage.`
          : `<strong>Presque à la limite : ${current}/${max} ${label}.</strong> Envisagez un plan supérieur.`}
        <div style="margin-top:6px;height:6px;background:rgba(0,0,0,0.08);border-radius:3px;overflow:hidden;">
          <div style="height:100%;background:${color};width:${Math.min(pct,100)}%;border-radius:3px;transition:width 0.3s;"></div>
        </div>
      </div>
      <a href="/subscription" data-link class="btn btn-primary" style="font-size:12px;padding:8px 14px;white-space:nowrap;">
        Améliorer le plan
      </a>
    </div>
  `;
}

/**
 * Mur bloquant quand une feature n'est pas disponible
 */
export function renderFeatureWall({ featureName, requiredPlan }) {
  return `
    <div class="feature-wall">
      <div class="feature-wall-icon">${icon('sparkles', 48)}</div>
      <h2>${featureName}</h2>
      <p>Cette fonctionnalité n'est pas incluse dans votre plan actuel.</p>
      ${requiredPlan ? `<p style="color:var(--pf-text-muted);font-size:13px;">Disponible à partir du plan <strong>${requiredPlan}</strong>.</p>` : ''}
      <div style="display:flex;gap:12px;justify-content:center;margin-top:24px;">
        <a href="/subscription" data-link class="btn btn-primary">Voir les plans</a>
        <a href="/dashboard" data-link class="btn btn-secondary">Retour</a>
      </div>
    </div>
  `;
}

/**
 * Badge "PRO" pour indiquer qu'une feature nécessite un plan supérieur
 */
export function proBadge(planName = 'PRO') {
  return `<span style="background:var(--pf-gradient);color:white;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;letter-spacing:0.05em;margin-left:6px;">${planName}</span>`;
}