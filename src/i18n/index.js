import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nativeStorage } from '../lib/storage';
import { DICT, LOCALES } from './strings';

/**
 * Language, and the two number formatters that go with it.
 *
 * Bengali first: `bn` is the default, `en` is the second locale. The design's
 * content rules make this a display concern, not a data one — the API returns
 * `name`/`nameBn` on templates and categories, and the app picks between them
 * (see `src/lib/format.js`).
 */

const BN_DIGIT = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export const useLangStore = create(
  persist(
    (set) => ({
      lang: 'bn',
      setLang: (lang) => set({ lang: LOCALES.includes(lang) ? lang : 'bn' }),
    }),
    { name: 'eape-lang', storage: nativeStorage }
  )
);

/**
 * Bengali numerals in body copy and counters — ৮ ক্রেডিট, ৫০০+ টেমপ্লেট.
 * Latin numerals stay Latin in technical strings (file sizes, "2.1MB").
 */
export const toDigits = (value, lang) => {
  const s = String(value ?? '');
  if (lang !== 'bn') return s;
  return s.replace(/[0-9]/g, (d) => BN_DIGIT[+d]);
};

/**
 * The translator.
 *
 * `t.something` is a string; `t.somethingElse(n)` is one of the few entries that
 * takes a value. Both come straight off the dictionary, so a missing key is a
 * visible `undefined` in development rather than a silent English fallback.
 */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return { t: DICT[lang], lang, num: (v) => toDigits(v, lang) };
}

/** For modules that cannot use hooks — the API client's session-expiry toast. */
export const currentT = () => DICT[useLangStore.getState().lang];
export const currentLang = () => useLangStore.getState().lang;
