# DotaBASED GSI Bridge

Local Node helper for Dota 2 Game State Integration. It receives GSI payloads from the Dota 2 client and exposes a small browser-readable draft endpoint for the DotaBASED HeroDraft page.

## Requirements

- Node.js 18 or newer
- Dota 2 installed locally

## Run

```powershell
npm start
```

The helper listens on `http://127.0.0.1:3100` by default.

Environment overrides:

```powershell
$env:DOTABASED_GSI_HOST='127.0.0.1'
$env:DOTABASED_GSI_PORT='3100'
$env:DOTABASED_GSI_TOKEN='dotabased-local-gsi'
npm start
```

## Dota 2 Config

Copy `config/gamestate_integration_dotabased.cfg` to:

```text
steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\gamestate_integration_dotabased.cfg
```

Restart Dota 2 after adding or changing the config.

## Endpoints

- `POST /gsi`: Dota 2 posts Game State Integration payloads here.
- `GET /draft`: Returns normalized Radiant/Dire draft data.
- `GET /health`: Returns helper status.

`GET /draft` returns:

```json
{
  "connected": true,
  "source": "dota-gsi",
  "matchId": "1234567890",
  "radiantHeroIds": [1, 2, null, null, null],
  "direHeroIds": [3, 4, null, null, null],
  "radiantWin": null,
  "updatedAt": "2026-06-14T00:00:00.000Z"
}
```

## Browser Access

The helper is intended for local browser access from DotaBASED. It sets CORS headers and `Access-Control-Allow-Private-Network: true` for Chrome Private Network Access preflights.

Use `127.0.0.1`, not a LAN IP, for the first pass.
