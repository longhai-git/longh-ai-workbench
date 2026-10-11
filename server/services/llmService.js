import db from '../db.js';

// 解析LLM返回的JSON，多级fallback
export function parseJSONResponse(text) {
  if (!text) return null;
  
  // 尝试直接解析
  try {
    return JSON.parse(text);
  } catch (e) { /* continue */ }
  
  // 尝试提取 ```json 代码块
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim());
    } catch (e) { /* continue */ }
  }
  
  // 尝试提取第一个{到最后一个}
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.substring(firstBrace, lastBrace + 1));
    } catch (e) { /* continue */ }
  }
  
  // 尝试提取第一个[到最后一个]
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(text.substring(firstBracket, lastBracket + 1));
    } catch (e) { /* continue */ }
  }
  
  return null;
}

// 获取用户LLM配置
export function getLLMConfig(userId) {
  return db.prepare('SELECT * FROM llm_configs WHERE user_id = ?').get(userId);
}

// ============================================================
// 模型路由策略：复杂任务用主力模型，简单任务用轻量模型
// ============================================================

// 复杂任务关键词（匹配技能名或智能体角色）—— 使用主力模型
const COMPLEX_TASK_KEYWORDS = [
  '脚本', '分镜', '评审', '拆解', '复盘', '对标', '选题策划',
  '项目综合', '深度', '策略', '方案', '报告', '分析报告',
  '知识提取', '画像', '工作流', '内容生成', '创作'
];

// 简单任务关键词 —— 使用轻量模型（低成本、低延迟）
const SIMPLE_TASK_KEYWORDS = [
  '标题', '标签', 'tag', '封面建议', '评论', '热点', '翻译',
  '摘要', '总结', '润色', '改写', '扩写', '缩写', '分类',
  '提取关键词', 'emoji', '文案', '短句', '一句话', '简介',
  '测试', '自我测试', '打招呼', '聊天', '闲聊', '你好',
  '自我介绍', '介绍一下', '在吗'
];

// 用户明确要求使用轻量模型的关键词
const LIGHT_MODEL_REQUEST_KEYWORDS = [
  '轻量模型', '用轻量', '轻量', '便宜的模型', '省钱', '快速回复',
  '用便宜', '小模型', '快速模型'
];

// 用户明确要求使用主力模型的关键词
const MAIN_MODEL_REQUEST_KEYWORDS = [
  '主力模型', '用主力', '主力', '大模型', '强模型', '高质量模型',
  '用强', '用大'
];

/**
 * 判断任务复杂度
 * @param {string} taskName - 技能名或智能体角色描述
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userPrompt - 用户提示词
 * @returns {'complex'|'simple'} 任务等级
 */
function classifyTaskComplexity(taskName, systemPrompt, userPrompt) {
  // 对于智能体群聊（taskName 为 null），优先检查用户的实际请求内容
  if (!taskName) {
    // 从群聊包装的 prompt 中提取用户真实发言，避免 chatHistory 污染关键词匹配
    let realUserContent = userPrompt || '';
    const marker = '【当前用户发言】';
    const idx = realUserContent.indexOf(marker);
    if (idx !== -1) {
      realUserContent = realUserContent.slice(idx + marker.length);
      const cutIdx1 = realUserContent.indexOf('请你以');
      const cutIdx2 = realUserContent.indexOf('\n【');
      let cut = -1;
      if (cutIdx1 !== -1) cut = cutIdx1;
      if (cutIdx2 !== -1 && (cut === -1 || cutIdx2 < cut)) cut = cutIdx2;
      if (cut !== -1) realUserContent = realUserContent.slice(0, cut);
    }
    const userText = realUserContent.toLowerCase();

    // 1. 用户明确要求用主力模型 → 主力模型（唯一触发主力的条件）
    const mainRequested = MAIN_MODEL_REQUEST_KEYWORDS.some(kw => userText.includes(kw.toLowerCase()));
    if (mainRequested) return 'complex';

    // 2. 其他所有情况 → 轻量模型
    return 'simple';
  }

  // 技能执行：检查技能名 + 系统提示词
  const text = `${taskName || ''} ${systemPrompt || ''}`.toLowerCase();

  // 命中简单关键词 → simple
  const simpleHit = SIMPLE_TASK_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
  if (simpleHit) {
    // 但如果同时命中复杂关键词，以复杂为准
    const complexHit = COMPLEX_TASK_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
    if (complexHit) return 'complex';
    return 'simple';
  }

  // 命中复杂关键词 → complex
  const complexHit = COMPLEX_TASK_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
  if (complexHit) return 'complex';

  // 根据 prompt 长度辅助判断：长 prompt 通常是复杂任务
  const promptLen = (userPrompt || '').length;
  if (promptLen > 2000) return 'complex';

  // 默认复杂（保守策略，核心任务优先保证质量）
  return 'complex';
}

/**
 * 根据任务复杂度选择模型
 * @param {object} config - 用户LLM配置
 * @param {string} taskName - 技能名
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {{model: string, tier: string}} 模型名和层级
 */
// 默认轻量模型（火山方舟豆包轻量版，低成本低延迟）
const DEFAULT_LIGHT_MODEL = 'doubao-seed-1-6-flash-250615';

export function selectModelForTask(config, taskName, systemPrompt, userPrompt) {
  const mainModel = config.model_name || 'doubao-seed-2-1-pro-250615';
  const lightModel = config.light_model_name || DEFAULT_LIGHT_MODEL;
  const lightEnabled = config.light_model_enabled === 1 || config.light_model_enabled === true;

  const complexity = classifyTaskComplexity(taskName, systemPrompt, userPrompt);

  // 智能体群聊（taskName 为 null）：不受 light_model_enabled 开关限制，
  // 除非用户明确要求主力模型，否则一律使用轻量模型
  if (!taskName) {
    if (complexity === 'complex') {
      return { model: mainModel, tier: 'main' };
    }
    return { model: lightModel, tier: 'light' };
  }

  // 技能执行：受 light_model_enabled 开关控制
  if (!lightEnabled || !config.light_model_name) {
    return { model: mainModel, tier: 'main' };
  }

  if (complexity === 'simple') {
    return { model: lightModel, tier: 'light' };
  }

  return { model: mainModel, tier: 'main' };
}

// 检查token是否超限
export function checkTokenLimit(userId, estimatedTokens) {
  const config = getLLMConfig(userId);
  if (!config || !config.daily_token_limit) return { ok: true };
  
  const today = new Date().toISOString().split('T')[0];
  if (config.last_reset_date !== today) {
    // 重置每日用量
    db.prepare('UPDATE llm_configs SET daily_token_used = 0, last_reset_date = ? WHERE user_id = ?')
      .run(today, userId);
    return { ok: true, used: 0, limit: config.daily_token_limit };
  }
  
  const used = config.daily_token_used || 0;
  return {
    ok: used + estimatedTokens <= config.daily_token_limit,
    used,
    limit: config.daily_token_limit,
    remaining: config.daily_token_limit - used
  };
}

// 记录token消耗（支持按模型统计）
export function recordTokenUsage(userId, inputTokens, outputTokens, modelName = null, modelTier = null) {
  const today = new Date().toISOString().split('T')[0];
  const config = getLLMConfig(userId);

  const total = (inputTokens || 0) + (outputTokens || 0);

  // 更新每日总量
  if (config && config.last_reset_date !== today) {
    db.prepare('UPDATE llm_configs SET daily_token_used = ?, last_reset_date = ? WHERE user_id = ?')
      .run(total, today, userId);
  } else {
    db.prepare('UPDATE llm_configs SET daily_token_used = daily_token_used + ? WHERE user_id = ?')
      .run(total, userId);
  }

  // 记录按模型统计（自动建表，兼容旧环境）
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS token_usage_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      model_name TEXT,
      model_tier TEXT,
      token_input INTEGER DEFAULT 0,
      token_output INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    const logId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    db.prepare('INSERT INTO token_usage_log (id, user_id, model_name, model_tier, token_input, token_output) VALUES (?, ?, ?, ?, ?, ?)')
      .run(logId, userId, modelName || 'unknown', modelTier || 'unknown', inputTokens || 0, outputTokens || 0);
  } catch (e) {
    console.error('Token usage log error:', e.message);
  }
}

// 获取按模型统计的今日用量（含兜底：无明细但有总量时按主力模型回填）
export function getTodayModelUsage(userId) {
  const today = new Date().toISOString().split('T')[0];
  try {
    const rows = db.prepare(`
      SELECT model_name, model_tier,
             SUM(token_input) as token_input,
             SUM(token_output) as token_output,
             COUNT(*) as call_count
      FROM token_usage_log
      WHERE user_id = ? AND date(created_at) = ?
      GROUP BY model_name, model_tier
      ORDER BY (SUM(token_input) + SUM(token_output)) DESC
    `).all(userId, today);

    // 兜底：如果明细为空但 llm_configs 有今日用量（旧数据迁移场景），
    // 按主力模型回填一条记录，保证 UI 至少显示主力模型维度
    if (!rows || rows.length === 0) {
      const config = getLLMConfig(userId);
      const dailyUsed = config?.daily_token_used || 0;
      if (dailyUsed > 0) {
        return [{
          model_name: config?.model_name || '主力模型',
          model_tier: 'main',
          token_input: Math.round(dailyUsed / 2),
          token_output: dailyUsed - Math.round(dailyUsed / 2),
          call_count: 1,
        }];
      }
    }
    return rows;
  } catch (e) {
    // 表不存在时返回空数组
    return [];
  }
}

// Mock LLM调用 - 根据技能类型返回模拟数据
function generateMockResponse(skillName, inputData) {
  const responses = {
    '爆款选题策划': {
      topics: [
        {
          name: '选题方向一：痛点直击型',
          targetAudience: '25-35岁职场人士',
          coreValue: '解决用户最迫切的痛点问题',
          differentiation: '从独特角度切入，避免同质化',
          expectedEffect: '高完播率+强互动',
          scores: { spread: 85, differentiation: 80, userMatch: 90, feasibility: 88, overall: 86 }
        },
        {
          name: '选题方向二：干货实用型',
          targetAudience: '学习成长型用户',
          coreValue: '提供可直接落地的实用方法',
          differentiation: '体系化输出，收藏价值高',
          expectedEffect: '高收藏+高转发',
          scores: { spread: 75, differentiation: 70, userMatch: 85, feasibility: 92, overall: 80 }
        },
        {
          name: '选题方向三：情感共鸣型',
          targetAudience: '广泛大众用户',
          coreValue: '触动用户内心情感共鸣',
          differentiation: '独特的情感切入点',
          expectedEffect: '高点赞+评论互动',
          scores: { spread: 90, differentiation: 75, userMatch: 80, feasibility: 82, overall: 82 }
        }
      ]
    },
    '爆款脚本创作': {
      hook: '你知道吗？90%的人都在这件事上浪费了大量时间...',
      structure: [
        { phase: '开头(0-3s)', content: '钩子抛出问题，制造悬念' },
        { phase: '发展(3-15s)', content: '展开论述，层层递进' },
        { phase: '高潮(15-40s)', content: '核心观点+案例佐证' },
        { phase: '结尾(40-60s)', content: '总结升华+互动引导' }
      ],
      content: '【完整脚本内容示例】\n\n(0-3s) 你知道吗？90%的人都在这件事上浪费了大量时间...\n\n(3-8s) 想象一下，你每天花2小时刷手机，一年就是730小时，相当于30天...\n\n(8-15s) 但如果你把这些时间用在自我提升上，一年后你会变成什么样？\n\n(15-25s) 今天我要分享一个亲测有效的方法，帮你每天多出2小时...\n\n(25-40s) 方法很简单，就是"时间块管理法"...\n\n(40-50s) 记住，时间是最公平的资源，你怎么对待它，它就怎么回馈你...\n\n(50-60s) 觉得有用的话，点赞收藏，下期分享更多干货！',
      goldenQuotes: [
        '时间是最公平的资源，你怎么对待它，它就怎么回馈你',
        '90%的人都在这件事上浪费了大量时间',
        '一年730小时，相当于30天完整的时间'
      ]
    },
    '标题优化': {
      titles: [
        { title: '90%的人都不知道的时间管理秘诀', score: 92, type: '数字型' },
        { title: '为什么你总是没时间？真相扎心了', score: 88, type: '悬念型' },
        { title: '每天多出2小时，只需要做到这3点', score: 90, type: '利益型' },
        { title: '你浪费的不是时间，是你的人生', score: 85, type: '情感型' },
        { title: '时间管理的3个误区，越早知道越好', score: 87, type: '痛点型' },
        { title: '从拖延到高效，我只用了这一个方法', score: 89, type: '对比型' },
        { title: '别再瞎忙了！高效人士都在用的时间管理法', score: 86, type: '反常识型' },
        { title: '一年多出30天？这个方法彻底改变了我', score: 91, type: '悬念型' },
        { title: '时间管理第一步：先停止做这5件事', score: 84, type: '清单型' },
        { title: '为什么越忙的人，反而时间越多？', score: 88, type: '反转型' }
      ],
      topPick: '90%的人都不知道的时间管理秘诀'
    },
    '爆款封面设计': {
      designs: [
        {
          style: '大字冲击型',
          mainVisual: '人物特写+惊讶表情',
          colorScheme: '红黑配色，高对比度',
          titleText: '90%的人都不知道！',
          layout: '左图右字，标题占60%面积'
        },
        {
          style: '对比反差型',
          mainVisual: '前后对比/左右分屏',
          colorScheme: '冷暖对比，视觉冲击强',
          titleText: '每天多出2小时',
          layout: '上下结构，图在上字在下'
        },
        {
          style: '悬念好奇型',
          mainVisual: '局部特写+问号元素',
          colorScheme: '暗色调+亮色点缀',
          titleText: '时间都去哪了？',
          layout: '居中构图，标题大字居中'
        }
      ],
      recommendations: '推荐方案一：大字冲击型，点击率预估最高'
    },
    '视频拆解分析': {
      hookAnalysis: {
        hookType: '问题+数字冲击',
        hookSentences: '你知道吗？90%的人都在这件事上浪费了大量时间...',
        analysis: '用数字"90%"制造冲击感，用"这件事"制造悬念，让用户想知道是什么事',
        retentionReason: '好奇心驱动+数字冲击双重留人机制',
        visualHint: '人物惊讶表情+大字数字'
      },
      conflictAnalysis: {
        conflictType: '认知冲突',
        conflictSentences: '但如果你把这些时间用在自我提升上，一年后你会变成什么样？',
        description: '从"浪费时间"到"改变人生"的认知反差',
        intensity: 8
      },
      segmentAnalysis: [
        { segment: '0-3s', function: '钩子', pacing: '快', emotion: '好奇', editingHint: '快切+大字', keyQuotes: '90%的人都不知道' },
        { segment: '3-8s', function: '铺垫', pacing: '中', emotion: '震惊', editingHint: '数据可视化', keyQuotes: '一年730小时' },
        { segment: '8-15s', function: '转折', pacing: '中', emotion: '期待', editingHint: '悬念过渡', keyQuotes: '你会变成什么样' }
      ],
      narrativeChain: {
        stages: ['抛出问题', '制造冲击', '给出方案', '价值升华'],
        turningPoints: ['3s钩子', '8s转折', '15s核心方法', '50s金句'],
        overallStructure: '问题-方案-价值 经典结构'
      },
      commentInsights: {
        potentialHotComments: ['收藏了慢慢看', '说得太对了', '我就是这样'],
        audiencePainPoints: ['时间不够用', '拖延症', '效率低'],
        interactionTriggers: ['你中了几条？', '评论区告诉我']
      },
      summary: {
        videoTopic: '时间管理方法分享',
        coreValue: '提供可落地的时间管理方法，帮助用户提升效率',
        actionableMethods: [
          { method: '数字冲击钩子', evidence: '90%的人...', application: '用数据制造冲击感', scene: '知识类视频开头' },
          { method: '问题-方案结构', evidence: '整体叙事结构', application: '先抛问题再给方案', scene: '干货类视频通用' }
        ]
      }
    },
    '数据复盘分析': {
      overview: '整体表现良好，完播率高于同类平均，但互动率有提升空间',
      highlights: ['完播率达到45%，高于同类平均30%', '前5秒留存率68%，钩子效果不错'],
      issues: ['点赞率偏低，只有2.5%', '评论互动不足', '转发率低于预期'],
      suggestions: ['优化结尾互动引导话术', '增加评论区置顶评论引导', '在内容中设置更多互动点']
    },
    '发布策略优化': {
      platforms: [
        { platform: '抖音', publishTime: '12:00-13:00, 18:00-22:00', description: '工作日中午和晚上流量高峰', tags: ['#时间管理', '#效率', '#成长'] },
        { platform: 'B站', publishTime: '18:00-22:00, 周末全天', description: '年轻人活跃时间', tags: ['时间管理', '效率提升', '学习方法'] },
        { platform: '小红书', publishTime: '08:00-10:00, 20:00-22:00', description: '女性用户活跃高峰', tags: ['#时间管理', '#自我提升', '#高效'] },
        { platform: '快手', publishTime: '12:00-14:00, 19:00-21:00', description: '下沉用户活跃时间', tags: ['#时间管理', '#涨知识'] }
      ]
    },
    '项目综合评审': {
      scores: { topicQuality: 85, scriptQuality: 88, visualQuality: 80, publishStrategy: 82, dataExpectation: 78 },
      overall: '项目整体质量良好，选题精准，脚本结构完整。建议优化封面设计，提升视觉吸引力。',
      suggestions: ['封面可以更大字冲击', '标题可以再优化2-3个备选', '结尾互动引导加强']
    },
    default: { result: 'Mock response - 请配置真实API Key以启用AI能力' }
  };
  
  return responses[skillName] || responses.default;
}

// 调用LLM - 支持火山方舟 OpenAI 兼容接口
export async function callLLM(userId, systemPrompt, userPrompt, skillName = null) {
  const config = getLLMConfig(userId);
  
  // 拼接全局公共约束Prompt（如果有配置）
  let finalSystemPrompt = systemPrompt;
  if (config && config.global_constraint_prompt && config.global_constraint_prompt.trim()) {
    finalSystemPrompt = `【全局约束】\n${config.global_constraint_prompt}\n\n【角色设定】\n${systemPrompt}`;
  }
  
  // 如果没有配置API Key，返回mock数据
  if (!config || !config.api_key) {
    console.log('No API key configured, using mock response');
    const mockData = generateMockResponse(skillName, userPrompt);
    return {
      success: true,
      data: mockData,
      rawText: JSON.stringify(mockData, null, 2),
      tokenInput: Math.round(userPrompt.length / 2 + finalSystemPrompt.length / 2),
      tokenOutput: Math.round(JSON.stringify(mockData).length / 2),
      mock: true,
      confidence: 0.5
    };
  }
  
  // 真实API调用 - 火山方舟 OpenAI 兼容接口
  try {
    const baseUrl = config.api_endpoint || 'https://ark.cn-beijing.volces.com/api/v3';

    // 模型路由：根据任务复杂度选择主力模型或轻量模型
    const { model: modelName, tier: modelTier } = selectModelForTask(
      config, skillName, finalSystemPrompt, userPrompt
    );

    const requestBody = {
      model: modelName,
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
    };

    console.log(`[LLM] 调用火山方舟: ${baseUrl}/chat/completions | 模型: ${modelName} | 层级: ${modelTier} | 技能: ${skillName || 'agent-chat'}`);
    
    // 设置30秒超时（覆盖整个fetch+json解析过程）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.api_key}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      throw new Error(`网络请求失败: ${fetchErr.message}`);
    }

    // 解析响应（也受AbortController保护，如果超时会abort）
    let responseData;
    try {
      responseData = await response.json();
    } catch (jsonErr) {
      clearTimeout(timeoutId);
      throw new Error(`响应解析失败: ${jsonErr.message}`);
    }

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('Ark API error:', response.status, responseData);
      throw new Error(responseData.error?.message || `API请求失败 (${response.status})`);
    }
    
    const rawText = responseData.choices?.[0]?.message?.content || '';
    const usage = responseData.usage || {};
    const tokenInput = usage.prompt_tokens || Math.round((systemPrompt.length + userPrompt.length) / 2);
    const tokenOutput = usage.completion_tokens || Math.round(rawText.length / 2);
    
    // 解析返回的JSON
    const parsedData = parseJSONResponse(rawText);

    // 记录 token 用量（按模型统计）
    recordTokenUsage(userId, tokenInput, tokenOutput, modelName, modelTier);

    return {
      success: true,
      data: parsedData || rawText,
      rawText: rawText,
      tokenInput,
      tokenOutput,
      mock: false,
      confidence: 0.8,
      model: modelName,
      modelTier,
    };
    
  } catch (error) {
    console.error('LLM call error:', error.message);
    
    // 失败降级：返回mock数据
    console.log('Falling back to mock response');
    const mockData = generateMockResponse(skillName, userPrompt);
    return {
      success: true,
      data: mockData,
      rawText: JSON.stringify(mockData, null, 2),
      tokenInput: Math.round(userPrompt.length / 2 + systemPrompt.length / 2),
      tokenOutput: Math.round(JSON.stringify(mockData).length / 2),
      mock: true,
      confidence: 0.5,
      fallbackReason: error.message
    };
  }
}

// 测试LLM连接 - 不降级mock，返回真实连接结果和明确错误类型
export async function testLLMConnection(userId, testConfig = null) {
  // 支持传入临时配置（用户输入但未保存的），否则读数据库
  const config = testConfig || getLLMConfig(userId);

  if (!config || !config.api_key) {
    return {
      success: false,
      errorType: 'NO_API_KEY',
      errorMessage: '请先填写 API Key',
    };
  }

  const baseUrl = (config.api_endpoint || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '');
  const modelName = config.model_name || 'doubao-seed-2-1-pro-250615';

  const requestBody = {
    model: modelName,
    messages: [
      { role: 'system', content: '你是一个AI助手，请用简洁的语言回答问题。' },
      { role: 'user', content: '请用一句话介绍你自己。' }
    ],
    temperature: 0.7,
    max_tokens: 50,
  };

  console.log(`[Test LLM] 调用: ${baseUrl}/chat/completions, model: ${modelName}`);

  // 15秒超时（测试场景不需要太长）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    let response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.api_key}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      // AbortError 表示超时
      if (fetchErr.name === 'AbortError' || fetchErr.message.includes('aborted')) {
        return {
          success: false,
          errorType: 'TIMEOUT',
          errorMessage: '连接超时，请检查网络或接口地址',
        };
      }
      // 其他网络错误（DNS、连接失败等）
      return {
        success: false,
        errorType: 'NETWORK_ERROR',
        errorMessage: `连接失败，请检查接口地址是否正确：${fetchErr.message}`,
      };
    }

    clearTimeout(timeoutId);

    // 解析响应体
    let responseData;
    try {
      responseData = await response.json();
    } catch (jsonErr) {
      return {
        success: false,
        errorType: 'PARSE_ERROR',
        errorMessage: '响应解析失败，请检查接口地址是否正确',
      };
    }

    // 按 HTTP 状态码处理
    if (!response.ok) {
      const errorCode = responseData.error?.code || responseData.code;
      const errorMsg = responseData.error?.message || responseData.message || `HTTP ${response.status}`;

      console.error(`[Test LLM] 失败 status=${response.status}, body=`, JSON.stringify(responseData).substring(0, 300));

      // 401 - API Key 无效
      if (response.status === 401) {
        return {
          success: false,
          errorType: 'UNAUTHORIZED',
          errorMessage: 'API Key 无效或已过期',
          detail: errorMsg,
        };
      }

      // 404 - 模型接入点 ID 错误
      if (response.status === 404) {
        return {
          success: false,
          errorType: 'NOT_FOUND',
          errorMessage: '模型接入点 ID 错误，请到火山方舟控制台检查',
          detail: errorMsg,
        };
      }

      // 余额不足判断：火山方舟余额不足通常返回 400 或 429，错误码含 InsufficientBalance/QuotaExhausted
      const balanceErrorCodes = ['InsufficientBalance', 'InsufficientFunds', 'QuotaExhausted', 'BalanceExceeded', 'AccountBalanceInsufficient'];
      const balanceKeywords = ['余额不足', 'insufficient balance', 'insufficient funds', 'quota exceeded', 'balance'];
      const isBalanceError =
        balanceErrorCodes.includes(errorCode) ||
        balanceKeywords.some(k => errorMsg.toLowerCase().includes(k.toLowerCase()));

      if (isBalanceError) {
        return {
          success: false,
          errorType: 'INSUFFICIENT_BALANCE',
          errorMessage: '火山方舟账户余额不足，请充值',
          detail: errorMsg,
        };
      }

      // 429 - 频率限制
      if (response.status === 429) {
        return {
          success: false,
          errorType: 'RATE_LIMIT',
          errorMessage: '请求频率过高，请稍后再试',
          detail: errorMsg,
        };
      }

      // 400 - 其他请求错误
      if (response.status === 400) {
        return {
          success: false,
          errorType: 'BAD_REQUEST',
          errorMessage: `请求参数错误：${errorMsg}`,
        };
      }

      // 其他 5xx 服务器错误
      if (response.status >= 500) {
        return {
          success: false,
          errorType: 'SERVER_ERROR',
          errorMessage: `火山方舟服务异常（${response.status}），请稍后重试`,
          detail: errorMsg,
        };
      }

      // 未归类的错误
      return {
        success: false,
        errorType: 'UNKNOWN',
        errorMessage: `连接失败（${response.status}）：${errorMsg}`,
      };
    }

    // 成功
    const rawText = responseData.choices?.[0]?.message?.content || '';
    const usage = responseData.usage || {};

    return {
      success: true,
      response: rawText,
      tokenInput: usage.prompt_tokens || 0,
      tokenOutput: usage.completion_tokens || 0,
      model: modelName,
    };

  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[Test LLM] 未知异常:', error.message);
    return {
      success: false,
      errorType: 'UNKNOWN',
      errorMessage: `连接失败：${error.message}`,
    };
  }
}

// 预估token消耗
export function estimateTokenCost(systemPrompt, userPrompt, skillWorkflow) {
  const baseInput = systemPrompt.length / 2 + userPrompt.length / 2;
  const workflowTokens = skillWorkflow ? JSON.stringify(skillWorkflow).length / 2 : 0;
  const estimatedOutput = 2000; // 预估输出
  
  return {
    input: Math.round(baseInput + workflowTokens),
    output: estimatedOutput,
    total: Math.round(baseInput + workflowTokens + estimatedOutput)
  };
}

export default { callLLM, parseJSONResponse, getLLMConfig, checkTokenLimit, recordTokenUsage, estimateTokenCost, testLLMConnection, selectModelForTask, getTodayModelUsage };
