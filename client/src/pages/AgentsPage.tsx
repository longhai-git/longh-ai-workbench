import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Sparkles, Users, Zap, Activity, RefreshCw, Plus, X, Edit2, Save, Trash2, Package, Check, Loader2, Star, StarOff, BarChart3, AlertTriangle, Clock, FileText } from 'lucide-react'
import api from '@/services/api'
import { getStatusColor, getStatusText, cn } from '@/utils'
import ImageUpload from '@/components/ImageUpload'
import type { Agent, Skill, SkillRun } from '@/types'

const agentColors: Record<string, string> = {
  project_director: 'from-indigo-500 to-purple-600',
  topic_planner: 'from-pink-500 to-rose-500',
  scriptwriter: 'from-orange-500 to-amber-500',
  graphic_designer: 'from-cyan-500 to-blue-500',
  video_analyst: 'from-emerald-500 to-teal-500',
  distributor: 'from-blue-500 to-indigo-500',
  operator: 'from-green-500 to-emerald-500',
  live_planner: 'from-fuchsia-500 to-pink-500',
  custom: 'from-gray-500 to-gray-700',
}

const roleLabels: Record<string, string> = {
  project_director: '项目总指挥',
  topic_planner: '选题立项负责人',
  scriptwriter: '脚本策划负责人',
  graphic_designer: '视觉物料负责人',
  video_analyst: '视频分析负责人',
  distributor: '平台分发负责人',
  operator: '数据复盘与涨粉负责人',
  live_planner: '直播策划负责人',
  custom: '自定义角色',
}

const roleOptions = [
  { value: 'project_director', label: '项目总指挥' },
  { value: 'topic_planner', label: '选题立项负责人' },
  { value: 'scriptwriter', label: '脚本策划负责人' },
  { value: 'graphic_designer', label: '视觉物料负责人' },
  { value: 'video_analyst', label: '视频分析负责人' },
  { value: 'distributor', label: '平台分发负责人' },
  { value: 'operator', label: '数据复盘与涨粉负责人' },
  { value: 'live_planner', label: '直播策划负责人' },
  { value: 'custom', label: '自定义角色' },
]

const failureStrategyOptions = [
  { value: 'retry', label: '自动重试', desc: '失败后自动重试，最多3次' },
  { value: 'skip', label: '跳过该步骤', desc: '失败后跳过并继续下一步' },
  { value: 'terminate', label: '终止任务', desc: '失败后立即终止并报错' },
]

function isImageAvatar(avatar?: string) {
  return !!avatar && (avatar.startsWith('/uploads/') || avatar.startsWith('http'))
}

function renderAvatar(agent: Agent, size: string = 'w-14 h-14 text-2xl') {
  const colorClass = agentColors[agent.role] || agentColors.custom
  if (isImageAvatar(agent.avatar)) {
    return (
      <div className={cn(size, 'rounded-2xl overflow-hidden bg-gray-100 shadow-lg')}>
        <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className={cn(size, `rounded-2xl bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-lg`)}>
      {agent.avatar || <Bot className="w-1/2 h-1/2" />}
    </div>
  )
}

// 状态文案
function getStatusBadge(status?: string) {
  const map: Record<string, { label: string; className: string; dot: string }> = {
    idle: { label: '空闲', className: 'bg-green-50 text-green-600', dot: 'bg-green-400' },
    busy: { label: '工作中', className: 'bg-amber-50 text-amber-600', dot: 'bg-amber-400' },
    reviewing: { label: '评审中', className: 'bg-blue-50 text-blue-600', dot: 'bg-blue-400' },
    waiting_confirm: { label: '待确认', className: 'bg-purple-50 text-purple-600', dot: 'bg-purple-400' },
    error: { label: '异常', className: 'bg-red-50 text-red-600', dot: 'bg-red-400' },
    offline: { label: '离线', className: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
  }
  return map[status || 'idle'] || map.idle
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = useCallback(async () => {
    try {
      const res: any = await api.get('/agents')
      setAgents(res.agents || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleResetAgents = async () => {
    if (!confirm('确定要恢复默认的8个AI智能体吗？\n技能绑定也会一并恢复。')) return
    setRestoring(true)
    try {
      await api.post('/agents/reset-defaults')
      await fetchAgents()
    } catch (e) {
      console.error(e)
      alert('恢复失败')
    } finally {
      setRestoring(false)
    }
  }

  const handleCreateAgent = () => {
    setEditingAgent(null)
    setShowEditModal(true)
  }

  const handleEditAgent = (agent: Agent, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedAgent(null)
    setEditingAgent(agent)
    setShowEditModal(true)
  }

  const handleDeleteAgent = async (agent: Agent, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`确定要删除智能体"${agent.name}"吗？`)) return
    try {
      await api.delete(`/agents/${agent.id}`)
      await fetchAgents()
      setSelectedAgent(null)
    } catch (err: any) {
      alert(err.error || '删除失败')
    }
  }

  const handleSaveAgent = async (data: any) => {
    setSaving(true)
    try {
      if (editingAgent) {
        await api.put(`/agents/${editingAgent.id}`, data)
      } else {
        const res: any = await api.post('/agents', data)
        if (res.id && data.avatar && data.avatar.startsWith('/uploads/')) {
          await api.put(`/agents/${res.id}`, { avatar: data.avatar })
        }
      }
      setShowEditModal(false)
      setEditingAgent(null)
      await fetchAgents()
    } catch (err: any) {
      alert(err.error || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const refreshSelectedAgent = useCallback(async (agentId: string) => {
    try {
      const res: any = await api.get(`/agents/${agentId}`)
      if (res.agent) {
        setSelectedAgent(res.agent)
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, skills: res.agent.skills } : a))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* 页面头部 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">AI智能体团队</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-1">8个职能化AI智能体，分工协作</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCreateAgent} className="btn-primary flex items-center gap-1.5 text-xs md:text-sm px-3 md:px-4 py-2">
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline">创建智能体</span>
            <span className="md:hidden">创建</span>
          </button>
          <Link to="/agent-group" className="btn-secondary flex items-center gap-1.5 text-xs md:text-sm px-3 md:px-4 py-2">
            <Users className="w-4 h-4" />
            <span className="hidden md:inline">智能体工作群</span>
            <span className="md:hidden">工作群</span>
          </Link>
        </div>
      </div>

      {/* 团队统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <div className="card p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 md:w-5 md:h-5 text-primary-600" />
            </div>
            <div className="min-w-0">
              <div className="text-lg md:text-2xl font-bold text-gray-900 truncate">{agents.length}</div>
              <div className="text-xs text-gray-500 truncate">智能体总数</div>
            </div>
          </div>
        </div>
        <div className="card p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
            </div>
            <div className="min-w-0">
              <div className="text-lg md:text-2xl font-bold text-gray-900 truncate">
                {agents.filter(a => a.status === 'idle').length}
              </div>
              <div className="text-xs text-gray-500 truncate">空闲中</div>
            </div>
          </div>
        </div>
        <div className="card p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <div className="text-lg md:text-2xl font-bold text-gray-900 truncate">{agents.reduce((sum, a) => sum + (a.skills?.length || 0), 0)}</div>
              <div className="text-xs text-gray-500 truncate">已装配技能</div>
            </div>
          </div>
        </div>
        <div className="card p-3 md:p-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-violet-600" />
            </div>
            <div className="min-w-0">
              <div className="text-lg md:text-2xl font-bold text-gray-900 truncate">{agents.filter(a => a.status === 'busy').length}</div>
              <div className="text-xs text-gray-500 truncate">工作中</div>
            </div>
          </div>
        </div>
      </div>

      {/* 智能体卡片网格 */}
      {agents.length === 0 ? (
        <div className="card p-6 md:p-12 text-center">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3 md:mb-4">
            <Bot className="w-6 h-6 md:w-8 md:h-8 text-gray-400" />
          </div>
          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-1 md:mb-2">暂无AI智能体</h3>
          <p className="text-xs md:text-sm text-gray-500 mb-4 md:mb-6 max-w-md mx-auto">
            系统预置了8个职能化AI智能体
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3">
            <button onClick={handleCreateAgent} className="btn-primary inline-flex items-center gap-2 w-full md:w-auto justify-center">
              <Plus className="w-4 h-4" />
              创建智能体
            </button>
            <button onClick={handleResetAgents} disabled={restoring} className="btn-secondary inline-flex items-center gap-2 w-full md:w-auto justify-center disabled:opacity-50">
              {restoring ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {restoring ? '恢复中...' : '恢复默认智能体'}
            </button>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        {agents.map((agent) => {
          const statusInfo = getStatusBadge(agent.status)
          return (
            <div
              key={agent.id}
              className="card p-3 md:p-5 hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => setSelectedAgent(agent)}
            >
              {/* 头像和状态 */}
              <div className="flex items-start justify-between mb-2 md:mb-3">
                {renderAvatar(agent, 'w-10 h-10 text-xl md:w-14 md:h-14 md:text-2xl')}
                <span className={`badge ${statusInfo.className} flex items-center gap-1 text-xs`}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', statusInfo.dot)} />
                  {statusInfo.label}
                </span>
              </div>

              {/* 名称和角色 */}
              <h3 className="font-bold text-gray-900 text-base md:text-lg mb-0.5 group-hover:text-primary-600 transition-colors truncate">
                {agent.name}
              </h3>
              <p className="text-xs md:text-sm text-gray-500 mb-1.5 md:mb-2 truncate">{roleLabels[agent.role] || agent.role}</p>

              {/* 实时动作文案（工作中时显示） */}
              {agent.status === 'busy' && agent.current_action && (
                <div className="flex items-center gap-1.5 mb-2 md:mb-3 px-2 py-1 md:py-1.5 bg-amber-50 rounded-lg">
                  <Loader2 className="w-3 h-3 md:w-3.5 md:h-3.5 text-amber-500 animate-spin flex-shrink-0" />
                  <span className="text-xs text-amber-700 truncate">{agent.current_action}</span>
                </div>
              )}

              {/* 描述 */}
              <p className="text-xs text-gray-400 line-clamp-2 mb-2 md:mb-3 hidden md:block">
                {agent.description}
              </p>

              {/* 技能标签 */}
              <div className="flex flex-wrap gap-1 md:gap-1.5 mb-2 md:mb-3">
                {agent.skills?.slice(0, 2).map((skill) => (
                  <span key={skill.id} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md">
                    {skill.name}
                  </span>
                ))}
                {agent.skills && agent.skills.length > 2 && (
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 text-xs rounded-md">
                    +{agent.skills.length - 2}
                  </span>
                )}
              </div>

              {/* 今日产出 */}
              <div className="pt-2 md:pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">今日产出</span>
                <span className="text-xs md:text-sm font-semibold text-gray-700">
                  {agent.todayRuns || 0} 次
                </span>
              </div>
            </div>
          )
        })}
      </div>
      )}

      {/* 智能体详情弹窗 */}
      {selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          onEdit={(e) => handleEditAgent(selectedAgent, e)}
          onDelete={(e) => handleDeleteAgent(selectedAgent, e)}
          onClose={() => setSelectedAgent(null)}
          onRefresh={(agentId) => refreshSelectedAgent(agentId)}
        />
      )}

      {/* 创建/编辑智能体弹窗 */}
      {showEditModal && (
        <AgentEditModal
          agent={editingAgent}
          saving={saving}
          onSave={handleSaveAgent}
          onClose={() => { setShowEditModal(false); setEditingAgent(null) }}
        />
      )}
    </div>
  )
}

// === 智能体详情弹窗（含技能装配 + 执行记录） ===
function AgentDetailModal({ agent, onEdit, onDelete, onClose, onRefresh }: {
  agent: Agent
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  onClose: () => void
  onRefresh: (agentId: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'skills' | 'runs' | 'info'>('skills')
  const [skillTab, setSkillTab] = useState<'installed' | 'available'>('installed')
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const statusInfo = getStatusBadge(agent.status)

  const fetchAvailableSkills = useCallback(async () => {
    setLoadingAvailable(true)
    try {
      const res: any = await api.get(`/agents/${agent.id}/available-skills`)
      setAvailableSkills(res.skills || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingAvailable(false)
    }
  }, [agent.id])

  const handleInstallSkill = async (skillId: string) => {
    setActionLoading(skillId)
    try {
      await api.post(`/agents/${agent.id}/skills`, { skillId })
      await onRefresh(agent.id)
      await fetchAvailableSkills()
    } catch (err: any) {
      alert(err.error || '安装失败')
    } finally {
      setActionLoading(null)
    }
  }

  const handleUninstallSkill = async (skillId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定要卸载该技能吗？')) return
    setActionLoading(skillId)
    try {
      await api.delete(`/agents/${agent.id}/skills/${skillId}`)
      await onRefresh(agent.id)
      await fetchAvailableSkills()
    } catch (err: any) {
      alert(err.error || '卸载失败')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSetPrimary = async (skillId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setActionLoading(skillId)
    try {
      await api.put(`/agents/${agent.id}/skills/${skillId}/primary`)
      await onRefresh(agent.id)
    } catch (err: any) {
      alert(err.error || '设置失败')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSkillTabSwitch = (tab: 'installed' | 'available') => {
    setSkillTab(tab)
    if (tab === 'available' && availableSkills.length === 0) {
      fetchAvailableSkills()
    }
  }

  const stats = agent.runStats || { totalRuns: 0, successRuns: 0, failedRuns: 0, totalTokens: 0, failureRate: 0 }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-2xl p-6 animate-fade-in max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部信息 */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4 flex-1">
            {renderAvatar(agent, 'w-14 h-14 text-2xl')}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-gray-900">{agent.name}</h2>
                <span className={`badge ${statusInfo.className} flex items-center gap-1`}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', statusInfo.dot)} />
                  {statusInfo.label}
                </span>
                {agent.is_builtin ? (
                  <span className="badge bg-blue-50 text-blue-600">内置</span>
                ) : (
                  <span className="badge bg-gray-100 text-gray-600">自定义</span>
                )}
              </div>
              <p className="text-sm text-gray-500">{roleLabels[agent.role] || agent.role}</p>
              {/* 实时动作 */}
              {agent.status === 'busy' && agent.current_action && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span className="text-xs text-amber-600">{agent.current_action}</span>
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab切换 */}
        <div className="flex border-b border-gray-200 mb-4">
          {[
            { key: 'skills', label: '技能装配', icon: Package },
            { key: 'runs', label: '执行记录', icon: BarChart3 },
            { key: 'info', label: '角色职责', icon: FileText },
          ].map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors',
                  isActive ? 'text-primary-600 border-primary-500 font-medium' : 'text-gray-500 border-transparent hover:text-gray-700'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* 技能装配 Tab */}
        {activeTab === 'skills' && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">
                已装配 {agent.skills?.length || 0} 个技能
              </span>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => handleSkillTabSwitch('installed')}
                  className={cn(
                    'px-3 py-1 text-xs rounded-md transition-all',
                    skillTab === 'installed' ? 'bg-white text-primary-600 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  已装配
                </button>
                <button
                  onClick={() => handleSkillTabSwitch('available')}
                  className={cn(
                    'px-3 py-1 text-xs rounded-md transition-all',
                    skillTab === 'available' ? 'bg-white text-primary-600 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  可安装
                </button>
              </div>
            </div>

            {skillTab === 'installed' && (
              <div className="space-y-2">
                {agent.skills && agent.skills.length > 0 ? (
                  agent.skills.map((skill) => (
                    <div key={skill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{skill.name}</span>
                            {skill.is_primary && (
                              <span className="badge bg-primary-100 text-primary-700 flex items-center gap-0.5">
                                <Star className="w-3 h-3" />
                                主技能
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">{skill.category}</span>
                            {skill.is_builtin && <span className="text-xs text-blue-400">内置</span>}
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-xs text-gray-400 truncate max-w-xs">{skill.description}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {!skill.is_primary && (
                          <button
                            onClick={(e) => handleSetPrimary(skill.id, e)}
                            disabled={actionLoading === skill.id}
                            className="px-2 py-1 text-xs text-amber-600 border border-amber-200 rounded-md hover:bg-amber-50 transition-colors flex items-center gap-1 disabled:opacity-50"
                          >
                            {actionLoading === skill.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <StarOff className="w-3 h-3" />}
                            设为主技能
                          </button>
                        )}
                        <button
                          onClick={(e) => handleUninstallSkill(skill.id, e)}
                          disabled={actionLoading === skill.id}
                          className="px-2 py-1 text-xs text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {actionLoading === skill.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                          卸载
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400 mb-3">该智能体还没有装配任何技能</p>
                    <button
                      onClick={() => handleSkillTabSwitch('available')}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      去安装技能 →
                    </button>
                  </div>
                )}
              </div>
            )}

            {skillTab === 'available' && (
              <div className="space-y-2">
                {loadingAvailable ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                    <span className="text-sm text-gray-400 ml-2">加载中...</span>
                  </div>
                ) : availableSkills.length > 0 ? (
                  availableSkills.map((skill) => (
                    <div key={skill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{skill.name}</span>
                          {skill.is_builtin && <span className="text-xs text-blue-400">内置</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{skill.category}</span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-400 truncate max-w-xs">{skill.description}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleInstallSkill(skill.id)}
                        disabled={actionLoading === skill.id}
                        className="px-2.5 py-1 text-xs text-white bg-primary-500 rounded-md hover:bg-primary-600 transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        {actionLoading === skill.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        安装
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Check className="w-10 h-10 text-green-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">所有技能已装配完毕</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 执行记录 Tab */}
        {activeTab === 'runs' && (
          <div className="mb-4">
            {/* 统计卡片 */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-lg font-bold text-gray-900">{stats.totalRuns}</div>
                <div className="text-xs text-gray-500">总执行次数</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-lg font-bold text-green-600">{stats.successRuns}</div>
                <div className="text-xs text-green-600">成功</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-lg font-bold text-red-600">{stats.failedRuns}</div>
                <div className="text-xs text-red-600">失败</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-lg font-bold text-blue-600">{Math.round(stats.totalTokens / 1000)}k</div>
                <div className="text-xs text-blue-600">Token消耗</div>
              </div>
            </div>

            {/* 失败率 */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-gray-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  失败率
                </span>
                <span className={cn('font-medium', stats.failureRate > 20 ? 'text-red-500' : 'text-green-500')}>
                  {stats.failureRate}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', stats.failureRate > 20 ? 'bg-red-400' : 'bg-green-400')}
                  style={{ width: `${Math.min(stats.failureRate, 100)}%` }}
                />
              </div>
            </div>

            {/* 最近执行记录 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">最近执行记录</h4>
              {!agent.recentRuns || agent.recentRuns.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">暂无执行记录</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {agent.recentRuns.map((run: SkillRun) => (
                    <div key={run.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-2 h-2 rounded-full',
                          run.status === 'completed' ? 'bg-green-400' :
                          run.status === 'failed' ? 'bg-red-400' :
                          run.status === 'running' ? 'bg-amber-400 animate-pulse' : 'bg-gray-300'
                        )} />
                        <span className="text-sm text-gray-700">{run.skill_name || '未知技能'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">
                          {run.token_input + run.token_output} tokens
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(run.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 角色职责 Tab */}
        {activeTab === 'info' && (
          <div className="space-y-4 mb-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">角色职责</h4>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
                {agent.description}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">系统提示词</h4>
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-mono">
                {agent.system_prompt || '（未设置）'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">失败策略</h4>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  {failureStrategyOptions.find(o => o.value === agent.failure_strategy)?.label || '自动重试'}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">专属模型</h4>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  {agent.override_model || '使用全局默认'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 底部操作按钮 */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <button onClick={onEdit} className="flex-1 btn-secondary flex items-center justify-center gap-2">
            <Edit2 className="w-4 h-4" />
            编辑
          </button>
          {!agent.is_builtin && (
            <button onClick={onDelete} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              删除
            </button>
          )}
          <button onClick={onClose} className="flex-1 btn-primary text-center">
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

// === 智能体创建/编辑弹窗组件 ===
function AgentEditModal({ agent, saving, onSave, onClose }: {
  agent: Agent | null
  saving: boolean
  onSave: (data: any) => void
  onClose: () => void
}) {
  const [name, setName] = useState(agent?.name || '')
  const [role, setRole] = useState(agent?.role || 'custom')
  const [avatar, setAvatar] = useState(agent?.avatar || '')
  const [description, setDescription] = useState(agent?.description || '')
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || '')
  const [failureStrategy, setFailureStrategy] = useState(agent?.failure_strategy || 'retry')
  const [overrideModel, setOverrideModel] = useState(agent?.override_model || '')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleAvatarChange = async (value: string) => {
    setAvatar(value)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      role,
      avatar,
      description: description.trim(),
      system_prompt: systemPrompt.trim(),
      failure_strategy: failureStrategy,
      override_model: overrideModel.trim() || '',
      enabled: 1,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg p-6 animate-fade-in max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {agent ? '编辑智能体' : '创建智能体'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 头像 */}
          {agent ? (
            <ImageUpload
              value={avatar}
              onChange={handleAvatarChange}
              agentId={agent.id}
              size="lg"
              label="智能体头像"
              emojis={['🎯', '🍑', '🍊', '🫧', '🐉', '🌊', '🪁', '🎪', '🤖', '🎨', '🎬', '📝', '🚀', '🌟', '💡']}
            />
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">智能体头像</label>
              <div className="flex items-center gap-4 mb-3">
                <div className={cn(
                  'w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden text-3xl shadow-lg',
                  isImageAvatar(avatar) ? 'bg-gray-100' : avatar ? 'bg-gray-100' : 'bg-gradient-to-br from-gray-400 to-gray-600 text-white'
                )}>
                  {isImageAvatar(avatar) ? (
                    <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                  ) : avatar ? (
                    <span>{avatar}</span>
                  ) : (
                    <Bot className="w-8 h-8" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400">创建后可上传本地图片头像</p>
                  <p className="text-xs text-gray-400 mt-0.5">现在请先选择表情或跳过</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {['🎯', '🍑', '🍊', '🫧', '🐉', '🌊', '🪁', '🎪', '🤖', '🎨', '🎬', '📝', '🚀', '🌟', '💡', '🎵'].map((emoji, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatar(emoji)}
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all',
                      avatar === emoji ? 'bg-primary-100 ring-2 ring-primary-500 ring-offset-1' : 'bg-gray-100 hover:bg-gray-200'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">智能体名称</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="请输入智能体名称" className="input-field" maxLength={30} required />
            <p className="text-xs text-gray-400 mt-1">{name.length}/30</p>
          </div>

          {/* 角色 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">角色类型</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="input-field">
              {roleOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">角色描述</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="描述智能体的职责和能力" className="input-field min-h-[80px] resize-none" maxLength={200} />
            <p className="text-xs text-gray-400 mt-1">{description.length}/200</p>
          </div>

          {/* 高级设置展开 */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
          >
            {showAdvanced ? '收起高级设置' : '展开高级设置'}
            <ChevronDown className={cn('w-4 h-4 transition-transform', showAdvanced && 'rotate-180')} />
          </button>

          {showAdvanced && (
            <div className="space-y-5 pt-2 border-t border-gray-100">
              {/* 系统提示词 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">系统提示词</label>
                <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="定义智能体的行为、沟通风格和约束" className="input-field min-h-[100px] resize-none" maxLength={1000} />
                <p className="text-xs text-gray-400 mt-1">{systemPrompt.length}/1000</p>
              </div>

              {/* 失败策略 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">技能执行失败策略</label>
                <div className="space-y-2">
                  {failureStrategyOptions.map(opt => (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                        failureStrategy === opt.value
                          ? 'border-primary-400 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <input
                        type="radio"
                        name="failureStrategy"
                        value={opt.value}
                        checked={failureStrategy === opt.value}
                        onChange={() => setFailureStrategy(opt.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 专属覆盖模型 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">专属覆盖模型（可选）</label>
                <input
                  type="text"
                  value={overrideModel}
                  onChange={(e) => setOverrideModel(e.target.value)}
                  placeholder="不填则使用全局默认模型"
                  className="input-field"
                />
                <p className="text-xs text-gray-400 mt-1">仅切换模型名称，不单独存储密钥，复用系统全局API Key</p>
              </div>
            </div>
          )}

          {/* 按钮 */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-outline">取消</button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? '保存中...' : (agent ? '保存修改' : '创建智能体')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 简化导入
import { ChevronDown } from 'lucide-react'
