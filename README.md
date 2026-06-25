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

Windows users can also start the bridge with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-dotabased-gsi.ps1
```

## Dota 2 Config

Enable Game State Integration in Dota 2's Steam launch options:

1. Open Steam.
2. Right-click Dota 2 and select `Properties`.
3. In `General` -> `Launch Options`, add:

```text
-gamestateintegration
```

Copy `config/gamestate_integration_dotabased.cfg` to:

```text
steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\gamestate_integration_dotabased.cfg
```

Restart Dota 2 after adding or changing the config.

The checked-in config posts to `http://127.0.0.1:3100/gsi`, enables `provider`, `map`, `player`, `hero`, `draft`, `items`, `abilities`, and `buildings` sections, and sends the default auth token `dotabased-local-gsi`.

Windows users can install the checked-in config with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-gsi-config.ps1
```

If Dota 2 is installed in a custom Steam library, pass the folder ending in `dota 2 beta\game\dota`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-gsi-config.ps1 -DotaPath "D:\SteamLibrary\steamapps\common\dota 2 beta\game\dota"
```

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

By default, source/development mode looks for model files in `..\dotaprediction` relative to this repo. Windows executable releases look for model files in `.\dotaprediction` next to `dotabased-gsi.exe`, even if that folder is not present yet. Set `DOTABASED_PREDICTION_DIR` to override either default. Each model directory must contain `model.txt` and `model_meta.json` with `feature_names`.

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

## Release Packaging

### Source Release Zip

Build a GitHub Release zip locally with:

```powershell
npm run release:zip
```

If PowerShell blocks `npm.ps1`, use:

```powershell
npm.cmd run release:zip
```

This creates:

```text
dist\dotabased-gsi-v0.1.0.zip
```

The release zip contains the source files, config template, README, and helper scripts. It intentionally does not include prediction model files.

Suggested GitHub release flow:

```powershell
git status
git add .gitignore README.md package.json scripts
git commit -m "add release helper scripts"
git tag v0.1.0
git push origin master
git push origin v0.1.0
```

Then create a GitHub Release from the `v0.1.0` tag and upload `dist\dotabased-gsi-v0.1.0.zip`.

### Windows Executable Release Zip

Build a Windows x64 release zip with:

```powershell
npm.cmd run release:windows-exe
```

This creates:

```text
dist\dotabased-gsi-v0.1.0-windows-x64.zip
```

The Windows executable release is intended for users who do not have Node.js or Python installed. It contains:

- `dotabased-gsi.exe`: the local bridge server packaged with Node's Single Executable Application flow.
- `scorer\scorer.exe`: the prediction scorer packaged with PyInstaller.
- `config\gamestate_integration_dotabased.cfg`.
- `scripts\install-gsi-config.ps1`.
- `start-dotabased-gsi.bat`.

Build environment requirements for the Windows executable zip:

- Node.js with `--experimental-sea-config` support.
- `npm`/`npx`, used by the build script to run `esbuild` and `postject`.
- Python with PyInstaller, LightGBM, and NumPy installed:

```powershell
python -m pip install pyinstaller lightgbm numpy
```

To include local prediction models in the executable release zip, pass the model directory explicitly:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-windows-release.ps1 -IncludePredictionModels -PredictionDir "C:\path\to\dotaprediction"
```

Only include prediction model files if redistribution is allowed. If models are omitted, the bridge still starts, but `/predict/status` reports a model-loading error until users provide `DOTABASED_PREDICTION_DIR` or place models in `dotaprediction` next to `dotabased-gsi.exe`.
