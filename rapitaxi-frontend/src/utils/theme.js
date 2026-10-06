const THEME_KEY = 'rapitaxi_theme';

export const getTheme = () => (localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light');

const applyThemeClass = (theme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
};

// Se llama una sola vez, apenas arranca la app (antes del primer render de
// React), para que la pantalla no parpadee en claro antes de pasar a oscuro.
export const initTheme = () => applyThemeClass(getTheme());

export const setTheme = (theme) => {
  localStorage.setItem(THEME_KEY, theme);
  applyThemeClass(theme);
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
};
