# Easy AI Photo Edit

A React Native (Expo) app with exactly one feature: pick a template, add one
photo, generate. The user never writes a prompt — every template carries its own.

It is a SohozKaj product and signs in with a SohozKaj account, but the app's own
name is **Easy AI Photo Edit** — which is what the design system, the Expo slug
(`easy-ai-photo-edit`), the URL scheme (`easyaiphotoedit`) and the `eape-*`
storage keys have always called it. The repository folder and the git remote
still say `sohozkaj-template`; renaming those is a separate, manual job.

It talks to the same SohozKaj API as `sohozkaj-studio`, using the same client and
the same session rules, but only the AI-template half of it:

| Screen | What it does | Endpoint |
| --- | --- | --- |
| **Home** | The template gallery, searched and filtered locally | `GET /api/ai-templates`, `GET /api/ai-templates/categories` |
| **Template** | Photo slots, admin-defined fields, generate | `GET /api/ai-templates/:id`, `POST /api/ai-templates/:id/generate` |
| **Creations** | Everything this account has generated from a template | `GET /api/image-generation/history?source=ai-templates` |
| **Favourites** | Hearted templates — **device-local**, see below | — |
| **Credits** | Balance, price per generate, packages, buying, ledger | `GET /api/credits/history`, `/costs`, `/config`, `GET /api/plans`, `POST /api/payments/[ssl/]checkout`, `/verify/:ref`, `GET /api/payments/status/:orderId` |
| **Profile** | Account, language, two local switches, shop, sign out | `GET /api/auth/me`, `GET /api/office-spaces` |
| **My profile** | Editing the account, avatar, password | `PUT /api/auth/profile`, `POST /api/auth/profile/picture`, `/change-password` |
| **Payments** | What this account has paid for, and a recheck | `GET /api/payments/history` |
| **Sign in** | Phone or email + password, remember me | `POST /api/auth/login` |
| **Sign up** | Country, number, email, name, password, then the code | `POST /api/auth/pre-register`, `/verify-otp`, `/register` |
| **Forgot password** | Number → SMS code → new password | `POST /api/auth/forgot-password`, `/reset-password` |

It is the same account as the main SohozKaj app, from either direction: one made
here signs into the website, and one made there signs in here.

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
  register.jsx         details → SMS or email code → account, in one route
  forgot-password.jsx  number → SMS code + new password
  credits.jsx
  profile-edit.jsx     the editable account form
  change-password.jsx
  payments.jsx         purchase history
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
    authUi.jsx         the WEBSITE's form language — the three auth screens only
    OtpInput           six boxes, one hidden field (SMS autofill needs one)
    PickerSheet        searchable sheet — the sign-up country list
    TemplateMasonry    virtualised masonry — every unbounded gallery
    TemplateGrid       plain dealt masonry — bounded lists only (picker sheet)
  components/icons/    GENERATED from the design system's module-icon SVGs
  constants/theme.js   the design tokens — the only styling source
  constants/countries  GENERATED — dial codes + names for the sign-up picker
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

**A sign-in screen was added, and sign-up and password reset with it.** Every
AI-template endpoint sits behind `authenticate`, including the plain list, so
there is nothing to show before a token exists.

Those three are **ports of sohozkaj.com's own auth pages**, not of this design
system: the SohozKaj mark over the same subtitle, a white card with a zinc
hairline, `rounded-md` inputs with a grey glyph at the head, one solid-orange
button. It is the same account system, so the form a person filled in on the
website is the form they get here. They are built on `src/components/authUi.jsx`
and the `SK` palette in `theme.js` — and on nothing in `ui.jsx` except the
language switch, because averaging the two design systems would produce a third
that is neither. `ui.jsx` inside the app, `authUi.jsx` at its door.

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

**Buying works, in a WebView, for Bangladesh only.** `POST
/api/payments/{ssl/,}checkout` returns the gateway's page URL, the app hosts it,
watches for the return redirect and settles the order against `/verify` then
`/status`. It has to be a WebView: the backend builds the return URLs itself and
finishes with a hard-coded 302 to `${FRONTEND_URL}/payment/success|failed`, so
there is no app scheme to hand a browser and no other way to learn how it ended.
Non-Bangladesh accounts and `packageType: 'others'` packages still point at the
website — FastSpring returns a `sessionId` for a JS popup, with no redirect URL
and no verify endpoint, so there is nothing a native client can drive.

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

**Signing up is three calls, and the middle one is not optional.**
`/auth/pre-register` writes an unverified row and texts the code, `/auth/verify-otp`
spends it, `/auth/register` creates the account and answers with a session.
`register` re-checks the verification server-side, so a client that skips ahead
gets a 401 — which is also why `/auth/register` is on the API client's public
list: that 401 is an unverified number, not an expired session.

**New accounts register as OWNER.** `AuthService.register` grants the signup
bonus and creates the default "Personal Space" office space for OWNER only, and
every credit-charging endpoint refuses a non-admin caller that has no office
space. An OPERATOR signed up here would reach the gallery with no credits, no
shop and no way to generate. The website keeps the OPERATOR path for staff an
owner adds.

**The country on the sign-up form decides how the code travels.** The backend
routes it: Bangladesh (or unset) gets an SMS, every other country gets an email
— which is why the email field is optional for BD and required elsewhere, and
why the resend, the OTP `purpose` and `verificationMethod` on the final
`register` all have to agree with the country. They are derived from it in one
place in `app/register.jsx`; a purpose that disagrees reads as "not verified" at
the very end of an otherwise perfect flow.

`change-registration-phone` is the SMS path only — it always answers by SMS. A
number corrected on the email path starts a fresh pre-registration instead.

**Two design systems live here, deliberately.** `ui.jsx` + the tokens at the top
of `theme.js` are the AI-template system — pill buttons, 12px radii, the
violet→orange account gradient. `authUi.jsx` + `SK` in the same file are
sohozkaj.com's, and reach exactly three screens. Do not "unify" them: the point
of the auth screens looking like the website is that they *are* the website's
account. Anything new inside the app uses `ui.jsx`.

The auth screens borrow the website's *form*, not its *mark*: they are headed by
`Wordmark` like every other screen. SohozKaj's logo is the parent platform's, and
the design system is explicit that Easy AI Photo Edit has none — the name in Anek
Bangla 800 with "AI" gradient-filled is the mark. Whose account it is gets said in
the subtitle, in words.

**Phone numbers are validated against the server's own rule, not a library.**
`libphonenumber-js` (which the website carries) is not a dependency here: the
BD local form has its own pattern, and everything else is checked against the
E.164 rule `Validator.validatePhone` enforces. A stricter check here would
reject numbers the account system accepts. `src/constants/countries.js` is
**generated** from the website's own data — provenance is in the file's header.

Sign-up asks for country, number, email, name and password, and nothing else.
District is not on the form: the schema takes it as nullable, and it is editable
in Profile, where filling it in is part of what earns the profile-completion
bonus. Adding a field back here costs a signup.

Password reset stays Bangladesh-only, because `/auth/forgot-password` is: its
schema takes eleven digits and the code goes by SMS. A non-BD account resets on
the website.

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

**A purchase needs a native rebuild.** `react-native-webview` is a native
module, so `npm run android` (or `expo prebuild` + a build) is required before
the Buy button works — an existing dev build and Expo Go both crash on the
import. Nothing else in the app touches it.

**Every test purchase is a real charge.** `activePaymentGateway` defaults to
`sslCommerz` and `SSLCommerzService` defaults to the *live* host, while
`.env.development` points at the live API. Use the cheapest plan, or a staging
`EXPO_PUBLIC_API_URL`.

**PENDING is a real answer, not a spinner.** SSLCommerz holds a risk-flagged
payment for manual review and reports it as pending with the credits not
granted, so the copy promises a later arrival rather than a wait of seconds. The
redirect's own `reason` is what distinguishes a cancel from that — a cancelled
Moneybag order has nothing to verify and would otherwise sit PENDING for a day
while the user is told credits are coming.

**`FAILED` does not mean "no money moved".** `evaluateAndSettle` writes FAILED on
the tran_id and amount mismatch paths, both of which are only reachable *after*
the gateway reported the transaction valid. No copy in this app tells a user
they were not charged.

**Profile saves are a diff, never the whole form.** `AuthService.updateProfile`
reads an absent key as "leave it alone" and `null` as "clear it", and the cached
user can be the thin login projection. Sending the form wholesale off that
object writes null over six columns the user never saw — so the screen waits for
`/auth/me`, keeps the result, and sends only what changed.

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

Four fixes are applied automatically (by `scripts/with-android-env.mjs` at run
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

4. **A working `:expo-modules-core:generateStubPCH`** — this is the one that
   makes Android Studio *sync*. Upstream (57.0.10, current latest) builds that
   task's clang command by splitting the `compile_commands.json` entry on every
   space, and locates the paths to rewrite with a no-whitespace regex. Both
   assume no path contains a space, so under this project root the arguments
   reach clang in fragments:

```
clang++: error: no such file or directory: 'C:/Users/Shamim C:/Users/Shamim Hasan/…/stub_pch.hxx'
clang++: error: no input files
```

   The task is an IDE helper: it pre-creates a throwaway PCH so Android Studio's
   C++ engine has one to read during sync, then backdates it so ninja rebuilds
   the real one. It is wired into `prepareKotlinBuildScriptModel`, the first
   thing a sync runs — so sync dies on it while builds are unaffected, which is
   why this stayed invisible from the command line.

   The plugin injects an `allprojects` block replacing the task's action with the
   same logic minus the two assumptions: split the command the way a shell would,
   and swap whole argv entries instead of rewriting the command string.
   Overriding from the root project rather than patching `node_modules` is what
   survives `npm install`; regenerating it at prebuild is what survives
   `prebuild --clean`.

   Verified by deleting PCH files and running
   `./gradlew prepareKotlinBuildScriptModel`: clang rewrites them (`CPCH` magic
   bytes) and the full-size PCHs from earlier real builds are left alone.

Debug builds get a `.dev` application id suffix
(`plugins/withDebugAppIdSuffix.js`) so a debug and a release build can sit on the
same device without `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.

Keep `gradle/wrapper/gradle-wrapper.properties` on **9.3.1** — Android Studio's
"Upgrade Gradle" prompt bumps it to a version whose Kotlin cannot compile Expo
SDK 57's Gradle plugin sources.

`expo prebuild` fails with `EBUSY: resource busy or locked, rmdir '…/android'`
while Android Studio has the project open — it clears `android/` before
regenerating. Close the IDE (or run `./gradlew --stop` and retry) first.
