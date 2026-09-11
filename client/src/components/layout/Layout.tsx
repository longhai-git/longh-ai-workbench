import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import BottomTabBar from './BottomTabBar'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* 桌面端侧边栏（移动端隐藏） */}
      <Sidebar />
      
      {/* 顶部栏 */}
      <Topbar />
      
      {/* 主内容区 */}
      <main className="md:ml-64 pt-16 min-h-screen pb-16 md:pb-0">
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
      
      {/* 移动端底部Tab栏（桌面端隐藏） */}
      <BottomTabBar />
    </div>
  )
}
