from fastapi import APIRouter, File, UploadFile, Form, HTTPException
import numpy as np
import pandas as pd
from services.data_loader import load_dataframe, clean_dataframe, get_column_types, safe

router = APIRouter()


def _series_to_float(series):
    return pd.to_numeric(series, errors='coerce')


def _build_time_series(df, numeric_cols):
    date_cols = [c for c in df.columns if 'datetime' in str(df[c].dtype) or 'date' in c.lower() or 'time' in c.lower()]
    if not date_cols or not numeric_cols:
        return None
    date_col = date_cols[0]
    metric_col = numeric_cols[0]
    tmp = df[[date_col, metric_col]].copy()
    tmp[date_col] = pd.to_datetime(tmp[date_col], errors='coerce')
    tmp[metric_col] = pd.to_numeric(tmp[metric_col], errors='coerce')
    tmp = tmp.dropna()
    if tmp.empty:
        return None
    tmp['period'] = tmp[date_col].dt.to_period('M').astype(str)
    grouped = tmp.groupby('period')[metric_col].sum().reset_index().head(24)
    return {
        'date_column': date_col,
        'metric_column': metric_col,
        'points': [{'period': str(r['period']), 'value': safe(r[metric_col])} for _, r in grouped.iterrows()]
    }


def _build_category_metrics(df, categorical_cols, numeric_cols):
    charts = []
    for cat_col in categorical_cols[:4]:
        if numeric_cols:
            metric = numeric_cols[0]
            tmp = df[[cat_col, metric]].copy()
            tmp[metric] = pd.to_numeric(tmp[metric], errors='coerce')
            tmp = tmp.dropna(subset=[cat_col])
            grouped = tmp.groupby(cat_col)[metric].sum().sort_values(ascending=False).head(10)
            charts.append({
                'category_column': cat_col,
                'metric_column': metric,
                'mode': 'sum',
                'points': [{'name': str(idx), 'value': safe(val)} for idx, val in grouped.items()]
            })
        else:
            counts = df[cat_col].astype(str).value_counts().head(10)
            charts.append({
                'category_column': cat_col,
                'metric_column': 'record_count',
                'mode': 'count',
                'points': [{'name': str(idx), 'value': int(val)} for idx, val in counts.items()]
            })
    return charts


def _build_scatter(df, numeric_cols):
    if len(numeric_cols) < 2:
        return None
    x, y = numeric_cols[0], numeric_cols[1]
    tmp = df[[x, y]].copy()
    tmp[x] = pd.to_numeric(tmp[x], errors='coerce')
    tmp[y] = pd.to_numeric(tmp[y], errors='coerce')
    tmp = tmp.dropna().head(200)
    return {'x': x, 'y': y, 'points': [{'x': safe(r[x]), 'y': safe(r[y])} for _, r in tmp.iterrows()]}


def _strong_correlation(corr):
    if not corr.get('columns') or not corr.get('matrix'):
        return None
    cols = corr['columns']
    matrix = corr['matrix']
    best = None
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            val = matrix[i][j]
            if val is None:
                continue
            if best is None or abs(val) > abs(best['value']):
                best = {'a': cols[i], 'b': cols[j], 'value': val}
    return best


@router.post('/process')
async def process_dataset(file: UploadFile = File(...), file_type: str = Form(...)):
    try:
        df = await load_dataframe(file, file_type)
        original = df.shape
        df = clean_dataframe(df)
        col_types = get_column_types(df)
        numeric = [c for c, t in col_types.items() if t == 'numeric']
        categorical = [c for c, t in col_types.items() if t == 'categorical']

        missing = df.isnull().sum()
        miss_pct = (missing / max(len(df), 1) * 100).round(2)

        stats = {}
        for c in numeric:
            s = pd.to_numeric(df[c], errors='coerce').dropna()
            if s.empty:
                continue
            stats[c] = {k: safe(v) for k, v in {
                'mean': s.mean(), 'median': s.median(), 'std': s.std(), 'min': s.min(), 'max': s.max(),
                'q25': s.quantile(.25), 'q75': s.quantile(.75), 'skewness': s.skew(), 'kurtosis': s.kurtosis()
            }.items()}

        category_distributions = {}
        for c in categorical[:12]:
            vc = df[c].astype(str).value_counts().head(20)
            category_distributions[c] = {'labels': [str(x) for x in vc.index.tolist()], 'values': [int(x) for x in vc.values.tolist()]}

        corr = {}
        if len(numeric) > 1:
            cols = numeric[:15]
            m = df[cols].apply(pd.to_numeric, errors='coerce').corr().round(3)
            corr = {'columns': cols, 'matrix': m.replace({np.nan: None}).values.tolist()}

        distributions = {}
        for c in numeric[:8]:
            vals = pd.to_numeric(df[c], errors='coerce').dropna()
            if vals.empty:
                continue
            counts, bins = np.histogram(vals, bins=14)
            distributions[c] = {'counts': counts.tolist(), 'bins': [safe(b) for b in bins]}

        preview = df.head(10).replace({np.nan: None}).to_dict(orient='records')
        duplicate_rows = int(df.duplicated().sum())
        total_cells = max(int(df.shape[0] * df.shape[1]), 1)
        missing_total = int(df.isnull().sum().sum())
        missing_rate = round(missing_total / total_cells * 100, 2)
        duplicate_rate = round(duplicate_rows / max(len(df), 1) * 100, 2)
        quality_score = max(0, min(100, round(100 - missing_rate * 1.7 - duplicate_rate * 1.1, 1)))
        strongest = _strong_correlation(corr)

        reporter = {
            'quality_score': quality_score,
            'dataset_health': 'Excellent' if quality_score >= 90 else 'Good' if quality_score >= 75 else 'Needs cleaning' if quality_score >= 55 else 'High risk',
            'headline': f"The dataset contains {df.shape[0]:,} records, {df.shape[1]} columns, and a data quality score of {quality_score}%.",
            'main_finding': (
                f"The strongest numeric relationship is between {strongest['a']} and {strongest['b']} with correlation {strongest['value']}."
                if strongest else
                (f"The dashboard found {len(categorical)} categorical segment(s) and {len(numeric)} numeric metric(s) for analysis." if categorical or numeric else "The file loaded successfully, but it has limited analytical columns.")
            ),
            'risk': (
                f"Missing values affect {missing_rate}% of all cells. Clean or impute them before training a model."
                if missing_total else
                (f"There are {duplicate_rows} duplicated records. Remove duplicates before final reporting." if duplicate_rows else "No major data quality risk was detected in the first pass.")
            ),
            'recommendation': (
                "Use regression if your target column is numeric, classification if it is a category, or clustering if you only want grouping."
                if numeric else "Add numeric fields such as marks, sales, income, quantity, time, or score to unlock deeper ML analysis."
            ),
            'best_ml_option': 'Regression / Random Forest' if numeric else 'Classification / Decision Tree' if categorical else 'Clustering / K-Means',
            'next_action': 'Open ML Lab, choose a target column, and train a model after reviewing missing values and outliers.'
        }

        return {
            'shape': {'rows': df.shape[0], 'columns': df.shape[1]},
            'original_shape': {'rows': original[0], 'columns': original[1]},
            'columns': df.columns.tolist(),
            'column_types': col_types,
            'numeric_columns': numeric,
            'categorical_columns': categorical,
            'missing_values': {
                'total': missing_total,
                'rate': missing_rate,
                'by_column': {c: {'count': int(missing[c]), 'percentage': float(miss_pct[c])} for c in df.columns if missing[c] > 0}
            },
            'duplicates': {'count': duplicate_rows, 'rate': duplicate_rate},
            'statistics': stats,
            'category_distributions': category_distributions,
            'correlation': corr,
            'distributions': distributions,
            'time_series': _build_time_series(df, numeric),
            'category_metrics': _build_category_metrics(df, categorical, numeric),
            'scatter': _build_scatter(df, numeric),
            'reporter': reporter,
            'preview': preview,
            'dtypes': {c: str(dt) for c, dt in df.dtypes.items()}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
