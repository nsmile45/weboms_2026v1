import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [taxNo, setTaxNo] = useState('')
  const [salesNo, setSalesNo] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taxNo || !password) {
      toast.error('사업자번호와 비밀번호를 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/auth/login', { taxNo, salesNo, password })
      login(res.data.token, res.data.user)
      toast.success(`${res.data.user.custNm}님 환영합니다!`)
      navigate({ to: '/' })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        '로그인에 실패했습니다.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="w-full max-w-md px-4">
        {/* 로고 영역 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground text-2xl font-bold mb-4">
            OMS
          </div>
          <h1 className="text-2xl font-bold text-slate-800">WEBOMS</h1>
          <p className="text-slate-500 text-sm mt-1">주문관리시스템</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">로그인</CardTitle>
            <CardDescription>사업자번호와 비밀번호를 입력하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="taxNo">사업자번호</Label>
                <Input
                  id="taxNo"
                  type="text"
                  placeholder="사업자번호 입력"
                  value={taxNo}
                  onChange={(e) => setTaxNo(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salesNo">영업사원번호 (선택)</Label>
                <Input
                  id="salesNo"
                  type="text"
                  placeholder="영업사원번호 입력 (없으면 비워두세요)"
                  value={salesNo}
                  onChange={(e) => setSalesNo(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="비밀번호 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '로그인 중...' : '로그인'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          © 2026 WEBOMS. All rights reserved.
        </p>
      </div>
    </div>
  )
}
