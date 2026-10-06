export const onlyDigits = (value, maxLength) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
};

export const limitText = (value, maxLength) => String(value ?? '').slice(0, maxLength);

export const formatUnitNumber = (value) => {
  const digits = onlyDigits(value, 5);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
};

export const formatPlate = (value) => {
  const normalized = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  const letters = normalized.slice(0, 3).replace(/[^A-Z]/g, '');
  const numbers = normalized.slice(3).replace(/\D/g, '').slice(0, 4);
  return numbers ? `${letters}-${numbers}` : letters;
};

export const normalizeDecimal = (value, maxIntegerDigits = 6) => {
  const cleaned = String(value ?? '').replace(/[^\d.]/g, '');
  const [integerPart, ...decimalParts] = cleaned.split('.');
  const integer = integerPart.slice(0, maxIntegerDigits);
  const decimals = decimalParts.join('').slice(0, 2);
  return cleaned.includes('.') ? `${integer}.${decimals}` : integer;
};
