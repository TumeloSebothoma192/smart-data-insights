const express=require('express');const router=express.Router();const multer=require('multer');const path=require('path');const {protect}=require('../middleware/auth');const c=require('../controllers/datasetController');
// Kept in memory, then saved to the database (no persistent disk on free hosting).
const storage=multer.memoryStorage();
const fileFilter=(req,file,cb)=>{const ext=path.extname(file.originalname).toLowerCase();['.csv','.xlsx','.xls','.json'].includes(ext)?cb(null,true):cb(new Error('Only CSV, Excel, and JSON files are allowed'),false);};
const upload=multer({storage,fileFilter,limits:{fileSize:10*1024*1024}});
router.post('/upload',protect,upload.single('file'),c.uploadDataset);router.get('/',protect,c.getDatasets);router.get('/:id',protect,c.getDataset);router.delete('/:id',protect,c.deleteDataset);module.exports=router;
