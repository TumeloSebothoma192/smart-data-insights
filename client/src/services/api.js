import axios from 'axios';
const api=axios.create({baseURL:import.meta.env.VITE_API_URL||'/api',timeout:180000});
api.interceptors.request.use(c=>{const t=localStorage.getItem('token'); if(t)c.headers.Authorization=`Bearer ${t}`; return c;});
api.interceptors.response.use(r=>r,e=>{if(e.response?.status===401){localStorage.removeItem('token'); if(location.pathname!='/login') location.href='/login';} return Promise.reject(e);});
export const datasetAPI={upload:f=>api.post('/datasets/upload',f,{headers:{'Content-Type':'multipart/form-data'}}),getAll:()=>api.get('/datasets'),getOne:id=>api.get(`/datasets/${id}`),delete:id=>api.delete(`/datasets/${id}`)};
export const analysisAPI={process:id=>api.post(`/analysis/process/${id}`),getAnalysis:id=>api.get(`/analysis/${id}`)};
export const mlAPI={train:(id,p)=>api.post(`/ml/train/${id}`,p),predict:(id,inputData)=>api.post(`/ml/predict/${id}`,{inputData}),getModels:()=>api.get('/ml/models'),getModel:id=>api.get(`/ml/models/${id}`)};
export const insightsAPI={generate:id=>api.post(`/insights/generate/${id}`),get:id=>api.get(`/insights/${id}`)};
export default api;
