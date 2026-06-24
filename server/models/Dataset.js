const mongoose = require('mongoose');
const datasetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true }, originalName: { type: String, required: true },
  fileType: { type: String, enum: ['csv','excel','json'], required: true }, filePath: { type: String, required: true }, fileSize: Number,
  status: { type: String, enum: ['uploaded','processing','processed','error'], default: 'uploaded' },
  metadata: { rows:Number, columns:Number, columnNames:[String], missingValues:Number },
  analysis: { type: mongoose.Schema.Types.Mixed, default:null }, insights: { type: mongoose.Schema.Types.Mixed, default:null }, tags:[String]
}, {timestamps:true});
module.exports = mongoose.model('Dataset', datasetSchema);
