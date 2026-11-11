/* تزریق آیکون و رنگ‌های برند به پروژه‌ی اندروید (بعد از cap add android)
 * بدون وابستگی خارجی — فقط فایل‌های تولیدشده در tools/icons را کپی می‌کند.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const ICONS = path.join(ROOT, 'tools', 'icons');

if (!fs.existsSync(RES)) {
  console.error('android res not found:', RES);
  process.exit(1);
}
if (!fs.existsSync(ICONS)) {
  console.error('tools/icons not found:', ICONS);
  process.exit(1);
}

const DENS = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
let copied = 0;

for (const d of DENS) {
  const dir = path.join(RES, 'mipmap-' + d);
  fs.mkdirSync(dir, { recursive: true });
  const files = [
    ['ic_launcher-' + d + '.png', 'ic_launcher.png'],
    ['ic_launcher_round-' + d + '.png', 'ic_launcher_round.png'],
    ['ic_launcher_foreground-' + d + '.png', 'ic_launcher_foreground.png'],
    ['ic_launcher_background-' + d + '.png', 'ic_launcher_background.png']
  ];
  for (const [src, dest] of files) {
    const s = path.join(ICONS, src);
    if (fs.existsSync(s)) {
      fs.copyFileSync(s, path.join(dir, dest));
      copied++;
    }
  }
}

/* آیکون تطبیقی (Android 8+) */
const anydpi = path.join(RES, 'mipmap-anydpi-v26');
fs.mkdirSync(anydpi, { recursive: true });
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
fs.writeFileSync(path.join(anydpi, 'ic_launcher.xml'), adaptive);
fs.writeFileSync(path.join(anydpi, 'ic_launcher_round.xml'), adaptive);
copied += 2;

/* رنگ‌های برند و پس‌زمینه‌ی روشن برای اسپلش */
const values = path.join(RES, 'values');
fs.mkdirSync(values, { recursive: true });
const colorsPath = path.join(values, 'colors.xml');
const colors = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="adabazi_primary">#6D28D9</color>
    <color name="adabazi_primary_dark">#4C1D95</color>
    <color name="adabazi_accent">#8B5CF6</color>
    <color name="adabazi_background">#F6F7FB</color>
    <color name="adabazi_surface">#FFFFFF</color>
    <color name="adabazi_text">#10121A</color>
    <color name="adabazi_splash_background">#F6F7FB</color>
</resources>
`;
fs.writeFileSync(colorsPath, colors);

/* استایل‌ها: پس‌زمینه‌ی روشن برای پنجره‌ی اپ */
const stylesPath = path.join(values, 'styles.xml');
const styles = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="android:windowBackground">@color/adabazi_background</item>
    </style>
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="android:windowBackground">@color/adabazi_background</item>
    </style>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@color/adabazi_background</item>
        <item name="windowSplashScreenBackground">@color/adabazi_background</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
`;
fs.writeFileSync(stylesPath, styles);

console.log('android branding applied (' + copied + ' files)');
