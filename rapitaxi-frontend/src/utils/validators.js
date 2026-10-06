const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value) => EMAIL_REGEX.test(String(value).trim());

export const isRequired = (value) => String(value ?? '').trim().length > 0;

export const hasMinLength = (value, min) => String(value ?? '').trim().length >= min;

/**
 * Corre un objeto { campo: valor } contra un objeto { campo: [validadores] }
 * y devuelve { campo: 'mensaje' } solo para los campos que fallaron.
 * Se reutiliza en cualquier formulario de la app en vez de repetir ifs sueltos.
 */
export const validateFields = (values, rules) => {
  const errors = {};

  Object.entries(rules).forEach(([field, fieldRules]) => {
    for (const rule of fieldRules) {
      const result = rule(values[field]);
      if (result !== true) {
        errors[field] = result;
        break;
      }
    }
  });

  return errors;
};

/**
 * Cedula ecuatoriana de 10 digitos: provincia valida (01-24 o 30), tercer
 * digito menor a 6 y digito verificador correcto (modulo 10). Es la misma
 * regla que aplica el backend (App\Rules\CedulaEcuatoriana).
 */
export const isValidCedulaEc = (value) => {
  const cedula = String(value ?? '');
  if (!/^\d{10}$/.test(cedula)) return false;

  const provincia = Number(cedula.slice(0, 2));
  if ((provincia < 1 || provincia > 24) && provincia !== 30) return false;
  if (Number(cedula[2]) >= 6) return false;

  let suma = 0;
  for (let i = 0; i < 9; i += 1) {
    const valor = Number(cedula[i]) * (i % 2 === 0 ? 2 : 1);
    suma += valor > 9 ? valor - 9 : valor;
  }

  return (10 - (suma % 10)) % 10 === Number(cedula[9]);
};

// Letras (con tildes y Ñ), espacios, apostrofes y guiones: nadie tiene
// numeros ni simbolos como parte de su nombre. 3-80 caracteres: ni un
// nombre de una sola letra ni uno de mas de 80 (una persona real no
// tiene un nombre completo mas largo que eso).
const NOMBRE_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ'\s-]{3,80}$/;

export const isValidNombrePersona = (value) => NOMBRE_REGEX.test(String(value ?? '').trim());

/**
 * Telefono ecuatoriano: 10 digitos, siempre empieza en 0 (celular 09... o
 * convencional 0X...). Es la misma regla que aplica el backend.
 */
export const isValidTelefonoEc = (value) => /^0\d{9}$/.test(String(value ?? '').trim());
