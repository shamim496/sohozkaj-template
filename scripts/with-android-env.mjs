#!/usr/bin/env node
// Runs a command with the two Android build-environment fixes this machine
// needs. Both exist because the Windows username contains a space
// ("C:\Users\Shamim Hasan\..."), which breaks tooling in ways that are hard to
// diagnose from the error messages alone. See the Android build notes in README.md.
//
// 1. JDK — AGP's prefab step turns every stderr line from its child process
//    into a build error, and JDK 24+ prints "WARNING: A restricted method in
//    java.lang.System has been called" there. Any RN module with C++ sources
//    then fails at configureCMakeDebug. JDK 17 or 21 is fine.
//
//    This has to go through GRADLE_OPTS, not gradle.properties: Gradle reads
//    org.gradle.java.home from GRADLE_USER_HOME/gradle.properties with HIGHER
//    precedence than the project's own file, and ~/.gradle/gradle.properties
//    here pins Android Studio's JBR (JDK 25) for the Capacitor app.
//
// 2. Android SDK path — CMake shortens paths containing spaces to 8.3 form
//    ("C:/Users/SHAMIM~1/..."). The NDK toolchain also passes
//    -no-canonical-prefixes, which stops clang from canonicalising its own
//    executable path. Together, clang cannot locate its lib directory and
//    silently links without libc++, so every C++ module dies with
//    "undefined symbol: std::__ndk1::...". Pointing ANDROID_HOME at a
//    space-free junction avoids the shortening entirely.
//
//    Create the junction once (no admin required):
//      New-Item -ItemType Junction -Path C:\AndroidSdk -Target "$env:LOCALAPPDATA\Android\Sdk"

// 3. android/local.properties — `sdk.dir` there takes precedence over the
//    ANDROID_HOME exported below, so `expo prebuild` regenerating the file with
//    the real (spaced) SDK path silently reintroduces problem 2. Rewritten on
//    every run to point at the junction.

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const JDK_CANDIDATES = [
  process.env.ANDROID_GRADLE_JAVA_HOME,
  'C:/Program Files/Java/jdk-21',
  'C:/Program Files/Java/jdk-17.0.19',
  '/usr/lib/jvm/java-17-openjdk',
].filter(Boolean);

const SDK_CANDIDATES = [
  process.env.ANDROID_SDK_NO_SPACES,
  'C:/AndroidSdk',
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
].filter(Boolean);

const jdk = JDK_CANDIDATES.find((p) => existsSync(p));
if (!jdk) {
  console.error(
    'No usable JDK found. Install JDK 17 or 21, or set ANDROID_GRADLE_JAVA_HOME.\n' +
      "Android Studio's bundled JBR is JDK 25 and cannot build RN C++ modules."
  );
  process.exit(1);
}

const sdk = SDK_CANDIDATES.find((p) => existsSync(p));
if (!sdk) {
  console.error('No Android SDK found. Set ANDROID_HOME or create the C:\\AndroidSdk junction.');
  process.exit(1);
}

if (/\s/.test(sdk)) {
  console.error(
    `Android SDK path contains a space: ${sdk}\n` +
      'C++ modules will fail to link. Create a space-free junction:\n' +
      '  New-Item -ItemType Junction -Path C:\\AndroidSdk -Target "$env:LOCALAPPDATA\\Android\\Sdk"'
  );
  process.exit(1);
}

// Gradle splits GRADLE_OPTS on whitespace, so a JDK path with spaces has to
// become its 8.3 short form first ("C:/Program Files" -> "C:/PROGRA~1").
// Unlike the SDK path, this one is only read by the JVM launcher, which does
// resolve short paths correctly.
function withoutSpaces(p) {
  if (process.platform !== 'win32' || !/\s/.test(p)) return p;
  try {
    // `for %I in (...) do @echo %~sI` is the usual recipe but it needs a real
    // cmd.exe context; invoked through a POSIX shell the percent-expansion is
    // mangled and it echoes the input back unchanged. FSO is unambiguous.
    const short = execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `(New-Object -ComObject Scripting.FileSystemObject).GetFolder('${p.replace(/'/g, "''")}').ShortPath`,
      ],
      { encoding: 'utf8' }
    ).trim();
    return /\s/.test(short) || !short ? p : short;
  } catch {
    return p;
  }
}

// Gradle reads sdk.dir as a Java properties value, where `\` and a leading `:`
// separator are escaped. Absent file = nothing to override; Gradle then falls
// back to ANDROID_HOME, which is already correct.
const localProps = fileURLToPath(new URL('../android/local.properties', import.meta.url));
if (existsSync(localProps)) {
  const escaped = sdk.replace(/\//g, '\\').replace(/\\/g, '\\\\').replace(/:/g, '\\:');
  const before = readFileSync(localProps, 'utf8');
  const after = before.replace(/^sdk\.dir=.*$/m, `sdk.dir=${escaped}`);
  if (after !== before) {
    writeFileSync(localProps, after);
    console.log(`[android-env] rewrote sdk.dir in android/local.properties -> ${sdk}`);
  }
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: node scripts/with-android-env.mjs <command> [args...]');
  process.exit(1);
}

const javaHome = withoutSpaces(jdk);
console.log(`[android-env] JDK=${javaHome}`);
console.log(`[android-env] SDK=${sdk}`);

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    ANDROID_HOME: sdk,
    ANDROID_SDK_ROOT: sdk,
    GRADLE_OPTS: `${process.env.GRADLE_OPTS || ''} -Dorg.gradle.java.home=${javaHome}`.trim(),
  },
});

child.on('exit', (code) => process.exit(code ?? 1));
