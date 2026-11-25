# Contribuir / Contributing

¡Gracias por sumarte! / Thanks for joining!

## Desarrollo / Development

```bash
npm install
npm run dev        # server with auto-reload on http://localhost:8080
npm test           # unit tests (homography, scenes, catalog)
```

Open `http://localhost:8080/display` in one tab and `http://localhost:8080` in another. There is no build step: edit
files in `public/` and reload.

## Ideas welcome

- New shader effects and particle systems (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#adding-an-effect))
- Mesh / grid warp for curved surfaces
- Built-in ambience scenes
- Translations (`public/js/core/i18n.js`)
- MIDI / OSC control, DMX bridges
- Performance on low-end TV boxes

## Guidelines

- Keep it dependency-light and build-free so anyone can hack on it.
- Effects must run at 60 fps at 1080p on a mid-range GPU; test with the FPS overlay (Optics → Show FPS).
- UI text goes through `t()` with both `es` and `en` entries.
- Run `npm test` before opening a PR.
- Be kind. This project is a gift to the community. ❤️
