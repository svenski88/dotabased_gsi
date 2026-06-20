# DotaBASED GSI Bridge

Local Node helper for Dota 2 Game State Integration. It receives GSI payloads from the Dota 2 client, exposes browser-readable draft/debug endpoints for DotaBASED, and can proxy prediction requests to local LightGBM model files.

Developer Note:  This is a beta utility and not ready for general distribution yet.  Please provide testing feedback to me on discord: [.svenge](https://discord.com/users/127179901148069889)

## Requirements

- Node.js 18 or newer
- Dota 2 installed locally
- Optional, for `/predict`: Python with `lightgbm` and `numpy`, plus the prediction model directory
  - Prediction models available from WonderCow's patreon here: https://www.patreon.com/TheWonderCow

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
$env:DOTABASED_GSI_STALE_AFTER_MS='5000'
$env:DOTABASED_PYTHON='python'
$env:DOTABASED_PREDICTION_DIR='..\dotaprediction'
$env:DOTABASED_PREDICT_TIMEOUT_MS='2000'
npm start
```

`npm run dev` starts the same helper with Node's watch mode.

## Dota 2 Config

Copy `config/gamestate_integration_dotabased.cfg` to:

```text
steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\gamestate_integration_dotabased.cfg
```

Restart Dota 2 after adding or changing the config.

The checked-in config posts to `http://127.0.0.1:3100/gsi`, enables `provider`, `map`, `player`, `hero`, `draft`, `items`, `abilities`, and `buildings` sections, and sends the default auth token `dotabased-local-gsi`.

## Endpoints

- `POST /gsi`: Dota 2 posts Game State Integration payloads here. Payloads must include `auth.token` matching `DOTABASED_GSI_TOKEN` unless that environment variable is empty.
- `GET /draft`: Returns normalized Radiant/Dire draft data.
- `GET /health`: Returns helper status.
- `GET /debug`: Returns the latest draft plus a compact summary of observed GSI keys.
- `GET /snapshot`: Returns health, staleness, normalized draft, selected GSI sections, summary data, and the raw latest GSI payload.
- `GET /predict/status`: Starts the local Python scorer if needed and returns model readiness/status.
- `POST /predict`: Scores one or more prediction model payloads through the local Python scorer.

`GET /draft` returns:

```json
{
  "connected": true,
  "source": "dota-gsi",
  "matchId": "1234567890",
  "radiantHeroIds": [1, 2, null, null, null],
  "direHeroIds": [3, 4, null, null, null],
  "radiantWin": null,
  "diagnostic": "",
  "gameState": "DOTA_GAMERULES_STATE_HERO_SELECTION",
  "updatedAt": "2026-06-14T00:00:00.000Z"
}
```

Draft extraction accepts several GSI shapes:

- `draft.team2` / `draft.team3`
- `draft.radiant` / `draft.dire`
- flat draft keys such as `radiant_pick0_id`, `radiant_pick_0_id`, and `radiant_hero1`
- `hero.team2` / `hero.team3`
- `hero.radiant` / `hero.dire`

Hero IDs are normalized to five Radiant slots and five Dire slots. Missing or invalid values are returned as `null`.

## Prediction Proxy

`POST /predict` expects a `models` object keyed by supported model name. Supported model names are:

- `min3`
- `micro19`
- `herowr`
- `max482`

Example request:

```json
{
  "models": {
    "min3": {
      "features": {
        "radiant_hero_1": 1,
        "dire_hero_1": 3
      }
    }
  }
}
```

Example response:

```json
{
  "id": 1,
  "ok": true,
  "models": {
    "min3": {
      "ok": true,
      "radiantWinProbability": 0.54321
    }
  }
}
```

By default the scorer looks for model files in `..\dotaprediction` relative to this repo. Each model directory must contain `model.txt` and `model_meta.json` with `feature_names`.

## Browser Access

The helper is intended for local browser access from DotaBASED. It sets CORS headers and `Access-Control-Allow-Private-Network: true` for Chrome Private Network Access preflights.

Allowed browser origins:

- `http://localhost:5173`
- `http://localhost:5174`
- `http://localhost:8080`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:5174`
- `http://127.0.0.1:8080`
- `https://dotabased.com`
- `https://www.dotabased.com`

Use `127.0.0.1`, not a LAN IP, for the first pass.
