import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// 标准阶段定义
const STAGES = [
  { code: 'topic', name: '选题策划', role: '选题策划-桃桃', order: 1 },
  { code: 'script', name: '脚本创作', role: '内容编剧-橘子', order: 2 },
  { code: 'design', name: '视觉设计', role: '平面设计师-泡泡', order: 3 },
  { code: 'review', name: '项目评审', role: '超级IP顾问-队长', order: 4 },
  { code: 'publish', name: '发布发行', role: '发行-小海', order: 5 },
  { code: 'data', name: '数据复盘', role: '运营-阿飞', order: 6 }
];

// 获取项目列表
router.get('/', (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  
  let query = 'SELECT * FROM projects WHERE user_id = ? AND deleted_at IS NULL';
  const params = [req.user.id];
  
  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  
  const projects = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM projects WHERE user_id = ? AND deleted_at IS NULL').get(req.user.id).count;
  
  res.json({ projects, total });
});

// 获取项目详情
router.get('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }
  
  // 获取阶段列表
  const stages = db.prepare('SELECT * FROM stages WHERE project_id = ? ORDER BY created_at ASC').all(req.params.id);
  
  res.json({ project, stages });
});

// 创建项目
router.post('/', (req, res) => {
  const { title, description } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: '项目名称不能为空' });
  }
  
  const projectId = uuidv4();
  
  db.prepare(`
    INSERT INTO projects (id, user_id, title, description, current_stage, status)
    VALUES (?, ?, ?, ?, 'topic', 'active')
  `).run(projectId, req.user.id, title, description || '');
  
  // 初始化6个阶段
  const insertStage = db.prepare(`
    INSERT INTO stages (id, project_id, code, name, role, status, agent_id)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `);
  
  for (const stage of STAGES) {
    // 查找对应的智能体
    const agent = db.prepare("SELECT id FROM agents WHERE user_id = ? AND name = ?").get(req.user.id, stage.role);
    insertStage.run(uuidv4(), projectId, stage.code, stage.name, stage.role, agent?.id || null);
  }
  
  // 设置第一个阶段为进行中
  db.prepare("UPDATE stages SET status = 'in_progress' WHERE project_id = ? AND code = 'topic'").run(projectId);
  
  // 发送消息通知
  db.prepare(`
    INSERT INTO messages (id, user_id, type, title, content, project_id)
    VALUES (?, ?, 'project', '新项目已创建', ?, ?)
  `).run(uuidv4(), req.user.id, `项目「${title}」已创建，开始选题策划阶段`, projectId);
  
  res.json({ id: projectId, title, current_stage: 'topic' });
});

// 更新项目
router.put('/:id', (req, res) => {
  const { title, description, auto_flow, quality_gate_score } = req.body;
  
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }
  
  db.prepare(`
    UPDATE projects SET title = ?, description = ?, auto_flow = ?, quality_gate_score = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title || project.title, description !== undefined ? description : project.description, 
        auto_flow !== undefined ? (auto_flow ? 1 : 0) : project.auto_flow,
        quality_gate_score !== undefined ? quality_gate_score : project.quality_gate_score,
        req.params.id);
  
  res.json({ success: true });
});

// 删除项目（软删除）
router.delete('/:id', (req, res) => {
  db.prepare('UPDATE projects SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  
  res.json({ success: true });
});

// 阶段流转 - 推进到下一阶段
router.post('/:id/stages/advance', (req, res) => {
  const projectId = req.params.id;
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user.id);
  
  if (!project) {
    return res.status(404).json({ error: '项目不存在' });
  }
  
  const currentStage = db.prepare("SELECT * FROM stages WHERE project_id = ? AND code = ?").get(projectId, project.current_stage);
  const currentIndex = STAGES.findIndex(s => s.code === project.current_stage);
  
  if (currentIndex >= STAGES.length - 1) {
    return res.status(400).json({ error: '已在最后阶段' });
  }
  
  // 质量门禁检查
  if (project.quality_gate_score && currentStage) {
    const reviews = db.prepare('SELECT AVG(score) as avg_score FROM reviews WHERE stage_id = ? AND type = ?').get(currentStage.id, 'score');
    if (reviews.avg_score && reviews.avg_score < project.quality_gate_score) {
      return res.status(400).json({ error: `评审评分 ${reviews.avg_score.toFixed(1)} 低于门禁值 ${project.quality_gate_score}，请先优化` });
    }
  }
  
  // 完成当前阶段
  db.prepare("UPDATE stages SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE project_id = ? AND code = ?")
    .run(projectId, project.current_stage);
  
  // 推进到下一阶段
  const nextStage = STAGES[currentIndex + 1];
  db.prepare("UPDATE stages SET status = 'in_progress', started_at = CURRENT_TIMESTAMP WHERE project_id = ? AND code = ?")
    .run(projectId, nextStage.code);
  
  db.prepare('UPDATE projects SET current_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(nextStage.code, projectId);
  
  // 发送通知
  db.prepare(`
    INSERT INTO messages (id, user_id, type, title, content, project_id)
    VALUES (?, ?, 'project', '阶段推进', ?, ?)
  `).run(uuidv4(), req.user.id, `项目「${project.title}」已进入「${nextStage.name}」阶段`, projectId);
  
  res.json({ success: true, current_stage: nextStage.code });
});

// 获取阶段详情
router.get('/:id/stages/:stageId', (req, res) => {
  const stage = db.prepare(`
    SELECT s.*, p.title as project_title 
    FROM stages s 
    JOIN projects p ON s.project_id = p.id 
    WHERE s.id = ? AND p.user_id = ?
  `).get(req.params.stageId, req.user.id);
  
  if (!stage) {
    return res.status(404).json({ error: '阶段不存在' });
  }
  
  const reviews = db.prepare('SELECT * FROM reviews WHERE stage_id = ? ORDER BY created_at DESC').all(req.params.stageId);
  
  res.json({ stage, reviews });
});

// 提交阶段产出
router.put('/:id/stages/:stageId', (req, res) => {
  const { output } = req.body;
  
  db.prepare('UPDATE stages SET output = ? WHERE id = ? AND project_id = ?').run(output, req.params.stageId, req.params.id);
  
  res.json({ success: true });
});

// 添加评审
router.post('/:id/stages/:stageId/reviews', (req, res) => {
  const { content, type, score } = req.body;
  
  const reviewId = uuidv4();
  db.prepare(`
    INSERT INTO reviews (id, stage_id, project_id, author_id, author_name, content, type, score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(reviewId, req.params.stageId, req.params.id, req.user.id, req.user.username, content, type || 'comment', score || null);
  
  res.json({ id: reviewId });
});

export default router;
