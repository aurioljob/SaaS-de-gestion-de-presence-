import { getCompanyContext, getMyFeatures } from './company.js';

/**
 * Prépare les extras pour renderSidebar + renderTopbar
 */
export async function prepareCompanyLayout(context) {
  const features = await getMyFeatures();
  return {
    companyName: context.company.name,
    planName: context.plan?.name || 'Aucun plan',
    isImpersonating: context.isImpersonating,
    features,
  };
}