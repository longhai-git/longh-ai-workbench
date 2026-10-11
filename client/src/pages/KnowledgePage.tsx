import { useState, useEffect } from 'react'
import { BookOpen, Plus, Search, MessageSquare, User, Send, Tag, Pin, Edit2, Trash2, X, Save, Sparkles } from 'lucide-react'
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

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  extractedEntries?: any[]
}

interface EntryForm {
  category: string
  title: string
  content: string
  source: string
  value_analysis: string
  tags: string
}

const emptyForm: EntryForm = {
  category: 'platform_rules',
  title: '',
  content: '',
  source: '',
  value_analysis: '',
  tags: '',
}

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<'entries' | 'chat' | 'profile'>('entries')
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [chatLoading, setChatLoading] = useState(false)

  // 新建/编辑弹窗
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EntryForm>(emptyForm)

  // 查看详情
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => {
    if (activeTab === 'entries') fetchEntries()
    if (activeTab === 'chat') fetchChats()
  }, [activeTab, categoryFilter, searchQuery])

  const fetchEntries = async () => {
    try {
      const res: any = await api.get('/knowledge/entries', {
        params: {
          category: categoryFilter === 'all' ? undefined : categoryFilter,
          keyword: searchQuery || undefined,
        }
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
    if (!chatInput.trim() || chatLoading) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setChatLoading(true)

    try {
      const res: any = await api.post('/knowledge/chats/ask', { content: userMsg })
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: res.reply,
        extractedEntries: res.extractedEntries,
      }])
      // 刷新条目列表（可能新增了）
      if (activeTab === 'entries') fetchEntries()
    } catch (e) {
      console.error(e)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '抱歉，知识整理服务暂时不可用。',
      }])
    } finally {
      setChatLoading(false)
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (entry: KnowledgeEntry) => {
    setEditingId(entry.id)
    setForm({
      category: entry.category,
      title: entry.title,
      content: entry.content || '',
      source: entry.source || '',
      value_analysis: entry.value_analysis || '',
      tags: entry.tags ? (typeof entry.tags === 'string' ? entry.tags : (entry.tags as any[]).join(', ')) : '',
    })
    setShowModal(true)
    setDetailId(null)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.category) {
      alert('标题和分类必填')
      return
    }
    const tags = form.tags ? form.tags.split(/[,，]/).map((t: string) => t.trim()).filter(Boolean) : []
    try {
      if (editingId) {
        await api.put(`/knowledge/entries/${editingId}`, { ...form, tags, is_pinned: 0 })
      } else {
        await api.post('/knowledge/entries', { ...form, tags })
      }
      setShowModal(false)
      fetchEntries()
    } catch (e) {
      console.error(e)
      alert('保存失败')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这条知识吗？')) return
    try {
      await api.delete(`/knowledge/entries/${id}`)
      setDetailId(null)
      fetchEntries()
    } catch (e) {
      console.error(e)
    }
  }

  const handleTogglePin = async (entry: KnowledgeEntry) => {
    try {
      await api.put(`/knowledge/entries/${entry.id}`, { is_pinned: entry.is_pinned ? 0 : 1 })
      fetchEntries()
    } catch (e) {
      console.error(e)
    }
  }

  const getCategoryInfo = (code: string) => {
    return categories.find(c => c.code === code) || { name: code, color: 'bg-gray-100 text-gray-700' }
  }

  const parseTags = (tags: any): string[] => {
    if (!tags) return []
    if (typeof tags === 'string') {
      try { return JSON.parse(tags) } catch { return tags.split(/[,，]/).map(t => t.trim()).filter(Boolean) }
    }
    return Array.isArray(tags) ? tags : []
  }

  const detailEntry = entries.find(e => e.id === detailId)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">知识库</h1>
          <p className="text-gray-500 text-sm mt-1">对话式知识沉淀，自动积累创作方法论和个人画像</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
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
                  const tags = parseTags(entry.tags)
                  return (
                    <div
                      key={entry.id}
                      onClick={() => setDetailId(entry.id)}
                      className="card p-4 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`badge ${catInfo.color}`}>{catInfo.name}</span>
                          {entry.is_pinned ? <Pin className="w-3.5 h-3.5 text-amber-500" /> : null}
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(entry.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1">{entry.title}</h4>
                      {entry.content && (
                        <p className="text-sm text-gray-500 line-clamp-2">{entry.content}</p>
                      )}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{tag}</span>
                          ))}
                        </div>
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
                    {msg.extractedEntries && msg.extractedEntries.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-1 text-xs font-medium text-primary-600">
                          <Sparkles className="w-3 h-3" />
                          提取到 {msg.extractedEntries.length} 条知识
                        </div>
                        {msg.extractedEntries.map((e, i) => {
                          const catInfo = getCategoryInfo(e.category)
                          return (
                            <div key={i} className="bg-white rounded-lg p-2.5 border border-gray-200">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`badge ${catInfo.color} text-xs`}>{catInfo.name}</span>
                              </div>
                              <p className="text-xs font-medium text-gray-900">{e.title}</p>
                              {e.content && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{e.content}</p>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
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
              <button onClick={handleSendMessage} disabled={chatLoading} className="btn-primary px-4 disabled:opacity-50">
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
              <button
                onClick={openCreate}
                className="w-full text-sm text-primary-600 hover:text-primary-700 py-2"
              >
                手动添加
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editingId ? '编辑知识条目' : '新建知识条目'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类 *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="input-field w-full"
                >
                  {categories.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标题 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="简洁概括这条知识"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内容</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="详细内容"
                  rows={4}
                  className="input-field w-full resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">来源</label>
                <input
                  type="text"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="如：对标视频、复盘记录、对话提取"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">价值分析</label>
                <textarea
                  value={form.value_analysis}
                  onChange={(e) => setForm({ ...form, value_analysis: e.target.value })}
                  placeholder="这条知识的价值和适用场景"
                  rows={2}
                  className="input-field w-full resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标签（逗号分隔）</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="如：爆款, 选题, 美妆"
                  className="input-field w-full"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary px-4 py-2">
                取消
              </button>
              <button onClick={handleSave} className="btn-primary px-4 py-2 flex items-center gap-2">
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {detailEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className={`badge ${getCategoryInfo(detailEntry.category).color}`}>
                  {getCategoryInfo(detailEntry.category).name}
                </span>
                {detailEntry.is_pinned ? <Pin className="w-4 h-4 text-amber-500" /> : null}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); handleTogglePin(detailEntry) }}
                  className="p-2 text-gray-400 hover:text-amber-500"
                  title={detailEntry.is_pinned ? '取消置顶' : '置顶'}
                >
                  <Pin className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(detailEntry) }}
                  className="p-2 text-gray-400 hover:text-primary-600"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(detailEntry.id) }}
                  className="p-2 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setDetailId(null)} className="p-2 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">{detailEntry.title}</h3>
              {detailEntry.content && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">内容</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{detailEntry.content}</p>
                </div>
              )}
              {detailEntry.value_analysis && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">价值分析</p>
                  <p className="text-sm text-gray-700">{detailEntry.value_analysis}</p>
                </div>
              )}
              {detailEntry.source && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">来源</p>
                  <p className="text-sm text-gray-700">{detailEntry.source}</p>
                </div>
              )}
              {parseTags(detailEntry.tags).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {parseTags(detailEntry.tags).map((tag, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400">
                创建于 {new Date(detailEntry.created_at).toLocaleString('zh-CN')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
