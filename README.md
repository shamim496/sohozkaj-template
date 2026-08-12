# SohozKaj Template

A React Native (Expo) app with exactly one feature: pick a template, add one
photo, generate. The user never writes a prompt — every template carries its own.

It talks to the same SohozKaj API as `sohozkaj-studio`, using the same client and
the same session rules, but only the AI-template half of it:

| Screen | What it does | Endpoint |
| --- | --- | --- |
| **Home** | The template gallery, searched and filtered locally | `GET /api/ai-templates`, `GET /api/ai-templates/categories` |
| **Template** | Photo slots, admin-defined fields, generate | `GET /api/ai-templates/:id`, `POST /api/ai-templates/:id/generate` |
| **Creations** | Everything this account has generated from a template | `GET /api/image-generation/history?source=ai-templates` |
| **Favourites** | Hearted templates — **device-local**, see below | — |
| **Credits** | Balance, price per generate, packages, ledger | `GET /api/credits/history`, `/costs`, `GET /api/plans` |
| **Profile** | Account, language, two local switches, shop, sign out | `GET /api/auth/me`, `GET /api/office-spaces` |

Accounts are created in the main SohozKaj app; this one signs in with the same
credentials and has no register or password-reset flow.

---

## Running it

```bash
npm install
```

```bash
npm start
```

`.env.development` points at the **live** API (`api-backend.sohozkaj.com`), so
every generate spends real credits. To use a local backend, start
`sohozkaj-backend` and swap the `EXPO_PUBLIC_API_URL` line — `EXPO_PUBLIC_*` vars
are inlined at bundle time, so the dev server must be restarted, not just
reloaded:

- Android emulator → `http://10.0.2.2:4000`
- Physical device → `http://<your-lan-ip>:4000` (the backend must bind `0.0.0.0`)

### Android build

```bash
npm run android
```

### Check it bundles

```bash
npm run export
```

**Expo Go will render the wrong typefaces.** Anek Bangla and Noto Sans Bengali
are embedded natively by the `expo-font` config plugin in `app.json`, which needs
a development build (`npm run android`) — in Expo Go both fall back to the system
font. Everything else works there.

---

## Layout

```
app/
  _layout.jsx          splash held until auth, settings and language rehydrate
  onboarding.jsx       three slides, once
  login.jsx
  credits.jsx
  template/[id].jsx    form → generating → result, one route
  result/[id].jsx      an older result, opened from Creations
  (tabs)/
    _layout.jsx        auth gate, shared loads, tab bar + generate FAB
    index.jsx          the gallery
    creations.jsx
    favourites.jsx
    profile.jsx

src/
  components/          design-system primitives, ported from _ds/
    TemplateMasonry    virtualised masonry — every unbounded gallery
    TemplateGrid       plain dealt masonry — bounded lists only (picker sheet)
  components/icons/    GENERATED from the design system's module-icon SVGs
  constants/theme.js   the design tokens — the only styling source
  i18n/                bn + en, Bengali first
  lib/                 env, session, files, image, format
  services/            axios client + one module per API area
  store/               auth, credits, office space, templates, creations,
                       favourites, settings (zustand)
scripts/
  gen-module-icons.mjs regenerates src/components/icons/ModuleIcon.jsx
```

---

## Where this differs from the design, and why

The design lives in `../AI Template Photo Editor` — a design system under `_ds/`
and two interactive prototypes (`Easy AI Photo Edit v2.dc.html` is the newer).
It was built against a mock, so a few things it draws have no server behind them.
Each departure is deliberate and commented at the code that makes it:

**A sign-in screen was added.** Every AI-template endpoint sits behind
`authenticate`, including the plain list, so there is nothing to show before a
token exists. Built from the design's own primitives.

**A shop row was added to Profile.** Every credit-charging endpoint refuses a
non-admin caller without an `officeSpaceId` — that is the shop whose balance the
generation is billed to. The store picks the first one silently, so an account
with a single shop never sees a decision.

**No variations strip.** `POST /api/ai-templates/:id/generate` returns exactly
one image per call. Four variations would be four calls at 4× the credits. In its
place, the result screen shows earlier results *this account* made from *this
template* — real, and browseable.

**No watermark removal, no HD toggle.** Neither exists in the API. Shipping a
control that charges 20 credits to remove a watermark nothing applies would be a
lie; the prototype's version spent a local variable.

**Packages are read-only.** They are real — `GET /api/plans` is what the website
sells, so a price change upstream lands here with no release. Buying is not
wired: `POST /api/payments/checkout` needs a gateway redirect, status polling and
a verify step against live money. Tapping a package says where to buy.

**The share sheet is the OS one.** The design draws app tiles (Facebook,
WhatsApp, Messenger). Those would either deep-link per app — breaking the moment
one is not installed — or open the system sheet anyway, making the grid a picture
of a choice the user does not get.

**The quality warning measures size, not blur.** Blur cannot be detected without
reading pixels. Resolution can, and it is the failure the model actually suffers
from: it re-encodes to 1536px, so anything under ~900px on the long edge has
nothing to work with. The copy says so.

**Report sends `negative` and nothing else.** `PATCH
/api/image-generation/feedback/:id` takes `positive | negative` — there is no
field for *why*, so the reason the user picks is not transmitted. The sheet's
footer claims only what is true.

**Favourites are device-local.** `/api/pinned-templates` pins *document* template
sets — a different table with a different id space — so pushing AI-template ids
through it would write rows the web app renders as broken tiles. There is no
AI-template favourite endpoint, so favourites do not follow the account to
another phone.

---

## Things worth knowing before changing something

**The gallery is fetched once and filtered locally.** That looks like a shortcut
and is not: `GET /api/ai-templates` runs the category filter in SQL but the
*search* in JavaScript, after loading every matching row. A request per keystroke
costs a full table read to do work the client already holds the data for.
`select()` in `src/store/templatesStore.js` reproduces the server's filter field
for field — name, nameBn, tags, category slug.

**Photo slots fill left to right.** The backend matches uploads to `image`,
`image_2`, `image_3` … by position, so a hole in the list would silently move
every later photo onto the wrong field. Empty slots past the next one are
disabled rather than reordered.

**`imageSize` drives the card's aspect ratio, not the grid.** A 9/16 jersey
template and a 1/1 DP template sit side by side at their real shapes — which is
why every gallery is a *masonry* and never a `FlatList` with `numColumns`, since
`numColumns` forces one height per row.

**The long galleries must stay virtualised.** `TemplateMasonry` (FlashList,
`masonry`) backs the hub, creations and favourites; `TemplateGrid` deals items
into columns inside a plain View and is for **bounded** lists only — today just
the picker sheet, where a virtualised list cannot nest inside the scrolling
bottom sheet.

Putting ~600 templates in the plain grid is what "the home scroll stutters"
looks like, measured on the emulator over an identical ten-swipe scroll:

| | plain grid | FlashList masonry |
| --- | --- | --- |
| janky frames | 54% | **0.4%** |
| 90th-percentile frame | 300ms | **18ms** |
| 99th-percentile frame | 350ms | **19ms** |
| missed vsyncs | 17 | **0** |
| frames drawn | 63 | **242** |
| total PSS | 997MB | **595MB** |

Capping how many cards were mounted did *not* fix it — appending to the slice
re-rendered every card already on screen. Virtualisation plus a memoised
`TemplateCard` is what did.

**The hub's header is a module-scope memoised component, deliberately.**
FlashList reconciles `ListHeaderComponent` by element type, so a header built
inline or through `useCallback` gets a fresh type on every keystroke, remounts,
and the search box loses the keyboard mid-word.

**There is no NativeWind, and adding it back will break layouts.** Styling is
plain style objects built from `src/constants/theme.js` — no `className`
anywhere. NativeWind 4.2.6 was in the initial scaffold and its JSX transform
silently dropped `Pressable`'s *function* styles (`style={({pressed}) => …}`),
taking `flex`, `alignItems`, `gap` and `padding` with them. The tab bar was the
visible casualty: all four tabs measured to their label width and bunched
against the screen edges. Measured on device, before and after removal:

| | label bounds | tab width | tab height |
| --- | --- | --- | --- |
| with NativeWind | `0..66`, `66..185` | 66 / 119px | 126px |
| without | centred at `138, 416, 927, 1205` | 278 / 277px | 186px |

Six components use function styles for press feedback. If NativeWind is ever
wanted here, convert those to static styles with a `pressed` state first.

**Every upload is downscaled first** (`src/lib/image.js`). The generate endpoint
caps a file at 10MB and the model re-encodes to 1536px anyway.

**Results are downloaded straight from R2.** The URLs in API responses are
public, so saving and sharing skip the backend's download proxy — one hop, and no
`Blob` handling, which React Native's XHR does badly.

**History ids are source-tagged.** `/history` returns `t123` for an
AiTemplateImage; the generate endpoint returns the bare `123`. Both resolve on
`GET /:id`, but only the tagged form dedupes against the list, so a fresh result
is tagged on the way into the store (`asTemplateImageRef`).

**Ledger direction is read off the balance, not the amount.** A deduction and a
top-up both store a positive `cost`; only `balanceBefore` → `balanceAfter` says
which way it went.

**One session per account, enforced by the backend.** `src/middleware/auth.js` in
`sohozkaj-backend` compares the JWT's `sessionToken` against the user's current
one and 401s when they differ (admins are exempt). Signing in on the main
SohozKaj app, the website, or another device therefore kills this app's session,
and its next request bounces to login. That is a server-side product rule, not a
bug here — the app just makes it visible with a toast instead of a silent
redirect.

**Icons are generated.** `src/components/icons/ModuleIcon.jsx` is built from the
design system's `assets/module-icons/*.svg` by `scripts/gen-module-icons.mjs`.
Re-run it after a design-system re-export; do not hand-edit the path data.

---

## Android build notes

Three fixes are applied automatically (by `scripts/with-android-env.mjs` at run
time and `plugins/withAndroidBuildEnv.js` at prebuild), all caused by the space
in `C:\Users\Shamim Hasan\`:

1. **JDK 17/21, not 24+.** JDK 24 and later print a restricted-method warning to
   stderr, and AGP's prefab step treats any stderr line as a build error — so
   `configureCMakeDebug` fails before it starts. Written as
   `android/gradle/gradle-daemon-jvm.properties`, whose criteria Gradle 9 reads
   *above* the `org.gradle.java.home` that `~/.gradle/gradle.properties` on this
   machine points at Android Studio's JBR (JDK 25).

2. **A space-free Android SDK path**, in `android/local.properties`. CMake
   shortens spaced paths to 8.3 form and the NDK passes
   `-no-canonical-prefixes`, so clang cannot find its own lib directory and links
   without libc++. Every C++ module then dies on `std::__ndk1::` symbols. Create
   the junction once (no admin needed):

```bash
powershell -Command "New-Item -ItemType Junction -Path C:\AndroidSdk -Target \"$env:LOCALAPPDATA\Android\Sdk\""
```

3. **A space-free NDK path pinned in `android/build.gradle`** — and this is the
   one that makes Android Studio usable. Fix 2 alone does not hold: Android
   Studio rewrites `local.properties` with its own SDK Location on every Gradle
   sync, so `sdk.dir` goes back to the spaced path and the linker errors return.
   The plugin therefore also sets `android.ndkPath` on **every** Android module
   via `allprojects { plugins.withId('com.android.base') }` — every module,
   because the one that actually fails to link is `:react-native-worklets`, not
   `:app`.

   Verified by building with the spaced `sdk.dir` deliberately left in place:
   `:app:assembleDebug` links clean.

   **The block must sit before the `apply plugin:` lines** in
   `android/build.gradle`. `expo-root-project` and `com.facebook.react.rootproject`
   evaluate subprojects as they are applied, so a block placed after them runs
   against projects AGP has already configured and Gradle fails the build with
   *"It is too late to set ndkPath."* The plugin inserts at the right anchor and
   throws at prebuild if it cannot find one.

Debug builds get a `.dev` application id suffix
(`plugins/withDebugAppIdSuffix.js`) so a debug and a release build can sit on the
same device without `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.

Keep `gradle/wrapper/gradle-wrapper.properties` on **9.3.1** — Android Studio's
"Upgrade Gradle" prompt bumps it to a version whose Kotlin cannot compile Expo
SDK 57's Gradle plugin sources.

`expo prebuild` fails with `EBUSY: resource busy or locked, rmdir '…/android'`
while Android Studio has the project open — it clears `android/` before
regenerating. Close the IDE (or run `./gradlew --stop` and retry) first.
