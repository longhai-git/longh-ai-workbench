import { create } from 'zustand'

type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode
  isDark: boolean
  setMode: (mode: ThemeMode) => void
  init: () => void
}

// 获取系统当前是否深色
function getSystemDark(): boolean {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

// 计算实际是否深色
function computeIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return getSystemDark()
}

// 应用主题到 document
function applyTheme(isDark: boolean) {
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'system',
  isDark: false,

  setMode: (mode: ThemeMode) => {
    const isDark = computeIsDark(mode)
    applyTheme(isDark)
    localStorage.setItem('theme-mode', mode)
    set({ mode, isDark })
  },

  init: () => {
    const saved = (localStorage.getItem('theme-mode') || 'system') as ThemeMode
    const isDark = computeIsDark(saved)
    applyTheme(isDark)
    set({ mode: saved, isDark })

    // 监听系统主题变化（跟随系统模式下生效）
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', (e) => {
        const currentMode = get().mode
        if (currentMode === 'system') {
          applyTheme(e.matches)
          set({ isDark: e.matches })
        }
      })
    }
  },
}))
