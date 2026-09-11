import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Search,
  Timer,
  Play,
  Pause,
  Square,
  RotateCcw,
  X,
  Minus,
  Coffee,
  Settings,
  LogOut,
  ChevronDown,
  User,
  Edit2,
  Check,
  SkipForward,
  CheckCircle2,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import api from '@/services/api'
import { formatDuration, cn } from '@/utils'
import ImageUpload from '@/components/ImageUpload'
import type { PomodoroRecord } from '@/types'

// 检查avatar是否为图片URL
function isImageAvatar(avatar?: string | null) {
  return !!avatar && (avatar.startsWith('/uploads/') || avatar.startsWith('http'))
}

export default function Topbar() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [unreadCount, setUnreadCount] = useState(0)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [pomodoroMinimized, setPomodoroMinimized] = useState(false)
  const [pomodoro, setPomodoro] = useState<PomodoroRecord | null>(null)
  const [displaySeconds, setDisplaySeconds] = useState(1500)
  const [pomodoroMode, setPomodoroMode] = useState<'work' | 'rest'>('work') // 用户选择的模式
  const [completedNotice, setCompletedNotice] = useState<string | null>(null)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completedMode, setCompletedMode] = useState<string | null>(null)
  const [currentDateStr, setCurrentDateStr] = useState('')
  const [currentTimeStr, setCurrentTimeStr] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const pomodoroRef = useRef<HTMLDivElement>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const [pomodoroPos, setPomodoroPos] = useState({ x: 0, y: 0 })
  // 记录弹窗是否已被拖拽过（未拖拽时用默认位置）
  const [hasDragged, setHasDragged] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // 获取未读消息数
  const fetchUnreadCount = async () => {
    try {
      const res: any = await api.get('/messages/unread-count')
      setUnreadCount(res.count)
    } catch (e) { /* ignore */ }
  }

  // 获取番茄时钟状态
  const fetchPomodoro = async () => {
    try {
      const res: any = await api.get('/pomodoro')
      setPomodoro(res.pomodoro)
      setDisplaySeconds(res.pomodoro.remain_seconds)
      // 如果后端报告刚完成了一个阶段，弹出选择弹窗
      if (res.pomodoro.just_completed === 'work') {
        setCompletedMode('work')
        setShowCompleteModal(true)
        playAlarm()
      } else if (res.pomodoro.just_completed === 'rest') {
        setCompletedMode('rest')
        setShowCompleteModal(true)
        playAlarm()
      }
    } catch (e) { /* ignore */ }
  }

  useEffect(() => {
    fetchUnreadCount()
    fetchPomodoro()
    const interval = setInterval(fetchUnreadCount, 30000)
    
    // 实时更新日期时间
    const updateDateTime = () => {
      const now = new Date()
      const weekDays = ['日', '一', '二', '三', '四', '五', '六']
      setCurrentDateStr(
        `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${weekDays[now.getDay()]}`
      )
      const h = String(now.getHours()).padStart(2, '0')
      const m = String(now.getMinutes()).padStart(2, '0')
      const s = String(now.getSeconds()).padStart(2, '0')
      setCurrentTimeStr(`${h}:${m}:${s}`)
    }
    updateDateTime()
    const timeInterval = setInterval(updateDateTime, 1000)
    
    return () => {
      clearInterval(interval)
      clearInterval(timeInterval)
    }
  }, [])

  // 番茄时钟倒计时
  useEffect(() => {
    if (!pomodoro || (pomodoro.status !== 'work' && pomodoro.status !== 'rest')) return

    const timer = setInterval(() => {
      setDisplaySeconds((prev) => {
        if (prev <= 1) {
          // 时间到，播放提示音并重新获取状态（后端会自动切换模式）
          playAlarm()
          fetchPomodoro()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [pomodoro?.status, pomodoro?.started_at])

  const playAlarm = () => {
    // 简单的提示音（使用Web Audio API）
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    } catch (e) { /* ignore */ }
  }

  // 全局搜索
  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    try {
      const res: any = await api.get('/search', { params: { q: query } })
      setSearchResults(res.results)
    } catch (e) { /* ignore */ }
  }

  // 保存个人资料
  const handleSaveProfile = async () => {
    if (!editUsername.trim()) return
    setSavingProfile(true)
    try {
      await api.put('/user-info', {
        username: editUsername.trim(),
        avatar: editAvatar || null,
      })
      // 更新 store 中的用户信息
      const { setUser } = useAuthStore.getState()
      const currentUser = useAuthStore.getState().user
      if (currentUser) {
        setUser({
          ...currentUser,
          username: editUsername.trim(),
          avatar: editAvatar || null,
        })
      }
      setShowProfileModal(false)
    } catch (e: any) {
      alert(e.error || '保存失败')
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePomodoroAction = async (action: string, data?: any) => {
    try {
      await api.post(`/pomodoro/${action}`, data)
      fetchPomodoro()
    } catch (e) { /* ignore */ }
  }

  // 番茄时钟拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!pomodoroRef.current) return
    const rect = pomodoroRef.current.getBoundingClientRect()
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
    setIsDragging(true)
  }

  useEffect(() => {
    if (!isDragging) return
    
    const handleMouseMove = (e: MouseEvent) => {
      setPomodoroPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      })
      setHasDragged(true)
    }
    
    const handleMouseUp = () => setIsDragging(false)
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const pomodoroActive = pomodoro?.status === 'work' || pomodoro?.status === 'rest'

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 fixed top-0 left-0 right-0 z-30 flex items-center px-6">
      {/* 左侧：头像 */}
      <div className="flex items-center gap-5 flex-shrink-0">
        {/* 用户头像菜单 */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 p-1 -m-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className={cn(
              'w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-medium',
              isImageAvatar(user?.avatar)
                ? 'bg-gray-100 dark:bg-gray-700'
                : user?.avatar
                ? 'bg-gray-100 dark:bg-gray-700 text-lg'
                : 'bg-gradient-to-br from-primary-400 to-primary-600 text-white text-sm'
            )}>
              {isImageAvatar(user?.avatar) ? (
                <img src={user?.avatar!} alt={user?.username || 'avatar'} className="w-full h-full object-cover" />
              ) : (
                user?.avatar || user?.username?.charAt(0)?.toUpperCase()
              )}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-tight">{user?.username}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight">
                {user?.role === 'admin' ? '管理员' : '创作者'}
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </button>

          {showUserMenu && (
            <div className="absolute left-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-1 animate-fade-in">
              <button
                onClick={() => {
                  setEditUsername(user?.username || '')
                  setEditAvatar(user?.avatar || '')
                  setShowProfileModal(true)
                  setShowUserMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                个人资料
              </button>
              <button
                onClick={() => { navigate('/settings'); setShowUserMenu(false) }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                系统设置
              </button>
              <hr className="my-1 border-gray-100 dark:border-gray-700" />
              <button
                onClick={() => { logout(); navigate('/login'); setShowUserMenu(false) }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 中间：搜索框 */}
      <div className="flex-1 flex items-center justify-center min-w-0 px-4">
        {/* 搜索框 */}
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索项目、选题、脚本..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-transparent rounded-lg text-sm focus:outline-none focus:bg-white dark:focus:bg-gray-700 focus:border-gray-200 dark:focus:border-gray-600 transition-all text-gray-900 dark:text-gray-100"
            onFocus={() => setShowSearch(true)}
            onBlur={() => setTimeout(() => setShowSearch(false), 200)}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {showSearch && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
              {searchResults.map((result, idx) => (
                <div
                  key={idx}
                  className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200"
                  onClick={() => {
                    setShowSearch(false)
                  }}
                >
                  <span className="text-gray-500 dark:text-gray-400 text-xs mr-2">[{result.type}]</span>
                  {result.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右侧：日期时间 + 番茄钟 + 消息通知 */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* 当前日期时间 */}
        <div className="flex flex-col items-end mr-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 leading-tight">{currentDateStr}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 leading-tight font-mono">{currentTimeStr}</span>
        </div>

        {/* 番茄时钟按钮 */}
        <button
          onClick={() => setShowPomodoro(!showPomodoro)}
          className={cn(
            'p-2 rounded-lg transition-colors relative',
            pomodoroActive ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
          )}
        >
          <Timer className="w-5 h-5" />
          {pomodoroActive && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
          )}
        </button>

        {/* 消息通知 */}
        <button
          onClick={() => navigate('/messages')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors relative"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-medium rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* 番茄时钟弹窗 */}
      {showPomodoro && (
        <div
          ref={pomodoroRef}
          className={cn(
            'fixed bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 animate-fade-in',
            pomodoroMinimized ? 'w-48 p-3' : 'w-80 p-6'
          )}
          style={{
            top: hasDragged ? pomodoroPos.y : 70,
            left: hasDragged ? pomodoroPos.x : (typeof window !== 'undefined' ? window.innerWidth - 340 : 800),
            right: 'auto',
            cursor: isDragging ? 'grabbing' : 'default'
          }}
        >
          {/* 拖拽条 */}
          <div
            className="absolute top-0 left-0 right-0 h-6 cursor-grab rounded-t-2xl"
            onMouseDown={handleMouseDown}
          />

          {/* 关闭/最小化按钮 */}
          <div className="absolute top-2 right-2 flex gap-1 z-10">
            <button
              onClick={() => setPomodoroMinimized(!pomodoroMinimized)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowPomodoro(false)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 完成通知 - 已移到弹窗模式 */}

          {!pomodoroMinimized ? (
            <>
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  {pomodoro?.status === 'rest' ? (
                    <Coffee className="w-5 h-5 text-green-500" />
                  ) : (
                    <Timer className="w-5 h-5 text-red-500" />
                  )}
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {pomodoro?.status === 'work' ? '专注工作中' : pomodoro?.status === 'rest' ? '休息时间' : '番茄时钟'}
                  </span>
                  {/* 已完成番茄数 */}
                  {(pomodoro?.completed_count || 0) > 0 && (
                    <span className="flex items-center gap-1 text-xs text-orange-500 dark:text-orange-400 ml-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {pomodoro?.completed_count}
                    </span>
                  )}
                </div>
                <div className={cn(
                  'text-5xl font-bold font-mono tracking-tight',
                  pomodoro?.status === 'work' ? 'text-red-600 dark:text-red-400' : pomodoro?.status === 'rest' ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-gray-100'
                )}>
                  {formatDuration(displaySeconds)}
                </div>
              </div>

              {/* 进度条 */}
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full mb-4 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-1000',
                    pomodoro?.status === 'work' ? 'bg-red-500' : pomodoro?.status === 'rest' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  )}
                  style={{
                    width: pomodoro ? `${(displaySeconds / (pomodoro.status === 'rest' ? pomodoro.rest_duration_cfg : pomodoro.work_duration_cfg)) * 100}%` : '100%'
                  }}
                />
              </div>

              {/* 停止状态：显示工作/休息模式选择 */}
              {pomodoro?.status === 'stop' || !pomodoro ? (
                <div className="mb-4">
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setPomodoroMode('work')}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
                        pomodoroMode === 'work'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-2 border-red-300 dark:border-red-700'
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                      )}
                    >
                      <Timer className="w-4 h-4" />
                      专注 {Math.floor((pomodoro?.work_duration_cfg || 1500) / 60)}分钟
                    </button>
                    <button
                      onClick={() => setPomodoroMode('rest')}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
                        pomodoroMode === 'rest'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-2 border-green-300 dark:border-green-700'
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                      )}
                    >
                      <Coffee className="w-4 h-4" />
                      休息 {Math.floor((pomodoro?.rest_duration_cfg || 300) / 60)}分钟
                    </button>
                  </div>
                </div>
              ) : null}

              {/* 控制按钮 */}
              <div className="flex items-center justify-center gap-3">
                {(pomodoro?.status === 'work' || pomodoro?.status === 'rest') ? (
                  <>
                    <button
                      onClick={() => handlePomodoroAction('pause')}
                      className="w-12 h-12 rounded-full bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 transition-colors shadow-lg"
                    >
                      <Pause className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handlePomodoroAction('skip')}
                      className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title="跳过当前阶段"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </>
                ) : pomodoro?.status === 'paused' ? (
                  <button
                    onClick={() => handlePomodoroAction('resume')}
                    className="w-12 h-12 rounded-full bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 transition-colors shadow-lg"
                  >
                    <Play className="w-5 h-5 ml-0.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handlePomodoroAction('start', { mode: pomodoroMode })}
                    className="w-12 h-12 rounded-full bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 transition-colors shadow-lg"
                  >
                    <Play className="w-5 h-5 ml-0.5" />
                  </button>
                )}
                {(pomodoro?.status === 'work' || pomodoro?.status === 'rest' || pomodoro?.status === 'paused') && (
                  <button
                    onClick={() => handlePomodoroAction('stop')}
                    className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="停止"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handlePomodoroAction('reset')}
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="重置统计"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* 统计信息 */}
              {(pomodoro?.completed_count || 0) > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>今日完成 {pomodoro?.completed_count} 个番茄</span>
                  <span>累计专注 {Math.floor((pomodoro?.total_duration || 0) / 60)} 分钟</span>
                </div>
              )}

              {/* 设置入口 */}
              <button
                onClick={() => navigate('/settings')}
                className="mt-3 w-full text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 flex items-center justify-center gap-1"
              >
                <Settings className="w-3 h-3" />
                自定义时长
              </button>
            </>
          ) : (
            /* 最小化状态 */
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-2.5 h-2.5 rounded-full animate-pulse',
                  pomodoro?.status === 'work' ? 'bg-red-500' : pomodoro?.status === 'rest' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                )} />
                <span className="text-lg font-mono font-bold text-gray-700 dark:text-gray-200">
                  {formatDuration(displaySeconds)}
                </span>
              </div>
              <button
                onClick={() => setPomodoroMinimized(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <Timer className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 番茄时钟完成选择弹窗 */}
      {showCompleteModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center animate-fade-in">
            {completedMode === 'work' ? (
              <>
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">专注完成！</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                  你已完成一个番茄钟，累计专注 {Math.floor((pomodoro?.total_duration || 0) / 60)} 分钟。
                  <br />休息一下，放松眼睛吧～
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      handlePomodoroAction('start', { mode: 'rest' })
                      setShowCompleteModal(false)
                    }}
                    className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Coffee className="w-4 h-4" />
                    开始休息
                  </button>
                  <button
                    onClick={() => {
                      handlePomodoroAction('start', { mode: 'work' })
                      setShowCompleteModal(false)
                    }}
                    className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Timer className="w-4 h-4" />
                    继续工作
                  </button>
                </div>
                <button
                  onClick={() => {
                    handlePomodoroAction('stop')
                    setShowCompleteModal(false)
                  }}
                  className="mt-3 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  先停下来
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
                  <Timer className="w-8 h-8 text-primary-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">休息结束！</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                  充电完毕，精力充沛！
                  <br />准备开始下一个番茄钟了吗？
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      handlePomodoroAction('start', { mode: 'work' })
                      setShowCompleteModal(false)
                    }}
                    className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Timer className="w-4 h-4" />
                    继续工作
                  </button>
                  <button
                    onClick={() => {
                      handlePomodoroAction('start', { mode: 'rest' })
                      setShowCompleteModal(false)
                    }}
                    className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Coffee className="w-4 h-4" />
                    继续休息
                  </button>
                </div>
                <button
                  onClick={() => {
                    handlePomodoroAction('stop')
                    setShowCompleteModal(false)
                  }}
                  className="mt-3 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  先停下来
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 个人资料编辑弹窗 */}
      {showProfileModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">编辑个人资料</h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* 头像选择 */}
              <ImageUpload
                value={editAvatar}
                onChange={(value) => setEditAvatar(value)}
                uploadEndpoint="/upload/user-avatar"
                size="md"
                label="账号头像"
                emojis={['🎨', '🎬', '📝', '🎯', '🚀', '🌟', '💡', '🎵', '🤖', '🔥', '📊', '✨']}
              />

              {/* 用户名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">用户名</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="请输入用户名"
                  className="input-field"
                  maxLength={20}
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{editUsername.length}/20</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowProfileModal(false)}
                className="flex-1 btn-outline"
              >
                取消
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile || !editUsername.trim()}
                className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {savingProfile ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {savingProfile ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
