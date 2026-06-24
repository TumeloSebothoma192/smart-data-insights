import pandas as pd, numpy as np, io
async def load_dataframe(file, file_type: str) -> pd.DataFrame:
    content = await file.read()
    if file_type == 'csv':
        try: return pd.read_csv(io.BytesIO(content), encoding='utf-8')
        except UnicodeDecodeError: return pd.read_csv(io.BytesIO(content), encoding='latin1')
    if file_type == 'excel': return pd.read_excel(io.BytesIO(content))
    if file_type == 'json': return pd.read_json(io.BytesIO(content))
    raise ValueError(f'Unsupported file type: {file_type}')
def clean_dataframe(df):
    df=df.dropna(how='all').dropna(axis=1, how='all')
    for col in df.select_dtypes(include='object').columns:
        df[col]=df[col].astype(str).str.strip()
    for col in df.columns:
        if 'date' in col.lower() or 'time' in col.lower():
            try: df[col]=pd.to_datetime(df[col])
            except Exception: pass
    return df
def get_column_types(df):
    out={}
    n=max(len(df),1)
    for col in df.columns:
        dt=str(df[col].dtype)
        if 'datetime' in dt: out[col]='datetime'
        elif pd.api.types.is_numeric_dtype(df[col]): out[col]='numeric'
        elif pd.api.types.is_bool_dtype(df[col]): out[col]='boolean'
        else:
            u=df[col].nunique(dropna=True); out[col]='categorical' if u<=50 and u/n<0.5 else 'text'
    return out
def safe(val):
    if isinstance(val, (np.integer,)): return int(val)
    if isinstance(val, (np.floating,)): return None if np.isnan(val) or np.isinf(val) else float(val)
    if isinstance(val, np.ndarray): return val.tolist()
    if isinstance(val, pd.Timestamp): return val.isoformat()
    return val
