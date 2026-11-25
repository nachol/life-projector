# Life Projector — Android TV / Google TV app

A small Kotlin app that turns any Android TV, Google TV, TV box or Android phone into a Life Projector display.

- Finds the server automatically on the network (mDNS `_lifeprojector._tcp`), or accepts a typed URL.
- Opens `<server>/display` fullscreen in a hardware-accelerated WebView, keeps the screen on, reconnects on its own.
- Optional **start on boot** — ideal for permanent installations.
- Remote control: **OK** shows the info / QR overlay, **BACK** returns to setup.

## Install

Download `life-projector-tv.apk` from the GitHub **Releases** page (or the *Android TV app* workflow artifacts) and
sideload it (e.g. with *Send Files to TV*, or `adb install life-projector-tv.apk`).

> mDNS discovery requires the server to run with host networking (`docker-compose.host.yml`) or without Docker.
> Otherwise just type `http://<server-ip>:8080`.

## Build

Requires JDK 17 and the Android SDK (API 35).

```bash
cd android-tv
gradle assembleRelease      # Gradle 8.10+
# → app/build/outputs/apk/release/app-release.apk (signed with the debug key for sideloading)
```

For a store release, configure your own `signingConfig` in `app/build.gradle.kts`.
