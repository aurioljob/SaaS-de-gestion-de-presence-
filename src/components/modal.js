export function openModal({ title, body, footer, onClose }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">${title}</div>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    if (onClose) onClose();
  };

  overlay.querySelector('[data-close]').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  return { overlay, close };
}

export function confirmModal(message, onConfirm) {
  const { close } = openModal({
    title: 'Confirmation',
    body: `<p style="color:var(--pf-text-muted);">${message}</p>`,
    footer: `
      <button class="btn btn-secondary" data-cancel>Annuler</button>
      <button class="btn btn-danger" data-confirm>Confirmer</button>
    `,
  });
  document.querySelector('[data-cancel]').addEventListener('click', close);
  document.querySelector('[data-confirm]').addEventListener('click', () => {
    close();
    onConfirm();
  });
}