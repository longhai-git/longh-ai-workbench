import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    'S3': 'bg-red-500',
    'S2': 'bg-orange-500',
    'S1': 'bg-yellow-500',
    'S': 'bg-green-500',
    'A': 'bg-blue-500',
    'B': 'bg-cyan-500',
    'C': 'bg-gray-400',
    'D': 'bg-gray-500',
    'E': 'bg-gray-600',
  }
  return colors[grade] || 'bg-gray-400'
}

export function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    'active': '进行中',
    'completed': '已完成',
    'pending': '待开始',
    'in_progress': '进行中',
    'candidate': '候选',
    'approved': '已通过',
    'draft': '草稿',
    'review': '评审中',
    'idle': '空闲',
    'busy': '忙碌',
    'work': '工作中',
    'rest': '休息中',
    'stop': '已停止',
    'paused': '已暂停',
  }
  return texts[status] || status
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'active': 'bg-green-100 text-green-700',
    'completed': 'bg-blue-100 text-blue-700',
    'pending': 'bg-gray-100 text-gray-600',
    'in_progress': 'bg-yellow-100 text-yellow-700',
    'idle': 'bg-green-100 text-green-700',
    'busy': 'bg-orange-100 text-orange-700',
    'work': 'bg-red-100 text-red-700',
    'rest': 'bg-green-100 text-green-700',
  }
  return colors[status] || 'bg-gray-100 text-gray-600'
}
