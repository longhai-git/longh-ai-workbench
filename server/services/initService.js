import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';

// 全局公共约束
const GLOBAL_CONSTRAINTS = `【全局通用约束】
1. 输出忠于输入素材，分析类结论必须标注原文依据，禁止无依据幻觉；无法完成则如实说明，不要编造信息。
2. 严格遵守对应Skill定义的输入输出Schema，优先使用Skill内的流程与模板。
3. 所有产出为辅助创作，关键结论需要人工复核。
4. 回答简洁，拒绝冗余铺垫，优先结构化输出。
5. 缺少必要输入条件时直接列出缺失项，不要强行生成结果。`;

// 8个智能体定义
const AGENTS = [
  {
    name: '超级IP顾问-队长',
    role: 'project_director',
    description: '项目总指挥，负责账号定位统筹、任务分派、进度跟踪、跨成员协调、质量审核。全局视角把控项目方向和团队节奏。',
    systemPrompt: '你是超级IP顾问-队长，短视频创作团队的项目总指挥。你的职责是：1. 账号定位统筹与方向把控；2. 任务分派与进度跟踪；3. 跨智能体协调与资源调度；4. 项目质量最终审核。你需要站在全局视角，确保每个项目方向正确、质量达标。沟通风格：专业、果断、有全局观。',
    avatar: '🎯'
  },
  {
    name: '选题策划-桃桃',
    role: 'topic_planner',
    description: '选题立项负责人，负责建立选题池、提交选题报告。擅长热点追踪和竞品分析，为内容创作提供方向指引。',
    systemPrompt: '你是选题策划-桃桃，短视频选题专家。你的职责是：1. 热点追踪与选题挖掘；2. 竞品选题分析与差异化定位；3. 选题方案产出与质量评估；4. 选题池维护与迭代优化。你精通短视频爆款选题逻辑，擅长从用户痛点、热点事件、竞品分析中找到优质切入点。沟通风格：敏锐、有创意、数据导向。',
    avatar: '🍑'
  },
  {
    name: '内容编剧-橘子',
    role: 'scriptwriter',
    description: '脚本策划负责人，产出母版脚本、标题、简介、标签、分镜表、拍摄清单。精通短视频叙事结构和爆款脚本技巧。',
    systemPrompt: '你是内容编剧-橘子，短视频脚本专家。你的职责是：1. 母版脚本创作（钩子+结构+金句）；2. 标题优化与多版本产出；3. 简介与标签撰写；4. 分镜脚本生成；5. 拍摄清单制作。你精通短视频叙事结构，擅长3秒钩子设计、节奏把控和情绪调动。沟通风格：有文采、懂结构、注重细节。',
    avatar: '🍊'
  },
  {
    name: '平面设计师-泡泡',
    role: 'graphic_designer',
    description: '视觉物料负责人，制作封面、视觉素材。精通短视频封面设计套路和视觉包装策略。',
    systemPrompt: '你是平面设计师-泡泡，短视频视觉设计专家。你的职责是：1. 爆款封面设计方案；2. 视觉素材创意策划；3. 封面标题文案优化；4. 视觉风格统一把控。你精通短视频封面设计套路，擅长用视觉元素吸引点击。沟通风格：有审美、懂视觉、追求品质。',
    avatar: '🫧'
  },
  {
    name: '视频分析师-小龙',
    role: 'video_analyst',
    description: '视频分析负责人，分析对标视频和已上传视频。精通6维度拆解分析。',
    systemPrompt: '你是视频分析师-小龙，短视频数据分析专家。你的职责是：1. 对标视频6维度深度拆解；2. 已发布视频数据分析；3. 爆款规律提炼总结；4. 可复用方法模板转化。你精通3S钩子、5S转折、逐段标注、叙事链条、评论区洞察、总结复用6维度分析方法。沟通风格：理性、严谨、善于提炼。',
    avatar: '🐉'
  },
  {
    name: '发行-小海',
    role: 'distributor',
    description: '平台分发负责人，负责发布策略、评论运营。精通各平台算法规则和合规要求。',
    systemPrompt: '你是发行-小海，短视频平台发行专家。你的职责是：1. 多平台发布策略优化；2. 标题标签SEO优化；3. 评论区运营与互动引导；4. 平台算法规则研究与应用；5. 发布物料全套产出。你精通抖音、快手、B站、小红书等各平台的算法规则和内容调性。沟通风格：务实、懂平台、注重效果。',
    avatar: '🌊'
  },
  {
    name: '运营-阿飞',
    role: 'operator',
    description: '数据复盘与涨粉负责人，负责数据监控、复盘报告、选题数据支持。擅长从数据中发现增长机会。',
    systemPrompt: '你是运营-阿飞，短视频数据运营专家。你的职责是：1. 视频数据监控与分析；2. 数据复盘报告产出；3. 涨粉策略制定；4. 选题数据支持；5. 优化建议输出。你擅长从播放、点赞、评论、完播率等数据中发现增长机会和问题。沟通风格：数据驱动、善于复盘、注重增长。',
    avatar: '🪁'
  },
  {
    name: 'EMOJI-直播策划',
    role: 'live_planner',
    description: '直播策划负责人（储备能力），负责直播方案设计。精通直播流程设计、话术脚本、互动设计。',
    systemPrompt: '你是EMOJI-直播策划，直播内容策划专家。你的职责是：1. 直播主题策划；2. 直播流程设计；3. 话术脚本撰写；4. 互动环节设计；5. 直播数据目标制定。（注：当前为储备能力，完整功能待后续开发）',
    avatar: '🎪'
  }
];

// 16个内置技能
const SKILLS = [
  {
    name: '爆款选题策划',
    category: 'content',
    stage: 'topic',
    description: '生成3个不同角度的选题 + 质量评分',
    workflow: JSON.stringify([
      { type: 'context', name: '收集项目信息', description: '从项目和用户档案中提取账号定位、目标人群、内容风格' },
      { type: 'llm', name: '生成选题方案', description: '基于账号定位生成3个差异化选题方向，每个包含选题名称、目标人群、核心价值、差异化切入点、预期效果' },
      { type: 'llm', name: '质量评分', description: '对每个选题从传播潜力、差异化程度、用户匹配度、可执行性4个维度打分并给出综合评分' },
      { type: 'format', name: '格式化输出', description: '整理为标准选题方案格式' }
    ]),
    inputSchema: JSON.stringify({
      type: 'object',
      required: ['projectContext'],
      properties: {
        projectContext: { type: 'string', description: '项目背景和需求描述' },
        topicType: { type: 'string', enum: ['干货', '情感', '娱乐', '资讯', '其他'], description: '选题类型偏好' }
      }
    }),
    outputSchema: JSON.stringify({
      type: 'object',
      properties: {
        topics: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              targetAudience: { type: 'string' },
              coreValue: { type: 'string' },
              differentiation: { type: 'string' },
              expectedEffect: { type: 'string' },
              scores: {
                type: 'object',
                properties: {
                  spread: { type: 'number' },
                  differentiation: { type: 'number' },
                  userMatch: { type: 'number' },
                  feasibility: { type: 'number' },
                  overall: { type: 'number' }
                }
              }
            }
          }
        }
      }
    })
  },
  {
    name: '竞品选题分析',
    category: 'content',
    stage: 'topic',
    description: '分析竞品爆款选题，提炼差异化切入点',
    workflow: JSON.stringify([
      { type: 'context', name: '收集竞品信息', description: '从对标库中提取竞品视频选题信息' },
      { type: 'llm', name: '竞品选题分析', description: '分析竞品爆款选题的共性规律、用户痛点、内容角度' },
      { type: 'llm', name: '差异化切入点', description: '基于竞品分析，提出3个差异化选题方向' },
      { type: 'format', name: '格式化输出', description: '整理为竞品分析报告格式' }
    ]),
    inputSchema: JSON.stringify({ type: 'object', required: ['benchmarkVideos'], properties: { benchmarkVideos: { type: 'array', description: '对标视频列表' } } }),
    outputSchema: JSON.stringify({ type: 'object', properties: { analysis: { type: 'string' }, patterns: { type: 'array' }, differentiation: { type: 'array' } } })
  },
  {
    name: '爆款脚本创作',
    category: 'content',
    stage: 'script',
    description: '产出完整脚本，含钩子/结构/金句',
    workflow: JSON.stringify([
      { type: 'context', name: '收集上下文', description: '提取选题信息、用户档案、创作人画像' },
      { type: 'llm', name: '设计钩子', description: '设计3秒黄金开头钩子，包含钩子类型和具体文案' },
      { type: 'llm', name: '构建叙事结构', description: '搭建脚本整体结构：开头-发展-高潮-结尾' },
      { type: 'llm', name: '撰写完整脚本', description: '逐句撰写完整脚本，标注情绪、节奏、画面提示' },
      { type: 'llm', name: '金句提炼', description: '提炼3-5个金句/爆点' },
      { type: 'format', name: '格式化输出', description: '整理为标准脚本格式' }
    ]),
    inputSchema: JSON.stringify({ type: 'object', required: ['topic'], properties: { topic: { type: 'string' }, style: { type: 'string' } } }),
    outputSchema: JSON.stringify({ type: 'object', properties: { hook: { type: 'string' }, structure: { type: 'array' }, content: { type: 'string' }, goldenQuotes: { type: 'array' } } })
  },
  {
    name: '标题优化',
    category: 'content',
    stage: 'script',
    description: '生成10个备选标题并评分',
    workflow: JSON.stringify([
      { type: 'context', name: '收集脚本内容', description: '提取脚本核心内容和主题' },
      { type: 'llm', name: '多版本标题生成', description: '从悬念型、数字型、对比型、痛点型、利益型5个角度各生成2个标题，共10个' },
      { type: 'llm', name: '标题评分排序', description: '对10个标题从点击率预估、关键词覆盖、情绪调动3个维度打分排序' },
      { type: 'format', name: '格式化输出', description: '整理为标题列表+评分格式' }
    ]),
    inputSchema: JSON.stringify({ type: 'object', required: ['scriptContent'], properties: { scriptContent: { type: 'string' } } }),
    outputSchema: JSON.stringify({ type: 'object', properties: { titles: { type: 'array' }, topPick: { type: 'string' } } })
  },
  {
    name: '爆款封面设计',
    category: 'design',
    stage: 'design',
    description: '封面设计方案 + 标题文案',
    workflow: JSON.stringify([
      { type: 'context', name: '收集信息', description: '提取视频主题、标题、内容调性' },
      { type: 'llm', name: '封面创意设计', description: '生成3套封面设计方案，包含主视觉、配色方案、标题排版、情绪氛围' },
      { type: 'llm', name: '封面标题文案', description: '为每套方案设计封面大字标题（短平快、有冲击力）' },
      { type: 'format', name: '格式化输出', description: '整理为封面设计方案格式' }
    ]),
    inputSchema: JSON.stringify({ type: 'object', required: ['topic', 'title'], properties: { topic: { type: 'string' }, title: { type: 'string' } } }),
    outputSchema: JSON.stringify({ type: 'object', properties: { designs: { type: 'array' }, recommendations: { type: 'string' } } })
  },
  {
    name: '视频拆解分析',
    category: 'analytics',
    stage: 'analysis',
    description: '6维度深度拆解对标视频',
    workflow: JSON.stringify([
      { type: 'context', name: '获取视频文案', description: '提取对标视频的完整文案/字幕内容' },
      { type: 'llm', name: '3S钩子分析', description: '分析前3秒钩子类型、原文依据、留人机制' },
      { type: 'llm', name: '5秒转折分析', description: '分析5秒处冲突/转折设计' },
      { type: 'llm', name: '逐段标注', description: '逐句/逐段标注叙事功能、节奏、情绪、剪辑提示' },
      { type: 'llm', name: '叙事链条分析', description: '梳理整体叙事结构和关键拐点' },
      { type: 'llm', name: '评论区洞察', description: '推测高赞评论、观众痛点、互动触发点' },
      { type: 'llm', name: '总结与复用', description: '提炼核心主题、价值、可复用方法' },
      { type: 'format', name: '格式化输出', description: '整理为6维度拆解报告格式' }
    ]),
    inputSchema: JSON.stringify({ type: 'object', required: ['transcript'], properties: { transcript: { type: 'string', description: '视频完整文案/字幕' } } }),
    outputSchema: JSON.stringify({ type: 'object', properties: { hookAnalysis: { type: 'object' }, conflictAnalysis: { type: 'object' }, segmentAnalysis: { type: 'array' }, narrativeChain: { type: 'object' }, commentInsights: { type: 'object' }, summary: { type: 'object' } } })
  },
  {
    name: '数据复盘分析',
    category: 'analytics',
    stage: 'data',
    description: '视频数据复盘 + 优化建议',
    workflow: JSON.stringify([
      { type: 'context', name: '收集数据', description: '提取视频各项数据指标' },
      { type: 'llm', name: '数据分析', description: '分析各项数据表现，识别亮点和问题' },
      { type: 'llm', name: '原因诊断', description: '分析数据表现背后的原因' },
      { type: 'llm', name: '优化建议', description: '提出具体可执行的优化建议' },
      { type: 'format', name: '格式化输出', description: '整理为数据复盘报告格式' }
    ]),
    inputSchema: JSON.stringify({ type: 'object', required: ['videoData'], properties: { videoData: { type: 'object' } } }),
    outputSchema: JSON.stringify({ type: 'object', properties: { overview: { type: 'string' }, highlights: { type: 'array' }, issues: { type: 'array' }, suggestions: { type: 'array' } } })
  },
  {
    name: '发布策略优化',
    category: 'distribution',
    stage: 'publish',
    description: '多平台发布时间/文案/标签策略',
    workflow: JSON.stringify([
      { type: 'context', name: '收集信息', description: '提取视频内容、目标人群、平台特性' },
      { type: 'llm', name: '发布时间策略', description: '针对各平台推荐最佳发布时间段' },
      { type: 'llm', name: '平台文案适配', description: '为每个平台生成适配的描述文案' },
      { type: 'llm', name: '标签策略', description: '推荐精准标签，包含核心标签+流量标签+长尾标签' },
      { type: 'format', name: '格式化输出', description: '整理为多平台发布策略格式' }
    ]),
    inputSchema: JSON.stringify({ type: 'object', required: ['videoInfo'], properties: { videoInfo: { type: 'object' } } }),
    outputSchema: JSON.stringify({ type: 'object', properties: { platforms: { type: 'array' } } })
  },
  {
    name: '账号定位策略',
    category: 'strategy',
    stage: null,
    description: '账号定位诊断 + 优化方案',
    workflow: JSON.stringify([
      { type: 'context', name: '收集账号信息', description: '提取用户档案、历史内容数据' },
      { type: 'llm', name: '定位诊断', description: '从差异化、用户画像、内容调性3个维度诊断当前定位' },
      { type: 'llm', name: '优化方案', description: '提出定位优化建议和实施路径' },
      { type: 'format', name: '格式化输出', description: '整理为账号定位报告格式' }
    ]),
    inputSchema: JSON.stringify({ type: 'object', required: ['profile'], properties: { profile: { type: 'object' } } }),
    outputSchema: JSON.stringify({ type: 'object', properties: { diagnosis: { type: 'object' }, optimization: { type: 'array' } } })
  },
  {
    name: '项目综合评审',
    category: 'review',
    stage: 'review',
    description: '全流程质量评审 + 打分',
    workflow: JSON.stringify([
      { type: 'context', name: '收集项目产出', description: '提取各阶段产出物：选题、脚本、封面、发布策略等' },
      { type: 'llm', name: '分维度评审', description: '从选题质量、脚本质量、视觉质量、发布策略、数据预期5个维度分别评审打分' },
      { type: 'llm', name: '综合评价', description: '给出综合评分和整体评价意见' },
      { type: 'llm', name: '改进建议', description: '列出需要改进的问题和具体建议' },
      { type: 'format', name: '格式化输出', description: '整理为项目评审报告格式' }
    ]),
    inputSchema: JSON.stringify({ type: 'object', required: ['projectData'], properties: { projectData: { type: 'object' } } }),
    outputSchema: JSON.stringify({ type: 'object', properties: { scores: { type: 'object' }, overall: { type: 'string' }, suggestions: { type: 'array' } } })
  },
  {
    name: '直播策划方案',
    category: 'live',
    stage: null,
    description: '直播主题 + 流程 + 互动设计（储备待开发）',
    workflow: JSON.stringify([{ type: 'llm', name: '直播方案生成', description: '生成完整直播策划方案' }]),
    inputSchema: JSON.stringify({ type: 'object', properties: { topic: { type: 'string' } } }),
    outputSchema: JSON.stringify({ type: 'object', properties: { plan: { type: 'object' } } })
  },
  {
    name: '评论区运营',
    category: 'operations',
    stage: 'publish',
    description: '评论回复模板 + 互动引导',
    workflow: JSON.stringify([
      { type: 'context', name: '收集视频内容', description: '提取视频主题和核心观点' },
      { type: 'llm', name: '评论回复模板', description: '生成10条常见评论的回复模板' },
      { type: 'llm', name: '互动引导策略', description: '设计置顶评论和互动引导话术' },
      { type: 'format', name: '格式化输出', description: '整理为评论运营方案格式' }
    ]),
    inputSchema: JSON.stringify({ type: 'object', required: ['videoTopic'], properties: { videoTopic: { type: 'string' } } }),
    outputSchema: JSON.stringify({ type: 'object', properties: { replyTemplates: { type: 'array' }, pinnedComment: { type: 'string' } } })
  },
  {
    name: '标签优化',
    category: 'operations',
    stage: 'publish',
    description: '标签推荐 + SEO优化',
    workflow: JSON.stringify([
      { type: 'context', name: '收集内容信息', description: '提取视频主题和关键词' },
      { type: 'llm', name: '标签推荐', description: '推荐核心标签、流量标签、长尾标签各5个' },
      { type: 'llm', name: 'SEO优化建议', description: '给出标题和描述的SEO优化建议' },
      { type: 'format', name: '格式化输出', description: '整理为标签优化方案格式' }
    ]),
    inputSchema: JSON.stringify({ type: 'object', required: ['content'], properties: { content: { type: 'string' } } }),
    outputSchema: JSON.stringify({ type: 'object', properties: { tags: { type: 'object' }, seoTips: { type: 'array' } } })
  },
  {
    name: '简介撰写',
    category: 'content',
    stage: 'script',
    description: '视频简介/描述文案',
    workflow: JSON.stringify([
      { type: 'context', name: '收集脚本内容', description: '提取脚本核心内容' },
      { type: 'llm', name: '简介撰写', description: '生成吸引点击的视频简介文案' },
      { type: 'format', name: '格式化输出', description: '整理为简介格式' }
    ]),
    inputSchema: JSON.stringify({ type: 'object', required: ['scriptContent'], properties: { scriptContent: { type: 'string' } } }),
    outputSchema: JSON.stringify({ type: 'object', properties: { description: { type: 'string' } } })
  },
  {
    name: '分镜脚本生成',
    category: 'content',
    stage: 'script',
    description: '文字转分镜表',
    workflow: JSON.stringify([
      { type: 'context', name: '获取脚本内容', description: '提取完整脚本文案' },
      { type: 'llm', name: '分镜拆解', description: '将脚本拆解为分镜表，包含镜号、时长、画面内容、台词、音效、备注' },
      { type: 'format', name: '格式化输出', description: '整理为分镜表格格式' }
    ]),
    inputSchema: JSON.stringify({ type: 'object', required: ['scriptContent'], properties: { scriptContent: { type: 'string' } } }),
    outputSchema: JSON.stringify({ type: 'object', properties: { shots: { type: 'array' } } })
  },
  {
    name: '拍摄清单生成',
    category: 'production',
    stage: null,
    description: '根据脚本生成拍摄清单',
    workflow: JSON.stringify([
      { type: 'context', name: '获取脚本和分镜', description: '提取脚本和分镜表内容' },
      { type: 'llm', name: '生成拍摄清单', description: '根据分镜表生成详细拍摄清单，包含场景、道具、服装、设备、人员、注意事项' },
      { type: 'format', name: '格式化输出', description: '整理为拍摄清单格式' }
    ]),
    inputSchema: JSON.stringify({ type: 'object', required: ['scriptContent', 'storyboard'], properties: { scriptContent: { type: 'string' }, storyboard: { type: 'array' } } }),
    outputSchema: JSON.stringify({ type: 'object', properties: { checklist: { type: 'object' } } })
  }
];

// 智能体-技能关联关系
const AGENT_SKILL_MAP = {
  '超级IP顾问-队长': ['账号定位策略', '项目综合评审'],
  '选题策划-桃桃': ['爆款选题策划', '竞品选题分析'],
  '内容编剧-橘子': ['爆款脚本创作', '标题优化', '简介撰写', '分镜脚本生成', '拍摄清单生成'],
  '平面设计师-泡泡': ['爆款封面设计'],
  '视频分析师-小龙': ['视频拆解分析'],
  '发行-小海': ['发布策略优化', '评论区运营', '标签优化'],
  '运营-阿飞': ['数据复盘分析'],
  'EMOJI-直播策划': ['直播策划方案']
};

export function initUserDefaultData(userId, username) {
  const insertAgent = db.prepare(`
    INSERT INTO agents (id, user_id, name, role, avatar, status, description, system_prompt, is_builtin, enabled)
    VALUES (?, ?, ?, ?, ?, 'idle', ?, ?, 1, 1)
  `);
  
  const insertSkill = db.prepare(`
    INSERT OR IGNORE INTO skills (id, user_id, name, category, workflow, input_schema, output_schema, version, is_global, is_builtin, enabled, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, '1.0.0', 1, 1, 1, ?)
  `);
  
  const bindSkill = db.prepare(`
    INSERT OR IGNORE INTO agent_skills (id, agent_id, skill_id, is_primary)
    VALUES (?, ?, ?, ?)
  `);
  
  // 初始化全局系统配置
  const initConfig = db.prepare('INSERT OR IGNORE INTO system_configs (key, value) VALUES (?, ?)');
  initConfig.run('global_constraints', GLOBAL_CONSTRAINTS);
  initConfig.run('pomodoro_default_work', '1500');
  initConfig.run('pomodoro_default_rest', '300');
  initConfig.run('group_chat_max_rounds', '20');
  initConfig.run('group_chat_max_agents_per_round', '3');
  
  // 创建8个智能体
  const agentIds = {};
  for (const agent of AGENTS) {
    const agentId = uuidv4();
    agentIds[agent.name] = agentId;
    insertAgent.run(agentId, userId, agent.name, agent.role, agent.avatar, agent.description, agent.systemPrompt);
  }
  
  // 创建16个内置技能（全局技能，只创建一次）
  const skillIds = {};
  for (const skill of SKILLS) {
    const existing = db.prepare('SELECT id FROM skills WHERE name = ? AND is_global = 1').get(skill.name);
    if (existing) {
      skillIds[skill.name] = existing.id;
    } else {
      const skillId = uuidv4();
      skillIds[skill.name] = skillId;
      insertSkill.run(skillId, null, skill.name, skill.category, skill.workflow, skill.inputSchema, skill.outputSchema, skill.description);
    }
  }
  
  // 为智能体绑定技能
  for (const [agentName, skillNames] of Object.entries(AGENT_SKILL_MAP)) {
    const agentId = agentIds[agentName];
    if (agentId) {
      skillNames.forEach((skillName, index) => {
        const skillId = skillIds[skillName];
        if (skillId) {
          bindSkill.run(uuidv4(), agentId, skillId, index === 0 ? 1 : 0);
        }
      });
    }
  }
  
  // 初始化用户档案
  db.prepare(`INSERT OR IGNORE INTO user_profiles (id, user_id) VALUES (?, ?)`)
    .run(uuidv4(), userId);
  
  // 初始化大模型配置
  db.prepare(`INSERT OR IGNORE INTO llm_configs (id, user_id) VALUES (?, ?)`)
    .run(uuidv4(), userId);
  
  // 初始化番茄时钟
  db.prepare(`INSERT OR IGNORE INTO pomodoro_records (id, user_id) VALUES (?, ?)`)
    .run(uuidv4(), userId);
  
  // 创建初始欢迎消息
  db.prepare(`INSERT INTO messages (id, user_id, type, title, content) VALUES (?, ?, ?, ?, ?)`)
    .run(uuidv4(), userId, 'system', '欢迎使用LongH AI工作台', 
      `欢迎 ${username}！这是你的短视频AI创作工作台。\n\n你可以：\n• 在项目看板中创建新的视频项目\n• 使用AI智能体团队协助内容创作\n• 在对标库中分析优秀视频\n• 在知识库中沉淀你的创作经验\n\n祝你创作愉快！`);
  
  console.log(`Initialized default data for user: ${username}`);
}

// 仅初始化/重置智能体（用于修复没有智能体的账号）
export function initUserDefaultAgentsOnly(userId, username) {
  const insertAgent = db.prepare(`
    INSERT INTO agents (id, user_id, name, role, avatar, status, description, system_prompt, is_builtin, enabled)
    VALUES (?, ?, ?, ?, ?, 'idle', ?, ?, 1, 1)
  `);
  
  const insertSkill = db.prepare(`
    INSERT OR IGNORE INTO skills (id, user_id, name, category, workflow, input_schema, output_schema, version, is_global, is_builtin, enabled, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, '1.0.0', 1, 1, 1, ?)
  `);
  
  const bindSkill = db.prepare(`
    INSERT OR IGNORE INTO agent_skills (id, agent_id, skill_id, is_primary)
    VALUES (?, ?, ?, ?)
  `);
  
  // 1. 创建16个内置技能（全局技能，只创建一次）
  const skillIds = {};
  for (const skill of SKILLS) {
    const existing = db.prepare('SELECT id FROM skills WHERE name = ? AND is_global = 1').get(skill.name);
    if (existing) {
      skillIds[skill.name] = existing.id;
    } else {
      const skillId = uuidv4();
      skillIds[skill.name] = skillId;
      insertSkill.run(skillId, null, skill.name, skill.category, skill.workflow, skill.inputSchema, skill.outputSchema, skill.description);
    }
  }
  
  // 2. 检查已有智能体数量
  const existingAgents = db.prepare('SELECT id, name, role FROM agents WHERE user_id = ?').all(userId);
  const existingAgentMap = {};
  for (const a of existingAgents) {
    existingAgentMap[a.name] = a;
  }
  
  let createdCount = 0;
  
  // 3. 创建缺失的智能体
  const agentIds = {};
  for (const agent of AGENTS) {
    if (existingAgentMap[agent.name]) {
      agentIds[agent.name] = existingAgentMap[agent.name].id;
    } else {
      const agentId = uuidv4();
      agentIds[agent.name] = agentId;
      insertAgent.run(agentId, userId, agent.name, agent.role, agent.avatar, agent.description, agent.systemPrompt);
      createdCount++;
    }
  }
  
  // 4. 为所有智能体补绑定技能（INSERT OR IGNORE 保证已绑定的不会重复）
  for (const [agentName, skillNames] of Object.entries(AGENT_SKILL_MAP)) {
    const agentId = agentIds[agentName];
    if (agentId) {
      // 先检查是否已有主技能
      const hasPrimary = db.prepare('SELECT COUNT(*) as c FROM agent_skills WHERE agent_id = ? AND is_primary = 1').get(agentId).c > 0;
      
      skillNames.forEach((skillName, index) => {
        const skillId = skillIds[skillName];
        if (skillId) {
          const isPrimary = !hasPrimary && index === 0 ? 1 : 0;
          bindSkill.run(uuidv4(), agentId, skillId, isPrimary);
        }
      });
    }
  }
  
  console.log(`Reset default agents for user: ${username} (${createdCount} created, skills bound)`);
  return createdCount;
}

export default { initUserDefaultData, initUserDefaultAgentsOnly };
