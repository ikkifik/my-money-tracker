# My Money Tracker

A personal, fully offline expense tracker for Android and iOS. Record what you spend, see it week by week and month by month, keep a photo of the receipt, and export your records to CSV. Nothing is sent to any server. All data stays on your phone.

## Tech stack

- **React Native** with **TypeScript** (strict)
- **Expo** (SDK 58) and **Expo Router** for screens and navigation
- **Open Sans** (sans-serif) as the app's typeface, used everywhere

## Features

### Recording an expense

| Field | Details |
| --- | --- |
| Expense name | Required. What you spent on. |
| Amount | Required. Thousand separators appear while you type (`12,345` for yen, `12.345` for rupiah). |
| Currency | **Japanese Yen (¥)** or **Indonesian Rupiah (Rp)**. The default comes from Settings. |
| Date | Chosen from a calendar (date only, defaults to today). Dates from 1 August 2026 up to today. |
| Payment method | **Cash**, **PayPay** or **Bank transfer**. For bank transfer you choose which bank (from the list in Settings). |
| Receipt | Optional. **Take a photo** or **upload a picture**. It's always compressed to a JPEG of about 200 KB or less. |
| Note | Optional free text. |

Saving changes to an existing expense, deleting an expense, and other destructive actions ask for confirmation in an in-app pop-up.

### Reports

- **Monthly view.** The Expenses tab shows one month at a time. Use **‹** for the previous month and **›** for the next one. Tap the month name to open a month picker and jump to any month, from **August 2026** (the oldest month) to the current one. The picker also shows how many expenses each month has.
- **Monthly total** for each currency at the top. If you set a monthly budget, a progress bar shows how much is left, and the **total turns red once it's over budget**.
- **The list** groups the month's expenses by week (Monday–Sunday), without totals, to keep it easy to scan.
- **Monthly report.** Tap the monthly total to open the detailed report:
  - the month total against your budget
  - the **total for each week**
  - totals **by payment method**
  - CSV export buttons
- **Details.** Tap an expense to see everything about it, including the receipt (tap the photo for full screen). From there you can edit or delete it.
- **CSV export.** The CSV has the records only (date, name, amount, currency, payment method, bank, note); receipt pictures are never exported. It opens in Excel or Google Sheets, with Japanese and Indonesian text shown correctly. Three exports are available:
  - **Monthly:** the **Export … as CSV** button in the monthly report.
  - **Weekly:** the download icon next to a week in the monthly report. It exports that full Monday–Sunday week, even if part of it falls in the neighbouring month.
  - **All records:** **Settings › Export all records (CSV)**.

### Settings

- **Appearance:** light or dark.
- **Default currency** for new expenses.
- **Monthly budget**, one per currency (leave empty for no limit).
- **Export all records** to one CSV file.
- **Banks:** add, rename or remove bank names. These are names only, since the app is offline. Past expenses keep their bank name even if you rename or remove it.
- **Backup:** see below.

### Keeping your data

- **App updates** keep all your data.
- **Uninstalling** an app erases everything stored inside it, on both Android and iOS. To keep your data after an uninstall, keep a copy outside the app:
  - **Android: automatic backup folder.** In Settings, tap **Choose backup folder** and pick a folder, for example *Documents › MoneyTracker*. From then on every change, including receipt pictures, is saved there automatically, and the folder stays when the app is uninstalled. After reinstalling, choose the same folder again and tap **Restore it to this phone**.
  - **Android and iOS: backup file.** **Export backup file** saves one file (records plus receipts) wherever you like: Files, iCloud Drive, Google Drive and so on. **Import backup file** restores it. On iOS this is the only option, because iOS doesn't let apps keep writing to an outside folder.

## Running it during development

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install
npm start
```

Then either:

- **On your phone:** install **Expo Go** from the Play Store or App Store and scan the QR code shown in the terminal. Phone and computer must be on the same Wi-Fi.
- **In an emulator or browser:** press `a` for an Android emulator, `i` for the iOS simulator (macOS only), or `w` for the web. On the web, the backup features aren't available.

Useful checks:

```bash
npm run typecheck     # TypeScript
npx expo-doctor       # dependency/config health check
```

## Installing on Android (building an .apk)

The app's Android package name is `com.personal.moneytracker` (set in `app.json`). Change it before the first build if you want; changing it later makes Android treat the app as a different one.

### Option A: build in the cloud with EAS (easiest, no Android Studio needed)

1. Create a free account at [expo.dev](https://expo.dev/).
2. Log in from this folder:
   ```bash
   npx eas-cli@latest login
   ```
3. Build the APK, using the `preview` profile from `eas.json`:
   ```bash
   npx eas-cli@latest build -p android --profile preview
   ```
   The first time, it asks to create a project and an Android signing key. Answer **yes** and let EAS manage the key. The build runs on Expo's servers and takes about 10–20 minutes.
4. When it finishes, the terminal prints a link and a QR code. Open it **on your phone**, download the `.apk`, and open it. Android will ask you to allow installing apps from this source (your browser or file manager). Allow it, then tap **Install**.
   - Or download the APK to your computer and install it over USB: `adb install path/to/app.apk`.

To update the app later, build again and install the new APK over the old one. **Your data is kept**, as long as the app is signed with the same key (EAS reuses it automatically).

### Option B: build locally on your computer

You need **Android Studio** (it includes the Android SDK) and **JDK 17**, with `ANDROID_HOME` set.

```bash
npx expo prebuild --platform android       # generates the android/ folder (git-ignored)
cd android
./gradlew assembleRelease                  # on Windows: gradlew.bat assembleRelease
```

The APK is written to `android/app/build/outputs/apk/release/app-release.apk`. Install it with `adb install android/app/build/outputs/apk/release/app-release.apk`, or copy it to the phone and open it.

> A local release build is signed with a **debug key** unless you configure your own keystore. An APK signed with a different key can't be installed over this one. You would have to uninstall first, which erases the app's data, so make a backup before switching between Option A and Option B.

To install straight onto a phone connected over USB (with USB debugging enabled) instead of producing a file, run `npx expo run:android --variant release`.

### Play Store

`eas.json` also has a `production` profile that builds an `.aab` app bundle (`npx eas-cli@latest build -p android --profile production`), which is the format Google Play requires.

## Project layout

```
src/
  app/                    # screens (Expo Router: every file is a route)
    _layout.tsx           # fonts, theme, dialog provider, root stack
    (tabs)/index.tsx      # Expenses: month switcher + picker, monthly total & budget, list grouped by week
    (tabs)/settings.tsx   # theme, default currency, monthly budget, CSV export of all records, banks, backup/restore
    report/[month].tsx    # monthly report: weekly totals, by payment method, CSV export
    expense/new.tsx       # add an expense
    expense/[id].tsx      # expense details (edit / delete)
    expense/edit/[id].tsx # edit an expense (asks before saving)
  components/             # UI building blocks: Open Sans text, inputs, dialog, date field, receipt picker
  lib/                    # types, formatting & grouping, CSV, receipts, backup, data migration
  state/store.tsx         # app state + saving to the device
```
