/**
 * La fecha de hoy como la ve el usuario, en formato YYYY-MM-DD.
 *
 * No usar `new Date().toISOString().slice(0, 10)`: eso devuelve la fecha en UTC.
 * Ecuador va cinco horas por detras, asi que a partir de las 19:00 el navegador
 * decia que hoy es mañana. Un socio que registraba un mantenimiento a las 8 de
 * la noche lo guardaba con la fecha del dia siguiente, y el historial de la
 * unidad quedaba corrido un dia sin que nadie lo notara.
 *
 * `sv-SE` es el truco corto para que toLocaleDateString devuelva YYYY-MM-DD.
 */
export const hoyLocal = () => new Date().toLocaleDateString('sv-SE');
