import hmac

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from routers import process, train, predict, insights
import os
app = FastAPI(title='Smart Insights Python ML Service', version='1.0.0')
# Only the Node API calls this service; browsers never do, so no CORS is needed.
INTERNAL_TOKEN = os.environ.get('INTERNAL_TOKEN', '')


@app.middleware('http')
async def require_internal_token(request: Request, call_next):
    # When hosted with a public URL (e.g. Render free tier), only callers holding the shared
    # token (the Node API) may use the /api routes. Health checks stay open.
    if INTERNAL_TOKEN and request.url.path.startswith('/api'):
        given = request.headers.get('x-internal-token', '')
        if not hmac.compare_digest(given, INTERNAL_TOKEN):
            return JSONResponse({'detail': 'Forbidden'}, status_code=403)
    return await call_next(request)
app.include_router(process.router, prefix='/api')
app.include_router(train.router, prefix='/api')
app.include_router(predict.router, prefix='/api')
app.include_router(insights.router, prefix='/api')
os.makedirs('saved_models', exist_ok=True)
@app.get('/')
def root(): return {'status':'ok','service':'Smart Insights ML Service'}
@app.get('/health')
def health(): return {'status':'healthy'}
