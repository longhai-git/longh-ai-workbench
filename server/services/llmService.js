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

// 记录token消耗
export function recordTokenUsage(userId, inputTokens, outputTokens) {
  const today = new Date().toISOString().split('T')[0];
  const config = getLLMConfig(userId);
  
  if (config.last_reset_date !== today) {
    db.prepare('UPDATE llm_configs SET daily_token_used = ?, last_reset_date = ? WHERE user_id = ?')
      .run(inputTokens + outputTokens, today, userId);
  } else {
    db.prepare('UPDATE llm_configs SET daily_token_used = daily_token_used + ? WHERE user_id = ?')
      .run(inputTokens + outputTokens, userId);
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
    const modelName = config.model_name || 'doubao-seed-2-1-pro-250615';
    
    const requestBody = {
      model: modelName,
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
    };
    
    console.log(`Calling Volcengine Ark API: ${baseUrl}/chat/completions, model: ${modelName}`);
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.api_key}`,
      },
      body: JSON.stringify(requestBody),
    });
    
    const responseData = await response.json();
    
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
    
    return {
      success: true,
      data: parsedData || rawText,
      rawText: rawText,
      tokenInput,
      tokenOutput,
      mock: false,
      confidence: 0.8
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

export default { callLLM, parseJSONResponse, getLLMConfig, checkTokenLimit, recordTokenUsage, estimateTokenCost };
