import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Kanban,
  Users,
  Bot,
  Settings,
} from 'lucide-react'
import { cn } from '@/utils'

interface TabItem {
  path: string
  label: string
  icon: React.ElementType
}

const tabs: TabItem[] = [
  { path: '/dashboard', label: '首页', icon: LayoutDashboard },
  { path: '/projects', label: '项目', icon: Kanban },
  { path: '/agent-group', label: '群聊', icon: Users },
  { path: '/agents', label: '团队', icon: Bot },
  { path: '/settings', label: '设置', icon: Settings },
]

export default function BottomTabBar() {
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="flex items-center justify-around h-14">
        {tabs.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname.startsWith(item.path)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                isActive
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive ? 'text-primary-500' : '')} />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
