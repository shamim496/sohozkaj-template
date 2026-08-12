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
 * A credit ledger row's label.
 *
 * The ledger is the account's whole credit history, not this app's — the same
 * balance pays for document sets, prints and question papers in the other
 * SohozKaj apps, and those rows arrive with only a `CreditModule` enum on them.
 * Printing the enum raw ("QUESTION_PAPER") is what the row looked like before
 * this existed.
 *
 * A template generate carries `metadata.templateName`, which is better than any
 * of these, so it wins when present.
 */
const MODULE_LABELS = {
  bn: {
    DOCUMENT: 'ডকুমেন্ট',
    IMAGE: 'এআই ছবি এডিট',
    IMAGE_MANUAL: 'ম্যানুয়াল ছবি এডিট',
    PRINT: 'প্রিন্ট',
    RECHARGE: 'ক্রেডিট রিচার্জ',
    AI_TEMPLATE: 'এআই টেমপ্লেট',
    FORM_FILL: 'ফর্ম পূরণ',
    EXTENSION_FILL: 'এক্সটেনশন ফর্ম',
    BULK_PHOTO: 'বাল্ক ছবি এডিট',
    QUESTION_PAPER: 'প্রশ্নপত্র',
    MIGRATION: 'ব্যালেন্স স্থানান্তর',
  },
  en: {
    DOCUMENT: 'Document',
    IMAGE: 'AI photo edit',
    IMAGE_MANUAL: 'Manual photo edit',
    PRINT: 'Print',
    RECHARGE: 'Credit recharge',
    AI_TEMPLATE: 'AI template',
    FORM_FILL: 'Form fill',
    EXTENSION_FILL: 'Extension form',
    BULK_PHOTO: 'Bulk photo edit',
    QUESTION_PAPER: 'Question paper',
    MIGRATION: 'Balance transfer',
  },
};

export function ledgerLabel(tx, lang) {
  const named = tx?.metadata?.templateName || tx?.metadata?.planName;
  if (named) return named;
  const table = MODULE_LABELS[lang] || MODULE_LABELS.en;
  if (tx?.module && table[tx.module]) return table[tx.module];
  // An enum this build has not seen yet reads better as "Question paper" than
  // as QUESTION_PAPER, so unknown codes are de-slugged rather than printed raw.
  const raw = tx?.module || tx?.source || '';
  return raw ? raw.charAt(0) + raw.slice(1).toLowerCase().replace(/_/g, ' ') : '';
}

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
