import io

import numpy as np
import pandas as pd


class UnreadableFile(ValueError):
    """The upload isn't valid CSV/Excel/JSON: the caller's fault, so it maps to a 400."""


def _parse(content: bytes, file_type: str) -> pd.DataFrame:
    if file_type == 'csv':
        try:
            return pd.read_csv(io.BytesIO(content), encoding='utf-8')
        except UnicodeDecodeError:
            return pd.read_csv(io.BytesIO(content), encoding='latin1')
    if file_type == 'excel':
        return pd.read_excel(io.BytesIO(content))
    if file_type == 'json':
        try:
            return pd.read_json(io.BytesIO(content))
        except ValueError:
            # Nested records ([{"a": {"b": 1}}]) need flattening rather than read_json.
            import json
            return pd.json_normalize(json.loads(content))
    raise UnreadableFile(f'Unsupported file type: {file_type}')


def load_dataframe(file, file_type: str) -> pd.DataFrame:
    """Read an UploadFile synchronously (call from a plain `def` endpoint, which runs in a thread)."""
    content = file.file.read()
    try:
        return _parse(content, file_type)
    except UnreadableFile:
        raise
    except Exception as e:
        raise UnreadableFile(f'Could not read this file as {file_type.upper()}: {e}') from e


def is_text(series: pd.Series) -> bool:
    """True for text columns on both pandas 2 (object dtype) and pandas 3 (str dtype)."""
    return pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series)


def text_columns(df: pd.DataFrame) -> list:
    return [c for c in df.columns if is_text(df[c]) and not pd.api.types.is_datetime64_any_dtype(df[c])]


def clean_dataframe(df):
    df = df.dropna(how='all').dropna(axis=1, how='all').copy()
    for col in text_columns(df):
        # Strip whitespace but keep missing values missing (astype(str) would turn NaN into the text "nan").
        stripped = df[col].where(df[col].isna(), df[col].astype(str).str.strip())
        df[col] = stripped.replace('', np.nan)
    for col in text_columns(df):
        # Only text columns can be dates; numeric columns such as "time_spent" must stay numeric.
        if 'date' in col.lower() or 'time' in col.lower():
            parsed = pd.to_datetime(df[col], errors='coerce')
            if parsed.notna().sum() >= max(1, int(df[col].notna().sum() * 0.8)):
                df[col] = parsed
    return df


def get_column_types(df):
    out = {}
    n = max(len(df), 1)
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            out[col] = 'datetime'
        elif pd.api.types.is_bool_dtype(df[col]):
            out[col] = 'boolean'
        elif pd.api.types.is_numeric_dtype(df[col]):
            out[col] = 'numeric'
        else:
            u = df[col].nunique(dropna=True)
            out[col] = 'categorical' if u <= 50 and u / n < 0.5 else 'text'
    return out


def safe(val):
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        return None if np.isnan(val) or np.isinf(val) else float(val)
    if isinstance(val, np.ndarray):
        return val.tolist()
    if isinstance(val, pd.Timestamp):
        return val.isoformat()
    return val
