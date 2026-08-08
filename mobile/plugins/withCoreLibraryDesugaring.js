const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Enables Android core library desugaring.
 *
 * `@google-cloud/recaptcha-enterprise-react-native` and its transitive
 * `com.google.android.recaptcha` AAR both declare that they require it, and
 * `:app:checkDebugAarMetadata` fails the build outright when it is missing.
 *
 * This has to be a config plugin rather than an edit to android/app/build.gradle:
 * that directory is prebuild output and is gitignored, so a hand-applied change
 * silently disappears the next time anyone runs `expo prebuild --clean` — which
 * is exactly how this surfaced.
 *
 * expo-build-properties has no option for this as of SDK 57, hence patching the
 * Gradle file directly here.
 */
const DESUGAR_LIB = 'com.android.tools:desugar_jdk_libs:2.1.5';

function addCompileOptions(contents) {
  if (contents.includes('coreLibraryDesugaringEnabled')) return contents;

  // Prefer extending an existing compileOptions block over adding a second one.
  const existing = contents.match(/(\n\s*compileOptions\s*\{)/);
  if (existing) {
    return contents.replace(
      existing[1],
      `${existing[1]}\n        coreLibraryDesugaringEnabled true`,
    );
  }

  const androidBlock = contents.match(/\nandroid\s*\{/);
  if (!androidBlock) {
    throw new Error('withCoreLibraryDesugaring: no `android {` block in app/build.gradle');
  }
  return contents.replace(
    androidBlock[0],
    `${androidBlock[0]}
    compileOptions {
        coreLibraryDesugaringEnabled true
    }
`,
  );
}

function addDependency(contents) {
  if (contents.includes('coreLibraryDesugaring ')) return contents;

  const deps = contents.match(/\ndependencies\s*\{/);
  if (!deps) {
    throw new Error('withCoreLibraryDesugaring: no `dependencies {` block in app/build.gradle');
  }
  return contents.replace(
    deps[0],
    `${deps[0]}\n    coreLibraryDesugaring '${DESUGAR_LIB}'\n`,
  );
}

module.exports = function withCoreLibraryDesugaring(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        `withCoreLibraryDesugaring: expected a Groovy build.gradle, got ${cfg.modResults.language}`,
      );
    }
    cfg.modResults.contents = addDependency(addCompileOptions(cfg.modResults.contents));
    return cfg;
  });
};
