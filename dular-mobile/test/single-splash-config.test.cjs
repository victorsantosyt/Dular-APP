const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test } = require('node:test');

test('prebuild mantém splash nativo sem ícone e é idempotente', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const config = require('../app.json');
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dular-splash-'));
  try {
    fs.cpSync(path.join(projectRoot, 'assets'), path.join(temporaryRoot, 'assets'), { recursive: true });
    fs.cpSync(path.join(projectRoot, 'plugins'), path.join(temporaryRoot, 'plugins'), { recursive: true });
    fs.copyFileSync(path.join(projectRoot, 'package.json'), path.join(temporaryRoot, 'package.json'));
    fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');
    const testConfig = structuredClone(config);
    delete testConfig.expo.android.googleServicesFile;
    fs.writeFileSync(path.join(temporaryRoot, 'app.json'), JSON.stringify(testConfig));
    const prebuild = () => execFileSync(process.execPath, [
      path.join(projectRoot, 'node_modules/expo/bin/cli'),
      'prebuild', '--platform', 'android', '--no-install',
    ], {
      cwd: temporaryRoot,
      env: { ...process.env, CI: '1', EXPO_NO_GIT_STATUS: '1' },
      stdio: 'pipe',
    });
    const resourcePath = (file) => path.join(temporaryRoot, 'android/app/src/main/res', file);
    prebuild();
    const styles = fs.readFileSync(resourcePath('values/styles.xml'), 'utf8');
    const drawable = fs.readFileSync(resourcePath('drawable/dular_splash_transparent.xml'), 'utf8');
    const splash = styles.match(/<style name="Theme.App.SplashScreen"[\s\S]*?<\/style>/)?.[0];
    assert.ok(splash);
    assert.match(splash, /name="windowSplashScreenAnimatedIcon">@drawable\/dular_splash_transparent</);
    assert.match(splash, /name="android:windowBackground">#F7F5FF</);
    assert.match(splash, /name="windowSplashScreenBackground">#F7F5FF</);
    assert.match(splash, /name="postSplashScreenTheme">@style\/AppTheme</);
    assert.doesNotMatch(splash, /@drawable\/splashscreen_logo|@mipmap\//);
    assert.match(drawable, /android:fillColor="#00000000"/);
    assert.equal((splash.match(/name="windowSplashScreenAnimatedIcon"/g) ?? []).length, 1);
    prebuild();
    assert.equal(fs.readFileSync(resourcePath('values/styles.xml'), 'utf8'), styles);
    assert.equal(fs.readFileSync(resourcePath('drawable/dular_splash_transparent.xml'), 'utf8'), drawable);
    const emittedManifest = fs.readFileSync(path.join(temporaryRoot, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
    assert.match(emittedManifest, /android:icon="@mipmap\/ic_launcher"/);
    assert.match(emittedManifest, /android:theme="@style\/Theme.App.SplashScreen"/);
    const savedConfig = JSON.parse(fs.readFileSync(path.join(temporaryRoot, 'app.json'), 'utf8'));
    assert.deepEqual(savedConfig.expo.ios, config.expo.ios);
    assert.equal(savedConfig.expo.icon, config.expo.icon);
    assert.deepEqual(savedConfig.expo.android.adaptiveIcon, config.expo.android.adaptiveIcon);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
