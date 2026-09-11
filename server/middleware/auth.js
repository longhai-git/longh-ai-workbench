import jwt from 'jsonwebtoken';
import db from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'longh-ai-workbench-secret-key-2026';

export function generateToken(userId) {
  const expiresIn = '7d';
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn });
  
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT OR REPLACE INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, userId, expiresAt);
  
  return token;
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const tokenRecord = db.prepare('SELECT * FROM auth_tokens WHERE token = ?').get(token);
    if (!tokenRecord) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (new Date(tokenRecord.expires_at) < new Date()) {
      db.prepare('DELETE FROM auth_tokens WHERE token = ?').run(token);
      return res.status(401).json({ error: 'Token expired' });
    }
    
    const user = db.prepare('SELECT id, username, avatar, role FROM users WHERE id = ?').get(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export default { generateToken, authMiddleware, adminMiddleware };
