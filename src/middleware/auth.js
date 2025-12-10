const jwt = require('jsonwebtoken');
const { User, Role } = require('../models');

module.exports = (requiredRoles=[]) => {
  return async (req,res,next) => {
    const hdr = req.headers.authorization||'';
    const token = hdr.startsWith('Bearer ')? hdr.slice(7): null;
    if(!token) return res.status(401).json({ error:'Unauthorized' });
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET||'secret');
      req.user = payload;
      if(Array.isArray(requiredRoles) && requiredRoles.length>0){
        const user = await User.findByPk(payload.id, { include: [{ model: Role }] });
        const userRoleKeys = (user && user.Roles ? user.Roles.map(r=>r.key) : []).concat(user && user.role ? [user.role] : []);
        const ok = requiredRoles.some(r=> userRoleKeys.includes(r));
        if(!ok) return res.status(403).json({ error:'Forbidden' });
      }
      next();
    } catch(e){ return res.status(401).json({ error: 'Invalid token' }); }
  };
};
