# Personal Wallet Manager

React Native (Expo SDK 57) + TypeScript personal finance app. Offline-first, SQLite storage, SecureStore authentication.

## APK Build (Local Build)

Zaroori cheezein (Windows/Mac/Linux):
1. Node.js LTS (v20+): https://nodejs.org — check: `node -v`
2. Java 17 JDK: `java -version`
3. Android Studio (with Android SDK + Emulator optional): https://developer.android.com/studio
4. Environment variables:
   - `ANDROID_HOME` = Android SDK path (e.g. C:\Users\you\AppData\Local\Android\Sdk)
   - `JAVA_HOME` = JDK 17 path

Commands (project folder ke andar):

```bash
npm install
npx expo-doctor          # optional health check
npx expo prebuild -p android --clean
cd android && ./gradlew assembleRelease
```

APK location:
- Windows: `android\app\build\outputs\apk\release\app-release.apk`
- Mac/Linux: `android/app/build/outputs/apk/release/app-release.apk`

Debug build (fast test): `cd android && ./gradlew assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk`

## APK Build (Cloud — EAS, agar local Android Studio na ho)

```bash
npm install -g eas-cli
eas login
eas build -p android --profile production
```

Build complete hone par link milega jahan se APK download ho jayega.

## Development / Testing on Phone

```bash
npx expo start
```
Phir Expo Go app ya `npx expo run:android` se device/emulator par chalayein.

## Tests & Type Check

```bash
npm test
npx tsc -p tsconfig.check.json --noEmit
```

## Notes
- Password/PIN SecureStore mein hashed form mein store hote hain; database plain SQLite hai — backup regularly rakhein.
- App delete ya device lose hone par data chala jayega agar backup export nahi kiya.
