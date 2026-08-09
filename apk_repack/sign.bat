@echo off
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot
set PATH=%JAVA_HOME%\bin;C:\Users\Admin1\AppData\Local\Android\Sdk\build-tools\34.0.0;%PATH%
cd /d C:\Users\Admin1\Documents\0Tarot\apk_repack
zipalign -p 4 app-debug-unsigned.apk app-debug-aligned.apk > sign.log 2>&1
echo ZIPALIGN_EXIT=%ERRORLEVEL% >> sign.log
call apksigner sign --ks C:\Users\Admin1\.android\debug.keystore --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out tarot-debug.apk app-debug-aligned.apk >> sign.log 2>&1
echo APKSIGNER_EXIT=%ERRORLEVEL% >> sign.log
call apksigner verify tarot-debug.apk >> sign.log 2>&1
echo VERIFY_EXIT=%ERRORLEVEL% >> sign.log
