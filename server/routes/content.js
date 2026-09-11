import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { getSkillRuns, getSkillStats } from '../services/skillEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 配置multer存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|bmp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('只支持 jpg/png/gif/webp/bmp 格式的图片'));
    }
  }
});

const router = Router();
router.use(authMiddleware);

// === 智能体相关 ===

// 获取智能体列表
router.get('/agents', (req, res) => {
  const agents = db.prepare('SELECT * FROM agents WHERE user_id = ? ORDER BY created_at ASC').all(req.user.id);
  
  // 为每个智能体加载绑定的技能
  const result = agents.map(agent => {
    const skills = db.prepare(`
      SELECT s.*, as2.is_primary 
      FROM agent_skills as2 
      JOIN skills s ON as2.skill_id = s.id 
      WHERE as2.agent_id = ? AND s.enabled = 1
    `).all(agent.id);
    return { ...agent, skills };
  });
  
  res.json({ agents: result });
});

// 获取智能体详情
router.get('/agents/:id', (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!agent) return res.status(404).json({ error: '智能体不存在' });
  
  const skills = db.prepare(`
    SELECT s.*, as2.is_primary 
    FROM agent_skills as2 
    JOIN skills s ON as2.skill_id = s.id 
    WHERE as2.agent_id = ? AND s.enabled = 1
  `).all(req.params.id);
  
  // 今日产出统计
  const today = new Date().toISOString().split('T')[0];
  const todayRuns = db.prepare(`
    SELECT COUNT(*) as count FROM skill_runs 
    WHERE agent_id = ? AND DATE(created_at) = ? AND status = 'completed'
  `).get(req.params.id, today).count;
  
  // 执行记录统计
  const runStats = db.prepare(`
    SELECT 
      COUNT(*) as total_runs,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as success_runs,
      COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed_runs,
      COALESCE(SUM(token_input + token_output), 0) as total_tokens
    FROM skill_runs 
    WHERE agent_id = ?
  `).get(req.params.id);
  
  // 近7天执行记录
  const recentRuns = db.prepare(`
    SELECT sr.*, s.name as skill_name
    FROM skill_runs sr
    LEFT JOIN skills s ON sr.skill_id = s.id
    WHERE sr.agent_id = ?
    ORDER BY sr.created_at DESC
    LIMIT 10
  `).all(req.params.id);
  
  const failureRate = runStats.total_runs > 0 
    ? Math.round((runStats.failed_runs / runStats.total_runs) * 100) 
    : 0;
  
  res.json({ 
    agent: { 
      ...agent, 
      skills, 
      todayRuns,
      runStats: {
        totalRuns: runStats.total_runs,
        successRuns: runStats.success_runs,
        failedRuns: runStats.failed_runs,
        totalTokens: runStats.total_tokens,
        failureRate,
      },
      recentRuns,
    } 
  });
});

// 创建智能体
router.post('/agents', (req, res) => {
  const { name, role, avatar, description, system_prompt, enabled } = req.body;
  if (!name) return res.status(400).json({ error: '智能体名称不能为空' });
  if (!role) return res.status(400).json({ error: '智能体角色不能为空' });
  
  const id = uuidv4();
  db.prepare(`
    INSERT INTO agents (id, user_id, name, role, avatar, status, description, system_prompt, is_builtin, enabled)
    VALUES (?, ?, ?, ?, ?, 'idle', ?, ?, 0, ?)
  `).run(id, req.user.id, name, role, avatar || '', description || '', system_prompt || '', enabled !== undefined ? (enabled ? 1 : 0) : 1);
  
  res.json({ id, success: true });
});

// 更新智能体
router.put('/agents/:id', (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!agent) return res.status(404).json({ error: '智能体不存在' });
  
  const fields = ['name', 'role', 'avatar', 'description', 'system_prompt', 'enabled', 'failure_strategy', 'override_model'];
  const sets = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      sets.push(`${f} = ?`);
      values.push(f === 'enabled' ? (req.body[f] ? 1 : 0) : req.body[f]);
    }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id, req.user.id);
    db.prepare(`UPDATE agents SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  }
  res.json({ success: true });
});

// 删除智能体
router.delete('/agents/:id', (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!agent) return res.status(404).json({ error: '智能体不存在' });
  if (agent.is_builtin) return res.status(400).json({ error: '内置智能体不能删除' });
  
  db.prepare('DELETE FROM agents WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// 上传智能体头像
router.post('/agents/:id/upload-avatar', upload.single('avatar'), (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!agent) return res.status(404).json({ error: '智能体不存在' });
  
  if (!req.file) return res.status(400).json({ error: '请选择要上传的图片' });
  
  const avatarUrl = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE agents SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
    .run(avatarUrl, req.params.id, req.user.id);
  
  res.json({ success: true, avatar: avatarUrl });
});

// 上传用户头像
router.post('/upload/user-avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择要上传的图片' });
  
  const avatarUrl = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(avatarUrl, req.user.id);
  
  res.json({ success: true, avatar: avatarUrl });
});

// === 技能装配相关 ===

// 获取智能体可安装的技能列表（未装配的技能）
router.get('/agents/:id/available-skills', (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!agent) return res.status(404).json({ error: '智能体不存在' });
  
  // 获取该智能体已装配的技能ID列表
  const installedIds = db.prepare('SELECT skill_id FROM agent_skills WHERE agent_id = ?').all(req.params.id)
    .map(r => r.skill_id);
  
  // 获取所有可用技能（全局技能 + 用户自定义技能），排除已装配的
  let query = `SELECT * FROM skills WHERE (is_global = 1 OR user_id = ?) AND enabled = 1 AND deleted_at IS NULL`;
  const params = [req.user.id];
  if (installedIds.length > 0) {
    query += ` AND id NOT IN (${installedIds.map(() => '?').join(',')})`;
    params.push(...installedIds);
  }
  query += ' ORDER BY is_builtin DESC, category ASC, name ASC';
  
  const skills = db.prepare(query).all(...params);
  res.json({ skills });
});

// 为智能体安装技能
router.post('/agents/:id/skills', (req, res) => {
  const { skillId, isPrimary } = req.body;
  if (!skillId) return res.status(400).json({ error: '技能ID不能为空' });
  
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!agent) return res.status(404).json({ error: '智能体不存在' });
  
  const skill = db.prepare('SELECT * FROM skills WHERE id = ? AND (is_global = 1 OR user_id = ?) AND enabled = 1').get(skillId, req.user.id);
  if (!skill) return res.status(404).json({ error: '技能不存在' });
  
  // 检查是否已装配
  const existing = db.prepare('SELECT * FROM agent_skills WHERE agent_id = ? AND skill_id = ?').get(req.params.id, skillId);
  if (existing) return res.status(400).json({ error: '该技能已装配' });
  
  const id = uuidv4();
  
  // 如果设为主技能，先取消其他主技能
  if (isPrimary) {
    db.prepare('UPDATE agent_skills SET is_primary = 0 WHERE agent_id = ?').run(req.params.id);
  }
  
  // 如果该智能体还没有任何技能，自动设为主技能
  const currentCount = db.prepare('SELECT COUNT(*) as c FROM agent_skills WHERE agent_id = ?').get(req.params.id).c;
  const shouldBePrimary = isPrimary || currentCount === 0;
  
  db.prepare('INSERT INTO agent_skills (id, agent_id, skill_id, is_primary) VALUES (?, ?, ?, ?)')
    .run(id, req.params.id, skillId, shouldBePrimary ? 1 : 0);
  
  res.json({ success: true, id });
});

// 从智能体卸载技能
router.delete('/agents/:id/skills/:skillId', (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!agent) return res.status(404).json({ error: '智能体不存在' });
  
  const record = db.prepare('SELECT * FROM agent_skills WHERE agent_id = ? AND skill_id = ?').get(req.params.id, req.params.skillId);
  if (!record) return res.status(404).json({ error: '该技能未装配' });
  
  const wasPrimary = record.is_primary === 1;
  
  db.prepare('DELETE FROM agent_skills WHERE agent_id = ? AND skill_id = ?')
    .run(req.params.id, req.params.skillId);
  
  // 如果删除的是主技能，自动将剩余的第一个技能设为主技能
  if (wasPrimary) {
    const next = db.prepare('SELECT * FROM agent_skills WHERE agent_id = ? ORDER BY created_at ASC LIMIT 1').get(req.params.id);
    if (next) {
      db.prepare('UPDATE agent_skills SET is_primary = 1 WHERE id = ?').run(next.id);
    }
  }
  
  res.json({ success: true });
});

// 设置智能体的主技能
router.put('/agents/:id/skills/:skillId/primary', (req, res) => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!agent) return res.status(404).json({ error: '智能体不存在' });
  
  const record = db.prepare('SELECT * FROM agent_skills WHERE agent_id = ? AND skill_id = ?').get(req.params.id, req.params.skillId);
  if (!record) return res.status(404).json({ error: '该技能未装配' });
  
  // 取消其他主技能
  db.prepare('UPDATE agent_skills SET is_primary = 0 WHERE agent_id = ?').run(req.params.id);
  // 设置新的主技能
  db.prepare('UPDATE agent_skills SET is_primary = 1 WHERE agent_id = ? AND skill_id = ?')
    .run(req.params.id, req.params.skillId);
  
  res.json({ success: true });
});

// === 技能相关 ===

// 获取技能列表
router.get('/skills', (req, res) => {
  const { category } = req.query;
  
  let query = 'SELECT * FROM skills WHERE (is_global = 1 OR user_id = ?) AND enabled = 1 AND deleted_at IS NULL';
  const params = [req.user.id];
  
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  
  query += ' ORDER BY is_builtin DESC, name ASC';
  
  const skills = db.prepare(query).all(...params);
  res.json({ skills });
});

// 获取技能详情
router.get('/skills/:id', (req, res) => {
  const skill = db.prepare(`
    SELECT * FROM skills 
    WHERE id = ? AND (is_global = 1 OR user_id = ?) AND enabled = 1
  `).get(req.params.id, req.user.id);
  
  if (!skill) return res.status(404).json({ error: '技能不存在' });
  res.json({ skill });
});

// 创建自定义技能
router.post('/skills', (req, res) => {
  const { name, category, workflow, input_schema, output_schema, description } = req.body;
  
  if (!name) return res.status(400).json({ error: '技能名称不能为空' });
  
  const skillId = uuidv4();
  db.prepare(`
    INSERT INTO skills (id, user_id, name, category, workflow, input_schema, output_schema, description, is_global, is_builtin, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '1.0.0')
  `).run(skillId, req.user.id, name, category || 'custom', 
        JSON.stringify(workflow || []), JSON.stringify(input_schema || {}), 
        JSON.stringify(output_schema || {}), description || '');
  
  res.json({ id: skillId });
});

// 执行技能
router.post('/skills/:id/execute', async (req, res) => {
  try {
    const { inputData, agentId, projectId } = req.body;
    const skillId = req.params.id;
    
    const { executeSkill } = await import('../services/skillEngine.js');
    const result = await executeSkill(skillId, inputData, req.user.id, agentId, projectId);
    
    res.json(result);
  } catch (err) {
    console.error('Execute skill error:', err);
    res.status(500).json({ error: '执行失败' });
  }
});

// 获取技能执行记录
router.get('/skill-runs', (req, res) => {
  const { limit = 20, page = 1, skillId, status } = req.query;
  
  const runs = getSkillRuns(req.user.id, { 
    limit: parseInt(limit), 
    offset: (parseInt(page) - 1) * parseInt(limit),
    skillId,
    status
  });
  
  res.json({ runs });
});

// 技能统计
router.get('/skills-stats', (req, res) => {
  const stats = getSkillStats(req.user.id);
  res.json({ stats });
});

// === 选题相关 ===

router.get('/topics', (req, res) => {
  const { status, projectId, limit = 50 } = req.query;
  let query = 'SELECT * FROM topics WHERE user_id = ? AND deleted_at IS NULL';
  const params = [req.user.id];
  
  if (status && status !== 'all') { query += ' AND status = ?'; params.push(status); }
  if (projectId) { query += ' AND project_id = ?'; params.push(projectId); }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  const topics = db.prepare(query).all(...params);
  res.json({ topics });
});

router.post('/topics', (req, res) => {
  const { name, status, type, source, target_audience, differentiation, content, project_id, quality_score } = req.body;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO topics (id, user_id, name, status, type, source, target_audience, differentiation, content, project_id, quality_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, name, status || 'candidate', type, source, target_audience, differentiation, content, project_id || null, quality_score || null);
  res.json({ id });
});

router.put('/topics/:id', (req, res) => {
  const fields = ['name', 'status', 'type', 'source', 'target_audience', 'differentiation', 'content', 'project_id', 'quality_score'];
  const sets = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id, req.user.id);
    db.prepare(`UPDATE topics SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  }
  res.json({ success: true });
});

router.delete('/topics/:id', (req, res) => {
  db.prepare('UPDATE topics SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// === 脚本相关 ===

router.get('/scripts', (req, res) => {
  const { status, projectId, limit = 50 } = req.query;
  let query = 'SELECT * FROM scripts WHERE user_id = ? AND deleted_at IS NULL';
  const params = [req.user.id];
  if (status && status !== 'all') { query += ' AND status = ?'; params.push(status); }
  if (projectId) { query += ' AND project_id = ?'; params.push(projectId); }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  const scripts = db.prepare(query).all(...params);
  res.json({ scripts });
});

router.post('/scripts', (req, res) => {
  const { title, type, status, hook, content, project_id } = req.body;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO scripts (id, user_id, title, type, status, hook, content, project_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, title, type || 'full', status || 'draft', hook || '', content || '', project_id || null);
  res.json({ id });
});

router.put('/scripts/:id', (req, res) => {
  const fields = ['title', 'type', 'status', 'hook', 'content', 'project_id'];
  const sets = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id, req.user.id);
    db.prepare(`UPDATE scripts SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  }
  res.json({ success: true });
});

router.delete('/scripts/:id', (req, res) => {
  db.prepare('UPDATE scripts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// === 视频相关 ===

router.get('/videos', (req, res) => {
  const { grade, platform, limit = 50 } = req.query;
  let query = 'SELECT * FROM videos WHERE user_id = ? AND deleted_at IS NULL';
  const params = [req.user.id];
  if (grade && grade !== 'all') { query += ' AND grade = ?'; params.push(grade); }
  if (platform) { query += ' AND platform = ?'; params.push(platform); }
  query += ' ORDER BY publish_date DESC, created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  const videos = db.prepare(query).all(...params);
  res.json({ videos });
});

router.post('/videos', (req, res) => {
  const { title, grade, views, likes, comments, shares, favorites, platform, publish_date, project_id } = req.body;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO videos (id, user_id, title, grade, views, likes, comments, shares, favorites, platform, publish_date, project_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, title, grade || 'C', views || 0, likes || 0, comments || 0, shares || 0, favorites || 0, platform || '', publish_date || null, project_id || null);
  res.json({ id });
});

router.put('/videos/:id', (req, res) => {
  const fields = ['title', 'grade', 'views', 'likes', 'comments', 'shares', 'favorites', 'platform', 'publish_date', 'click_rate', 'completion_rate', 'project_id'];
  const sets = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id, req.user.id);
    db.prepare(`UPDATE videos SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  }
  res.json({ success: true });
});

router.delete('/videos/:id', (req, res) => {
  db.prepare('UPDATE videos SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// === 素材相关 ===

router.get('/assets', (req, res) => {
  const { type, projectId, limit = 50 } = req.query;
  let query = 'SELECT * FROM assets WHERE user_id = ? AND deleted_at IS NULL';
  const params = [req.user.id];
  if (type && type !== 'all') { query += ' AND type = ?'; params.push(type); }
  if (projectId) { query += ' AND project_id = ?'; params.push(projectId); }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  const assets = db.prepare(query).all(...params);
  res.json({ assets });
});

router.delete('/assets/:id', (req, res) => {
  db.prepare('UPDATE assets SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// 重置默认智能体
router.post('/agents/reset-defaults', async (req, res) => {
  try {
    const { initUserDefaultAgentsOnly } = await import('../services/initService.js');
    const count = initUserDefaultAgentsOnly(req.user.id, req.user.username);
    res.json({ success: true, created: count });
  } catch (err) {
    console.error('Reset agents error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
