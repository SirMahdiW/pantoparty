# پانتوپارتی 🎭

بازی گروهی ادا و حدس کلمه برای دورهمی. وب‌اپ با HTML/CSS/JS خالص، و بسته‌بندی اندروید با [Capacitor](https://capacitorjs.com).

## ساختار

```
├── www/                    # خود بازی (همه‌چیز اینجاست)
│   ├── index.html
│   ├── css/style.css
│   ├── js/words.js         # کلمه‌ها؛ برای افزودن کلمه همین فایل را ویرایش کنید
│   ├── js/app.js           # منطق بازی و صفحه‌ها
│   └── fonts/              # وزیرمتن (مجوز OFL)
├── capacitor.config.json   # تنظیمات اپ اندروید (appId, appName)
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
کد را روی `main` push کنید → تب **Actions** → ورک‌فلو *Build Android APK* → بعد از چند دقیقه فایل `pantoparty-debug-apk` را از بخش Artifacts دانلود کنید و روی گوشی نصب کنید.

**راه ۲ — روی سیستم خودتان** (نیاز: Node 22، JDK 21، Android SDK):

```bash
npm install
npx cap add android
npm run android:build
# خروجی: android/app/build/outputs/apk/debug/app-debug.apk
```

## نسخه‌ی release (برای انتشار)

APK دیباگ فقط برای تست است. برای انتشار باید keystore بسازید و با آن امضا کنید (`assembleRelease` + `apksigner`). keystore را هرگز در گیت نگذارید.

## کلمه‌ها

۱۰ دسته × ۳ سطح × ۶ کلمه = ۱۸۰ کلمه‌ی اولیه. ساختار `www/js/words.js` ساده است؛ فقط به آرایه‌ی هر سطح اضافه کنید.

## قوانین امتیاز

کلمه‌ی درست = امتیاز سطح (۱ تا ۳) · امتیاز سرعت (+۱ اگر نیمی از زمان باقی مانده) · عوض کردن کلمه (−۱ برای هر بار).
