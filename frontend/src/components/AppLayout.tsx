import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import BookMasterPage from '@/pages/p0/BookMasterPage'
import P121Page from '@/pages/p1/P121Page'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import { fetchMenus, type TopMenuItem } from '@/lib/menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
  LayoutDashboard,
  BookOpen,
  Building2,
  Warehouse,
  ShoppingCart,
  Package,
  Truck,
  Receipt,
  Settings,
  Star,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// PGM_ID → 라우트 매핑 (C# 폼 클래스명 = PGM_ID, 구현된 메뉴만 등록)
const PGM_ROUTE_MAP: Record<string, string> = {
  P011: '/p0/bookcd', // 도서마스터
  P121: '/p1/p121',  // 주문입력
}

// MENU_ID → 라우트 매핑 (PGM_ID 모를 때 MENU_ID 사용)
const MENU_ROUTE_MAP: Record<string, string> = {
  // 실제 MENU_ID가 확인되면 추가
}

// 상위 메뉴 아이콘 (MENU_ID 기준)
function getMenuIcon(menuId: string) {
  const icons: Record<string, React.ReactNode> = {
    P0: <BookOpen className="w-4 h-4" />,
    P1: <ShoppingCart className="w-4 h-4" />,
    P2: <Package className="w-4 h-4" />,
    P3: <Receipt className="w-4 h-4" />,
    P4: <Truck className="w-4 h-4" />,
    P5: <Building2 className="w-4 h-4" />,
    P6: <Receipt className="w-4 h-4" />,
    PA: <Settings className="w-4 h-4" />,
    ZZ: <Star className="w-4 h-4" />,
  }
  return icons[menuId] ?? <Warehouse className="w-4 h-4" />
}

function resolveRoute(pgmId: string, menuId: string): string | null {
  return PGM_ROUTE_MAP[pgmId] ?? MENU_ROUTE_MAP[menuId] ?? null
}

interface SidebarMenuGroupProps {
  menu: TopMenuItem
  currentPath: string
  onNavigate: (path: string | null, title: string) => void
}

function SidebarMenuGroup({ menu, currentPath, onNavigate }: SidebarMenuGroupProps) {
  const hasActiveChild = menu.children.some((child) => {
    const route = resolveRoute(child.pgmId, child.menuId)
    return route === currentPath
  })

  const [open, setOpen] = useState(hasActiveChild)

  // 활성 자식이 있으면 자동 열기
  useEffect(() => {
    if (hasActiveChild) setOpen(true)
  }, [hasActiveChild])

  return (
    <div className="mb-0.5">
      {/* 상위 메뉴 버튼 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2.5 text-[14px] font-medium transition-colors',
          'text-white/90 hover:text-white hover:bg-white/15',
          hasActiveChild && 'text-white bg-white/15'
        )}
      >
        <span className="text-white/70">{getMenuIcon(menu.menuId)}</span>
        <span className="flex-1 text-left">{menu.title}</span>
        {menu.children.length > 0 && (
          <span className="text-white/50">
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
        )}
      </button>

      {/* 하위 메뉴 */}
      {open && menu.children.length > 0 && (
        <div className="mt-0 ml-3 pl-3 border-l border-white/25 space-y-0">
          {menu.children.map((child) => {
            const route = resolveRoute(child.pgmId, child.menuId)
            const isActive = route === currentPath

            return (
              <button
                key={child.menuId}
                onClick={() => onNavigate(route, child.title)}
                className={cn(
                  'w-full flex items-center gap-1.5 px-3 py-2 text-[13px] transition-colors text-left',
                  isActive
                    ? 'bg-orange-500 text-white font-medium rounded-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/15',
                  !route && 'opacity-50'
                )}
              >
                <span className="flex-1 truncate">{child.title}</span>
                {!route && (
                  <span className="text-[11px] text-white/60 bg-black/15 px-1.5 py-0.5 rounded-sm">준비중</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface TabItem {
  path: string
  title: string
}

// 경로 → 컴포넌트 매핑 (탭 상태 유지용)
const ROUTE_COMPONENT_MAP: Record<string, React.ComponentType> = {
  '/p0/bookcd': BookMasterPage,
  '/p1/p121': P121Page,
}

export default function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const [tabs, setTabs] = useState<TabItem[]>([])

  const { data: menus = [], isLoading: menusLoading } = useQuery({
    queryKey: ['menus'],
    queryFn: fetchMenus,
    staleTime: 5 * 60 * 1000, // 5분 캐시
  })

  const handleLogout = () => {
    logout()
    toast.success('로그아웃 되었습니다.')
    navigate({ to: '/login' })
  }

  const handleNavigate = useCallback((path: string | null, title: string) => {
    if (path) {
      setTabs((prev) => {
        if (prev.find((t) => t.path === path)) return prev
        return [...prev, { path, title }]
      })
      navigate({ to: path as any })
    } else {
      toast.info(`${title} 메뉴는 준비 중입니다.`)
    }
  }, [navigate])

  const closeTab = useCallback((path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path)
      const next = prev.filter((t) => t.path !== path)
      if (path === pathname) {
        if (next.length > 0) {
          const newIdx = Math.max(0, idx - 1)
          navigate({ to: next[newIdx].path as any })
        } else {
          navigate({ to: '/' })
        }
      }
      return next
    })
  }, [pathname, navigate])

  const initials = user?.custNm?.slice(0, 2) ?? 'WB'

  return (
    <div className="h-screen flex bg-white overflow-hidden">
      {/* ── 사이드바 ── */}
      <aside className="w-56 shrink-0 bg-[#1C4D95] flex flex-col">
        {/* 로고 */}
        <div
          className="h-12 flex items-center gap-2.5 px-4 cursor-pointer border-b border-white/20 shrink-0"
          onClick={() => navigate({ to: '/' })}
        >
          <div className="w-8 h-8 rounded bg-orange-500 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            OMS
          </div>
          <div>
            <div className="text-white font-semibold text-[14px] leading-tight">WEBOMS</div>
            <div className="text-white/60 text-[11px] leading-tight">출판물류시스템</div>
          </div>
        </div>

        {/* 대시보드 링크 */}
        <div className="px-2 pt-2">
          <button
            onClick={() => navigate({ to: '/' })}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 text-[14px] font-medium transition-colors',
              pathname === '/'
                ? 'bg-orange-500 text-white rounded-sm'
                : 'text-white/90 hover:text-white hover:bg-white/15'
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>대시보드</span>
          </button>
        </div>

        {/* 메뉴 구분선 */}
        <div className="px-4 pt-3 pb-1">
          <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Menu</span>
        </div>

        {/* 메뉴 목록 */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-0">
          {menusLoading ? (
            <div className="space-y-1.5 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full bg-white/5 rounded-sm" />
              ))}
            </div>
          ) : menus.length === 0 ? (
            <p className="text-white/50 text-[13px] px-3 py-2">메뉴를 불러올 수 없습니다</p>
          ) : (
            menus.map((menu) => (
              <SidebarMenuGroup
                key={menu.menuId}
                menu={menu}
                currentPath={pathname}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </nav>

        {/* 사용자 정보 (사이드바 하단) */}
        <div className="shrink-0 border-t border-white/20 p-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 px-2 py-2 hover:bg-white/15 transition-colors rounded-sm">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-orange-500 text-white text-[10px] font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-white text-[13px] font-medium truncate">{user?.custNm}</div>
                  <div className="text-white/60 text-[11px] truncate">
                    {user?.salesNm ? `${user.salesNm} (영업사원)` : user?.taxNo}
                  </div>
                </div>
                <ChevronDown className="w-3 h-3 text-white/40 flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <div className="font-medium text-sm">{user?.custNm}</div>
                  <div className="text-xs text-slate-500 font-normal">{user?.taxNo}</div>
                  {user?.salesNm && (
                    <div className="text-xs text-slate-500 font-normal">{user.salesNm}</div>
                  )}
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem className="gap-2">
                  <User className="w-4 h-4" />
                  내 정보
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={handleLogout} className="text-red-500 gap-2">
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ── 메인 콘텐츠 ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 상단 헤더 */}
        <header className="h-11 bg-[#2b579a] flex items-center px-5 gap-3 shrink-0">
          <div className="flex-1" />
          {/* 우측: 회사명 + 사용자 */}
          <div className="flex items-center gap-3 text-[13px] text-blue-100/90">
            <span>{user?.custNm}</span>
            {user?.salesNm && (
              <>
                <span className="text-blue-200/30">|</span>
                <span>{user.salesNm}</span>
              </>
            )}
          </div>
        </header>

        {/* 탭 바 */}
        {tabs.length > 0 && (
          <div className="flex items-end gap-0 px-1 pt-1 bg-white border-b border-[#b8c4d4] overflow-x-auto shrink-0">
            {tabs.map((tab) => {
              const isActive = pathname === tab.path
              return (
                <div
                  key={tab.path}
                  onClick={() => navigate({ to: tab.path as any })}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] cursor-pointer whitespace-nowrap border border-b-0 select-none transition-colors',
                    isActive
                      ? 'bg-white text-[#2b579a] font-semibold border-[#b8c4d4] rounded-t-sm relative z-10 -mb-px'
                      : 'bg-[#f0f2f5] text-[#5a6a7e] border-[#d0d8e4] hover:bg-[#e8ecf0] hover:text-[#3a4a5e]'
                  )}
                >
                  <span>{tab.title}</span>
                  <button
                    onClick={(e) => closeTab(tab.path, e)}
                    className={cn(
                      'p-0.5 transition-colors',
                      isActive
                        ? 'text-[#8a9ab0] hover:text-red-500'
                        : 'text-[#8a9ab0] hover:text-red-500'
                    )}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* 페이지 콘텐츠 - 탭 상태 유지를 위해 display:none으로 숨김 (언마운트 없음) */}
        <main className="flex-1 overflow-hidden p-2">
          {/* 대시보드 */}
          <div className="h-full" style={{ display: pathname === '/' ? undefined : 'none' }}>
            <DashboardPage />
          </div>
          {/* 탭 페이지 - 열린 탭은 마운트 상태 유지 */}
          {tabs.map((tab) => {
            const Component = ROUTE_COMPONENT_MAP[tab.path]
            if (!Component) return null
            return (
              <div key={tab.path} className="h-full" style={{ display: pathname === tab.path ? undefined : 'none' }}>
                <Component />
              </div>
            )
          })}
        </main>
      </div>
    </div>
  )
}
