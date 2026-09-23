import { supabase } from '../../config/supabase.js';
import { requireCompany as guardCompany } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { toast } from '../../components/toast.js';

export async function companySettingsPage(app) {
  const ctx = await guardCompany();
  if (!ctx) return;
  const { profile, context } = ctx;
  const c = context.company;

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/settings', 'company', {
  companyName: context.company.name,
  planName: context.plan?.name || 'Aucun plan',
  isImpersonating: context.isImpersonating,
})}
      <div class="main-content">
        ${renderTopbar(profile, 'Paramètres entreprise',{
  isImpersonating: context.isImpersonating,
  companyName: context.company.name,
})}
        <main class="page">
          <div class="page-header"><h1>Paramètres</h1><p>Informations de votre entreprise.</p></div>

          <div class="card" style="max-width:700px;">
            <div class="card-title">Informations générales</div>
            <div class="form-group">
              <label class="label">Nom *</label>
              <input class="input" id="c-name" value="${c.name || ''}" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="label">Email</label>
                <input class="input" type="email" id="c-email" value="${c.email || ''}" />
              </div>
              <div class="form-group">
                <label class="label">Téléphone</label>
                <input class="input" id="c-phone" value="${c.phone || ''}" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="label">Pays</label>
                <input class="input" id="c-country" value="${c.country || ''}" />
              </div>
              <div class="form-group">
                <label class="label">Ville</label>
                <input class="input" id="c-city" value="${c.city || ''}" />
              </div>
            </div>
            <div class="form-group">
              <label class="label">Adresse</label>
              <input class="input" id="c-address" value="${c.address || ''}" />
            </div>
            <button class="btn btn-primary" id="save">Enregistrer</button>
          </div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();

  document.getElementById('save').addEventListener('click', async () => {
    const payload = {
      name: document.getElementById('c-name').value.trim(),
      email: document.getElementById('c-email').value.trim() || null,
      phone: document.getElementById('c-phone').value.trim() || null,
      country: document.getElementById('c-country').value.trim() || null,
      city: document.getElementById('c-city').value.trim() || null,
      address: document.getElementById('c-address').value.trim() || null,
    };
    if (!payload.name) { toast('Nom requis', 'error'); return; }

    const { error } = await supabase.from('companies').update(payload).eq('id', context.companyId);
    if (error) { toast(error.message, 'error'); return; }
    toast('Entreprise mise à jour', 'success');
  });
}