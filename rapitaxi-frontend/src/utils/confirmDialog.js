/**
 * Reemplazo de window.confirm() con el mismo estilo visual del resto de la app.
 * Devuelve una Promise<boolean>: true si el usuario confirma, false si cancela
 * o cierra el dialogo. El host que realmente lo dibuja es <ConfirmHost />,
 * montado una sola vez en App.jsx.
 *
 * Uso: if (!(await confirmDialog('¿Eliminar este registro?'))) return;
 */
export const confirmDialog = (message, options = {}) => new Promise((resolve) => {
  window.dispatchEvent(new CustomEvent('rapitaxi-confirm', {
    detail: {
      id: Date.now() + Math.random(),
      message,
      title: options.title || 'Confirmar acción',
      confirmText: options.confirmText || 'Aceptar',
      cancelText: options.cancelText || 'Cancelar',
      danger: options.danger ?? true,
      resolve,
    },
  }));
});
