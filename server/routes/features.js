import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// === 对标库 ===

router.get('/benchmarks', (req, res) => {
  const { status, limit = 20, page = 1 } = req.query;
  let query = 'SELECT * FROM benchmarks WHERE user_id = ? AND deleted_at IS NULL';
  const params = [req.user.id];
  if (status && status !== 'all') { query += ' AND analysis_status = ?'; params.push(status); }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const benchmarks = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM benchmarks WHERE user_id = ? AND deleted_at IS NULL').get(req.user.id).count;
  res.json({ benchmarks, total });
});

router.get('/benchmarks/:id', (req, res) => {
  const benchmark = db.prepare('SELECT * FROM benchmarks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!benchmark) return res.status(404).json({ error: '对标视频不存在' });
  res.json({ benchmark });
});

router.post('/benchmarks', (req, res) => {
  const { url, title, author, transcript, views, likes, duration_seconds } = req.body;
  if (!title) return res.status(400).json({ error: '标题不能为空' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO benchmarks (id, user_id, url, title, author, transcript, views, likes, duration_seconds, analysis_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(id, req.user.id, url || '', title, author || '', transcript || '', views || 0, likes || 0, duration_seconds || 0);
  res.json({ id });
});

router.put('/benchmarks/:id', (req, res) => {
  const fields = ['url', 'title', 'author', 'transcript', 'views', 'likes', 'duration_seconds', 'analysis_report', 'analysis_status'];
  const sets = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id, req.user.id);
    db.prepare(`UPDATE benchmarks SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  }
  res.json({ success: true });
});

router.delete('/benchmarks/:id', (req, res) => {
  db.prepare('UPDATE benchmarks SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// 执行6维度拆解
router.post('/benchmarks/:id/analyze', async (req, res) => {
  try {
    const benchmark = db.prepare('SELECT * FROM benchmarks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!benchmark) return res.status(404).json({ error: '对标视频不存在' });
    if (!benchmark.transcript || benchmark.transcript.trim().length < 10) {
      return res.status(400).json({ error: '视频文案内容不足，请先粘贴完整视频文案/字幕再进行拆解' });
    }
    
    // 找到视频分析师智能体
    const analystAgent = db.prepare("SELECT id FROM agents WHERE user_id = ? AND role = 'video_analyst'").get(req.user.id);
    const analysisSkill = db.prepare("SELECT id FROM skills WHERE name = '视频拆解分析' AND is_global = 1").get();
    
    if (!analysisSkill) return res.status(500).json({ error: '分析技能未找到' });
    
    const { executeSkill } = await import('../services/skillEngine.js');
    const result = await executeSkill(analysisSkill.id, { transcript: benchmark.transcript }, req.user.id, analystAgent?.id);
    
    if (result.success) {
      db.prepare(`
        UPDATE benchmarks SET analysis_report = ?, analysis_status = 'completed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(JSON.stringify(result.result), req.params.id, req.user.id);
    } else {
      db.prepare("UPDATE benchmarks SET analysis_status = 'failed' WHERE id = ? AND user_id = ?")
        .run(req.params.id, req.user.id);
    }
    
    res.json(result);
  } catch (err) {
    console.error('Analyze benchmark error:', err);
    res.status(500).json({ error: '分析失败' });
  }
});

// === 知识库 ===

router.get('/knowledge/entries', (req, res) => {
  const { category, keyword, limit = 50 } = req.query;
  let query = 'SELECT * FROM knowledge_entries WHERE user_id = ? AND deleted_at IS NULL';
  const params = [req.user.id];
  if (category && category !== 'all') { query += ' AND category = ?'; params.push(category); }
  if (keyword) { 
    query += ' AND (title LIKE ? OR content LIKE ?)'; 
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  query += ' ORDER BY is_pinned DESC, created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  const entries = db.prepare(query).all(...params);
  res.json({ entries });
});

router.post('/knowledge/entries', (req, res) => {
  const { category, title, content, source, value_analysis, tags } = req.body;
  if (!title || !category) return res.status(400).json({ error: '标题和分类必填' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO knowledge_entries (id, user_id, category, title, content, source, value_analysis, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, category, title, content || '', source || '', value_analysis || '', tags ? JSON.stringify(tags) : null);
  res.json({ id });
});

router.put('/knowledge/entries/:id', (req, res) => {
  const fields = ['category', 'title', 'content', 'source', 'value_analysis', 'tags', 'is_pinned', 'confidence'];
  const sets = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (sets.length) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id, req.user.id);
    db.prepare(`UPDATE knowledge_entries SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  }
  res.json({ success: true });
});

router.delete('/knowledge/entries/:id', (req, res) => {
  db.prepare('UPDATE knowledge_entries SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// 知识对话记录
router.get('/knowledge/chats', (req, res) => {
  const chats = db.prepare('SELECT * FROM knowledge_chats WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
  res.json({ chats: chats.reverse() });
});

router.post('/knowledge/chats', (req, res) => {
  const { role, content, extracted_entries } = req.body;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO knowledge_chats (id, user_id, role, content, extracted_entries)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.user.id, role || 'user', content, extracted_entries ? JSON.stringify(extracted_entries) : null);
  res.json({ id });
});

// 创作人画像
router.get('/creator-profile', (req, res) => {
  const profile = db.prepare('SELECT * FROM creator_profile WHERE user_id = ? ORDER BY dimension, created_at').all(req.user.id);
  const grouped = {};
  for (const item of profile) {
    if (!grouped[item.dimension]) grouped[item.dimension] = [];
    grouped[item.dimension].push(item);
  }
  res.json({ profile: grouped });
});

router.post('/creator-profile', (req, res) => {
  const { dimension, key, value, source, confidence, evidence } = req.body;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO creator_profile (id, user_id, dimension, key, value, source, confidence, evidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, dimension, key, value || '', source || 'manual', confidence || 0.5, evidence || '');
  res.json({ id });
});

// === 消息中心 ===

router.get('/messages', (req, res) => {
  const { type, limit = 50, page = 1 } = req.query;
  let query = 'SELECT * FROM messages WHERE user_id = ?';
  const params = [req.user.id];
  if (type && type !== 'all') { query += ' AND type = ?'; params.push(type); }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const messages = db.prepare(query).all(...params);
  const unreadCount = db.prepare('SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND is_read = 0').get(req.user.id).count;
  res.json({ messages, unreadCount });
});

router.get('/messages/unread-count', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND is_read = 0').get(req.user.id).count;
  res.json({ count });
});

router.post('/messages/:id/read', (req, res) => {
  db.prepare('UPDATE messages SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

router.post('/messages/read-all', (req, res) => {
  db.prepare('UPDATE messages SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ success: true });
});

router.delete('/messages/:id', (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

router.delete('/messages/batch', (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ error: '请选择要删除的消息' });
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM messages WHERE id IN (${placeholders}) AND user_id = ?`).run(...ids, req.user.id);
  res.json({ success: true });
});

// === 日历 ===

router.get('/calendar', (req, res) => {
  const { month } = req.query;
  let query = 'SELECT * FROM calendar_events WHERE user_id = ?';
  const params = [req.user.id];
  if (month) { query += ' AND strftime("%Y-%m", date) = ?'; params.push(month); }
  query += ' ORDER BY date ASC';
  const events = db.prepare(query).all(...params);
  res.json({ events });
});

router.post('/calendar', (req, res) => {
  const { date, title, type, project_id, project_name, description } = req.body;
  if (!date || !title) return res.status(400).json({ error: '日期和标题必填' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO calendar_events (id, user_id, date, title, type, project_id, project_name, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, date, title, type || 'other', project_id || null, project_name || '', description || '');
  res.json({ id });
});

router.put('/calendar/:id', (req, res) => {
  const fields = ['date', 'title', 'type', 'project_id', 'project_name', 'description'];
  const sets = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (sets.length) {
    values.push(req.params.id, req.user.id);
    db.prepare(`UPDATE calendar_events SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  }
  res.json({ success: true });
});

router.delete('/calendar/:id', (req, res) => {
  db.prepare('DELETE FROM calendar_events WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

export default router;
