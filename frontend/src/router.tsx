import { createRouter, createRoute, createRootRoute, redirect } from '@tanstack/react-router'
import AppLayout from '@/components/AppLayout'
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import BookMasterPage from '@/pages/p0/BookMasterPage'
import P121Page from '@/pages/p1/P121Page'
import P115Page from '@/pages/p1/P115Page'
import { useAuthStore } from '@/store/auth'

function isAuthenticated() {
  return useAuthStore.getState().isAuthenticated
}

// 루트
const rootRoute = createRootRoute()

// 로그인
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: () => {
    if (isAuthenticated()) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

// 인증 필요 레이아웃
const authLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth-layout',
  beforeLoad: () => {
    if (!isAuthenticated()) throw redirect({ to: '/login' })
  },
  component: AppLayout,
})

// 대시보드
const dashboardRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/',
  component: DashboardPage,
})

// P0 - 기초마스터
const bookMasterRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/p0/bookcd',
  component: BookMasterPage,
})

// P1 - 주문입력
const p121Route = createRoute({
  getParentRoute: () => authLayout,
  path: '/p1/p121',
  component: P121Page,
})

// P1 - KOBIC주문받기
const p115Route = createRoute({
  getParentRoute: () => authLayout,
  path: '/p1/p115',
  component: P115Page,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  authLayout.addChildren([
    dashboardRoute,
    bookMasterRoute,
    p121Route,
    p115Route,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
