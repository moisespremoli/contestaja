/** Validadores e normalizadores para dados portugueses. Sem dependências de servidor. */

export function onlyDigits(v: string) {
  return v.replace(/\D/g, "");
}

/** NIF / NIPC: 9 dígitos com dígito de controlo módulo 11. */
export function isValidNif(value: string): boolean {
  const nif = onlyDigits(value);
  if (!/^\d{9}$/.test(nif)) return false;
  if (!/^[1-35-9]/.test(nif)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(nif[i]) * (9 - i);
  const mod = sum % 11;
  const check = mod < 2 ? 0 : 11 - mod;
  return check === Number(nif[8]);
}

/** NIPC (pessoa coletiva): mesmo algoritmo, prefixos 5, 6, 8 ou 9. */
export function isValidNipc(value: string): boolean {
  const nipc = onlyDigits(value);
  return /^[5689]/.test(nipc) && isValidNif(nipc);
}

export function isValidPostalCode(value: string) {
  return /^\d{4}-\d{3}$/.test(value.trim());
}

export function normalizePostalCode(value: string) {
  const d = onlyDigits(value).slice(0, 7);
  return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
}

/** Matrículas portuguesas: AA-00-00, 00-AA-00, 00-00-AA, AA-00-AA. */
export function isValidPlate(value: string) {
  const v = normalizePlate(value);
  return /^([A-Z]{2}-\d{2}-\d{2}|\d{2}-[A-Z]{2}-\d{2}|\d{2}-\d{2}-[A-Z]{2}|[A-Z]{2}-\d{2}-[A-Z]{2})$/.test(v);
}

export function normalizePlate(value: string) {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return raw.match(/.{1,2}/g)?.join("-") ?? "";
}

/** Telefone PT (9 dígitos começados por 2 ou 9), com ou sem +351. */
export function isValidPhone(value: string) {
  const d = onlyDigits(value).replace(/^351/, "");
  return /^[29]\d{8}$/.test(d);
}

export function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function formatNif(value: string) {
  const d = onlyDigits(value);
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : value;
}
