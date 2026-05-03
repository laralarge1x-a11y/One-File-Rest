# Mobile asset sources

Drop two PNGs here, then run `pnpm run icons` from `mobile/`:

- `icon.png` — **1024×1024**, no transparency, brand logo on solid background.
  Used to generate every Android launcher icon density (mipmap-*).
- `splash.png` — **2732×2732**, logo centered with at least 25% padding.
  Used to generate the splash screen across screen sizes.

`@capacitor/assets` reads these two files and writes the correct density
folders into `android/app/src/main/res/`. Do not commit the generated
files — re-run the command whenever the brand changes.
