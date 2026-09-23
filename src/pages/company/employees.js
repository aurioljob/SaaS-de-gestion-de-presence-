import { supabase } from '../../config/supabase.js';
import { checkPlanLimit } from '../../utils/company.js';
import { requireCompany as guardCompany } from '../../utils/guards.js';
import { renderSidebar } from '../../components/sidebar.js';
import { renderTopbar, attachTopbarEvents } from '../../components/topbar.js';
import { openModal, confirmModal } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { debounce } from '../../utils/format.js';

const initialState = { search: '', status: '', siteId: '' };
let state = { ...initialState };

export async function companyEmployeesPage(app) {
  const ctx = await guardCompany();
  if (!ctx) return;
  const { profile, context } = ctx;
  state = { ...initialState };

  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar('/employees', 'company', {
        companyName: context.company.name,
        planName: context.plan?.name || 'Aucun plan',
        isImpersonating: context.isImpersonating,
      })}
      <div class="main-content">
        ${renderTopbar(profile, 'Employés', {
          isImpersonating: context.isImpersonating,
          companyName: context.company.name,
        })}
        <main class="page">
          <div class="page-header">
            <h1>Employés</h1>
            <p>Gérez les membres de votre équipe</p>
          </div>

          <div class="toolbar">
            <input class="input" id="search" placeholder="Rechercher un employé…" />
            <select class="input" id="status-filter" style="max-width:180px;">
              <option value="">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
              <option value="suspended">Suspendus</option>
              <option value="terminated">Terminés</option>
            </select>
            <select class="input" id="site-filter" style="max-width:180px;">
              <option value="">Tous les sites</option>
            </select>
            <div class="toolbar-spacer"></div>
            <button class="btn btn-primary" id="new-emp">+ Ajouter un employé</button>
          </div>

          <div id="employees-list"></div>
        </main>
      </div>
    </div>
  `;

  attachTopbarEvents();

  const { data: sites } = await supabase.from('sites').select('id, name')
    .eq('company_id', context.companyId).order('name');
  const siteFilter = document.getElementById('site-filter');
  (sites || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.name;
    siteFilter.appendChild(opt);
  });

  document.getElementById('new-emp').addEventListener('click', () => openEmployeeForm(null, context));
  document.getElementById('search').addEventListener('input', debounce(e => { state.search = e.target.value; loadEmployees(context); }));
  document.getElementById('status-filter').addEventListener('change', e => { state.status = e.target.value; loadEmployees(context); });
  siteFilter.addEventListener('change', e => { state.siteId = e.target.value; loadEmployees(context); });

  await loadEmployees(context);
}

async function loadEmployees(context) {
  const list = document.getElementById('employees-list');
  if (!list) return;
  list.innerHTML = `<div class="loading"><div class="spinner"></div>Chargement…</div>`;

  let query = supabase.from('employees')
    .select(`*, departments(name), sites(name)`)
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false });

  if (state.search) {
    query = query.or(`first_name.ilike.%${state.search}%,last_name.ilike.%${state.search}%,email.ilike.%${state.search}%`);
  }
  if (state.status) query = query.eq('status', state.status);
  if (state.siteId) query = query.eq('site_id', state.siteId);

  const { data, error } = await query;
  if (error) { list.innerHTML = `<div class="empty"><h3>Erreur</h3><p>${error.message}</p></div>`; return; }

  if (!data || data.length === 0) {
    list.innerHTML = `<div class="empty">
      <h3>Aucun employé</h3>
      <p>Commencez par ajouter votre premier employé.</p>
    </div>`;
    return;
  }

  list.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr><th>Nom</th><th>Email</th><th>Poste</th><th>Département</th><th>Site</th><th>Statut</th><th>Compte</th><th></th></tr>
        </thead>
        <tbody>
          ${data.map(e => `
            <tr>
              <td><strong>${e.first_name} ${e.last_name}</strong><br><small style="color:var(--pf-text-muted);">${e.employee_number || ''}</small></td>
              <td>${e.email || '—'}<br><small style="color:var(--pf-text-muted);">${e.phone || ''}</small></td>
              <td>${e.position || '—'}</td>
              <td>${e.departments?.name || '—'}</td>
              <td>${e.sites?.name || '—'}</td>
              <td>
                ${badge(e.status)}
              </td>
              <td>${renderAccountBadge(e)}</td>
              <td>
                <div class="table-actions">
                  <button class="icon-btn" data-edit="${e.id}">✎</button>
                  <button class="icon-btn" data-invite="${e.id}" title="Gérer l'invitation">✉️</button>
                  <button class="icon-btn danger" data-del="${e.id}">🗑</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  list.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => openEmployeeForm(data.find(x => x.id === b.dataset.edit), context))
  );
  list.querySelectorAll('[data-invite]').forEach(b =>
    b.addEventListener('click', () => openInviteManager(b.dataset.invite, data, context))
);
  list.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => {
      const e = data.find(x => x.id === b.dataset.del);
      confirmModal(`Supprimer <strong>${e.first_name} ${e.last_name}</strong> ?`, async () => {
        const { error } = await supabase.from('employees').delete().eq('id', e.id);
        if (error) { toast(error.message, 'error'); return; }
        toast('Employé supprimé', 'success');
        loadEmployees(context);
      });
    })
  );
}

function badge(status) {
  const map = {
    active: '<span class="badge badge-success">Actif</span>',
    inactive: '<span class="badge badge-muted">Inactif</span>',
    suspended: '<span class="badge badge-warning">Suspendu</span>',
    terminated: '<span class="badge badge-danger">Terminé</span>',
  };
  return map[status] || `<span class="badge badge-muted">${status}</span>`;
}
function renderAccountBadge(emp) {
  if (emp.user_id) {
    return `<span style="font-size:11px;color:#065f46;display:inline-flex;align-items:center;gap:4px;margin-top:4px;">
      <span style="width:6px;height:6px;background:#10b981;border-radius:50%;"></span>
      Compte actif
    </span>`;
  }
  return `<button class="btn-invite-status" data-invite="${emp.id}" style="background:#fef3c7;color:#92400e;font-size:11px;padding:4px 10px;border-radius:999px;font-weight:600;margin-top:4px;display:inline-flex;align-items:center;gap:4px;cursor:pointer;border:none;font-family:inherit;">
    <span style="width:6px;height:6px;background:#f59e0b;border-radius:50%;"></span>
    Invitation en attente
  </button>`;
}

async function openEmployeeForm(emp, context) {
  const isEdit = !!emp;
  const e = emp || {};

  const [{ data: sites }, { data: deps }] = await Promise.all([
    supabase.from('sites').select('id, name').eq('company_id', context.companyId).order('name'),
    supabase.from('departments').select('id, name').eq('company_id', context.companyId).order('name'),
  ]);

  const { close } = openModal({
    title: isEdit ? 'Modifier l\'employé' : 'Nouvel employé',
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="label">Prénom *</label>
          <input class="input" id="e-first" value="${e.first_name || ''}" />
        </div>
        <div class="form-group">
          <label class="label">Nom *</label>
          <input class="input" id="e-last" value="${e.last_name || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Email ${isEdit ? '' : "* (pour l'invitation)"}</label>
          <input class="input" type="email" id="e-email" value="${e.email || ''}" ${isEdit ? '' : 'required'} />
        </div>
        <div class="form-group">
          <label class="label">Téléphone</label>
          <input class="input" id="e-phone" value="${e.phone || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Matricule</label>
          <input class="input" id="e-num" value="${e.employee_number || ''}" />
        </div>
        <div class="form-group">
          <label class="label">Poste</label>
          <input class="input" id="e-pos" value="${e.position || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Département</label>
          <select class="input" id="e-dep">
            <option value="">—</option>
            ${(deps || []).map(d => `<option value="${d.id}" ${d.id === e.department_id ? 'selected' : ''}>${d.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="label">Site principal</label>
          <select class="input" id="e-site">
            <option value="">—</option>
            ${(sites || []).map(s => `<option value="${s.id}" ${s.id === e.site_id ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="label">Date d'embauche</label>
          <input class="input" type="date" id="e-hire" value="${e.hire_date || ''}" />
        </div>
        <div class="form-group">
          <label class="label">Statut</label>
          <select class="input" id="e-status">
            ${['active','inactive','suspended','terminated'].map(s =>
              `<option value="${s}" ${s === (e.status || 'active') ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      ${!isEdit ? `
        <div style="background:#dbeafe;border-radius:10px;padding:14px;margin-top:16px;font-size:13px;color:#1e40af;">
          <strong>Un lien d'invitation sera envoyé à l'employé.</strong><br>
          Il devra cliquer dessus pour créer son mot de passe et activer son compte.
        </div>
      ` : ''}

      ${isEdit && e.user_id ? `
        <div style="background:#d1fae5;border-radius:10px;padding:14px;margin-top:16px;font-size:13px;color:#065f46;">
          ✅ <strong>Compte activé.</strong> Cet employé peut déjà se connecter.
        </div>
      ` : isEdit ? `
        <div style="background:#fef3c7;border-radius:10px;padding:14px;margin-top:16px;font-size:13px;color:#92400e;">
          ⚠️ <strong>Compte non activé.</strong> L'employé n'a pas encore créé son mot de passe.
        </div>
      ` : ''}
    `,
    footer: `
      <button class="btn btn-secondary" data-cancel>Annuler</button>
      <button class="btn btn-primary" data-save>${isEdit ? 'Enregistrer' : 'Créer et inviter'}</button>
    `,
  });

  document.querySelector('[data-cancel]').addEventListener('click', close);
  document.querySelector('[data-save]').addEventListener('click', async () => {
    if (!isEdit) {
      const limit = await checkPlanLimit('employees');
      if (!limit.allowed) {
        toast(`Limite atteinte : ${limit.current}/${limit.max} employés`, 'error');
        return;
      }
    }

    const email = document.getElementById('e-email').value.trim().toLowerCase();
    if (!isEdit && !email) { toast('Email requis pour l\'invitation', 'error'); return; }

    const payload = {
      company_id: context.companyId,
      first_name: document.getElementById('e-first').value.trim(),
      last_name: document.getElementById('e-last').value.trim(),
      email: email || null,
      phone: document.getElementById('e-phone').value.trim() || null,
      employee_number: document.getElementById('e-num').value.trim() || null,
      position: document.getElementById('e-pos').value.trim() || null,
      department_id: document.getElementById('e-dep').value || null,
      site_id: document.getElementById('e-site').value || null,
      hire_date: document.getElementById('e-hire').value || null,
      status: document.getElementById('e-status').value,
    };

    if (!payload.first_name || !payload.last_name) { toast('Prénom et nom requis', 'error'); return; }

    // Création ou modification de la fiche employé
    let employeeId = emp?.id;
    let error;

    if (isEdit) {
      ({ error } = await supabase.from('employees').update(payload).eq('id', emp.id));
    } else {
      const { data: created, error: err } = await supabase
        .from('employees')
        .insert(payload)
        .select('id')
        .single();
      error = err;
      if (created) employeeId = created.id;
    }

    if (error) { toast(error.message, 'error'); return; }

    // Création de l'invitation (uniquement pour les nouveaux)
    if (!isEdit) {
      const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString(); // 7 jours

      const { error: invError } = await supabase.from('invitations').insert({
        company_id: context.companyId,
        employee_id: employeeId,
        email,
        role: 'employee',
        token,
        expires_at: expiresAt,
        status: 'pending',
      });

      if (invError) {
        toast('Employé créé mais invitation échouée : ' + invError.message, 'error');
        close();
        loadEmployees(context);
        return;
      }

      // Générer le lien d'invitation
      const inviteUrl = `${window.location.origin}/accept-invite?token=${token}`;
      
      // Afficher la modale de succès avec le lien
      close();
      showInviteLink(inviteUrl, email, payload.first_name, payload.last_name);
      loadEmployees(context);
      return;
    }

    toast('Employé modifié', 'success');
    close();
    loadEmployees(context);
  });
}

function showInviteLink(inviteUrl, email, firstName, lastName) {
  const { close } = openModal({
    title: '✅ Invitation créée',
    body: `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:3rem;margin-bottom:12px;">📧</div>
        <p style="color:var(--pf-text-muted);font-size:14px;">
          Un lien d'invitation a été généré pour <strong>${firstName} ${lastName}</strong>.
        </p>
      </div>

      <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="font-size:11px;color:var(--pf-text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em;">
          Lien d'invitation
        </div>
        <div style="font-family:monospace;font-size:12px;word-break:break-all;color:var(--pf-text);">
          ${inviteUrl}
        </div>
      </div>

      <button class="btn btn-primary" id="copy-link" style="width:100%;margin-bottom:10px;">
        📋 Copier le lien
      </button>

      <p style="font-size:12px;color:var(--pf-text-muted);text-align:center;">
        Envoyez ce lien à <strong>${email}</strong>.<br>
        Il est valide 7 jours. L'employé créera son mot de passe via ce lien.
      </p>
    `,
    footer: `<button class="btn btn-secondary" data-close-modal>Fermer</button>`,
  });

  document.getElementById('copy-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast('Lien copié !', 'success');
    } catch {
      toast('Copie impossible, copiez manuellement', 'error');
    }
  });

  document.querySelector('[data-close-modal]').addEventListener('click', close);
}

async function openInviteManager(employeeId, employeesList, context) {
  const emp = employeesList.find(e => e.id === employeeId);
  if (!emp) return;

  // Charge l'invitation en cours
  const { data: invitation } = await supabase
    .from('invitations')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseUrl = window.location.origin;
  const hasValidInvite = invitation && new Date(invitation.expires_at) > new Date();
  const inviteUrl = hasValidInvite ? `${baseUrl}/accept-invite?token=${invitation.token}` : null;

  const { close } = openModal({
    title: `Invitation — ${emp.first_name} ${emp.last_name}`,
    body: `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--pf-gradient);color:white;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800;font-family:var(--pf-font-display);margin:0 auto 12px;">
          ${emp.first_name[0]}${emp.last_name[0]}
        </div>
        <div style="font-weight:600;">${emp.email || "Pas d'email"}</div>
      </div>

      ${hasValidInvite ? `
        <div style="background:#d1fae5;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;color:#065f46;">
          ✅ <strong>Invitation active</strong><br>
          Expire le ${new Date(invitation.expires_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </div>

        <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin-bottom:16px;">
          <div style="font-size:11px;color:var(--pf-text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em;">
            Lien d'invitation
          </div>
          <div style="font-family:monospace;font-size:12px;word-break:break-all;color:var(--pf-text);">
            ${inviteUrl}
          </div>
        </div>

        <button class="btn btn-primary" id="copy-invite" style="width:100%;margin-bottom:10px;">
          📋 Copier le lien
        </button>

        <button class="btn btn-secondary" id="share-invite" style="width:100%;margin-bottom:10px;">
          📤 Partager via WhatsApp / Email
        </button>
      ` : `
        <div style="background:#fef3c7;border-radius:10px;padding:14px;margin-bottom:16px;font-size:13px;color:#92400e;">
          ⚠️ <strong>Aucune invitation active</strong><br>
          ${invitation ? 'La précédente invitation a expiré.' : "Aucune invitation n'a encore été générée."}
        </div>
      `}

      <button class="btn ${hasValidInvite ? 'btn-secondary' : 'btn-primary'}" id="regen-invite" style="width:100%;">
        ${hasValidInvite ? '🔄 Régénérer un nouveau lien' : '✉️ Générer une invitation'}
      </button>

      <p style="font-size:12px;color:var(--pf-text-muted);text-align:center;margin-top:16px;">
        Le lien expire après 7 jours. Régénérez-le si l'employé l'a perdu.
      </p>
    `,
    footer: `<button class="btn btn-secondary" data-close-modal>Fermer</button>`,
  });

  // Copy
  if (hasValidInvite) {
    document.getElementById('copy-invite').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        toast('Lien copié !', 'success');
      } catch {
        toast('Copie impossible', 'error');
      }
    });

    document.getElementById('share-invite').addEventListener('click', () => {
      const msg = `Bonjour ${emp.first_name}, voici votre lien pour activer votre compte Pointify : ${inviteUrl}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      const mailUrl = `mailto:${emp.email}?subject=Invitation%20Pointify&body=${encodeURIComponent(msg)}`;

      // Affiche un mini menu
      const choice = confirm(
        'Partager via :\n\nOK = WhatsApp\nAnnuler = Email'
      );
      window.open(choice ? whatsappUrl : mailUrl, '_blank');
    });
  }

  // Régénération
  document.getElementById('regen-invite').addEventListener('click', async () => {
    const btn = document.getElementById('regen-invite');
    btn.disabled = true;
    btn.textContent = 'Génération…';

    const { data, error } = await supabase.rpc('regenerate_invitation', {
      p_employee_id: employeeId,
    });

    if (error || !data?.success) {
      toast(data?.error || error?.message || 'Erreur', 'error');
      btn.disabled = false;
      btn.textContent = 'Régénérer';
      return;
    }

    toast('Nouveau lien généré !', 'success');
    close();

    // Réouvre la modale avec le nouveau lien
    setTimeout(() => openInviteManager(employeeId, employeesList, context), 300);
  });

  document.querySelector('[data-close-modal]').addEventListener('click', close);
}