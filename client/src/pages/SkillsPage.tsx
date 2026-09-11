import { useState, useEffect } from 'react'
import {
  Sparkles,
  Play,
  Search,
  Filter,
  Plus,
  Upload,
  Clock,
  Zap,
  BarChart3,
  ChevronRight,
} from 'lucide-react'
import api from '@/services/api'
import type { Skill, SkillRun } from '@/types'

const categoryNames: Record<string, string> = {
  content: '内容创作',
  design: '视觉设计',
  analytics: '数据分析',
  distribution: '平台发行',
  strategy: '策略规划',
  review: '质量评审',
  operations: '运营增长',
  production: '制作生产',
  live: '直播策划',
  custom: '自定义',
}

const categoryColors: Record<string, string> = {
  content: 'bg-orange-100 text-orange-700',
  design: 'bg-pink-100 text-pink-700',
  analytics: 'bg-blue-100 text-blue-700',
  distribution: 'bg-green-100 text-green-700',
  strategy: 'bg-purple-100 text-purple-700',
  review: 'bg-red-100 text-red-700',
  operations: 'bg-cyan-100 text-cyan-700',
  production: 'bg-amber-100 text-amber-700',
  live: 'bg-fuchsia-100 text-fuchsia-700',
  custom: 'bg-gray-100 text-gray-700',
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    fetchSkills()
    fetchStats()
  }, [])

  const fetchSkills = async () => {
    try {
      const res: any = await api.get('/skills', { params: { category: categoryFilter === 'all' ? undefined : categoryFilter } })
      setSkills(res.skills || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res: any = await api.get('/skills-stats')
      setStats(res.stats)
    } catch (e) {
      console.error(e)
    }
  }

  const filteredSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleExecute = async () => {
    if (!selectedSkill) return
    setExecuting(true)
    try {
      await api.post(`/skills/${selectedSkill.id}/execute`, { inputData: {} })
      alert('技能执行完成（演示模式）')
    } catch (e) {
      console.error(e)
    } finally {
      setExecuting(false)
    }
  }

  const categories = ['all', 'content', 'design', 'analytics', 'distribution', 'strategy', 'review', 'operations']

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">技能库</h1>
          <p className="text-gray-500 text-sm mt-1">可扩展的技能系统，AI智能体通过调用技能完成具体任务</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-outline flex items-center gap-2">
            <Upload className="w-4 h-4" />
            导入技能
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            创建技能
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.totalRuns}</div>
                <div className="text-xs text-gray-500">总执行次数</div>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.successRate}%</div>
                <div className="text-xs text-gray-500">成功率</div>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{Math.round((stats.totalTokens || 0) / 1000)}k</div>
                <div className="text-xs text-gray-500">Token消耗</div>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{skills.length}</div>
                <div className="text-xs text-gray-500">可用技能</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 筛选栏 */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setCategoryFilter(cat); fetchSkills() }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    categoryFilter === cat
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat === 'all' ? '全部' : categoryNames[cat] || cat}
                </button>
              ))}
            </div>
          </div>

          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索技能..."
              className="input-field text-sm pl-9 py-1.5 w-56"
            />
          </div>
        </div>
      </div>

      {/* 技能列表 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.map((skill) => (
            <div
              key={skill.id}
              className="card p-5 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => setSelectedSkill(skill)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${categoryColors[skill.category] || 'bg-gray-100'} flex items-center justify-center`}>
                  <Sparkles className="w-5 h-5" />
                </div>
                {skill.is_builtin ? (
                  <span className="badge bg-blue-50 text-blue-600">内置</span>
                ) : skill.is_global ? (
                  <span className="badge bg-green-50 text-green-600">全局</span>
                ) : (
                  <span className="badge bg-gray-100 text-gray-600">自定义</span>
                )}
              </div>

              <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors">
                {skill.name}
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                {categoryNames[skill.category] || skill.category} · v{skill.version}
              </p>

              <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                {skill.description || '暂无描述'}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">点击查看详情</span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 技能详情弹窗 */}
      {selectedSkill && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedSkill(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-xl p-6 animate-fade-in max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-6">
              <div className={`w-14 h-14 rounded-2xl ${categoryColors[selectedSkill.category] || 'bg-gray-100'} flex items-center justify-center`}>
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{selectedSkill.name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {categoryNames[selectedSkill.category] || selectedSkill.category} · 版本 v{selectedSkill.version}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">技能描述</h4>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                  {selectedSkill.description || '暂无描述'}
                </p>
              </div>

              {selectedSkill.workflow && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">工作流步骤</h4>
                  <div className="space-y-2">
                    {JSON.parse(selectedSkill.workflow).map((step: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-medium">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{step.name}</p>
                          <p className="text-xs text-gray-400">{step.description}</p>
                        </div>
                        <span className="text-xs px-2 py-0.5 bg-white rounded text-gray-500">
                          {step.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSelectedSkill(null)}
                className="flex-1 btn-secondary"
              >
                关闭
              </button>
              <button
                onClick={handleExecute}
                disabled={executing}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {executing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                执行技能
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
