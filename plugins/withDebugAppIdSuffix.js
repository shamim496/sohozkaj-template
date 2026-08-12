const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Gives debug builds their own application id (`com.sohozkaj.template.dev`).
 *
 * A debug and a release build of the same id cannot coexist on one device:
 * their signing keys differ, so installing the second fails with
 * INSTALL_FAILED_UPDATE_INCOMPATIBLE — and if it is force-installed, whichever
 * went on last is the one that launches. That is easy to miss, because the app
 * still opens; it is just not the build you meant to test.
 *
 * It lives in a plugin rather than android/app/build.gradle because `expo
 * prebuild` regenerates that file, so a hand edit survives exactly until the
 * next prebuild.
 *
 * Release is untouched: a Play Store update must keep the original id.
 */
const withDebugAppIdSuffix = (config, { suffix = '.dev' } = {}) =>
  withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withDebugAppIdSuffix: expected a Groovy build.gradle');
    }

    if (cfg.modResults.contents.includes('applicationIdSuffix')) return cfg;

    // Anchor on `buildTypes {` first: `signingConfigs` also contains a `debug {`
    // block and comes earlier in the file, so a bare /debug\s*\{/ lands there and
    // Gradle silently ignores applicationIdSuffix on a signing config.
    const buildTypes = cfg.modResults.contents.indexOf('buildTypes {');
    if (buildTypes === -1) {
      throw new Error('withDebugAppIdSuffix: no buildTypes {} block in app/build.gradle');
    }

    const head = cfg.modResults.contents.slice(0, buildTypes);
    const tail = cfg.modResults.contents.slice(buildTypes);

    const debugBlock = /(\n(\s*)debug\s*\{\n)/;
    if (!debugBlock.test(tail)) {
      throw new Error('withDebugAppIdSuffix: no debug {} block inside buildTypes');
    }

    cfg.modResults.contents =
      head +
      tail.replace(debugBlock, (_, open, indent) => `${open}${indent}    applicationIdSuffix '${suffix}'\n`);

    return cfg;
  });

module.exports = withDebugAppIdSuffix;
