const TOASTS_ENABLED_KEY = 'rapitaxi_toasts_enabled';

export const areToastsEnabled = () => localStorage.getItem(TOASTS_ENABLED_KEY) !== 'false';

export const setToastsEnabled = (enabled) => {
  localStorage.setItem(TOASTS_ENABLED_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('toast-preference-changed', { detail: { enabled } }));
};

const dispatchToast = (type, message) => {
  if (!areToastsEnabled()) return;

  window.dispatchEvent(new CustomEvent('rapitaxi-toast', {
    detail: {
      id: Date.now() + Math.random(),
      type,
      message
    }
  }));
};

export const showSuccessToast = (message) => dispatchToast('success', message);

export const showErrorToast = (message) => dispatchToast('error', message);
