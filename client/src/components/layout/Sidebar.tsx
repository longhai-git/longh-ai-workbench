import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Kanban,
  Lightbulb,
  FileText,
  Image,
  PlayCircle,
  Bot,
  Sparkles,
  Target,
  BookOpen,
  MessageSquare,
  Calendar,
  Users,
} from 'lucide-react'
import { cn } from '@/utils'
import { useAuthStore } from '@/store/authStore'

interface NavItem {
  path: string
  label: string
  icon: React.ElementType
  badge?: string
}

const mainNav: NavItem[] = [
  { path: '/dashboard', label: '仪表板', icon: LayoutDashboard },
  { path: '/projects', label: '项目看板', icon: Kanban, badge: '核心' },
]

const contentNav: NavItem[] = [
  { path: '/topics', label: '选题池', icon: Lightbulb },
  { path: '/scripts', label: '脚本库', icon: FileText },
  { path: '/assets', label: '素材库', icon: Image },
  { path: '/videos', label: '视频库', icon: PlayCircle },
]

const aiNav: NavItem[] = [
  { path: '/agents', label: 'AI团队', icon: Bot },
  { path: '/skills', label: '技能库', icon: Sparkles },
  { path: '/agent-group', label: '智能体工作群', icon: Users, badge: '新' },
]

const analysisNav: NavItem[] = [
  { path: '/benchmarks', label: '对标库', icon: Target },
  { path: '/knowledge', label: '知识库', icon: BookOpen },
]

const otherNav: NavItem[] = [
  { path: '/messages', label: '消息中心', icon: MessageSquare },
  { path: '/calendar', label: '日历', icon: Calendar },
]

export default function Sidebar() {
  const location = useLocation()
  const { user } = useAuthStore()

  const renderNavGroup = (title: string, items: NavItem[]) => (
    <div className="mb-6">
      <h3 className="px-4 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        {title}
      </h3>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname.startsWith(item.path)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-all',
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500')} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className={cn(
                  'px-1.5 py-0.5 text-[10px] font-medium rounded',
                  item.badge === '新' ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
                )}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )

  return (
    <aside className="hidden md:block w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col fixed left-0 top-16 bottom-0 z-20">
      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        {renderNavGroup('工作台', mainNav)}
        {renderNavGroup('内容库', contentNav)}
        {renderNavGroup('AI智能体', aiNav)}
        {renderNavGroup('分析沉淀', analysisNav)}
        {renderNavGroup('其他', otherNav)}
      </div>
    </aside>
  )
}
