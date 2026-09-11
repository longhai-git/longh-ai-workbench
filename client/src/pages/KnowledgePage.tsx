import { useState, useEffect } from 'react'
import { BookOpen, Plus, Search, MessageSquare, User, Send, Tag, Pin } from 'lucide-react'
import api from '@/services/api'
import type { KnowledgeEntry } from '@/types'

const categories = [
  { code: 'platform_rules', name: '平台规则', color: 'bg-blue-100 text-blue-700' },
  { code: 'benchmark_insights', name: '对标借鉴', color: 'bg-pink-100 text-pink-700' },
  { code: 'review_experience', name: '复盘经验', color: 'bg-green-100 text-green-700' },
  { code: 'industry_insights', name: '行业洞察', color: 'bg-purple-100 text-purple-700' },
  { code: 'agent_learning', name: '智能体学习', color: 'bg-amber-100 text-amber-700' },
  { code: 'inspiration', name: '灵感库', color: 'bg-rose-100 text-rose-700' },
  { code: 'life_log', name: '生活档案', color: 'bg-cyan-100 text-cyan-700' },
  { code: 'experience', name: '经验库', color: 'bg-emerald-100 text-emerald-700' },
  { code: 'cognition', name: '认知库', color: 'bg-indigo-100 text-indigo-700' },
]

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<'entries' | 'chat' | 'profile'>('entries')
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (activeTab === 'entries') fetchEntries()
    if (activeTab === 'chat') fetchChats()
  }, [activeTab, categoryFilter])

  const fetchEntries = async () => {
    try {
      const res: any = await api.get('/knowledge/entries', {
        params: { category: categoryFilter === 'all' ? undefined : categoryFilter }
      })
      setEntries(res.entries || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchChats = async () => {
    try {
      const res: any = await api.get('/knowledge/chats')
      setChatMessages(res.chats || [])
    } catch (e) {
      console.error(e)
    }
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages([...chatMessages, { role: 'user', content: userMsg }])

    // 模拟AI回复
    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '已收到你的消息，我正在整理知识条目...\n\n（这是演示模式，真实AI需要配置API Key）'
      }])
    }, 1000)
  }

  const getCategoryInfo = (code: string) => {
    return categories.find(c => c.code === code) || { name: code, color: 'bg-gray-100 text-gray-700' }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">知识库</h1>
          <p className="text-gray-500 text-sm mt-1">对话式知识沉淀，自动积累创作方法论和个人画像</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          新建条目
        </button>
      </div>

      {/* Tab切换 */}
      <div className="flex gap-2">
        {[
          { key: 'entries', label: '知识条目', icon: BookOpen },
          { key: 'chat', label: '知识对话', icon: MessageSquare },
          { key: 'profile', label: '创作人画像', icon: User },
        ].map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 知识条目 */}
      {activeTab === 'entries' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 左侧分类 */}
          <div className="card p-4 h-fit">
            <h3 className="font-semibold text-gray-900 mb-3">分类</h3>
            <div className="space-y-1">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  categoryFilter === 'all' ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                全部条目
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.code}
                  onClick={() => setCategoryFilter(cat.code)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    categoryFilter === cat.code ? 'bg-primary-50 text-primary-700 font-medium' : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${cat.color.split(' ')[0]}`} />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* 右侧条目列表 */}
          <div className="lg:col-span-3 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索知识条目..."
                className="input-field pl-9 w-full"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-6 h-6 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div className="card p-12 text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">暂无知识条目</p>
                <p className="text-sm text-gray-400 mt-1">通过知识对话自动积累，或手动创建</p>
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => {
                  const catInfo = getCategoryInfo(entry.category)
                  return (
                    <div key={entry.id} className="card p-4 hover:shadow-md transition-shadow cursor-pointer">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`badge ${catInfo.color}`}>{catInfo.name}</span>
                          {entry.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-500" />}
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(entry.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">{entry.title}</h4>
                      {entry.content && (
                        <p className="text-sm text-gray-500 line-clamp-2">{entry.content}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 知识对话 */}
      {activeTab === 'chat' && (
        <div className="card h-[600px] flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">知识对话</h3>
            <p className="text-xs text-gray-400 mt-1">和AI对话，自动提取整理知识条目</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>开始对话，AI会自动提取知识</p>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-primary-500 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-gray-100">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="输入任何内容，AI自动提取知识..."
                className="flex-1 input-field"
              />
              <button onClick={handleSendMessage} className="btn-primary px-4">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 创作人画像 */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { dim: 'style', name: '创作风格', desc: '语言风格、内容调性' },
            { dim: 'decision', name: '决策模式', desc: '决策方式、风险偏好' },
            { dim: 'aesthetic', name: '审美标准', desc: '视觉偏好、设计品味' },
            { dim: 'philosophy', name: '内容哲学', desc: '内容价值观、选题逻辑' },
            { dim: 'interaction', name: '互动模式', desc: '互动方式、评论风格' },
          ].map((dim) => (
            <div key={dim.dim} className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-1">{dim.name}</h3>
              <p className="text-xs text-gray-400 mb-4">{dim.desc}</p>
              <div className="text-center py-4 text-gray-400 text-sm">
                <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
                暂无数据
              </div>
              <button className="w-full text-sm text-primary-600 hover:text-primary-700 py-2">
                手动添加
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
