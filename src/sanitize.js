/**
 * Spreadsheet formula-injection sanitizer (shared with Code.gs `safeText_` and `fromSafeText_`).
 *
 * - Prefixes strings starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with a single quote `'`.
 * - Never double-prefixes strings that already start with `'`.
 * - `fromSafeText` strips the leading escape quote when reading back plain-text cells.
 */

export function safeText(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (!str) return '';
  if (str.charAt(0) === "'") return str;
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
}

export function fromSafeText(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.length >= 2 && str.charAt(0) === "'" && /^[=+\-@\t\r]/.test(str.charAt(1))) {
    return str.slice(1);
  }
  return str;
}
