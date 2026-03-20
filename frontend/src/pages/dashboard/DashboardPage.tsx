import { useAuthStore } from '@/store/auth'
import { BookOpen, Package, TrendingUp, AlertCircle } from 'lucide-react'

const stats = [
  { label: '오늘 수주', icon: TrendingUp, color: 'text-[#2b579a]', bg: 'bg-[#e8f0fe]' },
  { label: '오늘 출고', icon: Package, color: 'text-[#1e7e34]', bg: 'bg-[#e6f4ea]' },
  { label: '재고 부족', icon: AlertCircle, color: 'text-[#e65100]', bg: 'bg-[#fff3e0]' },
  { label: '미처리 반품', icon: BookOpen, color: 'text-[#c62828]', bg: 'bg-[#fce8e8]' },
]

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="space-y-4">
      {/* 인사말 */}
      <div>
        <h1 className="text-[16px] font-bold text-[#1e3a5f]">대시보드</h1>
        <p className="text-[#5a6a7e] mt-0.5 text-[13px]">
          안녕하세요, <span className="font-medium text-[#2b579a]">{user?.custNm}</span>
          {user?.salesNm && ` · ${user.salesNm}`}님 환영합니다.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {stats.map(({ label, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-sm border border-[#b8c4d4] p-3 flex items-center gap-3">
            <div className={`${bg} ${color} rounded-sm p-2 shrink-0`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[13px] text-[#5a6a7e]">{label}</p>
              <p className="text-[18px] font-bold text-[#b8c4d4] mt-0.5">준비중</p>
            </div>
          </div>
        ))}
      </div>

      {/* 안내 */}
      <div className="bg-[#f4f6f8] rounded-sm border border-[#b8c4d4] p-4 text-center">
        <p className="text-[#8a9ab0] text-[13px]">좌측 메뉴에서 프로그램을 선택하세요.</p>
      </div>
    </div>
  )
}
