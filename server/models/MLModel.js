const mongoose = require('mongoose');
const mlModelSchema = new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}, dataset:{type:mongoose.Schema.Types.ObjectId,ref:'Dataset',required:true},
  name:String, algorithm:String, problemType:{type:String,enum:['classification','regression','clustering']}, targetColumn:String, featureColumns:[String], metrics:mongoose.Schema.Types.Mixed, modelPath:String, status:{type:String,enum:['training','ready','error'],default:'training'}
},{timestamps:true});
module.exports = mongoose.model('MLModel', mlModelSchema);
