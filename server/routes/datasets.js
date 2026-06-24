const express=require('express');const router=express.Router();const multer=require('multer');const path=require('path');const fs=require('fs');const {protect}=require('../middleware/auth');const c=require('../controllers/datasetController');
const uploadsDir=path.join(__dirname,'../uploads'); if(!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir,{recursive:true});
const storage=multer.diskStorage({destination:(req,file,cb)=>cb(null,uploadsDir),filename:(req,file,cb)=>cb(null,`${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname)}`)});
const fileFilter=(req,file,cb)=>{const ext=path.extname(file.originalname).toLowerCase();['.csv','.xlsx','.xls','.json'].includes(ext)?cb(null,true):cb(new Error('Only CSV, Excel, and JSON files are allowed'),false);};
const upload=multer({storage,fileFilter,limits:{fileSize:50*1024*1024}});
router.post('/upload',protect,upload.single('file'),c.uploadDataset);router.get('/',protect,c.getDatasets);router.get('/:id',protect,c.getDataset);router.delete('/:id',protect,c.deleteDataset);module.exports=router;
