# Yeelight for Stream Deck

A Stream Deck plugin to control Yeelight / Xiaomi smart lamps over your local network.
No cloud, no account, no internet needed to control the lamps. Works with standard
Stream Deck keys (no dials required).

**Actions**
- **Toggle Lamp:** on/off; the key shows the lamp's real state (checked every 10 seconds)
- **Brightness:** set a level, or step up / down
- **Color Temperature:** set a Kelvin value, or step warmer / cooler
- **Color:** pick any color
- **Scene:** a color or white + brightness in one press (also turns the lamp on)

Keys draw their own faces (the chosen color, "2700K", "50%"...). Every action has a
"Lamp IP(s)" field: enter several IPs separated by commas to control a group with one key.

Prefer a desktop window? See the companion app:
[yeelight-control](https://github.com/YOUR-USERNAME/yeelight-control).

## Download and install

1. Download `com.local.yeelight.streamDeckPlugin` from the **[Releases](../../releases/latest)** page.
2. Double-click it (requires Stream Deck software 6.5 or newer).
3. Drag an action from the **Yeelight** category onto a key and enter the lamp's IP address.

The settings panel loads its widgets from the web, so it needs an internet connection while you
configure a key. Controlling the lamps does not.

## Before you start (every lamp)

1. In the **Yeelight** app (or Mi Home), open the lamp's settings and turn on **LAN Control**.
   Some Xiaomi / Mi Home lamps don't support it.
2. Give each lamp a fixed IP address (DHCP reservation in your router).

## Build from source

Requires [Node.js](https://nodejs.org) 20 or newer and the Stream Deck app.

    npm install
    npm run build
    npx streamdeck link com.local.yeelight.sdPlugin

Use `npm run watch` during development to rebuild and restart the plugin on every save.
Before distributing, remove `"Debug": "enabled"` from the `Nodejs` block in
`com.local.yeelight.sdPlugin/manifest.json`.

If PowerShell blocks `npm`, run once:
`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

## Publishing a release (maintainers)

    git tag v0.1.0
    git push origin v0.1.0

GitHub Actions builds the plugin and attaches the `.streamDeckPlugin` file to the release
(see `.github/workflows/build.yml`). Keep the tag in sync with `Version` in `manifest.json`
(which uses four numbers, e.g. `0.1.0.0`).

## Troubleshooting

- **Key shows an alert:** check LAN Control is on, the PC and lamp share a network, and the IP is correct.
- **A lamp rejects a value:** white temperature range depends on the model
  (many bulbs are 2700-6500 K, bedside lamps from 1700 K).
- Lamps accept about 60 commands per minute, so avoid mashing keys.

## Disclaimer

Unofficial project, not affiliated with or endorsed by Yeelight, Xiaomi or Elgato.
All product names and trademarks belong to their respective owners.

## License

[MIT](LICENSE)
