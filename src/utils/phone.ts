/**
 * Bangladesh Mobile Number Validation & Formatting Utilities
 * Valid BD operators: 013, 014, 015, 016, 017, 018, 019 (11 digits local, 13 digits with 880)
 */

const BD_PHONE_REGEX = /^(?:\+?880|0)(1[3-9]\d{8})$/;

export function isValidBangladeshPhone(input: string): boolean {
  const cleaned = input.replace(/[\s\-()]/g, '');
  return BD_PHONE_REGEX.test(cleaned);
}

/**
 * Normalizes any valid BD phone number to 13-digit BulkSMSBD format: 8801XXXXXXXXX
 */
export function normalizeBangladeshPhone(input: string): string | null {
  const cleaned = input.replace(/[\s\-()]/g, '');
  const match = cleaned.match(BD_PHONE_REGEX);
  if (!match) return null;
  return `880${match[1]}`;
}

/**
 * Formats normalized 8801XXXXXXXXX to local display format: +880 1XXX-XXXXXX
 */
export function formatBangladeshPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  const normalized = normalizeBangladeshPhone(phone) || phone;
  if (normalized.length === 13 && normalized.startsWith('880')) {
    const part1 = normalized.slice(3, 7);
    const part2 = normalized.slice(7);
    return `+880 ${part1}-${part2}`;
  }
  return phone;
}

/**
 * Returns local 11-digit format (01XXXXXXXXX)
 */
export function toLocalBangladeshPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const normalized = normalizeBangladeshPhone(phone);
  if (normalized && normalized.startsWith('880')) {
    return `0${normalized.slice(3)}`;
  }
  return phone;
}
