import { useState, useEffect } from 'react'
import { Plus, Search, Filter, Lightbulb, FileText, Image, PlayCircle, MessageSquare, Calendar, Users, Shield } from 'lucide-react'
import api from '@/services/api'

// 通用列表页组件
interface ListPageProps {
  title: string
  description: string
  icon: React.ElementType
  itemName: string
  apiPath: string
  itemsKey: string
  renderItem?: (item: any) => React.ReactNode
}

export function SimpleListPage({ title, description, icon: Icon, itemName, apiPath, itemsKey }: ListPageProps) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      const res: any = await api.get(apiPath)
      setItems(res[itemsKey] || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await api.post(apiPath, { name: newName, title: newName })
      setShowModal(false)
      setNewName('')
      fetchItems()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-500 text-sm mt-1">{description}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          新建{itemName}
        </button>
      </div>

      <div className="card p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">共 {items.length} 条</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="搜索..." className="input-field text-sm pl-9 py-1.5 w-48" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Icon className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无{itemName}</h3>
          <p className="text-gray-500 text-sm mb-6">创建你的第一个{itemName}</p>
          <button onClick={() => setShowModal(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            新建{itemName}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item: any) => (
            <div key={item.id} className="card p-5 hover:shadow-md transition-shadow cursor-pointer group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                    {item.name || item.title}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {item.status || new Date(item.created_at).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              </div>
              {(item.description || item.hook || item.content) && (
                <p className="text-sm text-gray-500 line-clamp-2">
                  {item.description || item.hook || (item.content?.substring(0, 100))}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-fade-in">
            <h2 className="text-xl font-bold text-gray-900 mb-6">新建{itemName}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">名称 *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input-field"
                autoFocus
                placeholder={`输入{itemName}名称`}
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 btn-secondary">取消</button>
              <button onClick={handleCreate} className="flex-1 btn-primary">创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 各具体页面
export function TopicsPage() {
  return <SimpleListPage
    title="选题池"
    description="统一管理所有选题，从候选到立项全生命周期"
    icon={Lightbulb}
    itemName="选题"
    apiPath="/content/topics"
    itemsKey="topics"
  />
}

export function ScriptsPage() {
  return <SimpleListPage
    title="脚本库"
    description="管理所有脚本文件，按项目分组"
    icon={FileText}
    itemName="脚本"
    apiPath="/content/scripts"
    itemsKey="scripts"
  />
}

export function AssetsPage() {
  return <SimpleListPage
    title="素材库"
    description="统一管理图片、视频、音频等各类素材"
    icon={Image}
    itemName="素材"
    apiPath="/content/assets"
    itemsKey="assets"
  />
}

export function VideosPage() {
  return <SimpleListPage
    title="视频库"
    description="管理已发布视频作品及其数据表现"
    icon={PlayCircle}
    itemName="视频"
    apiPath="/content/videos"
    itemsKey="videos"
  />
}

export function MessagesPage() {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMessages()
  }, [])

  const fetchMessages = async () => {
    try {
      const res: any = await api.get('/messages')
      setMessages(res.messages || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handleMarkRead = async (id: string) => {
    try {
      await api.post(`/messages/${id}/read`)
      fetchMessages()
      window.dispatchEvent(new CustomEvent('messages-updated'))
    } catch (e) { console.error(e) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">消息中心</h1>
          <p className="text-gray-500 text-sm mt-1">系统通知、智能体消息、评审通知</p>
        </div>
        <button
          onClick={async () => {
            await api.post('/messages/read-all')
            fetchMessages()
            window.dispatchEvent(new CustomEvent('messages-updated'))
          }}
          className="btn-outline text-sm"
        >
          全部已读
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>暂无消息</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${!msg.is_read ? 'bg-primary-50/30' : ''}`}
                onClick={() => handleMarkRead(msg.id)}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {!msg.is_read && <span className="w-2 h-2 bg-red-500 rounded-full" />}
                    <h4 className="font-medium text-gray-900">{msg.title}</h4>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(msg.created_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2 ml-4">{msg.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function CalendarPage() {
  const [events, setEvents] = useState<any[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    fetchEvents()
  }, [currentDate])

  const fetchEvents = async () => {
    try {
      const monthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
      const res: any = await api.get('/calendar', { params: { month: monthStr } })
      setEvents(res.events || [])
    } catch (e) { console.error(e) }
  }

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">日历</h1>
          <p className="text-gray-500 text-sm mt-1">内容排期和日程管理</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          添加事件
        </button>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="h-20" />
          ))}
          {days.map((day) => {
            const dayStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayEvents = events.filter(e => e.date === dayStr)
            const isToday = dayStr === new Date().toISOString().split('T')[0]
            return (
              <div
                key={day}
                className={`h-20 p-2 rounded-lg border transition-colors cursor-pointer hover:border-primary-300 ${
                  isToday ? 'border-primary-400 bg-primary-50' : 'border-gray-100'
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${isToday ? 'text-primary-700' : 'text-gray-700'}`}>
                  {day}
                </div>
                {dayEvents.slice(0, 2).map((ev, idx) => (
                  <div key={idx} className="text-xs bg-primary-100 text-primary-700 rounded px-1.5 py-0.5 truncate mb-0.5">
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-gray-400">+{dayEvents.length - 2}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// 简化的导入
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function AdminPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-600" />
          管理员后台
        </h1>
        <p className="text-gray-500 text-sm mt-1">系统运维与配置管理</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '用户总数', value: '1', icon: Users, color: 'from-blue-500 to-blue-600' },
          { label: '项目总数', value: '0', icon: Lightbulb, color: 'from-green-500 to-emerald-600' },
          { label: '技能执行', value: '0', icon: Sparkles, color: 'from-amber-500 to-orange-600' },
          { label: 'Token消耗', value: '0', icon: Zap, color: 'from-purple-500 to-violet-600' },
        ].map((stat, idx) => {
          const Icon = stat.icon
          return (
            <div key={idx} className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">智能体管理</h3>
          <p className="text-sm text-gray-500">管理8个逻辑智能体角色配置</p>
          <button className="btn-outline text-sm mt-4">进入管理</button>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">技能库管理</h3>
          <p className="text-sm text-gray-500">技能版本管理、GitHub导入、执行日志</p>
          <button className="btn-outline text-sm mt-4">进入管理</button>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">系统参数配置</h3>
          <p className="text-sm text-gray-500">全局约束Prompt、成本管控阈值、MCP配置</p>
          <button className="btn-outline text-sm mt-4">进入管理</button>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">监控告警</h3>
          <p className="text-sm text-gray-500">Token用量统计、异常告警、任务队列监控</p>
          <button className="btn-outline text-sm mt-4">查看详情</button>
        </div>
      </div>
    </div>
  )
}

// 简化导入
import { Sparkles, Zap } from 'lucide-react'
