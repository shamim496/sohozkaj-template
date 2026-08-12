import { toDigits } from '../i18n';

/**
 * Turning API records into the strings the design asks for.
 */

/**
 * A template's display name.
 *
 * The design system is explicit that template *titles* stay English even in the
 * Bengali UI — they name a visual style ("Cinematic Suit Portrait"), and that is
 * how the web gallery reads. `nameBn` is only used when an admin actually filled
 * it in AND the user is on Bengali; otherwise `name` is the title.
 */
export const templateTitle = (template, lang) =>
  (lang === 'bn' && template?.nameBn?.trim()) || template?.name || '';

/** Categories are the opposite: they are UI chrome, so Bengali wins when present. */
export const categoryLabel = (category, lang) =>
  (lang === 'bn' && category?.nameBn?.trim()) || category?.name || '';

/**
 * "আজ, ১১:০৪" / "৩ দিন আগে" — the credit ledger's relative timestamps.
 *
 * Deliberately coarse. The ledger answers "when roughly did this happen", and a
 * full date on every row is noise; the exact timestamp is on the web receipt.
 */
export function relativeTime(value, lang) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

  const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  if (days <= 0) return lang === 'bn' ? `আজ, ${toDigits(clock, lang)}` : `Today, ${clock}`;
  if (days === 1) return lang === 'bn' ? 'গতকাল' : 'Yesterday';
  if (days < 30) {
    return lang === 'bn'
      ? `${toDigits(days, lang)} দিন আগে`
      : `${days} day${days === 1 ? '' : 's'} ago`;
  }
  return date.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * The name a generated file is stamped with, matching the web app's
 * "<shop> - <date> - <n>" filenames so a shop's downloads sort together.
 */
export function generationName(shopLabel) {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const stamp = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(
    now.getSeconds()
  ).padStart(2, '0')}`;
  return `${shopLabel || 'Sohozkaj'} - ${date} - ${stamp}`;
}

/** "2.1MB" — Latin numerals, per the design's copy rules. */
export function humanSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
