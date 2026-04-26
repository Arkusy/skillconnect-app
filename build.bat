@echo off
call npx expo prebuild
cd android
gradlew assembleRelease
