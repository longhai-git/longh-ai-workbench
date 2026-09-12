import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 数据库连接：优先 Turso 远程，失败则降级到本地 SQLite
let db;
let usingLocalFallback = false;

// 预加载模块（顶层 await，ES模块支持）
let LibSQL = null;
let BetterSQLite3 = null;

try {
  LibSQL = (await import('libsql')).default;
} catch (e) {
  console.log('libsql module not available');
}

try {
  BetterSQLite3 = (await import('better-sqlite3')).default;
} catch (e) {
  console.log('better-sqlite3 module not available');
}

// 本地 SQLite 初始化函数
function createLocalSQLite() {
  if (!BetterSQLite3) {
    throw new Error('better-sqlite3 is not installed');
  }

  const DB_PATH = process.env.DB_PATH
    ? (path.isAbsolute(process.env.DB_PATH) ? process.env.DB_PATH : path.join(__dirname, process.env.DB_PATH))
    : path.join(__dirname, 'data', 'workbench.db');

  const DB_DIR = path.dirname(DB_PATH);
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const localDb = new BetterSQLite3(DB_PATH);
  localDb.pragma('journal_mode = WAL');
  localDb.pragma('foreign_keys = ON');
  console.log('Connected to local SQLite database:', DB_PATH);
  return localDb;
}

if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN && LibSQL) {
  // 生产模式: 尝试连接 Turso 远程数据库
  try {
    const dbUrl = process.env.TURSO_DATABASE_URL.startsWith('libsql://')
      ? process.env.TURSO_DATABASE_URL
      : `libsql://${process.env.TURSO_DATABASE_URL}`;
    const tursoDb = new LibSQL(dbUrl, {
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    // 测试连接是否真的可用
    let tursoOk = false;
    try {
      tursoDb.prepare('SELECT 1 as test').get();
      tursoOk = true;
      console.log('Connected to Turso remote database:', dbUrl);
    } catch (testErr) {
      console.error('Turso connection test failed, falling back to local SQLite:', testErr.message);
    }

    if (tursoOk) {
      db = tursoDb;
    } else {
      console.log('Falling back to local SQLite database...');
      db = createLocalSQLite();
      usingLocalFallback = true;
    }
  } catch (e) {
    console.error('Failed to initialize Turso, falling back to local SQLite:', e.message);
    db = createLocalSQLite();
    usingLocalFallback = true;
  }
} else if (process.env.LIBSQL_URL && LibSQL) {
  // 兼容 libsql 本地/远程模式
  db = new LibSQL(process.env.LIBSQL_URL, {
    authToken: process.env.LIBSQL_AUTH_TOKEN,
  });
  console.log('Connected to libSQL database:', process.env.LIBSQL_URL);
} else {
  // 本地开发模式: 使用 better-sqlite3
  db = createLocalSQLite();
}

// 辅助函数：添加缺失的列
function addColumnIfMissing(tableName, columnName, columnDef) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = columns.some(col => col.name === columnName);
  if (!hasColumn) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`).run();
    console.log(`Added column ${columnName} to ${tableName}`);
  }
}

// 用户表
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 认证令牌表
db.exec(`
CREATE TABLE IF NOT EXISTS auth_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

// 项目表
db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  current_stage TEXT DEFAULT 'topic',
  status TEXT DEFAULT 'active',
  auto_flow INTEGER DEFAULT 0,
  quality_gate_score REAL DEFAULT 60,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

// 阶段表
db.exec(`
CREATE TABLE IF NOT EXISTS stages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  status TEXT DEFAULT 'pending',
  output TEXT,
  output_file TEXT,
  agent_id TEXT,
  started_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
)`);

// 评审表
db.exec(`
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  author_id TEXT,
  author_name TEXT,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'comment',
  score REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
)`);

// 选题池
db.exec(`
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'candidate',
  type TEXT,
  source TEXT,
  target_audience TEXT,
  differentiation TEXT,
  quality_score REAL,
  content TEXT,
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
)`);

// 脚本库
db.exec(`
CREATE TABLE IF NOT EXISTS scripts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'full',
  status TEXT DEFAULT 'draft',
  hook TEXT,
  content TEXT,
  content_file TEXT,
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
)`);

// 素材库
db.exec(`
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER DEFAULT 0,
  format TEXT,
  file_path TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
)`);

// 视频库
db.exec(`
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  grade TEXT DEFAULT 'C',
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  favorites INTEGER DEFAULT 0,
  click_rate REAL,
  completion_rate REAL,
  platform TEXT,
  publish_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
)`);

// 智能体表
db.exec(`
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar TEXT,
  status TEXT DEFAULT 'idle',
  description TEXT,
  system_prompt TEXT,
  is_builtin INTEGER DEFAULT 1,
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 智能体表字段迁移（增量添加）
try {
  const cols = db.prepare("PRAGMA table_info(agents)").all();
  const colNames = cols.map(c => c.name);
  if (!colNames.includes('current_action')) {
    db.prepare("ALTER TABLE agents ADD COLUMN current_action TEXT").run();
  }
  if (!colNames.includes('current_task_id')) {
    db.prepare("ALTER TABLE agents ADD COLUMN current_task_id TEXT").run();
  }
  if (!colNames.includes('override_model')) {
    db.prepare("ALTER TABLE agents ADD COLUMN override_model TEXT").run();
  }
  if (!colNames.includes('failure_strategy')) {
    db.prepare("ALTER TABLE agents ADD COLUMN failure_strategy TEXT DEFAULT 'retry'").run();
  }
  if (!colNames.includes('retry_count')) {
    db.prepare("ALTER TABLE agents ADD COLUMN retry_count INTEGER DEFAULT 0").run();
  }
} catch (e) {
  console.log('Agents table migration skipped:', e.message);
}

// 智能体技能关联表
db.exec(`
CREATE TABLE IF NOT EXISTS agent_skills (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
  UNIQUE(agent_id, skill_id)
)`);

// 技能库
db.exec(`
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  category TEXT,
  workflow TEXT,
  input_schema TEXT,
  output_schema TEXT,
  version TEXT DEFAULT '1.0.0',
  is_global INTEGER DEFAULT 0,
  is_builtin INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME
)`);

// 技能执行记录
db.exec(`
CREATE TABLE IF NOT EXISTS skill_runs (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  agent_id TEXT,
  user_id TEXT NOT NULL,
  project_id TEXT,
  status TEXT DEFAULT 'pending',
  input_data TEXT,
  output_data TEXT,
  step_logs TEXT,
  error_message TEXT,
  token_input INTEGER DEFAULT 0,
  token_output INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  confidence REAL,
  skill_version TEXT,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (skill_id) REFERENCES skills(id),
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
)`);

// 消息表
db.exec(`
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  is_read INTEGER DEFAULT 0,
  project_id TEXT,
  related_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
)`);

// 日历事件
db.exec(`
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  type TEXT,
  project_id TEXT,
  project_name TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
)`);

// 用户档案
db.exec(`
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  account_positioning TEXT,
  target_audience TEXT,
  content_style TEXT,
  topic_preferences TEXT,
  custom_fields TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

// 大模型配置
db.exec(`
CREATE TABLE IF NOT EXISTS llm_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  provider TEXT DEFAULT 'doubao',
  api_key TEXT,
  api_endpoint TEXT,
  model_name TEXT,
  daily_token_limit INTEGER DEFAULT 500000,
  daily_token_used INTEGER DEFAULT 0,
  last_reset_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

// llm_configs 字段迁移
try {
  const cols = db.prepare("PRAGMA table_info(llm_configs)").all();
  const colNames = cols.map(c => c.name);
  if (!colNames.includes('global_constraint_prompt')) {
    db.prepare("ALTER TABLE llm_configs ADD COLUMN global_constraint_prompt TEXT").run();
  }
} catch (e) {
  console.log('LLM configs migration skipped:', e.message);
}

// 对标视频
db.exec(`
CREATE TABLE IF NOT EXISTS benchmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  url TEXT,
  title TEXT NOT NULL,
  author TEXT,
  transcript TEXT,
  transcript_file TEXT,
  analysis_report TEXT,
  analysis_file TEXT,
  analysis_status TEXT DEFAULT 'pending',
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

// 对标模板
db.exec(`
CREATE TABLE IF NOT EXISTS benchmark_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  benchmark_id TEXT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT,
  used_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (benchmark_id) REFERENCES benchmarks(id) ON DELETE SET NULL
)`);

// 知识条目
db.exec(`
CREATE TABLE IF NOT EXISTS knowledge_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  source TEXT,
  value_analysis TEXT,
  is_pinned INTEGER DEFAULT 0,
  confidence REAL,
  tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

// 知识对话
db.exec(`
CREATE TABLE IF NOT EXISTS knowledge_chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  extracted_entries TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

// 创作人画像
db.exec(`
CREATE TABLE IF NOT EXISTS creator_profile (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  dimension TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  source TEXT,
  confidence REAL DEFAULT 0.5,
  evidence TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

// 异步任务队列
db.exec(`
CREATE TABLE IF NOT EXISTS task_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  payload TEXT,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  result TEXT,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME
)`);

// 审计日志
db.exec(`
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  operate_type TEXT NOT NULL,
  related_id TEXT,
  detail TEXT,
  operate_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 番茄时钟记录
db.exec(`
CREATE TABLE IF NOT EXISTS pomodoro_records (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'stop',
  total_duration INTEGER DEFAULT 0,
  remain_seconds INTEGER DEFAULT 1500,
  work_duration_cfg INTEGER DEFAULT 1500,
  rest_duration_cfg INTEGER DEFAULT 300,
  alarm_work_asset_id TEXT,
  alarm_rest_asset_id TEXT,
  started_at DATETIME,
  paused_at DATETIME,
  paused_mode TEXT,
  completed_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`);

// 番茄时钟表字段迁移（增量添加）
try {
  const pCols = db.prepare("PRAGMA table_info(pomodoro_records)").all();
  const pColNames = pCols.map(c => c.name);
  if (!pColNames.includes('paused_mode')) {
    db.prepare("ALTER TABLE pomodoro_records ADD COLUMN paused_mode TEXT").run();
  }
  if (!pColNames.includes('completed_count')) {
    db.prepare("ALTER TABLE pomodoro_records ADD COLUMN completed_count INTEGER DEFAULT 0").run();
  }
} catch (e) {
  console.log('Pomodoro table migration skipped:', e.message);
}

// 智能体工作群主会话
db.exec(`
CREATE TABLE IF NOT EXISTS agent_group_chat (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  project_id TEXT,
  mode TEXT DEFAULT 'discussion',
  max_rounds INTEGER DEFAULT 20,
  current_round INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
)`);

// 工作群消息表
db.exec(`
CREATE TABLE IF NOT EXISTS agent_group_messages (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  sender_id TEXT,
  sender_name TEXT,
  content TEXT NOT NULL,
  mention_agent_ids TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES agent_group_chat(id) ON DELETE CASCADE
)`);

// 自媒体平台API配置
db.exec(`
CREATE TABLE IF NOT EXISTS platform_api_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform_name TEXT NOT NULL,
  api_credential TEXT,
  status TEXT DEFAULT 'inactive',
  sync_switch INTEGER DEFAULT 0,
  last_sync_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, platform_name)
)`);

// 全局公共约束配置
db.exec(`
CREATE TABLE IF NOT EXISTS system_configs (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

console.log('Database initialized successfully');

export default db;
