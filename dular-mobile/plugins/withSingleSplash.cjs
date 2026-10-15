const fs = require('node:fs/promises');
const path = require('node:path');
const { withAndroidStyles, withDangerousMod } = require('expo/config-plugins');

const TRANSPARENT_ICON = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="1dp" android:height="1dp"
    android:viewportWidth="1" android:viewportHeight="1">
    <path android:fillColor="#00000000" android:pathData="M0,0h1v1h-1z" />
</vector>
`;

module.exports = function withSingleSplash(config) {
  config = withAndroidStyles(config, (mod) => {
    const splashTheme = mod.modResults.resources.style?.find(
      (style) => style.$.name === 'Theme.App.SplashScreen'
    );
    if (!splashTheme) {
      throw new Error('withSingleSplash requer o plugin expo-splash-screen na configuração.');
    }

    const overrides = {
      'android:windowBackground': '#F7F5FF',
      windowSplashScreenBackground: '#F7F5FF',
      windowSplashScreenAnimatedIcon: '@drawable/dular_splash_transparent',
      windowSplashScreenIconBackgroundColor: '@android:color/transparent',
    };
    splashTheme.item = (splashTheme.item ?? []).filter(
      (item) => !Object.hasOwn(overrides, item.$.name)
    );
    for (const [name, value] of Object.entries(overrides)) {
      splashTheme.item.push({ $: { name }, _: value });
    }
    return mod;
  });

  return withDangerousMod(config, ['android', async (mod) => {
    const drawableDirectory = path.join(
      mod.modRequest.platformProjectRoot, 'app/src/main/res/drawable'
    );
    await fs.mkdir(drawableDirectory, { recursive: true });
    await fs.writeFile(
      path.join(drawableDirectory, 'dular_splash_transparent.xml'), TRANSPARENT_ICON
    );
    return mod;
  }]);
};
