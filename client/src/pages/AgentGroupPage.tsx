import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Users, Send, Smile, AtSign,
  Bot, Loader2, Image as ImageIcon,
  FileText, Mic
} from 'lucide-react'
import api from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils'
import type { Agent, GroupChat, GroupMessage } from '@/types'

// === 工具函数 ===

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
  topic_planner: '选题立项',
  scriptwriter: '脚本策划',
  graphic_designer: '视觉物料',
  video_analyst: '视频分析',
  distributor: '平台分发',
  operator: '数据复盘',
  live_planner: '直播策划',
  custom: '自定义',
}

function isImageAvatar(avatar?: string | null) {
  return !!avatar && (avatar.startsWith('/uploads/') || avatar.startsWith('http'))
}

// 渲染头像（图片URL或emoji）
function renderAvatarBox(avatar: string | undefined | null, role: string | undefined, name: string, size: string = 'w-10 h-10 text-lg') {
  const colorClass = (role && agentColors[role]) || agentColors.custom
  if (isImageAvatar(avatar)) {
    return (
      <div className={cn(size, 'rounded-lg overflow-hidden bg-gray-100 flex-shrink-0')}>
        <img src={avatar!} alt={name} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className={cn(size, `rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center flex-shrink-0 text-white`)}>
      {avatar || <Bot className="w-1/2 h-1/2" />}
    </div>
  )
}

// 获取本地日期字符串 (YYYY-MM-DD)，使用本地时区而非UTC
function getLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 格式化时间
function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const today = getLocalDateStr(now)
  const msgDate = getLocalDateStr(d)

  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')

  if (msgDate === today) {
    return `${hh}:${mm}`
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = ['日', '一', '二', '三', '四', '五', '六']
    return `周${days[d.getDay()]} ${hh}:${mm}`
  }
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`
}

// 格式化日期分隔
function formatDateSeparator(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const today = getLocalDateStr(now)
  const msgDate = getLocalDateStr(d)
  const yesterdayDate = new Date(now.getTime() - 86400000)
  const yesterday = getLocalDateStr(yesterdayDate)

  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')

  if (msgDate === today) return `今天 ${hh}:${mm}`
  if (msgDate === yesterday) return `昨天 ${hh}:${mm}`
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`
}

// 判断是否需要显示日期分隔
function shouldShowDateSeparator(messages: GroupMessage[], index: number) {
  if (index === 0) return true
  const prev = new Date(messages[index - 1].created_at)
  const curr = new Date(messages[index].created_at)
  // 超过5分钟显示分隔
  return curr.getTime() - prev.getTime() > 5 * 60 * 1000
}

// === 主组件 ===

export default function AgentGroupPage() {
  const { user } = useAuthStore()
  const [agents, setAgents] = useState<Agent[]>([])
  const [activeChat, setActiveChat] = useState<GroupChat | null>(null)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [loadingChat, setLoadingChat] = useState(true)
  const [sending, setSending] = useState(false)
  const [showMention, setShowMention] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [showMembers, setShowMembers] = useState(true)
  const [agentStatusMap, setAgentStatusMap] = useState<Record<string, { status: string; current_action?: string }>>({})

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 加载智能体列表（群成员）
  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = useCallback(async () => {
    try {
      const res: any = await api.get('/agents')
      const list = res.agents || []
      setAgents(list)
      // 初始化状态map
      const map: Record<string, { status: string; current_action?: string }> = {}
      list.forEach((a: Agent) => {
        map[a.id] = { status: a.status, current_action: a.current_action }
      })
      setAgentStatusMap(map)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingAgents(false)
    }
  }, [])

  // 轮询智能体状态（发送消息时实时更新）
  const pollAgentStatus = useCallback(async () => {
    try {
      const res: any = await api.get('/agents/status/list')
      const list = res.agents || []
      const map: Record<string, { status: string; current_action?: string }> = {}
      list.forEach((a: any) => {
        map[a.id] = { status: a.status, current_action: a.current_action }
      })
      setAgentStatusMap(map)
      // 同时更新agents列表中的状态
      setAgents(prev => prev.map(a => ({
        ...a,
        status: map[a.id]?.status || a.status,
        current_action: map[a.id]?.current_action,
      })))
    } catch (e) {
      // 静默失败
    }
  }, [])

  // 发送中轮询状态
  useEffect(() => {
    if (!sending) return
    const timer = setInterval(pollAgentStatus, 1500)
    return () => clearInterval(timer)
  }, [sending, pollAgentStatus])

  // 加载默认群聊（只有一个AI工作群）
  const fetchDefaultChat = useCallback(async () => {
    try {
      const res: any = await api.get('/agent-group-chats')
      const list = res.chats || []
      if (list.length > 0) {
        setActiveChat(list[0])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingChat(false)
    }
  }, [])

  useEffect(() => {
    fetchDefaultChat()
  }, [fetchDefaultChat])

  // 加载消息
  const fetchMessages = useCallback(async (chatId: string) => {
    try {
      const res: any = await api.get(`/agent-group-chats/${chatId}/messages`)
      setMessages(res.messages || [])
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat.id)
    } else {
      setMessages([])
    }
  }, [activeChat, fetchMessages])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 发送消息
  const handleSend = async () => {
    if (!inputText.trim() || !activeChat || sending) return
    const content = inputText.trim()
    setInputText('')
    setSending(true)

    // 立即添加用户消息到UI
    const tempUserMsg: GroupMessage = {
      id: 'temp-' + Date.now(),
      group_id: activeChat.id,
      sender_type: 'user',
      sender_id: user?.id,
      sender_name: user?.username,
      content,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMsg])

    try {
      const res: any = await api.post(`/agent-group-chats/${activeChat.id}/messages`, {
        content,
        mention_agent_ids: extractMentions(content),
      })

      // 先移除临时用户消息（换成正式的），再逐条添加AI回复（模拟串行打字效果）
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id))

      if (res.responses && res.responses.length > 0) {
        const responses: any[] = res.responses
        for (let i = 0; i < responses.length; i++) {
          const r = responses[i]
          // 模拟打字延迟（不同智能体间隔不同）
          await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 400))
          const agentMsg: GroupMessage = {
            id: r.id,
            group_id: activeChat.id,
            sender_type: 'agent',
            sender_id: r.agent.id,
            sender_name: r.agent.name,
            content: r.content,
            created_at: new Date().toISOString(),
          }
          setMessages(prev => [...prev, agentMsg])
          // 智能体之间间隔
          if (i < responses.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300))
          }
        }
      }
    } catch (e: any) {
      // 失败时移除临时消息，显示错误
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id))
      alert(e.error || '发送失败')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  // 提取@提到的智能体
  function extractMentions(text: string): string[] {
    const ids: string[] = []
    for (const agent of agents) {
      if (text.includes(`@${agent.name}`)) {
        ids.push(agent.id)
      }
    }
    return ids
  }

  // 处理@提及
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      setShowMention(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInputText(val)

    // 检测@符号触发提及弹窗
    const lastChar = val[val.length - 1]
    if (lastChar === '@') {
      setShowMention(true)
      setMentionFilter('')
    } else if (showMention) {
      // 提取@后面的过滤词
      const atIdx = val.lastIndexOf('@')
      if (atIdx !== -1) {
        const filter = val.substring(atIdx + 1)
        if (!filter.includes(' ') && filter.length <= 10) {
          setMentionFilter(filter)
        } else {
          setShowMention(false)
        }
      }
    }
  }

  // 选择提及的智能体
  const handleSelectMention = (agent: Agent) => {
    const val = inputText
    const atIdx = val.lastIndexOf('@')
    if (atIdx !== -1) {
      const newVal = val.substring(0, atIdx) + `@${agent.name} `
      setInputText(newVal)
    }
    setShowMention(false)
    inputRef.current?.focus()
  }

  const filteredAgents = agents.filter(a =>
    !mentionFilter || a.name.includes(mentionFilter)
  )

  // 获取发送者头像/角色信息
  const getSenderInfo = (msg: GroupMessage) => {
    if (msg.sender_type === 'user') {
      return { avatar: user?.avatar, role: undefined, name: msg.sender_name || user?.username || '我', isUser: true }
    }
    const agent = agents.find(a => a.id === msg.sender_id)
    return {
      avatar: agent?.avatar,
      role: agent?.role,
      name: msg.sender_name || agent?.name || 'AI',
      isUser: false,
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900 -m-6 overflow-hidden">
      {/* === 左侧：群信息（固定一个AI工作群） === */}
      <div className="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0">
        {/* 群信息头部 */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {activeChat?.title || 'AI创作工作群'}
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {agents.length + 1}位成员
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            8位AI智能体集体协作，头脑风暴
          </p>
        </div>

        {/* 智能体列表 */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 py-1.5">
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">群成员</span>
          </div>

          {/* 用户自己 */}
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="relative">
              {isImageAvatar(user?.avatar) ? (
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                  <img src={user?.avatar!} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-medium">
                  {user?.avatar || user?.username?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-gray-800" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate block">{user?.username}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">管理员</span>
            </div>
          </div>

          {/* 分隔 */}
          <div className="px-3 py-1.5 mt-2">
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">AI智能体 ({agents.length})</span>
          </div>

          {/* 智能体列表 */}
          {loadingAgents ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 text-gray-400 dark:text-gray-500 animate-spin" />
            </div>
          ) : (
            agents.map(agent => {
              const status = agentStatusMap[agent.id]?.status || agent.status
              const action = agentStatusMap[agent.id]?.current_action || agent.current_action
              const isBusy = status === 'busy'
              return (
                <div key={agent.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <div className="relative">
                    {renderAvatarBox(agent.avatar, agent.role, agent.name, 'w-9 h-9 text-base')}
                    <div className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800',
                      status === 'idle' ? 'bg-green-400' : isBusy ? 'bg-amber-400 animate-pulse' : status === 'error' ? 'bg-red-400' : 'bg-gray-300 dark:bg-gray-600'
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-900 dark:text-gray-100 truncate block">{agent.name}</span>
                    {isBusy && action ? (
                      <span className="text-xs text-amber-600 dark:text-amber-400 truncate block flex items-center gap-1">
                        <Loader2 className="w-2.5 h-2.5 animate-spin flex-shrink-0" />
                        {action}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate block">{roleLabels[agent.role] || agent.role}</span>
                    )}
                  </div>
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded flex-shrink-0',
                    status === 'idle' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                    isBusy ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                    status === 'error' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  )}>
                    {status === 'idle' ? '空闲' : isBusy ? '工作中' : status === 'error' ? '异常' : '离线'}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* === 中间：聊天区域 === */}
      <div className="flex-1 flex flex-col min-w-0">
          {activeChat ? (
          <>
            {/* 聊天头部 */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{activeChat.title}</h3>
                <span className="text-sm text-gray-400 dark:text-gray-500 flex-shrink-0">
                  ({agents.length + 1}人)
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* 成员头像堆叠 */}
                <div className="flex items-center -space-x-1.5 mr-2">
                  {agents.slice(0, 5).map(agent => (
                    <div key={agent.id} className="w-7 h-7 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 flex-shrink-0">
                      {isImageAvatar(agent.avatar) ? (
                        <img src={agent.avatar!} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className={cn('w-full h-full rounded-full bg-gradient-to-br flex items-center justify-center text-xs text-white',
                          (agentColors[agent.role] || agentColors.custom))}>
                          {agent.avatar || <Bot className="w-3.5 h-3.5" />}
                        </div>
                      )}
                    </div>
                  ))}
                  {agents.length > 5 && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs text-gray-500 dark:text-gray-300 flex-shrink-0">
                      +{agents.length - 5}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-gray-50 dark:bg-gray-900">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                  <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                    <Users className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                  </div>
                  <p className="text-base font-medium text-gray-500 dark:text-gray-400 mb-1">AI创作工作群</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">群里有{agents.length}位AI智能体和1位管理员</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">@指定智能体进行定向提问，或自由讨论</p>
                  <p className="text-xs text-gray-300 dark:text-gray-600 mt-4">输入消息开始群聊吧</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const info = getSenderInfo(msg)
                  const showDate = shouldShowDateSeparator(messages, idx)

                  return (
                    <div key={msg.id}>
                      {/* 日期分隔 */}
                      {showDate && (
                        <div className="flex items-center justify-center my-3">
                          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                            {formatDateSeparator(msg.created_at)}
                          </span>
                        </div>
                      )}

                      {/* 消息气泡 */}
                      <div className={cn(
                        'flex items-start gap-2.5 py-1.5 group hover:bg-gray-100/50 dark:hover:bg-gray-800/50 rounded-lg px-2 -mx-2 transition-colors',
                        info.isUser ? 'flex-row-reverse' : 'flex-row'
                      )}>
                        {/* 头像 */}
                        {renderAvatarBox(info.avatar, info.role, info.name, 'w-9 h-9 text-base')}

                        {/* 消息内容 */}
                        <div className={cn('flex flex-col max-w-[60%]', info.isUser ? 'items-end' : 'items-start')}>
                          {/* 名称 */}
                          <span className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 px-1">
                            {info.name}
                          </span>
                          {/* 气泡 */}
                          <div className={cn(
                            'px-3 py-2 rounded-lg text-sm break-words whitespace-pre-wrap',
                            info.isUser
                              ? 'bg-green-500 text-white rounded-tr-sm'
                              : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-sm shadow-sm border border-gray-100 dark:border-gray-600'
                          )}>
                            {msg.content}
                          </div>
                          {/* 时间 */}
                          <span className="text-xs text-gray-300 dark:text-gray-600 mt-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              {/* 发送中指示 */}
              {sending && (
                <div className="flex items-center gap-2 py-2 px-2 text-gray-400 dark:text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">智能体正在思考...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
              {/* 工具栏 */}
              <div className="flex items-center gap-1 px-3 pt-2">
                <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="表情">
                  <Smile className="w-5 h-5" />
                </button>
                <button
                  onClick={() => { setInputText(inputText + '@'); setShowMention(true); inputRef.current?.focus() }}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="@提及"
                >
                  <AtSign className="w-5 h-5" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="图片">
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="文件">
                  <FileText className="w-5 h-5" />
                </button>
                <div className="flex-1" />
                <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="语音">
                  <Mic className="w-5 h-5" />
                </button>
              </div>

              {/* 文本输入 */}
              <div className="relative px-3 pb-3 pt-1">
                {/* @提及弹窗 */}
                {showMention && (
                  <div className="absolute bottom-full left-3 mb-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 max-h-48 overflow-y-auto z-10">
                    <div className="px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-700">
                      选择要@的智能体
                    </div>
                    {filteredAgents.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">没有匹配的智能体</div>
                    ) : (
                      filteredAgents.map(agent => (
                        <div
                          key={agent.id}
                          onClick={() => handleSelectMention(agent)}
                          className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        >
                          {renderAvatarBox(agent.avatar, agent.role, agent.name, 'w-7 h-7 text-sm')}
                          <span className="text-sm text-gray-700 dark:text-gray-200">{agent.name}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{roleLabels[agent.role] || agent.role}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    placeholder="输入消息，@智能体定向提问，Enter发送，Shift+Enter换行"
                    rows={1}
                    className="flex-1 resize-none px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 focus:bg-white dark:focus:bg-gray-600 transition-all max-h-32"
                    style={{ minHeight: '36px' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || sending}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0',
                      inputText.trim() && !sending
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    )}
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : '发送'}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-gray-300 dark:text-gray-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">智能体工作群</h3>
              <p className="text-sm text-gray-400 dark:text-gray-500">8个AI智能体集体讨论，头脑风暴，群策群力</p>
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-4">加载中...</p>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
