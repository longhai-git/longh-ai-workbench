import { useState, useEffect } from 'react'
import {
  Target,
  Plus,
  Search,
  Filter,
  PlayCircle,
  TrendingUp,
  Clock,
  ChevronRight,
  Sparkles,
  BookOpen,
} from 'lucide-react'
import api from '@/services/api'
import { formatDate } from '@/utils'
import type { Benchmark } from '@/types'

export default function BenchmarksPage() {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedBenchmark, setSelectedBenchmark] = useState<Benchmark | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [newBenchmark, setNewBenchmark] = useState({ title: '', url: '', author: '', transcript: '' })

  useEffect(() => {
    fetchBenchmarks()
  }, [statusFilter])

  const fetchBenchmarks = async () => {
    try {
      const res: any = await api.get('/benchmarks', { params: { status: statusFilter } })
      setBenchmarks(res.benchmarks || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!newBenchmark.title.trim()) return
    try {
      await api.post('/benchmarks', newBenchmark)
      setShowAddModal(false)
      setNewBenchmark({ title: '', url: '', author: '', transcript: '' })
      fetchBenchmarks()
    } catch (e) {
      console.error(e)
    }
  }

  const handleAnalyze = async (id: string) => {
    setAnalyzing(true)
    try {
      const res: any = await api.post(`/benchmarks/${id}/analyze`)
      if (res.success) {
        alert('分析完成！')
        fetchBenchmarks()
      } else {
        alert(res.error || '分析失败')
      }
    } catch (e: any) {
      alert(e.error || '分析失败')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">对标库</h1>
          <p className="text-gray-500 text-sm mt-1">存储和拆解优质对标视频，提炼可复用方法论</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          添加对标视频
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{benchmarks.length}</div>
              <div className="text-xs text-gray-500">对标视频</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {benchmarks.filter(b => b.analysis_status === 'completed').length}
              </div>
              <div className="text-xs text-gray-500">已拆解</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">6</div>
              <div className="text-xs text-gray-500">拆解维度</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-xs text-gray-500">生成模板</div>
            </div>
          </div>
        </div>
      </div>

      {/* 筛选 */}
      <div className="card p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field text-sm py-1.5 w-32"
            >
              <option value="all">全部状态</option>
              <option value="pending">待拆解</option>
              <option value="completed">已拆解</option>
              <option value="failed">拆解失败</option>
            </select>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="搜索..." className="input-field text-sm pl-9 py-1.5 w-48" />
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : benchmarks.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Target className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无对标视频</h3>
          <p className="text-gray-500 text-sm mb-6">添加对标视频，通过6维度深度拆解提炼可复用方法</p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            添加对标视频
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {benchmarks.map((bm) => (
            <div
              key={bm.id}
              className="card p-5 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => setSelectedBenchmark(bm)}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-16 rounded-lg bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center flex-shrink-0">
                  <PlayCircle className="w-6 h-6 text-white/80" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-primary-600 transition-colors">
                    {bm.title}
                  </h3>
                  {bm.author && (
                    <p className="text-xs text-gray-400 mt-1">{bm.author}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                <span>{formatDate(bm.created_at)}</span>
                <span className={`badge ${
                  bm.analysis_status === 'completed' ? 'bg-green-100 text-green-700' :
                  bm.analysis_status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {bm.analysis_status === 'completed' ? '已拆解' :
                   bm.analysis_status === 'failed' ? '拆解失败' : '待拆解'}
                </span>
              </div>

              {bm.analysis_status === 'pending' && bm.transcript && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleAnalyze(bm.id) }}
                  disabled={analyzing}
                  className="w-full text-sm py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors font-medium disabled:opacity-50"
                >
                  {analyzing ? '分析中...' : '开始6维度拆解'}
                </button>
              )}

              {bm.analysis_status === 'pending' && !bm.transcript && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 text-center">
                  请先补充视频文案
                </p>
              )}

              {bm.analysis_status === 'completed' && (
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">6维度分析报告</span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 添加弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-fade-in">
            <h2 className="text-xl font-bold text-gray-900 mb-6">添加对标视频</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">标题 *</label>
                <input
                  type="text"
                  value={newBenchmark.title}
                  onChange={(e) => setNewBenchmark({ ...newBenchmark, title: e.target.value })}
                  className="input-field"
                  placeholder="视频标题"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">视频链接</label>
                <input
                  type="text"
                  value={newBenchmark.url}
                  onChange={(e) => setNewBenchmark({ ...newBenchmark, url: e.target.value })}
                  className="input-field"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">作者</label>
                <input
                  type="text"
                  value={newBenchmark.author}
                  onChange={(e) => setNewBenchmark({ ...newBenchmark, author: e.target.value })}
                  className="input-field"
                  placeholder="博主名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  视频文案/字幕
                  <span className="text-amber-600 text-xs ml-1">（拆解必须）</span>
                </label>
                <textarea
                  value={newBenchmark.transcript}
                  onChange={(e) => setNewBenchmark({ ...newBenchmark, transcript: e.target.value })}
                  rows={4}
                  className="input-field resize-none"
                  placeholder="粘贴视频完整文案或字幕..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 btn-secondary">取消</button>
              <button onClick={handleAdd} className="flex-1 btn-primary">添加</button>
            </div>
          </div>
        </div>
      )}

      {/* 详情弹窗 */}
      {selectedBenchmark && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedBenchmark(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 animate-fade-in max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-4">{selectedBenchmark.title}</h2>
            {selectedBenchmark.analysis_report ? (
              <div className="bg-gray-50 rounded-xl p-4 whitespace-pre-wrap text-sm text-gray-700">
                {JSON.stringify(JSON.parse(selectedBenchmark.analysis_report), null, 2)}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>暂无分析报告</p>
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setSelectedBenchmark(null)} className="flex-1 btn-secondary">关闭</button>
              {selectedBenchmark.transcript && selectedBenchmark.analysis_status !== 'completed' && (
                <button
                  onClick={() => handleAnalyze(selectedBenchmark.id)}
                  className="flex-1 btn-primary"
                  disabled={analyzing}
                >
                  {analyzing ? '分析中...' : '开始拆解'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
