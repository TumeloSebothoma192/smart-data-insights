from fastapi import APIRouter, File, UploadFile, Form, HTTPException
import pandas as pd, numpy as np, joblib, uuid, os, json
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.cluster import KMeans
from sklearn.metrics import accuracy_score, mean_squared_error, r2_score, mean_absolute_error, silhouette_score
from services.data_loader import load_dataframe, clean_dataframe
router=APIRouter(); MODELS_DIR='saved_models'; os.makedirs(MODELS_DIR,exist_ok=True)
def detect(df,target):
    if not target or target not in df.columns: return 'clustering'
    if df[target].dtype=='object' or df[target].nunique()<=20: return 'classification'
    return 'regression'
def prep(df, feats, target=None):
    X=df[feats].copy(); enc={}
    for c in X.select_dtypes(include='object').columns:
        le=LabelEncoder(); X[c]=le.fit_transform(X[c].astype(str)); enc[c]=le
    X=X.fillna(X.median(numeric_only=True)).fillna(0); y=None; te=None
    if target and target in df.columns:
        y=df[target].copy()
        if y.dtype=='object': te=LabelEncoder(); y=te.fit_transform(y.astype(str))
        else: y=y.fillna(y.median())
    return X,y,enc,te
@router.post('/train')
async def train_model(file:UploadFile=File(...), file_type:str=Form(...), target_column:str=Form(default=''), algorithm:str=Form(default='auto'), feature_columns:str=Form(default='')):
    try:
        df=clean_dataframe(await load_dataframe(file,file_type)); target=target_column.strip() or None; problem=detect(df,target)
        feats=json.loads(feature_columns) if feature_columns else [c for c in df.columns if c!=target]
        feats=[c for c in feats if c in df.columns][:20]; X,y,enc,te=prep(df,feats,target); scaler=StandardScaler(); Xs=scaler.fit_transform(X); metrics={}; algo=algorithm
        if problem=='clustering':
            k=max(2,min(5,len(df)//5 or 2)); model=KMeans(n_clusters=k,random_state=42,n_init=10); labels=model.fit_predict(Xs); metrics={'silhouette_score':round(float(silhouette_score(Xs,labels)) if len(set(labels))>1 and len(df)>k else 0,4),'n_clusters':k,'inertia':round(float(model.inertia_),2)}; algo='kmeans'
        elif problem=='classification':
            Xtr,Xte,ytr,yte=train_test_split(Xs,y,test_size=.2,random_state=42); model=LogisticRegression(max_iter=1000) if algorithm=='logistic_regression' else DecisionTreeClassifier(random_state=42) if algorithm=='decision_tree' else RandomForestClassifier(n_estimators=100,random_state=42); algo='logistic_regression' if algorithm=='logistic_regression' else 'decision_tree' if algorithm=='decision_tree' else 'random_forest'; model.fit(Xtr,ytr); yp=model.predict(Xte); metrics={'accuracy':round(float(accuracy_score(yte,yp)),4),'test_samples':len(yte),'train_samples':len(ytr)}
            if hasattr(model,'feature_importances_'): metrics['feature_importances']={feats[i]:round(float(v),4) for i,v in enumerate(model.feature_importances_)}
        else:
            Xtr,Xte,ytr,yte=train_test_split(Xs,y,test_size=.2,random_state=42); model=LinearRegression() if algorithm=='linear_regression' else DecisionTreeRegressor(random_state=42) if algorithm=='decision_tree' else RandomForestRegressor(n_estimators=100,random_state=42); algo='linear_regression' if algorithm=='linear_regression' else 'decision_tree' if algorithm=='decision_tree' else 'random_forest'; model.fit(Xtr,ytr); yp=model.predict(Xte); metrics={'rmse':round(float(np.sqrt(mean_squared_error(yte,yp))),4),'mae':round(float(mean_absolute_error(yte,yp)),4),'r2_score':round(float(r2_score(yte,yp)),4),'test_samples':len(yte),'train_samples':len(ytr)}
            if hasattr(model,'feature_importances_'): metrics['feature_importances']={feats[i]:round(float(v),4) for i,v in enumerate(model.feature_importances_)}
        path=os.path.join(MODELS_DIR,f'{uuid.uuid4()}.joblib'); joblib.dump({'model':model,'scaler':scaler,'encoders':enc,'target_encoder':te,'feature_columns':feats,'problem_type':problem},path)
        return {'success':True,'algorithm':algo,'problem_type':problem,'feature_columns':feats,'target_column':target,'metrics':metrics,'model_path':path}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))
