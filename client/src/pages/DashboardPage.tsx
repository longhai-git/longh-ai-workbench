import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  Users,
  Video,
  Lightbulb,
  Bot,
  Calendar,
  ChevronRight,
  Play,
  Zap,
  Clock,
  Target,
  BookOpen,
} from 'lucide-react'
import api from '@/services/api'
import { formatNumber, getStatusColor, getStatusText } from '@/utils'
import type { Project, CalendarEvent } from '@/types'

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [activeProjects, setActiveProjects] = useState<Project[]>([])
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
  }, [])

  const fetchDashboard = async () => {
    try {
      const res: any = await api.get('/dashboard/stats')
      setStats(res)
      setActiveProjects(res.activeProjects || [])
      setTodayEvents(res.todayEvents || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  const statCards = [
    {
      label: '项目总数',
      value: stats?.projectStats?.total || 0,
      subValue: `${stats?.projectStats?.active || 0} 个进行中`,
      icon: Target,
      color: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '选题池',
      value: stats?.topicStats?.total || 0,
      subValue: `${stats?.topicStats?.candidate || 0} 个候选`,
      icon: Lightbulb,
      color: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-50',
    },
    {
      label: '视频作品',
      value: stats?.videoStats?.total || 0,
      subValue: `${formatNumber(stats?.videoStats?.totalViews || 0)} 总播放`,
      icon: Video,
      color: 'from-pink-500 to-rose-500',
      bg: 'bg-pink-50',
    },
    {
      label: 'AI智能体',
      value: stats?.agentStats?.total || 0,
      subValue: `${stats?.agentStats?.idle || 0} 个空闲`,
      icon: Bot,
      color: 'from-violet-500 to-purple-600',
      bg: 'bg-violet-50',
    },
  ]

  const quickActions = [
    { label: '新建项目', icon: Play, path: '/projects', color: 'bg-primary-500' },
    { label: '添加选题', icon: Lightbulb, path: '/topics', color: 'bg-amber-500' },
    { label: '上传对标', icon: Target, path: '/benchmarks', color: 'bg-pink-500' },
    { label: '知识记录', icon: BookOpen, path: '/knowledge', color: 'bg-emerald-500' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 欢迎区 */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute right-20 bottom-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />
        
        <div className="relative z-10">
          <h1 className="text-2xl font-bold mb-2">欢迎回来 👋</h1>
          <p className="text-primary-100 mb-6">
            今天有 {stats?.projectStats?.active || 0} 个项目进行中，继续你的创作吧！
          </p>
          
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action, idx) => {
              const Icon = action.icon
              return (
                <Link
                  key={idx}
                  to={action.path}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/15 backdrop-blur hover:bg-white/25 rounded-xl transition-colors"
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{action.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* 数据卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon
          return (
            <div key={idx} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 bg-gradient-to-br ${card.color} bg-clip-text text-transparent`} style={{ color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text' }} />
                </div>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{card.value}</div>
              <div className="text-sm text-gray-500">{card.label}</div>
              <div className="text-xs text-gray-400 mt-1">{card.subValue}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 进行中的项目 */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">进行中的项目</h3>
            <Link to="/projects" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              查看全部 <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {activeProjects.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>暂无进行中的项目</p>
              <Link to="/projects" className="text-primary-500 text-sm hover:underline mt-2 inline-block">
                创建第一个项目
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activeProjects.map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium">
                      {project.title.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{project.title}</h4>
                      <p className="text-xs text-gray-500">
                        当前阶段：{getStageName(project.current_stage)}
                      </p>
                    </div>
                  </div>
                  <span className={`badge ${getStatusColor(project.status)}`}>
                    {getStatusText(project.status)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 今日待办 + Token用量 */}
        <div className="space-y-6">
          {/* 今日日程 */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-primary-500" />
              <h3 className="font-semibold text-gray-900">今日日程</h3>
            </div>

            {todayEvents.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                今天没有安排
              </div>
            ) : (
              <div className="space-y-2">
                {todayEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-1.5 h-10 bg-primary-500 rounded-full" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{event.title}</p>
                      <p className="text-xs text-gray-400">{event.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Link to="/calendar" className="mt-4 block text-center text-sm text-primary-600 hover:text-primary-700">
              查看完整日历
            </Link>
          </div>

          {/* Token用量 */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-gray-900">今日Token用量</h3>
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">已使用</span>
                <span className="font-medium text-gray-900">
                  {formatNumber(stats?.tokenStats?.dailyUsed || 0)} / {formatNumber(stats?.tokenStats?.dailyLimit || 0)}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((stats?.tokenStats?.dailyUsed || 0) / (stats?.tokenStats?.dailyLimit || 1)) * 100)}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-gray-400">
              所有AI调用消耗的Token计入火山方舟账号
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function getStageName(code: string): string {
  const names: Record<string, string> = {
    topic: '选题策划',
    script: '脚本创作',
    design: '视觉设计',
    review: '项目评审',
    publish: '发布发行',
    data: '数据复盘',
  }
  return names[code] || code
}
