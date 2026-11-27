/**
 * UI Helpers: HTML Escaping, Non-Blocking Toast Notifications, and Custom Modal Dialogs
 * Replaces blocking browser alert(), confirm(), and prompt() dialogs.
 */
class UIHelpers {
  /**
   * Safely escape dynamic strings before inserting into HTML templates or attributes.
   * @param {*} value
   * @returns {string}
   */
  static escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Display a non-blocking toast notification in the bottom-right corner.
   * @param {string} message
   * @param {'info'|'success'|'warning'|'danger'} [type='info']
   * @param {number} [duration=3800]
   */
  static showToast(message, type = 'info', duration = 3800) {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    const icons = {
      success: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>',
      warning: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path></svg>',
      danger: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
      info: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <div class="toast-message">${UIHelpers.escapeHtml(message).replace(/\n/g, '<br>')}</div>
      <button type="button" class="toast-close" aria-label="Dismiss notification">&times;</button>
    `;

    const dismiss = () => {
      toast.classList.add('toast-leaving');
      setTimeout(() => toast.remove(), 220);
    };

    toast.querySelector('.toast-close')?.addEventListener('click', dismiss);
    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }

  /**
   * Internal helper to create and mount a dynamic modal dialog.
   */
  static _openDynamicModal({ title, bodyHtml, footerHtml, width = '480px', onMount }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay dynamic-modal-overlay';
      overlay.style.display = 'flex';

      overlay.innerHTML = `
        <div class="modal-card" style="width: min(92vw, ${width});" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title">${UIHelpers.escapeHtml(title)}</h3>
            <button type="button" class="btn-close" data-action="close" aria-label="Close modal">&times;</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          <div class="modal-footer">${footerHtml}</div>
        </div>
      `;

      let settled = false;
      const close = (result) => {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKeyDown);
        overlay.remove();
        resolve(result);
      };

      const onKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close(null);
        }
      };

      document.addEventListener('keydown', onKeyDown);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(null);
      });
      overlay.querySelector('[data-action="close"]')?.addEventListener('click', () => close(null));

      document.body.appendChild(overlay);
      if (typeof onMount === 'function') {
        onMount(overlay, close);
      }
    });
  }

  /**
   * Show a custom text prompt modal (replaces window.prompt).
   * @param {Object} options
   * @returns {Promise<string|null>}
   */
  static showPromptModal({
    title = 'Enter Value',
    message = '',
    label = '',
    defaultValue = '',
    placeholder = '',
    confirmText = 'Save',
    cancelText = 'Cancel'
  } = {}) {
    const bodyHtml = `
      ${message ? `<p style="font-size: 0.86rem; color: var(--text-muted); margin-bottom: 0.75rem;">${UIHelpers.escapeHtml(message)}</p>` : ''}
      ${label ? `<label style="display: block; font-size: 0.82rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.35rem;">${UIHelpers.escapeHtml(label)}</label>` : ''}
      <input type="text" class="form-control dynamic-prompt-input" value="${UIHelpers.escapeHtml(defaultValue)}" placeholder="${UIHelpers.escapeHtml(placeholder)}">
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary btn-sm" data-action="cancel">${UIHelpers.escapeHtml(cancelText)}</button>
      <button type="button" class="btn btn-primary btn-sm" data-action="confirm">${UIHelpers.escapeHtml(confirmText)}</button>
    `;

    return UIHelpers._openDynamicModal({
      title,
      bodyHtml,
      footerHtml,
      onMount: (overlay, close) => {
        const input = overlay.querySelector('.dynamic-prompt-input');
        const confirmBtn = overlay.querySelector('[data-action="confirm"]');
        const cancelBtn = overlay.querySelector('[data-action="cancel"]');

        const submit = () => {
          const val = (input?.value || '').trim();
          if (!val) {
            input?.focus();
            return;
          }
          close(val);
        };

        confirmBtn?.addEventListener('click', submit);
        cancelBtn?.addEventListener('click', () => close(null));
        input?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        });

        setTimeout(() => {
          input?.focus();
          input?.select();
        }, 30);
      }
    });
  }

  /**
   * Show a custom confirmation modal (replaces window.confirm).
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  static async showConfirmModal({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    danger = false
  } = {}) {
    const bodyHtml = `
      <p style="font-size: 0.9rem; color: var(--text-main); line-height: 1.55;">${UIHelpers.escapeHtml(message).replace(/\n/g, '<br>')}</p>
    `;
    const btnClass = danger ? 'btn-danger' : 'btn-primary';
    const footerHtml = `
      <button type="button" class="btn btn-secondary btn-sm" data-action="cancel">${UIHelpers.escapeHtml(cancelText)}</button>
      <button type="button" class="btn ${btnClass} btn-sm" data-action="confirm">${UIHelpers.escapeHtml(confirmText)}</button>
    `;

    const res = await UIHelpers._openDynamicModal({
      title,
      bodyHtml,
      footerHtml,
      onMount: (overlay, close) => {
        const confirmBtn = overlay.querySelector('[data-action="confirm"]');
        const cancelBtn = overlay.querySelector('[data-action="cancel"]');
        confirmBtn?.addEventListener('click', () => close(true));
        cancelBtn?.addEventListener('click', () => close(false));
        setTimeout(() => confirmBtn?.focus(), 30);
      }
    });

    return Boolean(res);
  }

  /**
   * Show a multi-choice modal (e.g., Merge vs Replace vs Cancel on JSON Import).
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.message
   * @param {Array<{id: string, label: string, description?: string, variant?: string}>} options.choices
   * @returns {Promise<string|null>}
   */
  static showChoiceModal({ title = 'Choose Option', message = '', choices = [] } = {}) {
    const choicesHtml = choices.map(c => `
      <button type="button" class="choice-modal-option" data-choice-id="${UIHelpers.escapeHtml(c.id)}">
        <div class="choice-modal-option-title">${UIHelpers.escapeHtml(c.label)}</div>
        ${c.description ? `<div class="choice-modal-option-desc">${UIHelpers.escapeHtml(c.description)}</div>` : ''}
      </button>
    `).join('');

    const bodyHtml = `
      ${message ? `<p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 0.9rem; line-height: 1.5;">${UIHelpers.escapeHtml(message).replace(/\n/g, '<br>')}</p>` : ''}
      <div class="choice-modal-list">${choicesHtml}</div>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary btn-sm" data-action="cancel">Cancel</button>
    `;

    return UIHelpers._openDynamicModal({
      title,
      bodyHtml,
      footerHtml,
      width: '520px',
      onMount: (overlay, close) => {
        overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => close(null));
        overlay.querySelectorAll('.choice-modal-option').forEach(btn => {
          btn.addEventListener('click', () => {
            close(btn.getAttribute('data-choice-id'));
          });
        });
      }
    });
  }
}

window.UIHelpers = UIHelpers;
