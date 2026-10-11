import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { callLLM, parseJSONResponse } from '../services/llmService.js';

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

// 知识对话 - 调用LLM分析用户消息，自动提取知识条目
router.post('/knowledge/chats/ask', async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '消息内容不能为空' });

  const userId = req.user.id;
  const userMsg = content.trim();

  // 保存用户消息
  const userChatId = uuidv4();
  db.prepare(`
    INSERT INTO knowledge_chats (id, user_id, role, content)
    VALUES (?, ?, 'user', ?)
  `).run(userChatId, userId, userMsg);

  try {
    const systemPrompt = `你是一个知识提取助手。用户会分享各种内容（经验、灵感、平台规则、对标分析等），你需要从中提取有价值的知识条目。

分类列表（必须从中选择）：
- platform_rules: 平台规则
- benchmark_insights: 对标借鉴
- review_experience: 复盘经验
- industry_insights: 行业洞察
- agent_learning: 智能体学习
- inspiration: 灵感库
- life_log: 生活档案
- experience: 经验库
- cognition: 认知库

请返回JSON格式：
{
  "reply": "对用户消息的简短回复（1-2句话）",
  "entries": [
    {
      "category": "分类code",
      "title": "条目标题（简洁概括）",
      "content": "详细内容（保留关键信息）",
      "value_analysis": "这条知识的价值和适用场景（1句话）",
      "tags": ["标签1", "标签2"]
    }
  ]
}

规则：
1. 如果用户消息包含值得沉淀的知识，提取1-3条
2. 如果只是闲聊或无价值内容，entries为空数组
3. 标题简洁，content保留关键信息，tags 2-4个
4. 只返回JSON，不要其他文字`;

    const result = await callLLM(userId, systemPrompt, userMsg, 'knowledge-extract');
    const parsed = parseJSONResponse(result.data || result.rawText);

    const reply = parsed?.reply || '已收到你的消息，我正在整理...';
    const extractedEntries = parsed?.entries || [];

    // 保存提取的条目
    const savedEntries = [];
    for (const entry of extractedEntries) {
      if (!entry.title || !entry.category) continue;
      const entryId = uuidv4();
      db.prepare(`
        INSERT INTO knowledge_entries (id, user_id, category, title, content, source, value_analysis, tags, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entryId, userId, entry.category, entry.title,
        entry.content || '', 'knowledge_chat', entry.value_analysis || '',
        entry.tags ? JSON.stringify(entry.tags) : null, 0.7
      );
      savedEntries.push({ id: entryId, ...entry });
    }

    // 保存AI回复
    const aiChatId = uuidv4();
    db.prepare(`
      INSERT INTO knowledge_chats (id, user_id, role, content, extracted_entries)
      VALUES (?, ?, 'assistant', ?, ?)
    `).run(aiChatId, userId, reply, savedEntries.length ? JSON.stringify(savedEntries) : null);

    res.json({ reply, extractedEntries: savedEntries });
  } catch (err) {
    console.error('Knowledge chat ask error:', err);
    const fallbackReply = '已收到你的消息，知识整理服务暂时不可用。';
    const aiChatId = uuidv4();
    db.prepare(`
      INSERT INTO knowledge_chats (id, user_id, role, content)
      VALUES (?, ?, 'assistant', ?)
    `).run(aiChatId, userId, fallbackReply);
    res.json({ reply: fallbackReply, extractedEntries: [] });
  }
});

// 知识检索 - 按关键词搜索，供其他模块（智能体、选题等）调用
router.get('/knowledge/search', (req, res) => {
  const { query, category, limit = 10 } = req.query;
  if (!query) return res.json({ entries: [] });

  let sql = `SELECT * FROM knowledge_entries WHERE user_id = ? AND deleted_at IS NULL`;
  const params = [req.user.id];

  if (category && category !== 'all') {
    sql += ' AND category = ?';
    params.push(category);
  }

  // 关键词匹配：title、content、tags
  const kw = `%${query}%`;
  sql += ` AND (title LIKE ? OR content LIKE ? OR tags LIKE ? OR value_analysis LIKE ?)`;
  params.push(kw, kw, kw, kw);

  // 简单排序：title 匹配优先，其次 content
  sql += ` ORDER BY
    CASE WHEN title LIKE ? THEN 0 ELSE 1 END,
    is_pinned DESC, created_at DESC LIMIT ?`;
  params.push(kw, parseInt(limit));

  const entries = db.prepare(sql).all(...params);
  // 解析 tags JSON
  for (const e of entries) {
    try { e.tags = e.tags ? JSON.parse(e.tags) : []; } catch { e.tags = []; }
  }
  res.json({ entries });
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
