export interface User {
  id: string
  username: string
  avatar: string | null
  role: string
}

export interface Project {
  id: string
  title: string
  description?: string
  current_stage: string
  status: string
  auto_flow: number
  quality_gate_score: number
  created_at: string
  updated_at: string
}

export interface Stage {
  id: string
  project_id: string
  code: string
  name: string
  role?: string
  status: string
  output?: string
  agent_id?: string
  started_at?: string
  completed_at?: string
}

export interface Review {
  id: string
  stage_id: string
  project_id: string
  author_id?: string
  author_name?: string
  content: string
  type: string
  score?: number
  created_at: string
}

export interface Topic {
  id: string
  name: string
  status: string
  type?: string
  source?: string
  target_audience?: string
  differentiation?: string
  quality_score?: number
  content?: string
  project_id?: string
  version: number
  created_at: string
  updated_at: string
}

export interface Script {
  id: string
  title: string
  type: string
  status: string
  hook?: string
  content?: string
  project_id?: string
  version: number
  created_at: string
  updated_at: string
}

export interface Video {
  id: string
  title: string
  grade: string
  views: number
  likes: number
  comments: number
  shares: number
  favorites: number
  click_rate?: number
  completion_rate?: number
  platform?: string
  publish_date?: string
  project_id?: string
  created_at: string
}

export interface Asset {
  id: string
  name: string
  type: string
  size: number
  format?: string
  file_path: string
  description?: string
  project_id?: string
  created_at: string
}

export interface Agent {
  id: string
  name: string
  role: string
  avatar?: string
  status: string
  current_action?: string
  current_task_id?: string
  description?: string
  system_prompt?: string
  is_builtin: number
  enabled: number
  failure_strategy?: string
  override_model?: string
  skills?: Skill[]
  todayRuns?: number
  runStats?: {
    totalRuns: number
    successRuns: number
    failedRuns: number
    totalTokens: number
    failureRate: number
  }
  recentRuns?: SkillRun[]
}

export interface Skill {
  id: string
  name: string
  category: string
  workflow?: string
  input_schema?: string
  output_schema?: string
  version: string
  is_global: number
  is_builtin: number
  enabled: number
  description?: string
  is_primary?: number
}

export interface SkillRun {
  id: string
  skill_id: string
  agent_id?: string
  status: string
  input_data?: string
  output_data?: string
  step_logs?: string
  error_message?: string
  token_input: number
  token_output: number
  retry_count: number
  confidence?: number
  skill_version: string
  duration_ms?: number
  created_at: string
  completed_at?: string
  skill_name?: string
  agent_name?: string
}

export interface Benchmark {
  id: string
  url?: string
  title: string
  author?: string
  transcript?: string
  analysis_report?: string
  analysis_status: string
  views: number
  likes: number
  duration_seconds?: number
  created_at: string
  updated_at: string
}

export interface KnowledgeEntry {
  id: string
  category: string
  title: string
  content?: string
  source?: string
  value_analysis?: string
  is_pinned: number
  confidence?: number
  tags?: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  type: string
  title: string
  content?: string
  is_read: number
  project_id?: string
  related_id?: string
  created_at: string
}

export interface CalendarEvent {
  id: string
  date: string
  title: string
  type?: string
  project_id?: string
  project_name?: string
  description?: string
}

export interface PomodoroRecord {
  id: string
  status: string
  total_duration: number
  remain_seconds: number
  work_duration_cfg: number
  rest_duration_cfg: number
  alarm_work_asset_id?: string
  alarm_rest_asset_id?: string
  started_at?: string
  paused_at?: string
  paused_mode?: string
  completed_count?: number
  just_completed?: string
}

export interface GroupChat {
  id: string
  title: string
  status: string
  project_id?: string
  mode: string
  max_rounds: number
  current_round: number
  created_at: string
  message_count?: number
}

export interface GroupMessage {
  id: string
  group_id: string
  sender_type: string
  sender_id?: string
  sender_name?: string
  content: string
  mention_agent_ids?: string
  created_at: string
}
