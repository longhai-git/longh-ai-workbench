import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { initUserDefaultData } from '../services/initService.js';
import { sendResetCode } from '../services/notifyService.js';

const router = Router();

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password, phone, email } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ error: '用户名至少3个字符' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6个字符' });
    }

    // 手机号/邮箱：至少填写一个，用于密码找回
    const normalizedPhone = phone?.trim() || null;
    const normalizedEmail = email?.trim().toLowerCase() || null;

    if (!normalizedPhone && !normalizedEmail) {
      return res.status(400).json({ error: '请至少填写手机号或邮箱，用于找回密码' });
    }

    if (normalizedPhone && !/^1[3-9]\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }
    
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    if (normalizedPhone) {
      const phoneOwner = db.prepare('SELECT id FROM users WHERE phone = ?').get(normalizedPhone);
      if (phoneOwner) {
        return res.status(400).json({ error: '该手机号已被注册' });
      }
    }

    if (normalizedEmail) {
      const emailOwner = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
      if (emailOwner) {
        return res.status(400).json({ error: '该邮箱已被注册' });
      }
    }
    
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    
    db.prepare('INSERT INTO users (id, username, password_hash, role, phone, email) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, username, passwordHash, username === 'admin' ? 'admin' : 'user', normalizedPhone, normalizedEmail);
    
    // 初始化用户默认数据
    initUserDefaultData(userId, username);
    
    const token = generateToken(userId);
    
    res.json({
      token,
      user: {
        id: userId,
        username,
        avatar: null,
        role: username === 'admin' ? 'admin' : 'user',
        phone: normalizedPhone,
        email: normalizedEmail
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: '注册失败' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const token = generateToken(user.id);
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        role: user.role,
        phone: user.phone || null,
        email: user.email || null
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// 登出
router.post('/logout', authMiddleware, (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.substring(7);
  db.prepare('DELETE FROM auth_tokens WHERE token = ?').run(token);
  res.json({ success: true });
});

// 修改密码
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const isValid = await bcrypt.compare(oldPassword, user.password_hash);

    if (!isValid) {
      return res.status(400).json({ error: '原密码错误' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6个字符' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(passwordHash, req.user.id);

    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// 获取当前用户绑定的手机号/邮箱
router.get('/contact', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT phone, email FROM users WHERE id = ?').get(req.user.id);
  res.json({
    phone: row?.phone || null,
    email: row?.email || null
  });
});

// 绑定/更新手机号与邮箱（用于忘记密码时接收验证码）
router.put('/contact', authMiddleware, (req, res) => {
  try {
    const { phone, email } = req.body;

    const normalizedPhone = phone?.trim() || null;
    const normalizedEmail = email?.trim().toLowerCase() || null;

    if (!normalizedPhone && !normalizedEmail) {
      return res.status(400).json({ error: '请至少绑定手机号或邮箱中的一项' });
    }

    if (normalizedPhone && !/^1[3-9]\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }

    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    if (normalizedPhone) {
      const owner = db.prepare('SELECT id FROM users WHERE phone = ? AND id <> ?')
        .get(normalizedPhone, req.user.id);
      if (owner) {
        return res.status(400).json({ error: '该手机号已被其他账号绑定' });
      }
    }

    if (normalizedEmail) {
      const owner = db.prepare('SELECT id FROM users WHERE email = ? AND id <> ?')
        .get(normalizedEmail, req.user.id);
      if (owner) {
        return res.status(400).json({ error: '该邮箱已被其他账号绑定' });
      }
    }

    db.prepare('UPDATE users SET phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(normalizedPhone, normalizedEmail, req.user.id);

    res.json({ success: true, phone: normalizedPhone, email: normalizedEmail });
  } catch (err) {
    console.error('Bind contact error:', err);
    res.status(500).json({ error: '保存失败' });
  }
});

// 忘记密码 - 发送验证码
router.post('/forgot-password/send-code', async (req, res) => {
  try {
    const { contact, contactType } = req.body;

    if (!contact) {
      return res.status(400).json({ error: '请输入手机号或邮箱' });
    }

    const input = String(contact).trim();
    const normalizedInput = input.includes('@') ? input.toLowerCase() : input;

    // 自动判断类型：手机号(纯数字11位) 或 邮箱(含@)
    let type = contactType;
    if (!type) {
      if (/^1[3-9]\d{9}$/.test(normalizedInput)) {
        type = 'phone';
      } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedInput)) {
        type = 'email';
      } else {
        // 也可能是用手机号作为用户名注册的
        type = 'phone';
      }
    }

    // 仅按手机号/邮箱匹配，避免知道用户名即可重置密码
    const user = db.prepare('SELECT * FROM users WHERE phone = ? OR email = ?')
      .get(normalizedInput, normalizedInput);

    if (!user) {
      return res.status(404).json({ error: '未找到该手机号/邮箱关联的账号' });
    }

    // 生成6位验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeId = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10分钟有效

    // 将旧验证码标记为已用
    db.prepare('UPDATE password_reset_codes SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);

    // 存储新验证码
    db.prepare(`
      INSERT INTO password_reset_codes (id, user_id, code, contact_type, contact_value, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(codeId, user.id, code, type, normalizedInput, expiresAt);

    // 发送验证码：已配置短信/邮件服务则真实发送，否则降级为页面显示
    console.log(`[Password Reset] 验证码已生成: 用户=${user.username}, 类型=${type}`);

    const sendResult = await sendResetCode({ type, contact: normalizedInput, code });

    if (sendResult.sent) {
      return res.json({
        success: true,
        sent: true,
        message: type === 'email' ? '验证码已发送至邮箱' : '验证码已发送至手机',
        maskedContact: type === 'phone'
          ? normalizedInput.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
          : normalizedInput.replace(/(.{2}).*(@.*)/, '$1***$2')
      });
    }

    // 未配置服务：保留原有开发模式，返回验证码供页面显示
    if (sendResult.reason === 'NOT_CONFIGURED') {
      return res.json({
        success: true,
        sent: false,
        devMode: true,
        message: '未配置短信/邮件服务，验证码已在页面显示',
        code,
        maskedContact: type === 'phone'
          ? normalizedInput.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
          : normalizedInput.replace(/(.{2}).*(@.*)/, '$1***$2')
      });
    }

    // 已配置但发送失败：作废刚生成的验证码，避免残留
    db.prepare('UPDATE password_reset_codes SET used = 1 WHERE id = ?').run(codeId);
    console.error('[Password Reset] 验证码发送失败:', sendResult.reason, sendResult.message || '');
    return res.status(500).json({ error: '验证码发送失败，请稍后重试' });
  } catch (err) {
    console.error('Forgot password send code error:', err);
    res.status(500).json({ error: '发送验证码失败' });
  }
});

// 忘记密码 - 验证码校验 + 重置密码
router.post('/forgot-password/reset', async (req, res) => {
  try {
    const { contact, code, newPassword } = req.body;

    if (!contact || !code || !newPassword) {
      return res.status(400).json({ error: '请填写完整信息' });
    }

    const input = String(contact).trim();
    const normalizedInput = input.includes('@') ? input.toLowerCase() : input;
    const normalizedCode = String(code).trim();

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6个字符' });
    }

    // 查找验证码记录
    const resetRecord = db.prepare(`
      SELECT * FROM password_reset_codes
      WHERE contact_value = ? AND code = ? AND used = 0
      ORDER BY created_at DESC LIMIT 1
    `).get(normalizedInput, normalizedCode);

    if (!resetRecord) {
      return res.status(400).json({ error: '验证码错误或已失效' });
    }

    // 检查是否过期
    if (new Date(resetRecord.expires_at) < new Date()) {
      db.prepare('UPDATE password_reset_codes SET used = 1 WHERE id = ?').run(resetRecord.id);
      return res.status(400).json({ error: '验证码已过期，请重新获取' });
    }

    // 更新密码
    const passwordHash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(passwordHash, resetRecord.user_id);

    // 标记验证码已使用
    db.prepare('UPDATE password_reset_codes SET used = 1 WHERE id = ?').run(resetRecord.id);

    res.json({ success: true, message: '密码重置成功' });
  } catch (err) {
    console.error('Forgot password reset error:', err);
    res.status(500).json({ error: '重置密码失败' });
  }
});

export default router;
