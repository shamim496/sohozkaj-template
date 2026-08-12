/**
 * The Easy AI Photo Edit design tokens, transcribed from
 * `_ds/easy-ai-photo-edit-design-system-…/tokens/*.css`.
 *
 * React Native has no CSS custom properties, so the tokens live here as plain
 * values and every component imports from this module rather than hard-coding a
 * hex. When the design system is re-exported, this is the one file to diff.
 *
 * Two deliberate translations:
 *
 *  - **Gradients.** `--gradient-brand` and `--gradient-login` are 278.07deg,
 *    which `expo-linear-gradient` expresses as start/end points rather than an
 *    angle. `GRADIENT.brand.start/end` below are that angle converted, so the
 *    stops still run bottom-right → top-left the way the CSS does.
 *  - **Bevel shadows.** `--shadow-card` is a pair of *inset* shadows, which RN
 *    cannot draw. Cards use `SHADOW.card` (a soft outer shadow, the same value
 *    the design system gives flat mobile tiles) — the design system itself says
 *    mobile tiles take the outer shadow, so this is its own fallback, not ours.
 */

// ── Colour ──────────────────────────────────────────────────────────────────
export const COLOR = {
  orange500: '#FF9900',
  orange600: '#E68900',
  orange400: '#FFB23D',
  orange300: '#FFD580',
  orange200: '#FFD99E',
  orange100: '#FFECD0',
  orange050: '#FFF6E9',
  orangeDeep: '#FF6900',
  orangeBurnt: '#F54900',
  red500: '#FA1014',
  redDanger: '#FF1E00',
  redInk: '#A81603',
  amberInk: '#BD7100',

  violet500: '#9810FA',
  violet400: '#AD46FF',
  violet300: '#C27AFF',
  violetSoft: '#8068FB',
  violet050: '#F3F0FF',

  green500: '#00C950',
  green600: '#00A63E',
  greenInk: '#0CA678',
  blue500: '#2B7FFF',
  blue700: '#1D4ED8',
  blue050: '#EBF5FF',

  black: '#000000',
  ink800: '#111111',
  ink700: '#364153',
  ink600: '#4A5565',
  ink500: '#868E96',
  ink400: '#98A2B3',
  line200: '#ECEEF2',
  line100: '#F0F1F3',
  white: '#FFFFFF',
  page: '#F3F4F5',
  muted: '#F1F1F1',
  thumb: '#F1F3F5',
  subtle: '#F8F9FA',
};

/**
 * The greys the prototype screens use directly. They are not in the token file
 * — the design canvas hard-codes them — so they are named here rather than
 * repeated as literals across ten screens.
 */
export const GREY = {
  label: '#8A94A2', // captions, hints, inactive text
  body: '#5B6472', // secondary paragraphs
  navIdle: '#6B7480', // inactive tab icon + label
  hairline: '#ECEEF2',
  border: '#E5E7EB',
  dashed: '#D3D8DF',
  fill: '#EDEFF2', // image placeholders
  track: '#DDE1E6', // switch track, off
  dot: '#E2E5EA', // onboarding dots, inactive
  chevron: '#B6BEC9',
};

export const TEXT = {
  heading: COLOR.black,
  body: COLOR.ink700,
  muted: COLOR.ink500,
  inverse: COLOR.white,
  link: COLOR.violetSoft,
};

// ── Gradients ───────────────────────────────────────────────────────────────
//
// The signature ramps are `linear-gradient(278.07deg, <first> … <second>)`.
// Converting a CSS angle to the start/end points expo-linear-gradient takes:
//
//   CSS 0deg points to the top and turns clockwise, so the travel direction is
//   (sin θ, −cos θ) in screen coordinates. At θ = 278.07° that is
//   (−0.990, −0.140) — leftwards, tilted very slightly up.
//
//   A gradient's 0% stop sits at the opposite end of that line, so
//   start = 0.5 − dir/2 = (0.995, 0.570) and end = 0.5 + dir/2 = (0.005, 0.430).
//
// Which means the FIRST colour in the CSS declaration is on the RIGHT. Getting
// that backwards flips every button in the app, so the CSS order is kept
// verbatim below: red→orange for brand, violet→orange for account.
const ANGLE_278 = { start: { x: 1, y: 0.57 }, end: { x: 0, y: 0.43 } };

export const GRADIENT = {
  /** `--gradient-brand`. Headline words and primary CTAs. Never re-angle it. */
  brand: { colors: [COLOR.red500, COLOR.orange500], ...ANGLE_278 },
  /** `--gradient-login`. AI and account actions — generate, the FAB, active pills. */
  login: { colors: [COLOR.violet500, COLOR.orange500], ...ANGLE_278 },
  /** `--gradient-get-started`. 90deg, so it runs plainly left → right. */
  getStarted: {
    colors: [COLOR.orangeDeep, COLOR.orangeBurnt, COLOR.violet500],
    start: { x: 0, y: 0.5 },
    end: { x: 1, y: 0.5 },
  },
};

// ── Radius ──────────────────────────────────────────────────────────────────
export const RADIUS = {
  xs: 5,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  '2xl': 16,
  '3xl': 24,
  sheet: 18,
  pill: 9999,
};

// ── Shadows ─────────────────────────────────────────────────────────────────
// RN takes one shadow, not a list, and Android only honours `elevation`.
export const SHADOW = {
  /** Flat mobile tiles and cards. */
  card: {
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  /** The white card the template detail and credits screens sit on. */
  raised: {
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  /** Bottom tab bar — the design's `0 -8px 32px`. */
  nav: {
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  /** Bottom sheets — `0 -12px 40px` plus the violet tint. */
  sheet: {
    shadowColor: '#9810FA',
    shadowOpacity: 0.12,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -12 },
    elevation: 24,
  },
  /** The centre FAB. */
  fab: {
    shadowColor: COLOR.violet500,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
};

// ── Type ────────────────────────────────────────────────────────────────────
// Both families are embedded natively by the expo-font config plugin in
// app.json, one XML family per name with real files per weight — so a bold
// heading picks a real bold rather than an Android-synthesised fake one.
export const FONT = {
  heading: 'AnekBangla',
  body: 'NotoSansBengali',
};

/**
 * `fontWeight` is still set alongside `fontFamily`: on iOS the weight selects
 * the face, on Android the embedded XML family does. Setting both is what makes
 * one style object work on either platform.
 */
export const type = (family, size, weight, extra) => ({
  fontFamily: family,
  fontSize: size,
  fontWeight: weight,
  ...extra,
});

export const heading = (size, weight = '700', extra) =>
  type(FONT.heading, size, weight, { letterSpacing: -0.02 * size, ...extra });

export const body = (size, weight = '400', extra) => type(FONT.body, size, weight, extra);

// ── Layout ──────────────────────────────────────────────────────────────────
export const LAYOUT = {
  headerHeight: 56,
  tabBarHeight: 68,
  screenPadding: 16,
  /** Room under a scroll view so the tab bar never covers the last row. */
  scrollBottom: 120,
};

// ── Motion ──────────────────────────────────────────────────────────────────
export const DURATION = { press: 150, chevron: 200, fade: 300, sheet: 320 };

/**
 * `imageSize` is the template's own aspect key, set by the admin. The card is
 * driven by it rather than by the grid, so a 9/16 jersey template and a 1/1 DP
 * template keep their real shape side by side.
 *
 * Values match `IMAGE_SIZE_CONFIG` in the design system. The backend also
 * stores document sizes (`bd_passport`, `stamp`, …) on older templates; those
 * fall through to the 3/4 default, which is what the web app shows them at.
 */
export const IMAGE_RATIO = {
  landscape_16x9: 16 / 9,
  landscape_3x2: 16 / 9,
  portrait_9x16: 9 / 16,
  portrait_4x5: 3 / 4,
  portrait_2x3: 3 / 5,
  jersey_full: 9 / 16,
  square_1x1: 1,
  auto: 3 / 4,
};

export const ratioFor = (imageSize) => IMAGE_RATIO[imageSize] || 3 / 4;
