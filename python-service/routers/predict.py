import os
from typing import Any, Dict, List

import joblib
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from routers.train import MODELS_DIR

router = APIRouter()


class PredictRequest(BaseModel):
    model_path: str
    input_data: Dict[str, Any]
    feature_columns: List[str]
    problem_type: str


def _resolve_model(model_path: str) -> str:
    """Only load model files this service saved: a bare file name inside MODELS_DIR.
    joblib files are pickles, so loading an arbitrary path would let a caller run code."""
    name = os.path.basename(model_path.replace('\\', '/'))
    if not name.endswith('.joblib'):
        raise HTTPException(status_code=400, detail='Invalid model reference')
    full = os.path.realpath(os.path.join(MODELS_DIR, name))
    if os.path.dirname(full) != os.path.realpath(MODELS_DIR) or not os.path.isfile(full):
        raise HTTPException(status_code=404, detail='Model not found')
    return full


@router.post('/predict')
def predict(req: PredictRequest):
    try:
        b = joblib.load(_resolve_model(req.model_path))
        X = pd.DataFrame({c: [req.input_data.get(c)] for c in req.feature_columns})
        encoders = b.get('encoders', {})
        for c in X.columns:
            if c in encoders:
                try:
                    X[c] = encoders[c].transform(X[c].astype(str))
                except Exception:
                    X[c] = 0  # unseen category
            else:
                X[c] = pd.to_numeric(X[c], errors='coerce')
        X = X.fillna(0)
        Xs = b['scaler'].transform(X)
        model = b['model']
        if req.problem_type == 'clustering':
            p = int(model.predict(Xs)[0])
            return {'prediction': p, 'type': 'cluster_assignment', 'label': f'Cluster {p}'}
        if req.problem_type == 'classification':
            pred = model.predict(Xs)[0]
            te = b.get('target_encoder')
            label = str(te.inverse_transform([pred])[0]) if te else str(pred)
            return {'prediction': label, 'type': 'class'}
        return {'prediction': round(float(model.predict(Xs)[0]), 4), 'type': 'value'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
