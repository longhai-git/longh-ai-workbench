import { useRef, useState } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { cn } from '@/utils'
import api from '@/services/api'

interface ImageUploadProps {
  /** Current avatar value - can be emoji string or image URL path */
  value: string
  /** Callback when avatar changes (emoji or image URL) */
  onChange: (value: string) => void
  /** Upload endpoint, e.g. '/upload/user-avatar' or '/agents/:id/upload-avatar' */
  uploadEndpoint?: string
  /** Whether to show emoji picker options */
  showEmojis?: boolean
  /** Default emoji list for quick selection */
  emojis?: string[]
  /** Size class for the avatar preview */
  size?: 'sm' | 'md' | 'lg'
  /** Label text */
  label?: string
  /** Whether to use a dynamic upload endpoint (agent avatar requires agent ID) */
  agentId?: string
}

const DEFAULT_EMOJIS = ['🎯', '🍑', '🍊', '🫧', '🐉', '🌊', '🪁', '🎪', '🎨', '🎬', '📝', '🚀', '🌟', '💡', '🎵', '🤖', '📊', '🔥']

const sizeMap = {
  sm: 'w-10 h-10 text-xl',
  md: 'w-14 h-14 text-2xl',
  lg: 'w-16 h-16 text-3xl',
}

export default function ImageUpload({
  value,
  onChange,
  uploadEndpoint,
  showEmojis = true,
  emojis = DEFAULT_EMOJIS,
  size = 'md',
  label = '头像',
  agentId,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const isImageUrl = value && (value.startsWith('/uploads/') || value.startsWith('http'))

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 客户端验证
    if (file.size > 5 * 1024 * 1024) {
      setError('文件大小不能超过5MB')
      return
    }
    const allowedTypes = /jpeg|jpg|png|gif|webp|bmp/
    if (!allowedTypes.test(file.type)) {
      setError('只支持 jpg/png/gif/webp/bmp 格式')
      return
    }

    setError('')
    setUploading(true)

    try {
      // 确定上传端点
      let endpoint = uploadEndpoint
      if (!endpoint) {
        if (agentId) {
          endpoint = `/agents/${agentId}/upload-avatar`
        } else {
          endpoint = '/upload/user-avatar'
        }
      }

      const formData = new FormData()
      formData.append('avatar', file)

      const res: any = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (res.avatar) {
        onChange(res.avatar)
      }
    } catch (err: any) {
      setError(err.error || '上传失败，请重试')
    } finally {
      setUploading(false)
      // 清空file input以便可以重复选择同一个文件
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">{label}</label>
      
      {/* 头像预览 + 上传按钮 */}
      <div className="flex items-center gap-4 mb-3">
        <div className="relative group">
          <div
            className={cn(
              'rounded-xl flex items-center justify-center overflow-hidden',
              sizeMap[size],
              isImageUrl
                ? 'bg-gray-100'
                : value
                ? 'bg-gray-100'
                : 'bg-gradient-to-br from-primary-400 to-primary-600 text-white'
            )}
          >
            {isImageUrl ? (
              <img src={value} alt="avatar" className="w-full h-full object-cover" />
            ) : value ? (
              <span>{value}</span>
            ) : (
              <Upload className="w-5 h-5" />
            )}
          </div>
          {isImageUrl && (
            <button
              onClick={handleRemoveImage}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {uploading ? '上传中...' : '上传图片'}
          </button>
          <span className="text-xs text-gray-400">支持 jpg/png/gif，最大5MB</span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/bmp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      {/* Emoji 快捷选择 */}
      {showEmojis && (
        <div>
          <p className="text-xs text-gray-400 mb-2">或选择表情头像</p>
          <div className="flex flex-wrap gap-2">
            {emojis.map((emoji, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onChange(emoji)}
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all',
                  value === emoji
                    ? 'bg-primary-100 ring-2 ring-primary-500 ring-offset-1'
                    : 'bg-gray-100 hover:bg-gray-200'
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
