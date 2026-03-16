import { useAuthStore } from '@/store/auth'
import { BookOpen, Package, TrendingUp, AlertCircle } from 'lucide-react'

const stats = [
  { label: '오늘 수주', icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' },
  { label: '오늘 출고', icon: Package, color: 'text-green-500', bg: 'bg-green-50' },
  { label: '재고 부족', icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50' },
  { label: '미처리 반품', icon: BookOpen, color: 'text-red-500', bg: 'bg-red-50' },
]

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="space-y-6">
      {/* 인사말 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">대시보드</h1>
        <p className="text-slate-500 mt-1 text-sm">
          안녕하세요, <span className="font-medium text-slate-700">{user?.custNm}</span>
          {user?.salesNm && ` · ${user.salesNm}`}님 환영합니다.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
            <div className={`${bg} ${color} rounded-lg p-2.5 flex-shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xl font-bold text-slate-300 mt-0.5">준비중</p>
            </div>
          </div>
        ))}
      </div>

      {/* 안내 */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 text-center">
        <p className="text-slate-400 text-sm">좌측 메뉴에서 프로그램을 선택하세요.</p>
      </div>
    </div>
  )
}
