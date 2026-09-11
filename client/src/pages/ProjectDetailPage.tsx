import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Play,
  CheckCircle,
  Clock,
  ChevronRight,
  Send,
  Sparkles,
  Zap,
  MessageSquare,
  Settings,
} from 'lucide-react'
import api from '@/services/api'
import { formatDateTime, getStatusColor, getStatusText } from '@/utils'
import type { Project, Stage, Review } from '@/types'

const STAGES = [
  { code: 'topic', name: '选题策划', role: '选题策划-桃桃', order: 1 },
  { code: 'script', name: '脚本创作', role: '内容编剧-橘子', order: 2 },
  { code: 'design', name: '视觉设计', role: '平面设计师-泡泡', order: 3 },
  { code: 'review', name: '项目评审', role: '超级IP顾问-队长', order: 4 },
  { code: 'publish', name: '发布发行', role: '发行-小海', order: 5 },
  { code: 'data', name: '数据复盘', role: '运营-阿飞', order: 6 },
]

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [activeStage, setActiveStage] = useState<Stage | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewContent, setReviewContent] = useState('')
  const [reviewScore, setReviewScore] = useState('')
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(false)
  const [executingSkill, setExecutingSkill] = useState(false)

  useEffect(() => {
    if (id) fetchProject()
  }, [id])

  const fetchProject = async () => {
    try {
      const res: any = await api.get(`/projects/${id}`)
      setProject(res.project)
      setStages(res.stages || [])
      
      // 找到当前阶段
      const current = res.stages?.find((s: Stage) => s.code === res.project.current_stage)
      if (current) {
        setActiveStage(current)
        fetchStageReviews(current.id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchStageReviews = async (stageId: string) => {
    try {
      const res: any = await api.get(`/projects/${id}/stages/${stageId}`)
      setReviews(res.reviews || [])
    } catch (e) {
      console.error(e)
    }
  }

  const handleStageClick = (stage: Stage) => {
    setActiveStage(stage)
    fetchStageReviews(stage.id)
  }

  const handleAdvance = async () => {
    if (!confirm('确定要推进到下一阶段吗？')) return
    setAdvancing(true)
    try {
      await api.post(`/projects/${id}/stages/advance`)
      fetchProject()
    } catch (e: any) {
      alert(e.error || '推进失败')
    } finally {
      setAdvancing(false)
    }
  }

  const handleSubmitReview = async () => {
    if (!reviewContent.trim() || !activeStage) return
    try {
      await api.post(`/projects/${id}/stages/${activeStage.id}/reviews`, {
        content: reviewContent,
        type: reviewScore ? 'score' : 'comment',
        score: reviewScore ? parseFloat(reviewScore) : null,
      })
      setReviewContent('')
      setReviewScore('')
      fetchStageReviews(activeStage.id)
    } catch (e) {
      console.error(e)
    }
  }

  const handleRunSkill = async () => {
    if (!activeStage) return
    setExecutingSkill(true)
    try {
      // 模拟执行技能
      await new Promise(resolve => setTimeout(resolve, 2000))
      alert('技能执行完成（演示模式，真实执行需要配置API Key）')
    } catch (e) {
      console.error(e)
    } finally {
      setExecutingSkill(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return <div className="text-center py-16 text-gray-500">项目不存在</div>
  }

  const currentStageIndex = STAGES.findIndex(s => s.code === project.current_stage)
  const isLastStage = currentStageIndex >= STAGES.length - 1

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/projects')}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
            <p className="text-gray-500 text-sm">
              当前阶段：{STAGES[currentStageIndex]?.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-outline flex items-center gap-2">
            <Settings className="w-4 h-4" />
            项目设置
          </button>
          {!isLastStage && (
            <button
              onClick={handleAdvance}
              disabled={advancing}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {advancing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              推进下一阶段
            </button>
          )}
        </div>
      </div>

      {/* 阶段时间线 */}
      <div className="card p-6">
        <div className="flex items-center justify-between relative">
          {/* 进度线 */}
          <div className="absolute top-5 left-8 right-8 h-0.5 bg-gray-200 -z-0">
            <div
              className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all"
              style={{ width: `${(currentStageIndex / (STAGES.length - 1)) * 100}%` }}
            />
          </div>

          {STAGES.map((stage, idx) => {
            const stageData = stages.find(s => s.code === stage.code)
            const isCompleted = idx < currentStageIndex
            const isCurrent = idx === currentStageIndex
            const isPending = idx > currentStageIndex

            return (
              <div
                key={stage.code}
                className="flex flex-col items-center relative z-10 cursor-pointer group"
                onClick={() => stageData && handleStageClick(stageData)}
              >
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all
                  ${isCompleted ? 'bg-primary-500 text-white' : ''}
                  ${isCurrent ? 'bg-primary-100 text-primary-700 ring-4 ring-primary-50' : ''}
                  ${isPending ? 'bg-gray-100 text-gray-400' : ''}
                  ${stageData ? 'group-hover:scale-110' : ''}
                `}>
                  {isCompleted ? <CheckCircle className="w-5 h-5" /> : idx + 1}
                </div>
                <div className="mt-2 text-center">
                  <p className={`text-sm font-medium ${isCurrent ? 'text-primary-700' : isCompleted ? 'text-gray-700' : 'text-gray-400'}`}>
                    {stage.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{stage.role.split('-')[1]}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 阶段详情 */}
      {activeStage && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：阶段信息 + 产出 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 阶段信息 */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{activeStage.name}</h3>
                <span className={`badge ${getStatusColor(activeStage.status)}`}>
                  {getStatusText(activeStage.status)}
                </span>
              </div>

              <div className="space-y-3 text-sm text-gray-600 mb-4">
                <p>负责角色：<span className="text-gray-900">{activeStage.role}</span></p>
                {activeStage.started_at && (
                  <p>开始时间：<span className="text-gray-900">{formatDateTime(activeStage.started_at)}</span></p>
                )}
                {activeStage.completed_at && (
                  <p>完成时间：<span className="text-gray-900">{formatDateTime(activeStage.completed_at)}</span></p>
                )}
              </div>

              {activeStage.status === 'in_progress' && (
                <button
                  onClick={handleRunSkill}
                  disabled={executingSkill}
                  className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {executingSkill ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      AI执行中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      调用AI智能体生成
                    </>
                  )}
                </button>
              )}
            </div>

            {/* 阶段产出 */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">阶段产出</h3>
              {activeStage.output ? (
                <div className="bg-gray-50 rounded-xl p-4 text-sm whitespace-pre-wrap text-gray-700">
                  {activeStage.output}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>暂无产出内容</p>
                  <p className="text-sm mt-1">调用AI智能体生成或手动添加</p>
                </div>
              )}
            </div>
          </div>

          {/* 右侧：评审区 */}
          <div className="card p-5 flex flex-col h-[600px]">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-primary-500" />
              <h3 className="font-semibold text-gray-900">评审记录</h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {reviews.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  暂无评审记录
                </div>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {review.author_name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDateTime(review.created_at)}
                      </span>
                    </div>
                    {review.score !== null && review.score !== undefined && (
                      <div className="text-sm text-amber-600 mb-1">
                        评分：{review.score} 分
                      </div>
                    )}
                    <p className="text-sm text-gray-600">{review.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* 评审输入 */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  placeholder="评分(可选)"
                  value={reviewScore}
                  onChange={(e) => setReviewScore(e.target.value)}
                  className="input-field text-sm w-24"
                  min={0}
                  max={100}
                />
              </div>
              <div className="flex gap-2">
                <textarea
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value)}
                  placeholder="输入评审意见..."
                  rows={2}
                  className="flex-1 input-field text-sm resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmitReview()
                    }
                  }}
                />
                <button
                  onClick={handleSubmitReview}
                  disabled={!reviewContent.trim()}
                  className="px-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
