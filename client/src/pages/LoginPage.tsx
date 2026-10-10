import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Sparkles, Bot, Target, TrendingUp, ArrowLeft, Phone, Mail, CheckCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, register, forgotPasswordSendCode, forgotPasswordReset } = useAuthStore()
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 忘记密码相关状态
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotStep, setForgotStep] = useState(1) // 1: 输入联系方式, 2: 输入验证码+新密码, 3: 成功
  const [contact, setContact] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [maskedContact, setMaskedContact] = useState('')
  const [sentCode, setSentCode] = useState('') // 开发阶段保存验证码
  const [countdown, setCountdown] = useState(0)

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

  // 发送验证码
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError('')
    setForgotLoading(true)

    try {
      const res = await forgotPasswordSendCode(contact)
      setMaskedContact(res.maskedContact)
      setSentCode(res.code) // 开发阶段保存验证码用于展示
      setForgotStep(2)
      // 开始倒计时
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err: any) {
      setForgotError(err.error || '发送验证码失败')
    } finally {
      setForgotLoading(false)
    }
  }

  // 重置密码
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError('')

    if (newPassword !== confirmPassword) {
      setForgotError('两次输入的密码不一致')
      return
    }
    if (newPassword.length < 6) {
      setForgotError('新密码至少6个字符')
      return
    }

    setForgotLoading(true)

    try {
      await forgotPasswordReset(contact, resetCode, newPassword)
      setForgotStep(3)
    } catch (err: any) {
      setForgotError(err.error || '重置密码失败')
    } finally {
      setForgotLoading(false)
    }
  }

  // 重置忘记密码流程
  const resetForgotFlow = () => {
    setShowForgotPassword(false)
    setForgotStep(1)
    setContact('')
    setResetCode('')
    setNewPassword('')
    setConfirmPassword('')
    setForgotError('')
    setMaskedContact('')
    setSentCode('')
    setCountdown(0)
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
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          {/* 移动端Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-6 md:mb-10">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-lg md:text-xl">
              L
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg md:text-xl">LongH AI</h1>
              <p className="text-xs text-gray-400">短视频创作工作台</p>
            </div>
          </div>

          {/* ============ 忘记密码面板 ============ */}
          {showForgotPassword ? (
            <div className="bg-white rounded-xl md:rounded-2xl shadow-xl border border-gray-100 p-5 md:p-8">
              {/* 返回按钮 */}
              <button
                onClick={resetForgotFlow}
                className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                返回登录
              </button>

              <div className="text-center mb-5 md:mb-8">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1 md:mb-2">
                  找回密码
                </h2>
                {forgotStep === 1 && (
                  <p className="text-gray-500 text-xs md:text-sm">
                    输入注册时的手机号或邮箱，获取验证码
                  </p>
                )}
                {forgotStep === 2 && (
                  <p className="text-gray-500 text-xs md:text-sm">
                    验证码已发送至 <span className="font-medium text-gray-700">{maskedContact}</span>
                  </p>
                )}
                {forgotStep === 3 && (
                  <p className="text-gray-500 text-xs md:text-sm">
                    密码已成功重置，请使用新密码登录
                  </p>
                )}
              </div>

              {/* Step 1: 输入联系方式 */}
              {forgotStep === 1 && (
                <form onSubmit={handleSendCode} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      手机号 / 邮箱
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        placeholder="请输入注册时的手机号或邮箱"
                        className="input-field pl-10"
                        required
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {contact.includes('@') ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {forgotError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                      {forgotError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full btn-primary py-2.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    发送验证码
                  </button>
                </form>
              )}

              {/* Step 2: 输入验证码 + 新密码 */}
              {forgotStep === 2 && (
                <form onSubmit={handleResetPassword} className="space-y-5">
                  {/* 开发阶段提示验证码 */}
                  {sentCode && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                      <span className="font-medium">验证码：</span>
                      <span className="text-lg font-bold tracking-widest ml-2">{sentCode}</span>
                      <p className="text-xs mt-1 text-amber-600">
                        （开发阶段显示验证码，接入短信/邮件服务后将通过手机/邮箱发送）
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      验证码
                    </label>
                    <input
                      type="text"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      placeholder="请输入6位验证码"
                      className="input-field tracking-widest text-center text-lg"
                      required
                      maxLength={6}
                    />
                  </div>

                  {countdown > 0 ? (
                    <div className="text-center text-xs text-gray-400">
                      {countdown}秒后可重新获取
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setForgotStep(1)
                        setForgotError('')
                      }}
                      className="w-full text-center text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      重新发送验证码
                    </button>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      新密码
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="请输入新密码（至少6位）"
                        className="input-field pr-10"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      确认新密码
                    </label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="请再次输入新密码"
                      className="input-field pr-10"
                      required
                      minLength={6}
                    />
                  </div>

                  {forgotError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
                      {forgotError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full btn-primary py-2.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    确认重置密码
                  </button>
                </form>
              )}

              {/* Step 3: 成功 */}
              {forgotStep === 3 && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="text-gray-700 font-medium mb-1">密码重置成功</p>
                  <p className="text-gray-400 text-sm mb-6">请使用新密码登录账号</p>
                  <button
                    onClick={resetForgotFlow}
                    className="w-full btn-primary py-2.5"
                  >
                    返回登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ============ 正常登录/注册面板 ============ */
            <div className="bg-white rounded-xl md:rounded-2xl shadow-xl border border-gray-100 p-5 md:p-8">
              <div className="text-center mb-5 md:mb-8">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1 md:mb-2">
                  {isRegister ? '创建账号' : '欢迎回来'}
                </h2>
                <p className="text-gray-500 text-xs md:text-sm">
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      密码
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
                    >
                      忘记密码？
                    </button>
                  </div>
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
          )}

          {!showForgotPassword && (
            <p className="text-center text-xs text-gray-400 mt-6">
              首次使用建议注册账号，系统会自动为你初始化8个AI智能体和16个内置技能
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
