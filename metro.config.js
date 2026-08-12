const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep Metro out of the native build directories.
//
// Gradle rewrites and deletes thousands of files under android/app/build while
// it compiles — the incremental dex state in particular. Metro's watcher was
// crawling into them, and when Gradle deleted a directory mid-crawl the watcher
// died with:
//
//   Error: ENOENT: no such file or directory, watch
//   '...\android\app\build\intermediates\desugar_graph\debug\dexBuilderDebug\...'
//
// That race also corrupted the dex output itself: the resulting APK was missing
// expo.modules.kotlin.* entirely, so the app died at startup with
// NoClassDefFoundError before any JS ran. None of these files are ever imported
// by the JS bundle, so there is nothing to gain by watching them.
config.resolver.blockList = /[\/](android|ios)[\/](build|\.gradle|\.cxx|app[\/](build|\.cxx))[\/].*/;

module.exports = config;
