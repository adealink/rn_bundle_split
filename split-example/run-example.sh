#!/bin/bash

mkdir build
node ../bin/index.js --platform ios --output build --config .splitconfig --dev false

#rm -rf android/app/src/main/assets/bundle/*
#cp -R build/split/* android/app/src/main/assets/bundle
#cd android
#./gradlew :app:installDebug
#adb shell am start -n com.example/.MainActivity