# ctOS Greeter

A [nody-greeter](https://github.com/JezerM/nody-greeter) (web-greeter) theme
for LightDM, styled after the ctOS aesthetic. TypeScript + Vite.

## Build

```bash
npm ci
npm run build
```

The build produces `dist/ctos-greeter.tar` — a rootfs archive that unpacks
from `/`:

- `/usr/share/web-greeter/themes/ctos/` — the theme (with an empty
  `backgrounds/` directory; without images the theme uses a plain black
  background)
- `/usr/lib/ctos-greeter/write-system-info` — boot-time helper
- `/etc/lightdm/web-greeter.yml` — web-greeter configuration
- `/etc/lightdm/lightdm.conf.d/20-ctos-greeter.conf` — LightDM drop-in
  selecting nody-greeter

## Release

Pushing a `v*` tag builds the artifact in CI and attaches
`ctos-greeter.tar` to a GitHub Release.

## Development

```bash
npm run dev
```
