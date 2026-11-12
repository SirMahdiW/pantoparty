# ادابازی — پروژه‌ی اندروید (APK)

بسته‌ی اندروید اپلیکیشن ادابازی بر پایه‌ی **Capacitor**. خروجی APK به‌صورت خودکار با GitHub Actions ساخته می‌شود.

📦 **آخرین نسخه:** https://github.com/SirMahdiW/pantoparty/releases

🌐 **نسخه‌ی وب:** https://sirmahdiw.github.io/adabazi/

---

## ساختار
```
.github/workflows/android.yml   خط لوله‌ی ساخت APK
www/                             همان رابط کاربری وب (کپی همگام با ریپوی سایت)
tools/apply-icons.mjs            تزریق آیکون و تم برند به پروژه‌ی اندروید
tools/icons/                     آیکون‌های لانچر در همه‌ی دانسیتی‌ها
capacitor.config.json            تنظیمات Capacitor
UI-NOTE.md                       سند کامل طراحی رابط کاربری
```

## ساخت
```bash
npm install
npx cap add android
node tools/apply-icons.mjs      # آیکون و تم برند
npx cap sync android
cd android && ./gradlew assembleDebug
```

در CI هر push به `main` این مراحل خودکار اجرا و APK به‌صورت artifact آماده می‌شود.

## همگام‌سازی با وب
پوشه‌ی `www/` باید با ریپوی سایت (`SirMahdiW/adabazi`) یکسان باشد؛
پس از هر تغییر در وب، فایل‌های `www/` را کپی و commit کنید.

## نکته‌ها
- فونت‌ها **محلی** هستند (`www/fonts/`) تا اپ کاملاً آفلاین کار کند
- Service Worker در نسخه‌ی اندروید ثبت نمی‌شود (فقط وب)
- هیچ SDK تبلیغاتی یا پرداخت درون‌برنامه‌ای وجود ندارد
