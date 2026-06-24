from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import process, train, predict, insights
import os
app = FastAPI(title='Smart Insights Python ML Service', version='1.0.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
app.include_router(process.router, prefix='/api')
app.include_router(train.router, prefix='/api')
app.include_router(predict.router, prefix='/api')
app.include_router(insights.router, prefix='/api')
os.makedirs('saved_models', exist_ok=True)
@app.get('/')
def root(): return {'status':'ok','service':'Smart Insights ML Service'}
@app.get('/health')
def health(): return {'status':'healthy'}
