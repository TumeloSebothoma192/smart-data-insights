from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List
import joblib, pandas as pd
router=APIRouter()
class PredictRequest(BaseModel): model_path:str; input_data:Dict[str,Any]; feature_columns:List[str]; problem_type:str
@router.post('/predict')
async def predict(req:PredictRequest):
    try:
        b=joblib.load(req.model_path); X=pd.DataFrame({c:[req.input_data.get(c,0)] for c in req.feature_columns})
        for c,le in b.get('encoders',{}).items():
            if c in X.columns:
                try: X[c]=le.transform(X[c].astype(str))
                except Exception: X[c]=0
        X=X.fillna(0); Xs=b['scaler'].transform(X); model=b['model']
        if req.problem_type=='clustering':
            p=int(model.predict(Xs)[0]); return {'prediction':p,'type':'cluster_assignment','label':f'Cluster {p}'}
        if req.problem_type=='classification':
            pred=model.predict(Xs)[0]; te=b.get('target_encoder'); label=str(te.inverse_transform([pred])[0]) if te else str(pred); return {'prediction':label,'type':'class'}
        return {'prediction':round(float(model.predict(Xs)[0]),4),'type':'value'}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))
