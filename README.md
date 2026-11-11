# پانتوپارتی / ادابازی 🎭

بازی گروهی ادا و حدس کلمه برای دورهمی. وب‌اپ با HTML/CSS/JS خالص، و بسته‌بندی اندروید با [Capacitor](https://capacitorjs.com).

این ریپو همان بازی «ادابازی» (نسخه‌ی کامل وب) را داخل اپ اندروید بسته‌بندی می‌کند.

## ساختار

```
├── www/                    # خود بازی (همه‌چیز اینجاست)
│   ├── index.html
│   ├── css/                # tokens.css (دیزاین‌تکن) + app.css (کلی‌مورفیسم)
│   ├── js/                 # icons, store, audio, data, confetti, game, app
│   ├── data/words.json     # ۱۶,۳۰۵ کلمه ادبیات + ۱,۰۲۹ چالش بوم + ۵۰ ترانه
│   ├── fonts/              # Lalezar + Vazirmatn (محلی، بدون نیاز به اینترنت، OFL)
│   └── icons/              # آیکون‌های اپ
├── capacitor.config.json   # تنظیمات اپ اندروید (appId: app.adabazi.game)
├── package.json
└── .github/workflows/android.yml   # ساخت خودکار APK
```

پوشه‌ی `android/` عمداً در گیت نیست؛ هر بار توسط `cap add android` ساخته می‌شود.

## اجرا در مرورگر

```bash
npm install
npm run serve      # یا هر سرور استاتیک روی پوشه‌ی www
```

## گرفتن APK

**راه ۱ — GitHub Actions (بدون نصب چیزی):**
کد را روی `main` push کنید → تب **Actions** → ورک‌فلو *Build Android APK* → بعد از چند دقیقه فایل `app-debug.apk` را از بخش Artifacts (یا Releases) دانلود کنید و روی گوشی نصب کنید.

**راه ۲ — روی سیستم خودتان** (نیاز: Node 22، JDK 21، Android SDK):

```bash
npm install
npx cap add android
npm run android:build
# خروجی: android/app/build/outputs/apk/debug/app-debug.apk
```

## نسخه‌ی release (برای انتشار)

APK دیباگ فقط برای تست است. برای انتشار باید keystore بسازید و با آن امضا کنید (`assembleRelease` + `apksigner`). keystore را هرگز در گیت نگذارید.

## فونت‌ها

Lalezar و Vazirmatn به‌صورت محلی در `www/fonts/` باندل شده‌اند (مجوز OFL) — اپ کاملاً آفلاین کار می‌کند و هیچ درخواست اینترنتی ندارد.

## قوانین امتیاز

فرمول هر نوبت: `S = P − E − R + B`
- P: امتیاز پایه کلمه (۱ تا ۶ بر اساس سطح)
- E: جریمه‌ی خطاها (هر خطا −۱)
- R: جریمه‌ی تعویض کلمه (فقط یک بار، −۱)
- B: پاداش زمان باقی‌مانده (+۱، در تنظیمات قابل خاموش‌کردن)
