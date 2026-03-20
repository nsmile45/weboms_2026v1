import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  taxNo: string
  custNm: string
  salesNo: string
  salesNm: string
  empNo: string
  plocCd: string
  rlocCd: string
  jlocCd: string
  domeYn: string
  jgchgYn: string
  sublseqDiv: string
}

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      login: (token, user) => {
        localStorage.setItem('token', token)
        set({ token, user, isAuthenticated: true })
      },
      logout: () => {
        localStorage.removeItem('token')
        set({ token: null, user: null, isAuthenticated: false })
      },
    }),
    {
      name: 'weboms-auth',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
