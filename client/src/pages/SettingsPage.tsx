import { useState, useEffect } from 'react'
import {
  Settings,
  User,
  Bot,
  Shield,
  Database,
  Bell,
  Clock,
  Save,
  Eye,
  EyeOff,
  AlertTriangle,
  Zap,
  Sun,
  Moon,
  Monitor,
  Palette,
} from 'lucide-react'
import api from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const { mode: themeMode, setMode: setThemeMode } = useThemeStore()
  const [activeTab, setActiveTab] = useState('profile')
  const [profile, setProfile] = useState<any>({})
  const [llmConfig, setLlmConfig] = useState<any>({})
  const [showApiKey, setShowApiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null)
  const [pomodoroWork, setPomodoroWork] = useState(25)
  const [pomodoroRest, setPomodoroRest] = useState(5)

  useEffect(() => {
    fetchProfile()
    fetchLLMConfig()
    fetchPomodoroConfig()
  }, [])

  const fetchProfile = async () => {
    try {
      const res: any = await api.get('/profile')
      setProfile(res.profile || {})
    } catch (e) { /* ignore */ }
  }

  const fetchLLMConfig = async () => {
    try {
      const res: any = await api.get('/llm-config')
      setLlmConfig(res.config || {})
    } catch (e) { /* ignore */ }
  }

  const fetchPomodoroConfig = async () => {
    try {
      const res: any = await api.get('/pomodoro')
      if (res.pomodoro) {
        setPomodoroWork(Math.round(res.pomodoro.work_duration_cfg / 60))
        setPomodoroRest(Math.round(res.pomodoro.rest_duration_cfg / 60))
      }
    } catch (e) { /* ignore */ }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await api.put('/profile', profile)
      alert('保存成功')
    } catch (e) {
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveLLM = async () => {
    setSaving(true)
    setTestResult(null)
    try {
      await api.put('/llm-config', llmConfig)
      alert('保存成功')
      fetchLLMConfig()
    } catch (e: any) {
      alert(e.error || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleTestLLM = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      // 先保存当前配置
      await api.put('/llm-config', llmConfig)
      // 然后调用测试接口
      const res: any = await api.post('/llm-config/test', {
        prompt: '请用一句话介绍你自己。'
      })
      if (res.success) {
        setTestResult({ success: true, message: `模型响应正常，消耗 ${res.tokenInput + res.tokenOutput} tokens` })
      } else {
        setTestResult({ success: false, message: res.error || '未知错误' })
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.error || e.message || '连接失败' })
    } finally {
      setTesting(false)
    }
  }

  const handleSavePomodoro = async () => {
    setSaving(true)
    try {
      await api.put('/pomodoro/config', {
        work_duration: pomodoroWork * 60,
        rest_duration: pomodoroRest * 60,
      })
      alert('保存成功')
    } catch (e) {
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { key: 'profile', label: '账号定位', icon: User },
    { key: 'llm', label: '大模型配置', icon: Bot },
    { key: 'pomodoro', label: '番茄时钟', icon: Clock },
    { key: 'appearance', label: '外观主题', icon: Palette },
    { key: 'platforms', label: '平台API', icon: Bell },
    { key: 'backup', label: '备份恢复', icon: Database },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
        <p className="text-gray-500 text-sm mt-1">管理你的账号信息、AI配置和偏好设置</p>
      </div>

      <div className="flex gap-6">
        {/* 左侧菜单 */}
        <div className="w-56 flex-shrink-0">
          <div className="card p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    activeTab === tab.key
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 右侧内容 */}
        <div className="flex-1">
          {/* 账号定位 */}
          {activeTab === 'profile' && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">账号定位</h2>
              <div className="space-y-5 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">账号定位</label>
                  <textarea
                    value={profile.account_positioning || ''}
                    onChange={(e) => setProfile({ ...profile, account_positioning: e.target.value })}
                    rows={3}
                    placeholder="你的账号做什么内容？解决什么问题？"
                    className="input-field resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">目标人群</label>
                  <textarea
                    value={profile.target_audience || ''}
                    onChange={(e) => setProfile({ ...profile, target_audience: e.target.value })}
                    rows={3}
                    placeholder="描述你的目标受众特征"
                    className="input-field resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">内容风格</label>
                  <input
                    type="text"
                    value={profile.content_style || ''}
                    onChange={(e) => setProfile({ ...profile, content_style: e.target.value })}
                    placeholder="例如：专业干货型、轻松娱乐型..."
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">选题偏好</label>
                  <textarea
                    value={profile.topic_preferences || ''}
                    onChange={(e) => setProfile({ ...profile, topic_preferences: e.target.value })}
                    rows={2}
                    placeholder="你感兴趣的选题方向"
                    className="input-field resize-none"
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? '保存中...' : '保存设置'}
                </button>
              </div>
            </div>
          )}

          {/* 大模型配置 */}
          {activeTab === 'llm' && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">大模型配置</h2>
              <p className="text-sm text-gray-500 mb-6">
                配置火山方舟API，启用真实AI能力。未配置时系统使用模拟数据。
              </p>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">火山方舟接入指南</p>
                    <ol className="mt-2 space-y-1 text-blue-700 list-decimal list-inside">
                      <li>登录 <a href="https://console.volcengine.com/ark" target="_blank" rel="noopener noreferrer" className="underline">火山方舟控制台</a></li>
                      <li>在「API Key 管理」中创建 API Key（不是 IAM 的 AK/SK）</li>
                      <li>在「模型广场」开通模型，创建「推理接入点」获取模型ID</li>
                      <li>将 API Key 和接入点模型ID 填入下方</li>
                    </ol>
                    <p className="mt-2 text-xs text-blue-600">
                      说明：你提供的 AccessKeyId / SecretAccessKey 是 IAM 凭证，
                      火山方舟 OpenAI 兼容接口使用独立的 API Key（Bearer Token）认证。
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700">
                  <p className="font-medium">成本管控提示</p>
                  <p className="mt-1">
                    所有AI调用消耗的Token计入你的火山方舟账号账单。
                    系统内置任务限流、执行预估、每日上限、异常降级等成本管控机制。
                  </p>
                </div>
              </div>

              <div className="space-y-5 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">服务商</label>
                  <select
                    value={llmConfig.provider || 'doubao'}
                    onChange={(e) => setLlmConfig({ ...llmConfig, provider: e.target.value })}
                    className="input-field"
                  >
                    <option value="doubao">豆包（火山方舟）</option>
                    <option value="openai">OpenAI</option>
                    <option value="custom">自定义（OpenAI兼容）</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    API Key
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={llmConfig.api_key || ''}
                      onChange={(e) => setLlmConfig({ ...llmConfig, api_key: e.target.value })}
                      placeholder="例如：ark-xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="input-field pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">在火山方舟控制台「API Key 管理」中创建</p>
                  {llmConfig.hasApiKey && <p className="text-xs text-green-600 mt-1">✓ 已配置API Key</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">接口地址 (Base URL)</label>
                  <input
                    type="text"
                    value={llmConfig.api_endpoint || ''}
                    onChange={(e) => setLlmConfig({ ...llmConfig, api_endpoint: e.target.value })}
                    placeholder="https://ark.cn-beijing.volces.com/api/v3"
                    className="input-field"
                  />
                  <p className="text-xs text-gray-400 mt-1">默认：https://ark.cn-beijing.volces.com/api/v3</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    模型名称 (接入点ID)
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={llmConfig.model_name || ''}
                    onChange={(e) => setLlmConfig({ ...llmConfig, model_name: e.target.value })}
                    placeholder="例如：doubao-seed-2-1-pro-xxxxxxxx"
                    className="input-field"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    在「推理接入点」中创建接入点后获得，格式通常为：模型名-随机串
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    每日Token上限
                  </label>
                  <input
                    type="number"
                    value={llmConfig.daily_token_limit || 500000}
                    onChange={(e) => setLlmConfig({ ...llmConfig, daily_token_limit: parseInt(e.target.value) })}
                    className="input-field"
                  />
                  <p className="text-xs text-gray-400 mt-1">当日消耗达到上限后，所有AI任务将暂停，次日自动重置</p>
                </div>

                {/* 全局公共约束Prompt */}
                <div className="mt-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    全局公共约束 Prompt
                  </label>
                  <textarea
                    value={llmConfig.global_constraint_prompt || ''}
                    onChange={(e) => setLlmConfig({ ...llmConfig, global_constraint_prompt: e.target.value })}
                    placeholder="例如：&#10;1. 所有输出必须使用中文&#10;2. 回答要简洁明了，避免冗余&#10;3. 涉及数据时需注明来源&#10;4. 禁止生成违法违规内容"
                    rows={5}
                    className="input-field resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    该约束会附加到所有智能体的系统提示词之前，对所有AI对话生效。留空则不使用。
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSaveLLM}
                    disabled={saving}
                    className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? '保存中...' : '保存配置'}
                  </button>
                  <button
                    onClick={handleTestLLM}
                    disabled={testing || !llmConfig.api_key}
                    className="btn-outline flex items-center gap-2 disabled:opacity-50"
                  >
                    {testing ? (
                      <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    {testing ? '测试中...' : '测试连接'}
                  </button>
                </div>

                {testResult && (
                  <div className={`p-3 rounded-xl text-sm ${
                    testResult.success 
                      ? 'bg-green-50 border border-green-100 text-green-700' 
                      : 'bg-red-50 border border-red-100 text-red-700'
                  }`}>
                    {testResult.success ? '✓ 连接成功！AI模型响应正常。' : `✗ 连接失败：${testResult.message}`}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 番茄时钟 */}
          {activeTab === 'pomodoro' && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">番茄时钟设置</h2>
              <p className="text-sm text-gray-500 mb-6">自定义番茄钟的工作和休息时长</p>
              <div className="space-y-5 max-w-sm">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">工作时长（分钟）</label>
                  <input
                    type="number"
                    value={pomodoroWork}
                    onChange={(e) => setPomodoroWork(parseInt(e.target.value) || 25)}
                    min={1}
                    max={120}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">休息时长（分钟）</label>
                  <input
                    type="number"
                    value={pomodoroRest}
                    onChange={(e) => setPomodoroRest(parseInt(e.target.value) || 5)}
                    min={1}
                    max={60}
                    className="input-field"
                  />
                </div>
                <button
                  onClick={handleSavePomodoro}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? '保存中...' : '保存设置'}
                </button>
              </div>
            </div>
          )}

          {/* 外观主题 */}
          {activeTab === 'appearance' && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">外观主题</h2>
              <p className="text-sm text-gray-500 mb-6">选择你喜欢的界面主题，切换后立即生效</p>
              <div className="space-y-4">
                <ThemeOption
                  icon={Sun}
                  title="浅色模式"
                  desc="界面以白色、浅灰为主，适合白天或光线充足的环境"
                  active={themeMode === 'light'}
                  onClick={() => setThemeMode('light')}
                  preview="light"
                />
                <ThemeOption
                  icon={Moon}
                  title="深色模式"
                  desc="界面以深灰、黑色为主，降低屏幕眩光，适合夜间或暗光环境，更护眼"
                  active={themeMode === 'dark'}
                  onClick={() => setThemeMode('dark')}
                  preview="dark"
                />
                <ThemeOption
                  icon={Monitor}
                  title="跟随系统"
                  desc="自动跟随用户操作系统的明暗设置进行切换（推荐）"
                  active={themeMode === 'system'}
                  onClick={() => setThemeMode('system')}
                  preview="system"
                  recommended
                />
              </div>
            </div>
          )}

          {/* 平台API */}
          {activeTab === 'platforms' && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">自媒体平台API</h2>
              <p className="text-sm text-gray-500 mb-6">绑定各平台API，自动同步视频数据</p>
              <div className="space-y-3">
                {['抖音', '快手', 'B站', '小红书', '视频号'].map((platform) => (
                  <div key={platform} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <h4 className="font-medium text-gray-900">{platform}</h4>
                      <p className="text-xs text-gray-400">未绑定</p>
                    </div>
                    <button className="btn-outline text-sm py-1.5">去绑定</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 备份恢复 */}
          {activeTab === 'backup' && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">数据备份与恢复</h2>
              <p className="text-sm text-gray-500 mb-6">整机导出所有数据，支持迁移和恢复</p>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">整机备份导出</h4>
                    <p className="text-xs text-gray-400 mt-0.5">导出项目、脚本、知识库、对标库全部数据</p>
                  </div>
                  <button className="btn-primary text-sm">导出备份</button>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">从备份恢复</h4>
                    <p className="text-xs text-gray-400 mt-0.5">导入之前导出的备份文件</p>
                  </div>
                  <button className="btn-outline text-sm">导入备份</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 主题选项组件
function ThemeOption({
  icon: Icon,
  title,
  desc,
  active,
  onClick,
  preview,
  recommended,
}: {
  icon: any
  title: string
  desc: string
  active: boolean
  onClick: () => void
  preview: 'light' | 'dark' | 'system'
  recommended?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={`relative flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
        active
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-200 hover:border-gray-300 bg-gray-50'
      }`}
    >
      {/* 图标 */}
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
          active ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
        }`}
      >
        <Icon className="w-6 h-6" />
      </div>

      {/* 文字 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-gray-900">{title}</h4>
          {recommended && (
            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-600 rounded-full">
              推荐
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
      </div>

      {/* 预览色块 */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {preview === 'light' && (
          <>
            <div className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600" style={{ backgroundColor: '#ffffff' }} />
            <div className="w-6 h-6 rounded border border-gray-200 dark:border-gray-600" style={{ backgroundColor: '#f3f4f6' }} />
          </>
        )}
        {preview === 'dark' && (
          <>
            <div className="w-6 h-6 rounded border border-gray-700" style={{ backgroundColor: '#1f2937' }} />
            <div className="w-6 h-6 rounded border border-gray-800" style={{ backgroundColor: '#111827' }} />
          </>
        )}
        {preview === 'system' && (
          <>
            <div className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600" style={{ backgroundColor: '#ffffff' }} />
            <div className="w-6 h-6 rounded border border-gray-700" style={{ backgroundColor: '#1f2937' }} />
            <div className="w-6 h-6 rounded border border-gray-400" style={{ background: 'linear-gradient(to right, #ffffff, #1f2937)' }} />
          </>
        )}
      </div>

      {/* 选中标记 */}
      {active && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  )
}
