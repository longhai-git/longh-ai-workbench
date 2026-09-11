import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { callLLM, parseJSONResponse, checkTokenLimit, recordTokenUsage, estimateTokenCost } from './llmService.js';

// 获取全局公共约束
function getGlobalConstraints() {
  const config = db.prepare("SELECT value FROM system_configs WHERE key = 'global_constraints'").get();
  return config ? config.value : '';
}

// 获取技能详情
export function getSkillById(skillId) {
  return db.prepare('SELECT * FROM skills WHERE id = ? AND enabled = 1').get(skillId);
}

// 获取智能体的system prompt
function getAgentSystemPrompt(agentId) {
  const agent = db.prepare('SELECT system_prompt, name FROM agents WHERE id = ?').get(agentId);
  return agent ? agent.system_prompt || '' : '';
}

// 收集上下文
function collectContext(step, inputData, userId, projectId) {
  let context = '';
  
  // 如果是项目相关，收集项目信息
  if (projectId) {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (project) {
      context += `【项目信息】\n项目名称：${project.title}\n项目描述：${project.description || '无'}\n当前阶段：${project.current_stage}\n\n`;
    }
  }
  
  // 收集用户档案
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
  if (profile) {
    context += `【用户档案】\n账号定位：${profile.account_positioning || '未设置'}\n目标人群：${profile.target_audience || '未设置'}\n内容风格：${profile.content_style || '未设置'}\n\n`;
  }
  
  return context;
}

// 执行技能
export async function executeSkill(skillId, inputData, userId, agentId = null, projectId = null) {
  const skill = getSkillById(skillId);
  if (!skill) {
    return { success: false, error: '技能不存在或已禁用' };
  }
  
  const runId = uuidv4();
  const startTime = Date.now();
  
  // 初始化执行记录
  db.prepare(`
    INSERT INTO skill_runs (id, skill_id, agent_id, user_id, project_id, status, input_data, skill_version, created_at)
    VALUES (?, ?, ?, ?, ?, 'running', ?, ?, CURRENT_TIMESTAMP)
  `).run(runId, skillId, agentId, userId, projectId, JSON.stringify(inputData), skill.version);
  
  try {
    const workflow = JSON.parse(skill.workflow || '[]');
    const globalConstraints = getGlobalConstraints();
    const agentPrompt = agentId ? getAgentSystemPrompt(agentId) : '';
    
    let stepLogs = [];
    let accumulatedOutput = '';
    let totalTokenInput = 0;
    let totalTokenOutput = 0;
    let finalResult = null;
    
    // 预估token并检查限额
    const estimate = estimateTokenCost(agentPrompt + globalConstraints, JSON.stringify(inputData), workflow);
    const limitCheck = checkTokenLimit(userId, estimate.total);
    if (!limitCheck.ok) {
      throw new Error(`今日Token用量已达上限 (${limitCheck.used}/${limitCheck.limit})`);
    }
    
    for (let i = 0; i < workflow.length; i++) {
      const step = workflow[i];
      const stepStartTime = Date.now();
      let stepResult = { step: step.name, type: step.type, status: 'success' };
      
      try {
        if (step.type === 'context') {
          // 上下文收集步骤
          const context = collectContext(step, inputData, userId, projectId);
          accumulatedOutput = context;
          stepResult.output = `收集到 ${context.length} 字上下文信息`;
          
        } else if (step.type === 'llm') {
          // LLM调用步骤
          const systemPrompt = `${globalConstraints}\n\n【角色设定】\n${agentPrompt}\n\n【任务说明】\n${step.description}`;
          const userPrompt = `【输入数据】\n${JSON.stringify(inputData, null, 2)}\n\n【已收集信息】\n${accumulatedOutput}\n\n请完成以下任务：${step.description}`;
          
          // 截断过长的上下文，防止token爆炸
          let truncatedPrompt = userPrompt;
          if (truncatedPrompt.length > 8000) {
            truncatedPrompt = truncatedPrompt.substring(0, 8000) + '\n...(内容已截断)';
          }
          
          const llmResult = await callLLM(userId, systemPrompt, truncatedPrompt, skill.name);
          
          if (!llmResult.success) {
            throw new Error(llmResult.error || 'LLM调用失败');
          }
          
          totalTokenInput += llmResult.tokenInput;
          totalTokenOutput += llmResult.tokenOutput;
          
          const parsedData = parseJSONResponse(llmResult.rawText);
          accumulatedOutput = llmResult.rawText;
          finalResult = parsedData || llmResult.data;
          
          stepResult.tokenInput = llmResult.tokenInput;
          stepResult.tokenOutput = llmResult.tokenOutput;
          stepResult.confidence = llmResult.confidence;
          stepResult.mock = llmResult.mock;
          
        } else if (step.type === 'format') {
          // 格式化输出步骤
          stepResult.output = '格式化完成';
        }
        
      } catch (stepError) {
        stepResult.status = 'failed';
        stepResult.error = stepError.message;
        
        // 失败策略：重试/跳过/终止
        const failStrategy = step.failStrategy || 'retry';
        
        if (failStrategy === 'retry' && stepResult.retryCount < 2) {
          stepResult.retryCount = (stepResult.retryCount || 0) + 1;
          i--; // 重试当前步骤
          continue;
        } else if (failStrategy === 'skip') {
          stepResult.status = 'skipped';
          stepLogs.push(stepResult);
          continue;
        } else {
          throw stepError;
        }
      }
      
      stepResult.durationMs = Date.now() - stepStartTime;
      stepLogs.push(stepResult);
    }
    
    const duration = Date.now() - startTime;
    
    // 记录token消耗
    recordTokenUsage(userId, totalTokenInput, totalTokenOutput);
    
    // 更新执行记录
    db.prepare(`
      UPDATE skill_runs 
      SET status = 'completed', output_data = ?, step_logs = ?, 
          token_input = ?, token_output = ?, confidence = ?,
          duration_ms = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      JSON.stringify(finalResult),
      JSON.stringify(stepLogs),
      totalTokenInput,
      totalTokenOutput,
      stepLogs.find(s => s.confidence)?.confidence || 0.7,
      duration,
      runId
    );
    
    return {
      success: true,
      runId,
      result: finalResult,
      stepLogs,
      tokenInput: totalTokenInput,
      tokenOutput: totalTokenOutput,
      durationMs: duration
    };
    
  } catch (error) {
    console.error('Skill execution error:', error);
    
    db.prepare(`
      UPDATE skill_runs 
      SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(error.message, runId);
    
    return {
      success: false,
      runId,
      error: error.message
    };
  }
}

// 获取技能执行记录
export function getSkillRuns(userId, options = {}) {
  const { limit = 20, offset = 0, skillId, status } = options;
  
  let query = 'SELECT sr.*, s.name as skill_name, a.name as agent_name FROM skill_runs sr LEFT JOIN skills s ON sr.skill_id = s.id LEFT JOIN agents a ON sr.agent_id = a.id WHERE sr.user_id = ?';
  const params = [userId];
  
  if (skillId) {
    query += ' AND sr.skill_id = ?';
    params.push(skillId);
  }
  if (status) {
    query += ' AND sr.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY sr.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  return db.prepare(query).all(...params);
}

// 获取技能统计
export function getSkillStats(userId) {
  const totalRuns = db.prepare('SELECT COUNT(*) as count FROM skill_runs WHERE user_id = ?').get(userId).count;
  const successRuns = db.prepare("SELECT COUNT(*) as count FROM skill_runs WHERE user_id = ? AND status = 'completed'").get(userId).count;
  const failedRuns = db.prepare("SELECT COUNT(*) as count FROM skill_runs WHERE user_id = ? AND status = 'failed'").get(userId).count;
  const totalTokenInput = db.prepare('SELECT COALESCE(SUM(token_input), 0) as total FROM skill_runs WHERE user_id = ?').get(userId).total;
  const totalTokenOutput = db.prepare('SELECT COALESCE(SUM(token_output), 0) as total FROM skill_runs WHERE user_id = ?').get(userId).total;
  
  // 按技能统计
  const bySkill = db.prepare(`
    SELECT s.name, s.id, COUNT(*) as runs,
           SUM(CASE WHEN sr.status = 'completed' THEN 1 ELSE 0 END) as success,
           SUM(CASE WHEN sr.status = 'failed' THEN 1 ELSE 0 END) as failed,
           COALESCE(SUM(sr.token_input + sr.token_output), 0) as total_tokens,
           COALESCE(AVG(sr.duration_ms), 0) as avg_duration
    FROM skill_runs sr
    JOIN skills s ON sr.skill_id = s.id
    WHERE sr.user_id = ?
    GROUP BY s.id
    ORDER BY runs DESC
  `).all(userId);
  
  return {
    totalRuns,
    successRuns,
    failedRuns,
    successRate: totalRuns > 0 ? Math.round(successRuns / totalRuns * 100) : 0,
    totalTokenInput,
    totalTokenOutput,
    totalTokens: totalTokenInput + totalTokenOutput,
    bySkill
  };
}

export default { executeSkill, getSkillById, getSkillRuns, getSkillStats };
