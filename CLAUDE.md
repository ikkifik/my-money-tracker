# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Expo/React Native rules (SDK-version caveats, `npx expo install`, Expo Router conventions, no hand-editing `ios/`/`android/`) live in AGENTS.md:

@AGENTS.md

## What this is

"My Money Tracker" — an offline, single-user expense tracker (spec in README.md). Expo SDK 58, Expo Router, React Native 0.88, TypeScript (strict). No backend, no network calls: all data lives on the device in AsyncStorage.

## Commands

```bash
npm start              # expo dev server (a = Android, i = iOS, w = web)
npm run typecheck      # tsc --noEmit
npx expo export --platform web --output-dir <dir>   # full bundle check without a device
npx expo-doctor        # dependency/config diagnostics
npx eas-cli@latest build -p android --profile preview   # installable .apk (profiles in eas.json)
```

There is no test suite and no ESLint config yet (`npx expo lint` would scaffold one).

## Architecture

- **Routing** (`src/app/`): root `_layout.tsx` is a Stack wrapping the `(tabs)` group (Expenses list + Settings) and the expense screens (`expense/new`, `expense/[id]` details, `expense/edit/[id]`, `report/[month]`). New/edit slide up but are **not** `presentation: 'modal'`: the root-level `DialogProvider` `<Modal>` can't present over a native iOS modal screen. Typed routes are on, so `router.push` hrefs are type-checked.
- **State** (`src/state/store.tsx`): one React context (`StoreProvider` / `useStore`) holds `expenses` and `settings` (theme, banks, default currency, Android backup folder). It loads both AsyncStorage keys on mount and writes back via effects **only after `ready`** — keep that guard, or defaults overwrite saved data. Keys are still `.../v1`: older shapes are upgraded on load (and on backup restore) by `src/lib/migrate.ts`, so extend `normalizeExpense`/`normalizeSettings` when the shape changes.
- **Startup gate**: `AppShell` in `_layout.tsx` keeps the splash screen up until both the store is `ready` and the Open Sans fonts are loaded.
- **Theming**: the user picks light/dark explicitly (`settings.theme`), and it does not follow the OS after first launch. `src/lib/theme.ts` defines the `palettes` and builds a React Navigation theme that also sets the Open Sans fonts, so headers and the tab bar follow along. Components get colors with `usePalette()` (in `src/components/ui.tsx`).
- **Font**: the README requires Open Sans everywhere. Render text with `AppText` (or pass `fonts.*` as `fontFamily`) instead of a bare `<Text>`, which would fall back to the system font.
- **Expenses tab**: shows one month at a time (`month` state, a `"YYYY-MM"` key). You can browse from `FIRST_MONTH` (`2026-08`, in `format.ts`) to the current month, using the arrows or the `MonthPicker` grid opened from the title. `DateField` also blocks dates before `FIRST_MONTH`. The `MonthTotals` card compares totals per currency with `settings.monthlyBudget` and turns `p.danger` when over budget; tapping it opens `report/[month]`. The list groups by week (`groupByWeek(expenses, monthRange(month))`) but deliberately shows **no weekly totals**; those live only in the report, together with a breakdown by payment method. Currencies are never summed together. A week that straddles two months keeps its full `start`/`end`, while `shownStart`/`shownEnd` are clipped to the month.
- **CSV export** (`src/lib/csv.ts`): records only, never receipt images. There are three entry points:
  - **Month:** the button in the report.
  - **Week:** the icon in the report; it exports the **full** Monday–Sunday week, even across a month boundary.
  - **All records:** in Settings.

  The file has a UTF-8 BOM for Excel. It is shared through the share sheet on native and downloaded as a Blob on web.
- **Data model** (`src/lib/types.ts`): `amount` is whole units of `currency` (`JPY` | `IDR`). `date` is a local `"YYYY-MM-DD"` string (no time). Use `fromDateKey`/`toDateKey`, never `new Date("YYYY-MM-DD")`, which parses as UTC. `bankName` is copied onto the expense **by value** (only for `bank_transfer`), so renaming or removing a bank doesn't change past records. Money formatting and the live thousand separators in the amount field (`,` for JPY, `.` for IDR) are hand-rolled in `format.ts` rather than using `Intl`.
- **Receipts** (`src/lib/receipts.ts`): camera or photo library (`captureReceipt('camera' | 'library')`), then compressed with expo-image-manipulator in steps until it's 200 KB or less. A draft sits in the cache until the expense is saved; then the store moves it to `Paths.document/receipts/mt-receipt-*.jpg` and deletes replaced or removed files. On web, the JPEG is kept as a data URI on the expense.
- **Surviving uninstall** (`src/lib/backup.ts`): AsyncStorage survives updates but not uninstall. On Android the store auto-mirrors data (debounced) into a user-picked SAF folder. Each write creates a new `money-tracker-data-<ms>.json` and then deletes older ones, because overwriting in place on SAF may not truncate the file. Picking a folder that already holds a backup asks before overwriting it. On both platforms, export/import of a single JSON file with base64-embedded receipts uses the share sheet and file picker.
- **Dialogs**: saving an edit, deleting, and restoring all confirm first. Use `useDialog()` (`confirm`/`alert`/`show`) from `src/components/Dialog.tsx`, never `Alert.alert` or `window.confirm`.
- **Platform splits**: `DateField` opens a modal with an inline `DateTimePicker` on iOS, uses the imperative `DateTimePickerAndroid.open` on Android, and renders a real `<input type="date">` via `createElement` on web. Backup UI is hidden on web.

## Gotcha

Don't wrap a `Pressable` whose `style` is a function in `<Link asChild>`. expo-router's Slot merges styles by spreading them, and a function spreads to nothing, so all the styles disappear. This once made the add-expense button invisible. Use `router.push` in `onPress` instead.
