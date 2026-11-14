require('dotenv').config();
const express=require('express'); const cors=require('cors'); const helmet=require('helmet'); const morgan=require('morgan'); const rateLimit=require('express-rate-limit'); const path=require('path'); const connectDB=require('./config/database');
const app=express(); const PORT=process.env.PORT||5000; connectDB();
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));
app.use(cors({origin:process.env.CLIENT_URL||'http://localhost:3000',credentials:true}));
app.use('/api/', rateLimit({windowMs:15*60*1000,max:300}));
app.use(express.json({limit:'50mb'})); app.use(express.urlencoded({extended:true,limit:'50mb'})); app.use(morgan('dev'));
// Uploaded datasets are private: they are only read by the API for their owner, never served statically.
app.use('/api/auth', require('./routes/auth')); app.use('/api/datasets', require('./routes/datasets')); app.use('/api/analysis', require('./routes/analysis')); app.use('/api/ml', require('./routes/ml')); app.use('/api/insights', require('./routes/insights'));
app.get('/api/health',(req,res)=>res.json({status:'ok',service:'Smart Data Insights API',timestamp:new Date().toISOString()}));
// Upload problems (wrong type, too large) are the client's fault: answer 400, not 500.
app.use((err,req,res,next)=>{const multer=require('multer');const isUpload=err instanceof multer.MulterError||/Only CSV, Excel, and JSON/.test(err.message||'');res.status(isUpload?400:(err.status||500)).json({success:false,message:err.message||'Internal Server Error'});});
app.listen(PORT,()=>console.log(`Smart Data Insights API running on http://localhost:${PORT}`));
