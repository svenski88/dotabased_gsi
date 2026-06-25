#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import lightgbm as lgb
import numpy as np


SUPPORTED_MODELS = ("min3", "micro19", "herowr", "max482")


def default_prediction_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parents[1] / "dotaprediction"

    return Path(__file__).resolve().parents[2] / "dotaprediction"


def load_model(model_root: Path, model_name: str):
    model_dir = model_root / model_name
    booster = lgb.Booster(model_file=str(model_dir / "model.txt"))
    meta = json.loads((model_dir / "model_meta.json").read_text(encoding="utf-8"))
    return {
        "booster": booster,
        "features": meta["feature_names"],
        "best_iteration": meta.get("best_iteration"),
    }


def score_model(model, features: dict) -> float:
    x = np.zeros((1, len(model["features"])), dtype=np.float64)
    for index, feature_name in enumerate(model["features"]):
        value = features.get(feature_name, 0.0)
        try:
            x[0, index] = float(value)
        except (TypeError, ValueError):
            x[0, index] = 0.0

    prediction = model["booster"].predict(x, num_iteration=model["best_iteration"])
    return float(np.atleast_1d(prediction)[0])


def main() -> int:
    model_root = Path(os.environ.get("DOTABASED_PREDICTION_DIR") or default_prediction_dir()).resolve()

    try:
      models = {model_name: load_model(model_root, model_name) for model_name in SUPPORTED_MODELS}
    except Exception as error:
        print(json.dumps({
            "type": "startup_error",
            "error": str(error),
            "modelRoot": str(model_root),
        }), flush=True)
        return 1

    print(json.dumps({
        "type": "ready",
        "models": list(models.keys()),
        "modelRoot": str(model_root),
    }), flush=True)

    for line in sys.stdin:
        try:
            request = json.loads(line)
            request_id = request.get("id")
            requested_models = request.get("models") or {}
            response_models = {}

            for model_name, payload in requested_models.items():
                if model_name not in models:
                    response_models[model_name] = {
                        "ok": False,
                        "error": f"Unsupported model: {model_name}",
                    }
                    continue

                features = (payload or {}).get("features") or {}
                response_models[model_name] = {
                    "ok": True,
                    "radiantWinProbability": score_model(models[model_name], features),
                }

            print(json.dumps({
                "id": request_id,
                "ok": True,
                "models": response_models,
            }), flush=True)
        except Exception as error:
            print(json.dumps({
                "id": None,
                "ok": False,
                "error": str(error),
            }), flush=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
