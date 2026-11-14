const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isId } = require('../models/Dataset');
const JWT_SECRET = require('../config/jwt');
exports.protect = async (req,res,next)=>{
  const header=req.headers.authorization || '';
  const token=header.startsWith('Bearer ')?header.split(' ')[1]:null;
  if(!token) return res.status(401).json({success:false,message:'Not authorized'});
  try { const decoded=jwt.verify(token, JWT_SECRET); req.user=isId(decoded.id)?await User.findById(decoded.id):null; if(!req.user) return res.status(401).json({success:false,message:'User not found'}); next(); }
  catch { return res.status(401).json({success:false,message:'Token invalid or expired'}); }
};
