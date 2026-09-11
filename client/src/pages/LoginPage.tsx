import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Sparkles, Bot, Target, TrendingUp } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, register } = useAuthStore()
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isRegister) {
        await register(username, password)
      } else {
        await login(username, password)
      }
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.error || '操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: Bot, title: '8大AI智能体', desc: '选题、脚本、设计、运营全流程AI协作' },
    { icon: Target, title: '6维度对标拆解', desc: '深度分析爆款视频，提炼可复用方法论' },
    { icon: TrendingUp, title: '数据驱动增长', desc: '全链路数据复盘，持续优化内容表现' },
  ]

  return (
    <div className="min-h-screen flex">
      {/* 左侧品牌区 */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* 装饰背景 */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-cyan-400 blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold">
              L
            </div>
            <div>
              <h1 className="text-2xl font-bold">LongH AI</h1>
              <p className="text-primary-200 text-sm">短视频创作工作台</p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <h2 className="text-4xl font-bold mb-4 leading-tight">
            让每个创作者
            <br />
            都拥有一支AI团队
          </h2>
          <p className="text-primary-200 text-lg mb-12 max-w-md">
            从选题策划到数据复盘，8个职能化AI智能体协同工作，
            帮助你提升内容质量、提高创作效率、沉淀个人方法论。
          </p>

          <div className="space-y-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon
              return (
                <div key={idx} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{feature.title}</h3>
                    <p className="text-primary-200 text-sm">{feature.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="relative z-10 text-primary-300 text-sm">
          © 2026 LongH AI Workbench v2.1.0
        </div>
      </div>

      {/* 右侧表单区 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* 移动端Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-lg">
              L
            </div>
            <div>
              <h1 className="font-bold text-gray-900">LongH AI</h1>
              <p className="text-xs text-gray-400">短视频创作工作台</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isRegister ? '创建账号' : '欢迎回来'}
              </h2>
              <p className="text-gray-500 text-sm">
                {isRegister ? '注册后即可体验完整AI创作能力' : '登录你的账号继续创作'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  className="input-field"
                  required
                  minLength={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  密码
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="input-field pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-2.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isRegister ? '立即注册' : '登录'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
              {isRegister ? '已有账号？' : '还没有账号？'}
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="text-primary-600 hover:text-primary-700 font-medium ml-1"
              >
                {isRegister ? '去登录' : '立即注册'}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            首次使用建议注册账号，系统会自动为你初始化8个AI智能体和16个内置技能
          </p>
        </div>
      </div>
    </div>
  )
}
