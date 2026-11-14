import json
import os
import uuid

import joblib
import numpy as np
import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import accuracy_score, mean_absolute_error, mean_squared_error, r2_score, silhouette_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from services.data_loader import clean_dataframe, is_text, load_dataframe

router = APIRouter()
MODELS_DIR = 'saved_models'
os.makedirs(MODELS_DIR, exist_ok=True)

REGRESSION_ALGOS = {'linear_regression'}
CLASSIFICATION_ALGOS = {'logistic_regression'}


def detect(df, target, algorithm='auto'):
    """Pick the problem type. An explicit algorithm choice wins; otherwise text targets and
    small sets of whole-number labels are classification, other numbers are regression."""
    if not target or target not in df.columns:
        return 'clustering'
    if algorithm in REGRESSION_ALGOS:
        return 'regression'
    if algorithm in CLASSIFICATION_ALGOS:
        return 'classification'
    y = df[target].dropna()
    if is_text(y) or pd.api.types.is_bool_dtype(y):
        return 'classification'
    whole_numbers = bool(np.all(np.mod(y.astype(float), 1) == 0)) if len(y) else False
    unique = y.nunique()
    if whole_numbers and unique <= 10 and unique < max(len(y) * 0.5, 3):
        return 'classification'
    return 'regression'


def prep(df, feats, target=None):
    X = df[feats].copy()
    enc = {}
    for c in X.columns:
        if pd.api.types.is_datetime64_any_dtype(X[c]):
            # Dates become numbers (seconds since 1970) so the scaler and models can use them.
            X[c] = X[c].astype('int64', errors='ignore') // 10**9
            X[c] = X[c].where(df[c].notna(), np.nan)
        elif is_text(X[c]) or pd.api.types.is_bool_dtype(X[c]):
            le = LabelEncoder()
            X[c] = le.fit_transform(X[c].astype(str))
            enc[c] = le
    X = X.apply(pd.to_numeric, errors='coerce')
    X = X.fillna(X.median(numeric_only=True)).fillna(0)
    y = None
    te = None
    if target and target in df.columns:
        y = df[target].copy()
        if is_text(y) or pd.api.types.is_bool_dtype(y):
            te = LabelEncoder()
            y = te.fit_transform(y.astype(str))
        else:
            y = pd.to_numeric(y, errors='coerce')
            y = y.fillna(y.median())
    return X, y, enc, te


@router.post('/train')
async def train_model(
    file: UploadFile = File(...),
    file_type: str = Form(...),
    target_column: str = Form(default=''),
    algorithm: str = Form(default='auto'),
    feature_columns: str = Form(default=''),
):
    try:
        df = clean_dataframe(await load_dataframe(file, file_type))
        target = target_column.strip() or None
        problem = detect(df, target, algorithm)
        if target:
            # Rows without a target value can't be learned from; don't invent a 'nan' class for them.
            df = df[df[target].notna()].reset_index(drop=True)
            if len(df) < 5:
                raise HTTPException(status_code=400, detail=f'Not enough rows with a value in "{target}" to train on.')
            y_raw = df[target]
            target_is_text = is_text(y_raw) or pd.api.types.is_bool_dtype(y_raw)
            if problem == 'regression' and target_is_text:
                raise HTTPException(status_code=400, detail=f'"{target}" is a category, not a number: use a classification algorithm.')
            if problem == 'classification' and not target_is_text and y_raw.nunique() > 20:
                raise HTTPException(status_code=400, detail=f'"{target}" has too many distinct numeric values for classification: use a regression algorithm.')
        feats = json.loads(feature_columns) if feature_columns else [c for c in df.columns if c != target]
        feats = [c for c in feats if c in df.columns and c != target][:20]
        if not feats:
            raise HTTPException(status_code=400, detail='No usable feature columns.')
        X, y, enc, te = prep(df, feats, target)
        scaler = StandardScaler()
        Xs = scaler.fit_transform(X)
        metrics = {}

        if problem == 'clustering':
            k = max(2, min(5, len(df) // 5 or 2))
            model = KMeans(n_clusters=k, random_state=42, n_init=10)
            labels = model.fit_predict(Xs)
            sil = float(silhouette_score(Xs, labels)) if len(set(labels)) > 1 and len(df) > k else 0
            metrics = {'silhouette_score': round(sil, 4), 'n_clusters': k, 'inertia': round(float(model.inertia_), 2)}
            algo = 'kmeans'
        elif problem == 'classification':
            Xtr, Xte, ytr, yte = train_test_split(Xs, y, test_size=.2, random_state=42)
            if algorithm == 'logistic_regression':
                model, algo = LogisticRegression(max_iter=1000), 'logistic_regression'
            elif algorithm == 'decision_tree':
                model, algo = DecisionTreeClassifier(random_state=42), 'decision_tree'
            else:
                model, algo = RandomForestClassifier(n_estimators=100, random_state=42), 'random_forest'
            model.fit(Xtr, ytr)
            yp = model.predict(Xte)
            metrics = {'accuracy': round(float(accuracy_score(yte, yp)), 4), 'test_samples': len(yte), 'train_samples': len(ytr)}
            if hasattr(model, 'feature_importances_'):
                metrics['feature_importances'] = {feats[i]: round(float(v), 4) for i, v in enumerate(model.feature_importances_)}
        else:
            Xtr, Xte, ytr, yte = train_test_split(Xs, y, test_size=.2, random_state=42)
            if algorithm == 'linear_regression':
                model, algo = LinearRegression(), 'linear_regression'
            elif algorithm == 'decision_tree':
                model, algo = DecisionTreeRegressor(random_state=42), 'decision_tree'
            else:
                model, algo = RandomForestRegressor(n_estimators=100, random_state=42), 'random_forest'
            model.fit(Xtr, ytr)
            yp = model.predict(Xte)
            metrics = {
                'rmse': round(float(np.sqrt(mean_squared_error(yte, yp))), 4),
                'mae': round(float(mean_absolute_error(yte, yp)), 4),
                'r2_score': round(float(r2_score(yte, yp)), 4) if len(yte) > 1 else None,
                'test_samples': len(yte),
                'train_samples': len(ytr),
            }
            if hasattr(model, 'feature_importances_'):
                metrics['feature_importances'] = {feats[i]: round(float(v), 4) for i, v in enumerate(model.feature_importances_)}

        model_id = f'{uuid.uuid4()}.joblib'
        joblib.dump(
            {'model': model, 'scaler': scaler, 'encoders': enc, 'target_encoder': te, 'feature_columns': feats, 'problem_type': problem},
            os.path.join(MODELS_DIR, model_id),
        )
        # Only the file name is returned; /predict resolves it inside MODELS_DIR.
        return {'success': True, 'algorithm': algo, 'problem_type': problem, 'feature_columns': feats,
                'target_column': target, 'metrics': metrics, 'model_path': model_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
