import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// === 仪表板数据 ===

router.get('/dashboard/stats', (req, res) => {
  const userId = req.user.id;
  
  // 项目统计
  const projectStats = {
    total: db.prepare('SELECT COUNT(*) as count FROM projects WHERE user_id = ? AND deleted_at IS NULL').get(userId).count,
    active: db.prepare("SELECT COUNT(*) as count FROM projects WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL").get(userId).count,
    completed: db.prepare("SELECT COUNT(*) as count FROM projects WHERE user_id = ? AND current_stage = 'data' AND deleted_at IS NULL").get(userId).count
  };
  
  // 选题统计
  const topicStats = {
    total: db.prepare('SELECT COUNT(*) as count FROM topics WHERE user_id = ? AND deleted_at IS NULL').get(userId).count,
    candidate: db.prepare("SELECT COUNT(*) as count FROM topics WHERE user_id = ? AND status = 'candidate' AND deleted_at IS NULL").get(userId).count,
    approved: db.prepare("SELECT COUNT(*) as count FROM topics WHERE user_id = ? AND status = 'approved' AND deleted_at IS NULL").get(userId).count
  };
  
  // 视频统计
  const videoStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      COALESCE(SUM(views), 0) as totalViews,
      COALESCE(SUM(likes), 0) as totalLikes
    FROM videos WHERE user_id = ? AND deleted_at IS NULL
  `).get(userId);
  
  // 智能体状态
  const agentStats = {
    total: db.prepare('SELECT COUNT(*) as count FROM agents WHERE user_id = ? AND enabled = 1').get(userId).count,
    busy: db.prepare("SELECT COUNT(*) as count FROM agents WHERE user_id = ? AND status = 'busy' AND enabled = 1").get(userId).count,
    idle: db.prepare("SELECT COUNT(*) as count FROM agents WHERE user_id = ? AND status = 'idle' AND enabled = 1").get(userId).count
  };
  
  // Token用量
  const llmConfig = db.prepare('SELECT daily_token_limit, daily_token_used FROM llm_configs WHERE user_id = ?').get(userId);
  const tokenStats = {
    dailyLimit: llmConfig?.daily_token_limit || 500000,
    dailyUsed: llmConfig?.daily_token_used || 0
  };
  
  // 今日待办
  const today = new Date().toISOString().split('T')[0];
  const todayEvents = db.prepare('SELECT * FROM calendar_events WHERE user_id = ? AND date = ? ORDER BY date ASC LIMIT 10').all(userId, today);
  
  // 进行中的项目
  const activeProjects = db.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM stages s WHERE s.project_id = p.id AND s.status = 'completed') as completed_stages
    FROM projects p 
    WHERE p.user_id = ? AND p.status = 'active' AND p.deleted_at IS NULL
    ORDER BY p.updated_at DESC LIMIT 5
  `).all(userId);
  
  res.json({
    projectStats,
    topicStats,
    videoStats,
    agentStats,
    tokenStats,
    todayEvents,
    activeProjects
  });
});

// === 用户设置 ===

// 获取用户档案
router.get('/profile', (req, res) => {
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.user.id);
  res.json({ profile });
});

// 更新用户档案
router.put('/profile', (req, res) => {
  const { account_positioning, target_audience, content_style, topic_preferences, custom_fields } = req.body;
  db.prepare(`
    UPDATE user_profiles 
    SET account_positioning = ?, target_audience = ?, content_style = ?, topic_preferences = ?, custom_fields = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(account_positioning || '', target_audience || '', content_style || '', topic_preferences || '', custom_fields ? JSON.stringify(custom_fields) : null, req.user.id);
  res.json({ success: true });
});

// 更新用户信息
router.put('/user-info', (req, res) => {
  const { username, avatar } = req.body;
  const fields = [];
  const values = [];
  if (username !== undefined) { fields.push('username = ?'); values.push(username); }
  if (avatar !== undefined) { fields.push('avatar = ?'); values.push(avatar); }
  if (fields.length) {
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.user.id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  res.json({ success: true });
});

// 获取LLM配置
router.get('/llm-config', (req, res) => {
  const config = db.prepare('SELECT provider, api_endpoint, model_name, daily_token_limit, daily_token_used, global_constraint_prompt FROM llm_configs WHERE user_id = ?').get(req.user.id);
  // 不返回api_key
  const hasApiKey = !!db.prepare('SELECT api_key FROM llm_configs WHERE user_id = ?').get(req.user.id)?.api_key;
  res.json({ config: { ...config, hasApiKey } });
});

// 更新LLM配置
router.put('/llm-config', (req, res) => {
  const { provider, api_key, api_endpoint, model_name, daily_token_limit, global_constraint_prompt } = req.body;
  const existing = db.prepare('SELECT id FROM llm_configs WHERE user_id = ?').get(req.user.id);
  
  const fields = [];
  const values = [];
  if (provider !== undefined) { fields.push('provider = ?'); values.push(provider); }
  if (api_key !== undefined) { fields.push('api_key = ?'); values.push(api_key); }
  if (api_endpoint !== undefined) { fields.push('api_endpoint = ?'); values.push(api_endpoint); }
  if (model_name !== undefined) { fields.push('model_name = ?'); values.push(model_name); }
  if (daily_token_limit !== undefined) { fields.push('daily_token_limit = ?'); values.push(daily_token_limit); }
  if (global_constraint_prompt !== undefined) { fields.push('global_constraint_prompt = ?'); values.push(global_constraint_prompt); }
  
  if (existing) {
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.user.id);
    db.prepare(`UPDATE llm_configs SET ${fields.join(', ')} WHERE user_id = ?`).run(...values);
  } else {
    const id = uuidv4();
    const columns = fields.map(f => f.split(' = ')[0].trim());
    db.prepare(`INSERT INTO llm_configs (id, user_id, ${columns.join(', ')}) VALUES (?, ?, ${columns.map(() => '?').join(', ')})`)
      .run(id, req.user.id, ...values);
  }
  
  res.json({ success: true });
});

// 测试LLM连接
router.post('/llm-config/test', async (req, res) => {
  try {
    const { prompt } = req.body;
    const { callLLM } = await import('../services/llmService.js');
    
    const result = await callLLM(
      req.user.id,
      '你是一个AI助手，请用简洁的语言回答问题。',
      prompt || '请用一句话介绍你自己。',
      null
    );
    
    if (result.mock) {
      res.json({ 
        success: false, 
        error: result.fallbackReason || 'API调用失败，当前使用模拟数据。请检查API Key和模型配置是否正确。' 
      });
    } else {
      res.json({
        success: true,
        response: result.rawText,
        tokenInput: result.tokenInput,
        tokenOutput: result.tokenOutput,
      });
    }
  } catch (err) {
    console.error('Test LLM error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// === 番茄时钟 ===

// 计算剩余秒数
function calcRemainSeconds(record) {
  if (!record.started_at) return record.remain_seconds;
  const elapsed = Math.floor((Date.now() - new Date(record.started_at).getTime()) / 1000);
  const baseDuration = record.status === 'rest' ? record.rest_duration_cfg : record.work_duration_cfg;
  return Math.max(0, baseDuration - elapsed);
}

// 获取番茄时钟状态
router.get('/pomodoro', (req, res) => {
  let record = db.prepare('SELECT * FROM pomodoro_records WHERE user_id = ?').get(req.user.id);
  if (!record) {
    const id = uuidv4();
    db.prepare('INSERT INTO pomodoro_records (id, user_id) VALUES (?, ?)').run(id, req.user.id);
    record = db.prepare('SELECT * FROM pomodoro_records WHERE user_id = ?').get(req.user.id);
  }

  // 如果正在工作或休息，实时计算剩余秒数
  if ((record.status === 'work' || record.status === 'rest') && record.started_at) {
    record.remain_seconds = calcRemainSeconds(record);
    // 如果时间到了，标记完成但不自动切换，等用户选择
    if (record.remain_seconds <= 0) {
      const completedMode = record.status;
      // 工作完成：增加总时长和完成次数，设为stop状态等用户选择
      if (completedMode === 'work') {
        db.prepare(`
          UPDATE pomodoro_records
          SET status = 'stop', remain_seconds = work_duration_cfg,
              started_at = NULL, paused_at = NULL, paused_mode = NULL,
              total_duration = total_duration + work_duration_cfg,
              completed_count = completed_count + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(req.user.id);
      } else {
        // 休息完成：设为stop状态等用户选择
        db.prepare(`
          UPDATE pomodoro_records
          SET status = 'stop', remain_seconds = work_duration_cfg,
              started_at = NULL, paused_at = NULL, paused_mode = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(req.user.id);
      }
      record = db.prepare('SELECT * FROM pomodoro_records WHERE user_id = ?').get(req.user.id);
      record.just_completed = completedMode; // 标记刚刚完成的模式
    }
  }

  res.json({ pomodoro: record });
});

// 开始番茄时钟
router.post('/pomodoro/start', (req, res) => {
  const { mode } = req.body; // 'work' or 'rest'
  const workMode = mode === 'rest' ? 'rest' : 'work';

  let record = db.prepare('SELECT * FROM pomodoro_records WHERE user_id = ?').get(req.user.id);
  if (!record) {
    const id = uuidv4();
    db.prepare('INSERT INTO pomodoro_records (id, user_id) VALUES (?, ?)').run(id, req.user.id);
    record = db.prepare('SELECT * FROM pomodoro_records WHERE user_id = ?').get(req.user.id);
  }

  const duration = workMode === 'rest' ? record.rest_duration_cfg : record.work_duration_cfg;

  db.prepare(`
    UPDATE pomodoro_records
    SET status = ?, remain_seconds = ?, started_at = CURRENT_TIMESTAMP,
        paused_at = NULL, paused_mode = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(workMode, duration, req.user.id);

  res.json({ success: true, status: workMode, remainSeconds: duration });
});

// 暂停
router.post('/pomodoro/pause', (req, res) => {
  const record = db.prepare('SELECT * FROM pomodoro_records WHERE user_id = ?').get(req.user.id);
  if (!record) return res.status(404).json({ error: '记录不存在' });

  // 只有工作/休息状态才能暂停
  if (record.status !== 'work' && record.status !== 'rest') {
    return res.json({ success: false, error: '当前状态无法暂停' });
  }

  const remain = calcRemainSeconds(record);

  db.prepare(`
    UPDATE pomodoro_records
    SET status = 'paused', remain_seconds = ?, paused_at = CURRENT_TIMESTAMP,
        paused_mode = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(remain, record.status, req.user.id);

  res.json({ success: true, remainSeconds: remain, pausedMode: record.status });
});

// 继续
router.post('/pomodoro/resume', (req, res) => {
  const record = db.prepare('SELECT * FROM pomodoro_records WHERE user_id = ?').get(req.user.id);
  if (!record) return res.status(404).json({ error: '记录不存在' });

  if (record.status !== 'paused') {
    return res.json({ success: false, error: '当前状态无法继续' });
  }

  // 恢复暂停前的模式（work 或 rest），而不是强制设为 work
  const mode = record.paused_mode || 'work';
  const baseDuration = mode === 'rest' ? record.rest_duration_cfg : record.work_duration_cfg;
  // 计算 started_at：让剩余时间 = remain_seconds
  // started_at = 现在 - (总时长 - 剩余秒数)
  const startTime = new Date(Date.now() - (baseDuration - record.remain_seconds) * 1000).toISOString();

  db.prepare(`
    UPDATE pomodoro_records
    SET status = ?, started_at = ?, paused_at = NULL,
        paused_mode = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(mode, startTime, req.user.id);

  res.json({ success: true, status: mode, remainSeconds: record.remain_seconds });
});

// 停止（重置到初始状态，但保留统计数据）
router.post('/pomodoro/stop', (req, res) => {
  db.prepare(`
    UPDATE pomodoro_records
    SET status = 'stop', remain_seconds = work_duration_cfg,
        started_at = NULL, paused_at = NULL, paused_mode = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(req.user.id);

  res.json({ success: true });
});

// 重置全部（包括统计数据归零）
router.post('/pomodoro/reset', (req, res) => {
  db.prepare(`
    UPDATE pomodoro_records
    SET status = 'stop', remain_seconds = work_duration_cfg,
        started_at = NULL, paused_at = NULL, paused_mode = NULL,
        total_duration = 0, completed_count = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(req.user.id);

  res.json({ success: true });
});

// 跳过当前阶段（工作→休息 或 休息→工作）
router.post('/pomodoro/skip', (req, res) => {
  const record = db.prepare('SELECT * FROM pomodoro_records WHERE user_id = ?').get(req.user.id);
  if (!record) return res.status(404).json({ error: '记录不存在' });

  if (record.status === 'work' || record.status === 'paused') {
    // 工作跳过 → 休息
    db.prepare(`
      UPDATE pomodoro_records
      SET status = 'rest', remain_seconds = rest_duration_cfg,
          started_at = CURRENT_TIMESTAMP, paused_at = NULL, paused_mode = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(req.user.id);
    res.json({ success: true, status: 'rest' });
  } else if (record.status === 'rest') {
    // 休息跳过 → 工作
    db.prepare(`
      UPDATE pomodoro_records
      SET status = 'work', remain_seconds = work_duration_cfg,
          started_at = CURRENT_TIMESTAMP, paused_at = NULL, paused_mode = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(req.user.id);
    res.json({ success: true, status: 'work' });
  } else {
    res.json({ success: false, error: '当前状态无法跳过' });
  }
});

// 配置工作/休息时长
router.put('/pomodoro/config', (req, res) => {
  const { work_duration, rest_duration } = req.body;
  const work = Math.max(60, Math.min(7200, work_duration || 1500)); // 1分钟~2小时
  const rest = Math.max(30, Math.min(3600, rest_duration || 300));  // 30秒~1小时
  db.prepare(`
    UPDATE pomodoro_records
    SET work_duration_cfg = ?, rest_duration_cfg = ?,
        remain_seconds = CASE WHEN status = 'stop' THEN ? ELSE remain_seconds END,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(work, rest, work, req.user.id);
  res.json({ success: true });
});

// === 智能体工作群 ===

// 智能体角色设定（system prompt）
const agentRolePrompts = {
  project_director: `你是"项目总指挥"，是AI创作团队的负责人。你的名字叫{name}。
你的职责：把控项目整体方向，协调团队成员，做决策和分配任务。
你的风格：有大局观，说话有条理，善于总结和引导讨论，经常会分配任务给其他团队成员。
说话要求：用口语化的中文，简洁有力，每次回复控制在80-150字之间，不要太长。`,

  topic_planner: `你是"选题立项"专家，擅长发现爆款选题。你的名字叫{name}。
你的职责：研究市场趋势，分析用户喜好，提出有潜力的选题方向。
你的风格：思维活跃，善于捕捉热点，经常给出多个选题方向供选择。
说话要求：用口语化的中文，活泼有创意，每次回复控制在80-150字之间。`,

  scriptwriter: `你是"脚本策划"，擅长写爆款短视频脚本。你的名字叫{name}。
你的职责：负责内容脚本的结构设计、金句打磨和节奏把控。
你的风格：文字功底好，懂短视频节奏，经常提到钩子、反转、金句等概念。
说话要求：用口语化的中文，生动有画面感，每次回复控制在80-150字之间。`,

  graphic_designer: `你是"视觉物料"设计师，负责封面和视觉设计。你的名字叫{name}。
你的职责：设计高点击率的封面图、配图和视觉物料。
你的风格：对色彩、构图、字体很敏感，经常从视觉角度给出建议。
说话要求：用口语化的中文，有设计感，每次回复控制在80-150字之间。`,

  video_analyst: `你是"视频分析"专家，擅长拆解对标视频。你的名字叫{name}。
你的职责：分析爆款视频的结构、数据和规律，为创作提供参考。
你的风格：数据驱动，理性分析，经常提到完播率、互动率、留存率等指标。
说话要求：用口语化的中文，专业但易懂，每次回复控制在80-150字之间。`,

  distributor: `你是"平台分发"专家，懂各个平台的玩法。你的名字叫{name}。
你的职责：制定发布策略，选择平台和发布时间，优化标题标签。
你的风格：熟悉各平台特性，务实，经常提到抖音、小红书、B站等平台。
说话要求：用口语化的中文，接地气，每次回复控制在80-150字之间。`,

  operator: `你是"数据复盘"运营，擅长数据分析和优化。你的名字叫{name}。
你的职责：跟踪内容数据表现，诊断问题，提出优化建议。
你的风格：细心，善于发现问题，用数据说话，经常给出具体的优化建议。
说话要求：用口语化的中文，务实有条理，每次回复控制在80-150字之间。`,

  live_planner: `你是"直播策划"专家。你的名字叫{name}。
你的职责：设计直播主题、流程和话术。
你的风格：懂直播节奏，善于调动气氛。
说话要求：用口语化的中文，有感染力，每次回复控制在80-150字之间。`,

  custom: `你是一位AI创作助手。你的名字叫{name}。
你的职责：帮助用户完成内容创作相关的工作。
说话要求：用口语化的中文，友好专业，每次回复控制在80-150字之间。`,
};

// 群聊列表 - 确保用户至少有一个默认群
router.get('/agent-group-chats', (req, res) => {
  const userId = req.user.id;
  
  // 检查是否有群聊，没有则创建默认群
  let chats = db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM agent_group_messages m WHERE m.group_id = c.id) as message_count
    FROM agent_group_chat c 
    WHERE c.user_id = ? 
    ORDER BY c.created_at ASC LIMIT 20
  `).all(userId);
  
  if (chats.length === 0) {
    const defaultId = uuidv4();
    db.prepare(`
      INSERT INTO agent_group_chat (id, user_id, title, mode)
      VALUES (?, ?, 'AI创作工作群', 'discussion')
    `).run(defaultId, userId);
    chats = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM agent_group_messages m WHERE m.group_id = c.id) as message_count
      FROM agent_group_chat c 
      WHERE c.user_id = ? 
      ORDER BY c.created_at ASC LIMIT 20
    `).all(userId);
  }
  
  res.json({ chats });
});

// 创建群聊（保留接口，但前端不再使用）
router.post('/agent-group-chats', (req, res) => {
  const { title, project_id, mode } = req.body;
  const id = uuidv4();
  db.prepare(`
    INSERT INTO agent_group_chat (id, user_id, title, project_id, mode)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.user.id, title || 'AI工作群讨论', project_id || null, mode || 'discussion');
  res.json({ id });
});

router.get('/agent-group-chats/:id/messages', (req, res) => {
  const messages = db.prepare(`
    SELECT * FROM agent_group_messages 
    WHERE group_id = ? 
    ORDER BY created_at ASC LIMIT 200
  `).all(req.params.id);
  res.json({ messages });
});

// 获取智能体状态列表
router.get('/agents/status/list', (req, res) => {
  const agents = db.prepare(`
    SELECT id, name, role, avatar, status, current_action, current_task_id, enabled
    FROM agents 
    WHERE user_id = ? 
    ORDER BY created_at ASC
  `).all(req.user.id);
  res.json({ agents });
});

// 标准化动作文案生成
function generateActionText(agentRole, content, step) {
  const actionMap = {
    project_director: {
      step1: '正在分析需求',
      step2: '正在拆解任务',
      step3: '正在输出结论',
    },
    topic_planner: {
      step1: '正在调研选题方向',
      step2: '正在分析市场热度',
      step3: '正在整理选题建议',
    },
    scriptwriter: {
      step1: '正在构思脚本结构',
      step2: '正在撰写核心内容',
      step3: '正在打磨表达细节',
    },
    graphic_designer: {
      step1: '正在分析视觉风格',
      step2: '正在构思设计方案',
      step3: '正在输出视觉建议',
    },
    video_analyst: {
      step1: '正在分析对标案例',
      step2: '正在拆解数据表现',
      step3: '正在提炼规律总结',
    },
    distributor: {
      step1: '正在分析平台特性',
      step2: '正在制定发布策略',
      step3: '正在输出分发建议',
    },
    operator: {
      step1: '正在分析数据指标',
      step2: '正在诊断问题原因',
      step3: '正在输出优化建议',
    },
    live_planner: {
      step1: '正在设计直播主题',
      step2: '正在规划直播流程',
      step3: '正在输出策划方案',
    },
    custom: {
      step1: '正在理解需求',
      step2: '正在分析内容',
      step3: '正在生成回复',
    },
  };
  const roleActions = actionMap[agentRole] || actionMap.custom;
  return roleActions[step] || roleActions.step1;
}

// 延时函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 构建对话历史
function buildChatHistory(messages, currentAgentName) {
  let history = '';
  for (const msg of messages) {
    if (msg.sender_type === 'user') {
      history += `用户: ${msg.content}\n`;
    } else {
      history += `${msg.sender_name}: ${msg.content}\n`;
    }
  }
  return history;
}

// 生成智能体回复（调用LLM）
async function generateAgentReplyLLM(agent, userContent, chatHistory, userId) {
  try {
    const { callLLM } = await import('../services/llmService.js');
    
    const rolePrompt = agentRolePrompts[agent.role] || agentRolePrompts.custom;
    const systemPrompt = rolePrompt.replace('{name}', agent.name);
    
    const userPrompt = `【群聊上下文】\n${chatHistory}\n【当前用户发言】\n${userContent}\n\n请你以"${agent.name}"的身份，在群聊中回复。注意：\n1. 回复要符合你的角色定位\n2. 结合上下文来回复，不要重复别人说过的话\n3. 用第一人称说话，自然融入群聊\n4. 不要输出markdown格式，直接输出纯文本\n5. 回复简短有力，80-150字左右`;
    
    const result = await callLLM(userId, systemPrompt, userPrompt, null);
    
    if (result.mock) {
      // LLM不可用时返回模板回复
      return getFallbackReply(agent.role);
    }
    
    // 清理回复（去掉可能的引号、markdown等）
    let reply = result.rawText || '';
    reply = reply.trim();
    // 去掉可能的前缀（如"项目总指挥："等）
    reply = reply.replace(/^[^:：]+[：:]\s*/, '');
    // 去掉多余换行
    reply = reply.replace(/\n{3,}/g, '\n\n');
    
    return reply || getFallbackReply(agent.role);
  } catch (err) {
    console.error('Generate agent reply error:', err);
    return getFallbackReply(agent.role);
  }
}

// 备用回复模板（LLM不可用时）
function getFallbackReply(role) {
  const replies = {
    project_director: `收到你的想法。从整体角度来看这个方向挺有潜力的，我建议先从选题调研入手，把方向再细化一下。大家有什么补充意见吗？`,
    topic_planner: `这个方向我觉得可以深挖！目前市场上同类内容的反馈都不错，但我们得做出差异化才行。我建议可以从几个不同的角度来切入，你觉得呢？`,
    scriptwriter: `如果是这个方向的话，脚本可以考虑用"问题-冲突-解决"的经典结构。开头3秒一定要有钩子，中间层层递进，结尾留互动点。需要我出一个详细脚本吗？`,
    graphic_designer: `视觉上我建议用高对比度的配色方案，封面大字要醒目。可以考虑人物+文字的组合形式，点击率会更高一些。`,
    video_analyst: `从数据分析角度，我建议先找3-5条同类型对标视频做一下拆解，看看爆款规律，这样我们的内容方向会更精准。`,
    distributor: `发布层面我建议主做抖音+小红书双平台。抖音流量大，小红书精准度高。发布时间可以选在工作日晚上8-10点的黄金档。`,
    operator: `数据方面我会持续跟踪，发布后24小时是关键窗口期。完播率和互动率是核心指标，我们可以根据数据快速调整优化。`,
    live_planner: `直播这块我们可以好好策划一下，选个好主题+好节奏，效果不会差的。`
  };
  return replies[role] || '收到你的消息，我会认真思考的。';
}

router.post('/agent-group-chats/:id/messages', async (req, res) => {
  try {
    const { content, mention_agent_ids } = req.body;
    const groupId = req.params.id;
    const userId = req.user.id;
    
    // 验证群聊归属
    const group = db.prepare('SELECT * FROM agent_group_chat WHERE id = ? AND user_id = ?').get(groupId, userId);
    if (!group) return res.status(404).json({ error: '群聊不存在' });
    
    // 保存用户消息
    const userMsgId = uuidv4();
    db.prepare(`
      INSERT INTO agent_group_messages (id, group_id, sender_type, sender_id, sender_name, content, mention_agent_ids)
      VALUES (?, ?, 'user', ?, ?, ?, ?)
    `).run(userMsgId, groupId, userId, req.user.username, content, mention_agent_ids ? JSON.stringify(mention_agent_ids) : null);
    
    // 获取历史消息（用于上下文）
    const historyMessages = db.prepare(`
      SELECT * FROM agent_group_messages 
      WHERE group_id = ? 
      ORDER BY created_at ASC LIMIT 50
    `).all(groupId);
    
    // 获取群内智能体
    let agents = db.prepare("SELECT * FROM agents WHERE user_id = ? AND enabled = 1").all(userId);
    
    // 如果@了特定智能体，只回复那些
    if (mention_agent_ids && mention_agent_ids.length > 0) {
      agents = agents.filter(a => mention_agent_ids.includes(a.id));
    } else {
      // 否则默认队长+相关角色，最多3个
      const captain = agents.find(a => a.role === 'project_director');
      agents = captain ? [captain, ...agents.filter(a => a.role !== 'project_director').slice(0, 2)] : agents.slice(0, 3);
    }
    
    // 限制单轮回复数量
    const maxAgents = 3;
    agents = agents.slice(0, maxAgents);
    
    // 串行处理每个智能体的回复（模拟真人团队协作）
    const responses = [];
    let accumulatedHistory = buildChatHistory(historyMessages, '');
    
    for (let ai = 0; ai < agents.length; ai++) {
      const agent = agents[ai];
      
      // 步骤1：更新状态为工作中 + 第一步动作
      const action1 = generateActionText(agent.role, content, 'step1');
      db.prepare("UPDATE agents SET status = 'busy', current_action = ?, current_task_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(action1, groupId, agent.id);
      await delay(600 + Math.random() * 400);
      
      // 步骤2：更新第二步动作
      const action2 = generateActionText(agent.role, content, 'step2');
      db.prepare("UPDATE agents SET current_action = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(action2, agent.id);
      await delay(500 + Math.random() * 300);
      
      // 步骤3：调用LLM生成回复
      const action3 = generateActionText(agent.role, content, 'step3');
      db.prepare("UPDATE agents SET current_action = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(action3, agent.id);
      
      // 真正调用LLM生成回复
      const replyContent = await generateAgentReplyLLM(agent, content, accumulatedHistory, userId);
      
      const replyId = uuidv4();
      
      // 智能体之间间隔一下再说话
      if (ai > 0) await delay(400);
      
      db.prepare(`
        INSERT INTO agent_group_messages (id, group_id, sender_type, sender_id, sender_name, content)
        VALUES (?, ?, 'agent', ?, ?, ?)
      `).run(replyId, groupId, agent.id, agent.name, replyContent);
      
      // 累加上下文
      accumulatedHistory += `${agent.name}: ${replyContent}\n`;
      
      // 恢复空闲状态
      db.prepare("UPDATE agents SET status = 'idle', current_action = NULL, current_task_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(agent.id);
      
      responses.push({ 
        id: replyId, 
        agent: { id: agent.id, name: agent.name, role: agent.role, avatar: agent.avatar }, 
        content: replyContent 
      });
    }
    
    res.json({ success: true, userMessageId: userMsgId, responses });
  } catch (err) {
    console.error('Group chat message error:', err);
    // 确保异常时恢复所有智能体状态
    try {
      db.prepare("UPDATE agents SET status = 'idle', current_action = NULL WHERE user_id = ? AND status = 'busy'")
        .run(req.user.id);
    } catch (e) { /* ignore */ }
    res.status(500).json({ error: '发送失败' });
  }
});

// === 管理员后台 ===

router.get('/admin/overview', adminMiddleware, (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;
  const skillRunCount = db.prepare('SELECT COUNT(*) as count FROM skill_runs').get().count;
  const totalTokens = db.prepare('SELECT COALESCE(SUM(token_input + token_output), 0) as total FROM skill_runs').get().total;
  
  res.json({
    userCount,
    projectCount,
    skillRunCount,
    totalTokens
  });
});

router.get('/admin/agents', adminMiddleware, (req, res) => {
  const agents = db.prepare('SELECT a.*, u.username FROM agents a JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC').all();
  res.json({ agents });
});

router.get('/admin/skills', adminMiddleware, (req, res) => {
  const skills = db.prepare('SELECT * FROM skills ORDER BY is_global DESC, created_at DESC').all();
  res.json({ skills });
});

router.get('/admin/system-configs', adminMiddleware, (req, res) => {
  const configs = db.prepare('SELECT * FROM system_configs').all();
  res.json({ configs });
});

router.put('/admin/system-configs/:key', adminMiddleware, (req, res) => {
  const { value } = req.body;
  db.prepare(`
    INSERT INTO system_configs (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(req.params.key, value);
  res.json({ success: true });
});

router.get('/admin/audit-logs', adminMiddleware, (req, res) => {
  const { limit = 50 } = req.query;
  const logs = db.prepare(`
    SELECT al.*, u.username 
    FROM audit_logs al 
    LEFT JOIN users u ON al.user_id = u.id 
    ORDER BY al.operate_at DESC LIMIT ?
  `).all(parseInt(limit));
  res.json({ logs });
});

// 全局搜索
router.get('/search', (req, res) => {
  const { q, limit = 20 } = req.query;
  if (!q) return res.json({ results: [] });
  
  const results = [];
  const search = `%${q}%`;
  
  // 搜索项目
  const projects = db.prepare('SELECT id, title, "project" as type FROM projects WHERE user_id = ? AND title LIKE ? AND deleted_at IS NULL LIMIT 5')
    .all(req.user.id, search);
  results.push(...projects);
  
  // 搜索选题
  const topics = db.prepare('SELECT id, name as title, "topic" as type FROM topics WHERE user_id = ? AND name LIKE ? AND deleted_at IS NULL LIMIT 5')
    .all(req.user.id, search);
  results.push(...topics);
  
  // 搜索脚本
  const scripts = db.prepare('SELECT id, title, "script" as type FROM scripts WHERE user_id = ? AND title LIKE ? AND deleted_at IS NULL LIMIT 5')
    .all(req.user.id, search);
  results.push(...scripts);
  
  // 搜索知识条目
  const knowledge = db.prepare('SELECT id, title, "knowledge" as type FROM knowledge_entries WHERE user_id = ? AND title LIKE ? AND deleted_at IS NULL LIMIT 5')
    .all(req.user.id, search);
  results.push(...knowledge);
  
  // 搜索对标视频
  const benchmarks = db.prepare('SELECT id, title, "benchmark" as type FROM benchmarks WHERE user_id = ? AND title LIKE ? AND deleted_at IS NULL LIMIT 5')
    .all(req.user.id, search);
  results.push(...benchmarks);
  
  res.json({ results: results.slice(0, parseInt(limit)) });
});

export default router;
