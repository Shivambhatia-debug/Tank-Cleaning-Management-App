@echo off
echo Building Android APK via EAS (Expo)...
echo.
echo First time: When asked "Generate a new Android Keystore?" press Y and Enter.
echo.
cd /d "%~dp0"
npx eas-cli build --platform android --profile preview
pause
