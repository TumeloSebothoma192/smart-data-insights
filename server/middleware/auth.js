const jwt = require('jsonwebtoken');
const User = require('../models/User');
exports.protect = async (req,res,next)=>{
  const header=req.headers.authorization || '';
  const token=header.startsWith('Bearer ')?header.split(' ')[1]:null;
  if(!token) return res.status(401).json({success:false,message:'Not authorized'});
  try { const decoded=jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_change_me'); req.user=await User.findById(decoded.id).select('-password'); if(!req.user) return res.status(401).json({success:false,message:'User not found'}); next(); }
  catch { return res.status(401).json({success:false,message:'Token invalid or expired'}); }
};
