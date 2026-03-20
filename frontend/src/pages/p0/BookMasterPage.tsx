import React, { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Search, RotateCcw, X, Trash2, Plus, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ── 타입 ───────────────────────────────────────────────────────
interface BookRow {
  BAR_CD: string; BK_CD: string; BK_NM: string; PUB_CD: string
  PUB_NM: string; WRITER: string; BK_PTNM: string; OUT_DANGA: number
  CUSTBK_CD: string; NEW_DATE: string; OUT_GB: string; OUT_GBNM: string
  SR_CD: string; SET_QTY: number; UNIT_GB: string; VAT_YN: string
  B_QTY: number; A_QTY: number; X_QTY: number
  MEIP_NM: string; IN_RATE: number
}

interface BookDetail {
  BAR_CD: string; BK_CD: string; BK_NM: string; PUB_CD: string
  OUT_DANGA: number; IPSU_QTY: number; PUB_REMK: string; CUSTBK_CD: string
  OUT_GB: string; WRITER: string; TRANSLATOR: string; BK_PART: string
  SR_CD: string; NEW_DATE: string; PUB_DATE: string; SET_QTY: number
  UNIT_GB: string; SIZE_WIDTH: number; SIZE_HEIGHT: number; SIZE_THICK: number
  SIZE_WEIGHT: number; PAN_QTY: number; PRINTING: number; SIZE_GB: string
  PAGE: number; CHK_CD: string; AVG_QTY: number
  USE_YN: string; BAN_YN: string; PARCEL_BOOK_YN: string
  INJI_YN: string; BUROK_YN: string; VAT_YN: string
  MEIP_CD: string; MEIP_NM: string; IN_RATE: number; IN_DANGA: number
  CON_NO: string; CON_NM: string
}

interface Custch { PUB_CD: string; PUB_NM: string }
interface Bkpart { BK_PART: string; BK_PTNM: string }
interface PanhistRow { PAN_QTY: number; PRINTING: number; MAKE_QTY: number; PAN_DATE: string | null; PM_REMK: string }
interface SetcodRow { BK_CD: string; BK_NM: string; BAR_CD: string; OUT_DANGA: number; ADD_QTY: number }

// ── 상수 ───────────────────────────────────────────────────────
const OUT_GB_OPTIONS = [
  { value: '00', label: '정상' },
  { value: '10', label: '절판' },
  { value: '20', label: '품절' },
  { value: '30', label: '절판예정' },
]

const UNIT_GB_OPTIONS = [
  { value: '1', label: '1-낱권' },
  { value: '2', label: '2-세트' },
  { value: '3', label: '3-낱권+CD' },
]

// key가 '_'로 시작하면 computed 값 (DB 필드 아님)
const COLS: { key: string; label: string; width: number; align?: string }[] = [
  { key: '_seq',      label: '순번',    width: 45,  align: 'center' },
  { key: 'BK_CD',     label: '도서코드', width: 80              },
  { key: 'BAR_CD',    label: '바코드',   width: 120             },
  { key: 'BK_NM',     label: '도서명',   width: 320             },
  { key: 'PUB_NM',    label: '브랜드',   width: 100             },
  { key: 'WRITER',    label: '저자',     width: 100             },
  { key: 'BK_PTNM',  label: '분류',     width: 70              },
  { key: 'OUT_DANGA', label: '정가',     width: 75,  align: 'right' },
  { key: '_total',    label: '총재고',   width: 65,  align: 'right' },
  { key: 'B_QTY',    label: '본사',     width: 60,  align: 'right' },
  { key: 'A_QTY',    label: '정품',     width: 60,  align: 'right' },
  { key: 'X_QTY',    label: '반품',     width: 60,  align: 'right' },
  { key: 'NEW_DATE',  label: '신간일자', width: 95              },
  { key: 'OUT_GBNM', label: '도서상태', width: 70              },
  { key: 'SR_CD',    label: '시리즈',   width: 70              },
  { key: 'CUSTBK_CD',label: '매칭코드', width: 80              },
  { key: 'UNIT_GB',  label: '단위구분', width: 65              },
  { key: 'SET_QTY',  label: '세트수량', width: 65,  align: 'right' },
  { key: 'VAT_YN',   label: '과세',     width: 45,  align: 'center' },
]

// ── 스타일 상수 ────────────────────────────────────────────────
const inp = 'h-8 text-[13px] bg-white border-[#b8c4d4] rounded-sm px-1.5 py-0'
const inpDis = 'h-8 text-[13px] bg-[#f4f6f8] border-[#d8dfe8] rounded-sm px-1.5 py-0'
const selCls = 'h-8 text-[13px] bg-white border-[#b8c4d4] rounded-sm px-1.5 py-0'

// ── 폼 행 헬퍼 ────────────────────────────────────────────────
function FR({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      <span className="text-[13px] text-[#4a5a6e] font-medium text-right flex-shrink-0 w-[4.5rem]">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

// ── 칼럼 리사이즈 훅 ──────────────────────────────────────────
function useResizeCols(initW: number[]) {
  const [widths, setWidths] = useState(initW)
  const drag = useRef<{ i: number; sx: number; sw: number } | null>(null)
  useEffect(() => {
    const mv = (e: MouseEvent) => {
      if (!drag.current) return
      const d = e.clientX - drag.current.sx
      setWidths(p => { const n = [...p]; n[drag.current!.i] = Math.max(30, drag.current!.sw + d); return n })
    }
    const up = () => { drag.current = null; document.body.style.cursor = '' }
    document.addEventListener('mousemove', mv)
    document.addEventListener('mouseup', up)
    return () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up) }
  }, [])
  const startResize = (e: React.MouseEvent, i: number) => {
    e.preventDefault(); e.stopPropagation()
    drag.current = { i, sx: e.clientX, sw: widths[i] }
    document.body.style.cursor = 'col-resize'
  }
  return { widths, startResize }
}

// ── 탭 헤더 ───────────────────────────────────────────────────
type TabName = '도서정보' | '판쇄정보' | '세트정보' | '저자정보'

function TabBar({ active, onChange }: { active: TabName; onChange: (t: TabName) => void }) {
  return (
    <div className="shrink-0 flex border-b border-[#b8c4d4] bg-[#f4f6f8]">
      {(['도서정보', '판쇄정보', '세트정보', '저자정보'] as TabName[]).map(t => (
        <button key={t} type="button" onClick={() => onChange(t)}
          className={`px-2.5 py-1.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
            active === t
              ? 'border-[#2b579a] text-[#2b579a] bg-white'
              : 'border-transparent text-[#5a6a7e] hover:text-[#2b579a] hover:bg-[#eef2f7]'
          }`}>
          {t}
        </button>
      ))}
    </div>
  )
}

// ── 저장 버튼 공통 ────────────────────────────────────────────
function SaveBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <Button onClick={onClick} disabled={saving}
      className="h-8 px-3 text-[13px] bg-[#2b579a] hover:bg-[#1e3a5f] text-white font-medium rounded-sm shrink-0">
      {saving ? '저장중' : '저장'}
    </Button>
  )
}

// ── 상세 패널 ─────────────────────────────────────────────────
interface DetailPanelProps {
  detail: BookDetail | null
  form: Partial<BookDetail>
  saving: boolean
  custchList: Custch[]
  bkpartList: Bkpart[]
  onSave: () => void
  onClose: () => void
  onField: (key: keyof BookDetail, value: string | number) => void
  onToggle: (key: keyof BookDetail) => void
}

const DetailPanel = React.memo(function DetailPanel({ detail, form, saving, custchList, bkpartList, onSave, onClose, onField, onToggle }: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabName>('도서정보')
  const yn = (v: string | undefined) => v === 'Y'

  // ── 판쇄 ──
  const panCols = useResizeCols([38, 46, 46, 72, 90, 120, 30])
  const [panhistList, setPanhistList] = useState<PanhistRow[]>([])
  const emptyPan = { panQty: '', printing: '', makeQty: '', panDate: '', pmRemk: '' }
  const [newPan, setNewPan] = useState(emptyPan)
  const [addingPan, setAddingPan] = useState(false)

  // ── 세트 ──
  const setCols = useResizeCols([38, 80, 999, 68, 50, 30])
  const [setcodList, setSetcodList] = useState<SetcodRow[]>([])
  const [newSetBkCd, setNewSetBkCd] = useState('')
  const [newSetQty, setNewSetQty] = useState('1')
  const [addingSet, setAddingSet] = useState(false)

  // ── 저자 ──
  const writerCols = useResizeCols([38, 60, 999, 50, 44])

  useEffect(() => {
    if (!detail?.BK_CD) { setPanhistList([]); setSetcodList([]); return }
    api.get(`/p0/bookcd/${detail.BK_CD}/panhist`).then(r => setPanhistList(r.data)).catch(() => {})
    api.get(`/p0/bookcd/${detail.BK_CD}/setcod`).then(r => setSetcodList(r.data)).catch(() => {})
  }, [detail?.BK_CD])

  const reloadPan = () => detail && api.get(`/p0/bookcd/${detail.BK_CD}/panhist`).then(r => setPanhistList(r.data)).catch(() => {})
  const reloadSet = () => detail && api.get(`/p0/bookcd/${detail.BK_CD}/setcod`).then(r => setSetcodList(r.data)).catch(() => {})

  const handleAddPan = async () => {
    if (!detail || !newPan.panQty || !newPan.printing) { toast.error('판수와 쇄수를 입력하세요.'); return }
    setAddingPan(true)
    try {
      await api.post(`/p0/bookcd/${detail.BK_CD}/panhist`, {
        panQty: Number(newPan.panQty), printing: Number(newPan.printing),
        makeQty: Number(newPan.makeQty) || 0,
        panDate: newPan.panDate || null, pmRemk: newPan.pmRemk || null,
      })
      await reloadPan()
      setNewPan(emptyPan)
      toast.success('추가되었습니다.')
    } catch (err: any) { toast.error(err?.response?.data?.message ?? '추가 실패') }
    finally { setAddingPan(false) }
  }

  const handleDelPan = async (panQty: number, printing: number) => {
    if (!detail) return
    try {
      await api.delete(`/p0/bookcd/${detail.BK_CD}/panhist`, { params: { panQty, printing } })
      setPanhistList(p => p.filter(r => !(r.PAN_QTY === panQty && r.PRINTING === printing)))
      toast.success('삭제되었습니다.')
    } catch (err: any) { toast.error(err?.response?.data?.message ?? '삭제 실패') }
  }

  const handleAddSet = async () => {
    if (!detail || !newSetBkCd.trim()) { toast.error('도서코드를 입력하세요.'); return }
    setAddingSet(true)
    try {
      await api.post(`/p0/bookcd/${detail.BK_CD}/setcod`, { addBkCd: newSetBkCd.trim(), addQty: Number(newSetQty) || 1 })
      await reloadSet()
      setNewSetBkCd(''); setNewSetQty('1')
      toast.success('추가되었습니다.')
    } catch (err: any) { toast.error(err?.response?.data?.message ?? '추가 실패') }
    finally { setAddingSet(false) }
  }

  const handleDelSet = async (itemBkCd: string) => {
    if (!detail) return
    try {
      await api.delete(`/p0/bookcd/${detail.BK_CD}/setcod/${itemBkCd}`)
      setSetcodList(p => p.filter(s => s.BK_CD !== itemBkCd))
      toast.success('삭제되었습니다.')
    } catch (err: any) { toast.error(err?.response?.data?.message ?? '삭제 실패') }
  }

  const handleUpdSetQty = async (itemBkCd: string, addQty: number) => {
    if (!detail) return
    try { await api.put(`/p0/bookcd/${detail.BK_CD}/setcod/${itemBkCd}`, { addQty }) }
    catch (err: any) { toast.error(err?.response?.data?.message ?? '수정 실패') }
  }

  // 룩업 명
  const pubNm = custchList.find(c => c.PUB_CD === form.PUB_CD)?.PUB_NM ?? ''
  const bkPartNm = bkpartList.find(b => b.BK_PART === form.BK_PART)?.BK_PTNM ?? ''
  const outGbNm = OUT_GB_OPTIONS.find(o => o.value === (form.OUT_GB ?? '00'))?.label ?? ''
  const unitGbNm = UNIT_GB_OPTIONS.find(o => o.value === (form.UNIT_GB ?? '1'))?.label ?? ''

  // 리사이즈 가능한 테이블 헤더 셀
  const RH = ({ label, i, cols, align = 'center' }: { label: string; i: number; cols: ReturnType<typeof useResizeCols>; align?: string }) => (
    <th className="relative px-1 py-1.5 font-medium border border-[#c8d0e0] select-none overflow-hidden text-[13px]"
      style={{ textAlign: align as any }}>
      <span className="truncate block">{label}</span>
      <div onMouseDown={e => cols.startResize(e, i)}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-300" />
    </th>
  )

  return (
    <>
      {/* 헤더 */}
      <div className="shrink-0 flex items-center justify-between px-2 py-1 border-b border-[#b8c4d4] bg-[#2b579a]">
        <span className="text-[13px] font-medium text-white truncate flex-1 mr-2">
          {detail ? detail.BK_NM : '불러오는 중...'}
        </span>
        <button type="button" onClick={onClose} className="text-blue-200/70 hover:text-white">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />

      {detail ? (
        <div className="flex-1 overflow-y-auto">

          {/* ══════════════ 도서정보 탭 ══════════════ */}
          {activeTab === '도서정보' && (
            <div className="p-2 space-y-1.5">

              <div className="flex items-center gap-1">
                <FR label="도서코드" className="flex-1">
                  <Input value={form.BK_CD ?? ''} disabled className={inpDis} />
                </FR>
                <SaveBtn saving={saving} onClick={onSave} />
              </div>

              <FR label="바코드">
                <Input value={form.BAR_CD ?? ''} onChange={e => onField('BAR_CD', e.target.value)} className={inp} maxLength={13} />
              </FR>

              <FR label="도서명">
                <Input value={form.BK_NM ?? ''} onChange={e => onField('BK_NM', e.target.value)} className={inp} maxLength={200} />
              </FR>

              <FR label="브랜드">
                <Select value={form.PUB_CD ?? ''} onValueChange={v => onField('PUB_CD', v ?? '')}>
                  <SelectTrigger className={selCls}>
                    <SelectValue>{pubNm || <span className="text-slate-400">선택</span>}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {custchList.map(c => <SelectItem key={c.PUB_CD} value={c.PUB_CD} className="text-[13px]">{c.PUB_NM}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FR>

              <div className="flex gap-1">
                <FR label="정가" className="flex-1">
                  <Input type="number" value={form.OUT_DANGA ?? 0} onChange={e => onField('OUT_DANGA', e.target.value)} className={inp} />
                </FR>
                <FR label="입수수량" className="flex-1">
                  <Input type="number" value={form.IPSU_QTY ?? 0} onChange={e => onField('IPSU_QTY', e.target.value)} className={inp} />
                </FR>
              </div>

              <div className="flex gap-1">
                <FR label="매칭코드" className="flex-1">
                  <Input value={form.CUSTBK_CD ?? ''} onChange={e => onField('CUSTBK_CD', e.target.value)} className={inp} maxLength={20} />
                </FR>
                <FR label="도서상태" className="flex-1">
                  <Select value={form.OUT_GB ?? '00'} onValueChange={v => onField('OUT_GB', v ?? '00')}>
                    <SelectTrigger className={selCls}><SelectValue>{outGbNm}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {OUT_GB_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-[13px]">{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FR>
              </div>

              <div className="flex gap-1">
                <FR label="저자" className="flex-1">
                  <Input value={form.WRITER ?? ''} onChange={e => onField('WRITER', e.target.value)} className={inp} maxLength={100} />
                </FR>
                <FR label="역자" className="flex-1">
                  <Input value={form.TRANSLATOR ?? ''} onChange={e => onField('TRANSLATOR', e.target.value)} className={inp} maxLength={100} />
                </FR>
              </div>

              <div className="flex gap-1">
                <FR label="분류" className="flex-1">
                  <Select value={form.BK_PART ?? ''} onValueChange={v => onField('BK_PART', v ?? '')}>
                    <SelectTrigger className={selCls}>
                      <SelectValue>{bkPartNm || <span className="text-slate-400">전체</span>}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {bkpartList.map(b => <SelectItem key={b.BK_PART} value={b.BK_PART} className="text-[13px]">{b.BK_PTNM}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FR>
                <FR label="시리즈" className="flex-1">
                  <Input value={form.SR_CD ?? ''} onChange={e => onField('SR_CD', e.target.value)} className={inp} maxLength={15} />
                </FR>
              </div>

              <div className="flex gap-1">
                <FR label="신간일자" className="flex-1">
                  <Input type="date" value={form.NEW_DATE ?? ''} onChange={e => onField('NEW_DATE', e.target.value)} className={inp} />
                </FR>
                <FR label="발행일자" className="flex-1">
                  <Input type="date" value={form.PUB_DATE ?? ''} onChange={e => onField('PUB_DATE', e.target.value)} className={inp} />
                </FR>
              </div>

              <div className="flex gap-1">
                <FR label="단위구분" className="flex-1">
                  <Select value={form.UNIT_GB ?? '1'} onValueChange={v => onField('UNIT_GB', v ?? '1')}>
                    <SelectTrigger className={selCls}><SelectValue>{unitGbNm}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {UNIT_GB_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-[13px]">{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FR>
                <FR label="세트수량" className="flex-1">
                  <Input type="number" value={form.SET_QTY ?? 0} onChange={e => onField('SET_QTY', e.target.value)} className={inp} />
                </FR>
              </div>

              <div className="flex gap-1 items-center flex-wrap">
                <span className="text-[13px] text-slate-600 flex-shrink-0 w-[4.5rem] text-right">가로(mm)</span>
                <Input type="number" value={form.SIZE_WIDTH ?? 0} disabled className={`${inpDis} w-12`} />
                <span className="text-[13px] text-slate-600 flex-shrink-0">세로(mm)</span>
                <Input type="number" value={form.SIZE_HEIGHT ?? 0} disabled className={`${inpDis} w-12`} />
                <span className="text-[13px] text-slate-600 flex-shrink-0">두께(mm)</span>
                <Input type="number" value={form.SIZE_THICK ?? 0} disabled className={`${inpDis} w-12`} />
                <span className="text-[13px] text-slate-600 flex-shrink-0">무게(g)</span>
                <Input type="number" value={form.SIZE_WEIGHT ?? 0} disabled className={`${inpDis} w-12`} />
              </div>

              <div className="flex gap-1">
                <FR label="판" className="flex-1">
                  <Input type="number" value={form.PAN_QTY ?? 0} onChange={e => onField('PAN_QTY', e.target.value)} className={inp} />
                </FR>
                <FR label="쇄" className="flex-1">
                  <Input type="number" value={form.PRINTING ?? 0} onChange={e => onField('PRINTING', e.target.value)} className={inp} />
                </FR>
              </div>

              <div className="flex gap-1 items-center flex-wrap">
                <span className="text-[13px] text-slate-600 flex-shrink-0 w-[4.5rem] text-right">판형</span>
                <Input value={form.SIZE_GB ?? ''} onChange={e => onField('SIZE_GB', e.target.value)} className={`${inp} w-14`} />
                <span className="text-[13px] text-slate-600 flex-shrink-0">페이지</span>
                <Input type="number" value={form.PAGE ?? 0} onChange={e => onField('PAGE', e.target.value)} className={`${inp} w-12`} />
                <span className="text-[13px] text-slate-600 flex-shrink-0">부가기호</span>
                <Input value={form.CHK_CD ?? ''} onChange={e => onField('CHK_CD', e.target.value)} className={`${inp} w-14`} />
                <span className="text-[13px] text-slate-600 flex-shrink-0">안전재고</span>
                <Input type="number" value={form.AVG_QTY ?? 0} onChange={e => onField('AVG_QTY', e.target.value)} className={`${inp} w-12`} />
              </div>

              <div className="flex gap-4 pt-0.5 pl-1">
                {([
                  { key: 'USE_YN', label: '즐고볼가' },
                  { key: 'BAN_YN', label: '반입불가' },
                  { key: 'PARCEL_BOOK_YN', label: '청구제외' },
                ] as { key: keyof BookDetail; label: string }[]).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={yn(form[key] as string)} onChange={() => onToggle(key)} className="w-3.5 h-3.5 accent-blue-600" />
                    <span className="text-[13px] text-slate-700">{label}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-4 pl-1">
                {([
                  { key: 'INJI_YN', label: '인지여부' },
                  { key: 'BUROK_YN', label: '부록여부' },
                  { key: 'VAT_YN', label: '과세여부' },
                ] as { key: keyof BookDetail; label: string }[]).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={yn(form[key] as string)} onChange={() => onToggle(key)} className="w-3.5 h-3.5 accent-blue-600" />
                    <span className="text-[13px] text-slate-700">{label}</span>
                  </label>
                ))}
              </div>

              <FR label="출판사비고">
                <Input value={form.PUB_REMK ?? ''} onChange={e => onField('PUB_REMK', e.target.value)} className={inp} maxLength={200} />
              </FR>

            </div>
          )}

          {/* ══════════════ 판쇄정보 탭 ══════════════ */}
          {activeTab === '판쇄정보' && (
            <div className="p-2 space-y-2">
              {/* 판 / 쇄 + 저장 */}
              <div className="flex items-center gap-2">
                <FR label="판" className="w-24">
                  <Input type="number" value={form.PAN_QTY ?? 0}
                    onChange={e => onField('PAN_QTY', e.target.value)} className={inp} />
                </FR>
                <FR label="쇄" className="w-24">
                  <Input type="number" value={form.PRINTING ?? 0}
                    onChange={e => onField('PRINTING', e.target.value)} className={inp} />
                </FR>
                <div className="flex-1" />
                <SaveBtn saving={saving} onClick={onSave} />
              </div>

              {/* 제작 히스토리 */}
              <div>
                <p className="text-[13px] font-semibold text-slate-600 mb-1 pb-1 border-b border-slate-200">제작 히스토리</p>
                <div className="overflow-x-auto border border-slate-300 rounded-sm">
                  <table className="w-full border-collapse text-[13px]" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: panCols.widths[0] }} />
                      <col style={{ width: panCols.widths[1] }} />
                      <col style={{ width: panCols.widths[2] }} />
                      <col style={{ width: panCols.widths[3] }} />
                      <col style={{ width: panCols.widths[4] }} />
                      <col />
                      <col style={{ width: panCols.widths[6] }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-[#E7EBF5] text-black">
                        <RH label="No"    i={0} cols={panCols} />
                        <RH label="판"    i={1} cols={panCols} />
                        <RH label="쇄"    i={2} cols={panCols} />
                        <RH label="발행부수" i={3} cols={panCols} align="right" />
                        <RH label="제작일자" i={4} cols={panCols} />
                        <RH label="비고"  i={5} cols={panCols} align="left" />
                        <th className="border border-[#c8d0e0] w-7 px-1">삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {panhistList.map((p, idx) => (
                        <tr key={`${p.PAN_QTY}-${p.PRINTING}`} className="hover:bg-blue-50 border-b border-slate-100">
                          <td className="px-1.5 py-1.5 text-center border-r border-slate-200">{idx + 1}</td>
                          <td className="px-1.5 py-1.5 text-center border-r border-slate-200">{p.PAN_QTY}</td>
                          <td className="px-1.5 py-1.5 text-center border-r border-slate-200">{p.PRINTING}</td>
                          <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-slate-200">{p.MAKE_QTY.toLocaleString()}</td>
                          <td className="px-1.5 py-1.5 text-center border-r border-slate-200">{p.PAN_DATE ?? '-'}</td>
                          <td className="px-1.5 py-1.5 truncate border-r border-slate-200 text-slate-600">{p.PM_REMK}</td>
                          <td className="text-center">
                            <button onClick={() => handleDelPan(p.PAN_QTY, p.PRINTING)}
                              className="p-0.5 text-red-400 hover:text-red-600">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {/* 인라인 입력 행 */}
                      <tr className="bg-blue-50 border-b border-slate-200">
                        <td className="px-1 py-1 text-center border-r border-slate-200 text-blue-500">→</td>
                        <td className="px-0.5 py-0.5 border-r border-slate-200">
                          <Input type="number" value={newPan.panQty} placeholder="판"
                            onChange={e => setNewPan(p => ({ ...p, panQty: e.target.value }))}
                            className="h-7 text-[13px] bg-white border-slate-300 px-1 rounded-sm w-full" />
                        </td>
                        <td className="px-0.5 py-0.5 border-r border-slate-200">
                          <Input type="number" value={newPan.printing} placeholder="쇄"
                            onChange={e => setNewPan(p => ({ ...p, printing: e.target.value }))}
                            className="h-7 text-[13px] bg-white border-slate-300 px-1 rounded-sm w-full" />
                        </td>
                        <td className="px-0.5 py-0.5 border-r border-slate-200">
                          <Input type="number" value={newPan.makeQty} placeholder="부수"
                            onChange={e => setNewPan(p => ({ ...p, makeQty: e.target.value }))}
                            className="h-7 text-[13px] bg-white border-slate-300 px-1 rounded-sm w-full" />
                        </td>
                        <td className="px-0.5 py-0.5 border-r border-slate-200">
                          <Input type="date" value={newPan.panDate}
                            onChange={e => setNewPan(p => ({ ...p, panDate: e.target.value }))}
                            className="h-7 text-[13px] bg-white border-slate-300 px-1 rounded-sm w-full" />
                        </td>
                        <td className="px-0.5 py-0.5 border-r border-slate-200">
                          <Input value={newPan.pmRemk} placeholder="비고"
                            onChange={e => setNewPan(p => ({ ...p, pmRemk: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleAddPan()}
                            className="h-7 text-[13px] bg-white border-slate-300 px-1 rounded-sm w-full" />
                        </td>
                        <td className="text-center">
                          <button onClick={() => setNewPan(emptyPan)} className="p-0.5 text-red-400 hover:text-red-600">
                            <X className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <button onClick={handleAddPan} disabled={addingPan}
                    className="w-full py-1.5 text-[13px] text-slate-400 hover:bg-slate-50 hover:text-blue-500 transition-colors flex items-center justify-center gap-1">
                    <Plus className="w-3 h-3" />
                    {addingPan ? '추가중...' : '행 추가'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ 세트정보 탭 ══════════════ */}
          {activeTab === '세트정보' && (
            <div className="p-2 space-y-2">
              {/* 세트명 / 세트코드 / 세트수량 */}
              <FR label="세트명">
                <Input value={form.BK_NM ?? ''} disabled className={inpDis} />
              </FR>
              <div className="flex gap-1 items-center">
                <FR label="세트코드" className="flex-1">
                  <Input value={form.BK_CD ?? ''} disabled className={inpDis} />
                </FR>
                <FR label="세트수량" className="flex-1">
                  <Input type="number" value={form.SET_QTY ?? 0}
                    onChange={e => onField('SET_QTY', e.target.value)} className={inp} />
                </FR>
                <SaveBtn saving={saving} onClick={onSave} />
              </div>

              {/* 구성 도서 목록 */}
              <div className="overflow-x-auto border border-slate-300 rounded-sm">
                <table className="w-full border-collapse text-[13px]" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: setCols.widths[0] }} />
                    <col style={{ width: setCols.widths[1] }} />
                    <col />
                    <col style={{ width: setCols.widths[3] }} />
                    <col style={{ width: setCols.widths[4] }} />
                    <col style={{ width: setCols.widths[5] }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#E7EBF5] text-black">
                      <RH label="No"   i={0} cols={setCols} />
                      <RH label="코드" i={1} cols={setCols} />
                      <RH label="도서명" i={2} cols={setCols} align="left" />
                      <RH label="정가" i={3} cols={setCols} align="right" />
                      <RH label="수량" i={4} cols={setCols} />
                      <th className="border border-[#c8d0e0] w-7">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {setcodList.map((s, idx) => (
                      <tr key={s.BK_CD} className="hover:bg-blue-50 border-b border-slate-100">
                        <td className="px-1.5 py-1.5 text-center border-r border-slate-200">{idx + 1}</td>
                        <td className="px-1.5 py-1.5 font-mono text-slate-500 truncate border-r border-slate-200">{s.BK_CD}</td>
                        <td className="px-1.5 py-1.5 truncate border-r border-slate-200">{s.BK_NM}</td>
                        <td className="px-1.5 py-1.5 text-right tabular-nums border-r border-slate-200">{s.OUT_DANGA.toLocaleString()}</td>
                        <td className="px-0.5 py-0.5 text-center border-r border-slate-200">
                          <Input type="number" defaultValue={s.ADD_QTY}
                            onBlur={e => handleUpdSetQty(s.BK_CD, Number(e.target.value))}
                            className="h-7 text-[13px] text-center w-full border-0 bg-transparent p-0" />
                        </td>
                        <td className="text-center">
                          <button onClick={() => handleDelSet(s.BK_CD)} className="p-0.5 text-red-400 hover:text-red-600">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* 인라인 입력 행 */}
                    <tr className="bg-blue-50">
                      <td className="px-1 py-1 text-center border-r border-slate-200 text-blue-500">→</td>
                      <td className="px-0.5 py-0.5 border-r border-slate-200" colSpan={2}>
                        <Input value={newSetBkCd} placeholder="도서코드 입력"
                          onChange={e => setNewSetBkCd(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddSet()}
                          className="h-7 text-[13px] bg-white border-slate-300 px-1 rounded-sm w-full" />
                      </td>
                      <td className="border-r border-slate-200"></td>
                      <td className="px-0.5 py-0.5 border-r border-slate-200">
                        <Input type="number" value={newSetQty}
                          onChange={e => setNewSetQty(e.target.value)}
                          className="h-7 text-[13px] bg-white border-slate-300 px-1 rounded-sm w-full" />
                      </td>
                      <td className="text-center">
                        <button onClick={() => { setNewSetBkCd(''); setNewSetQty('1') }}
                          className="p-0.5 text-red-400 hover:text-red-600">
                          <X className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <button onClick={handleAddSet} disabled={addingSet}
                  className="w-full py-1.5 text-[13px] text-slate-400 hover:bg-slate-50 hover:text-blue-500 transition-colors flex items-center justify-center gap-1">
                  <Plus className="w-3 h-3" />
                  {addingSet ? '추가중...' : '행 추가'}
                </button>
              </div>
            </div>
          )}

          {/* ══════════════ 저자정보 탭 ══════════════ */}
          {activeTab === '저자정보' && (
            <div className="p-2 space-y-2">
              <fieldset className="border border-slate-300 rounded-sm p-2">
                <legend className="text-[13px] text-slate-600 px-1">저자 정보</legend>

                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-[13px] text-slate-600 flex-shrink-0 w-[4.5rem] text-right">계약번호</span>
                  <Input value={form.CON_NO ?? ''} onChange={e => onField('CON_NO', e.target.value)}
                    className={`${inp} flex-1`} maxLength={20} />
                  <Input value={form.CON_NM ?? ''} disabled className={`${inpDis} flex-1`} />
                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-[13px] flex-shrink-0">O</Button>
                </div>

                <div className="overflow-x-auto border border-slate-300 rounded-sm">
                  <table className="w-full border-collapse text-[13px]" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: writerCols.widths[0] }} />
                      <col style={{ width: writerCols.widths[1] }} />
                      <col />
                      <col style={{ width: writerCols.widths[3] }} />
                      <col style={{ width: writerCols.widths[4] }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-[#E7EBF5] text-black">
                        <RH label="순번"  i={0} cols={writerCols} />
                        <RH label="코드"  i={1} cols={writerCols} />
                        <RH label="저자"  i={2} cols={writerCols} align="left" />
                        <RH label="공저율" i={3} cols={writerCols} align="right" />
                        <th className="border border-[#c8d0e0] px-1.5 py-1.5 font-medium text-center select-none">대표</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={5} className="px-2 py-5 text-center text-slate-400 border border-slate-200">
                          저자 정보가 없습니다.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </fieldset>
            </div>
          )}

        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-300">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-400 rounded-full animate-spin" />
          <span className="text-[13px]">불러오는 중...</span>
        </div>
      )}
    </>
  )
})

// ── 리사이즈 그리드 ────────────────────────────────────────────
interface ResizableGridProps {
  rows: BookRow[]
  loading: boolean
  selectedBkCd: string | null
  onRowClick: (bkCd: string) => void
}

const ResizableGrid = React.memo(function ResizableGrid({ rows, loading, selectedBkCd, onRowClick }: ResizableGridProps) {
  const [widths, setWidths] = useState<number[]>(COLS.map(c => c.width))
  const dragging = useRef<{ colIdx: number; startX: number; startW: number } | null>(null)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const { colIdx, startX, startW } = dragging.current
      const delta = e.clientX - startX
      setWidths(prev => { const next = [...prev]; next[colIdx] = Math.max(40, startW + delta); return next })
    }
    const onUp = () => { dragging.current = null; document.body.style.cursor = '' }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [])

  const startResize = (e: React.MouseEvent, colIdx: number) => {
    e.preventDefault(); e.stopPropagation()
    dragging.current = { colIdx, startX: e.clientX, startW: widths[colIdx] }
    document.body.style.cursor = 'col-resize'
  }

  const handleSort = (key: string) => {
    if (key === '_seq') return // 순번은 정렬 불가
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedRows = React.useMemo(() => {
    if (!sortKey || rows.length === 0) return rows
    return [...rows].sort((a, b) => {
      let va: string | number, vb: string | number
      if (sortKey === '_total') {
        va = a.B_QTY + a.A_QTY + a.X_QTY
        vb = b.B_QTY + b.A_QTY + b.X_QTY
      } else {
        va = (a as unknown as Record<string, string | number>)[sortKey] ?? ''
        vb = (b as unknown as Record<string, string | number>)[sortKey] ?? ''
      }
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va
      }
      const sa = String(va), sb = String(vb)
      return sortDir === 'asc' ? sa.localeCompare(sb, 'ko') : sb.localeCompare(sa, 'ko')
    })
  }, [rows, sortKey, sortDir])

  return (
    <table className="text-[13px] border-collapse [&_td]:border-r [&_td]:border-[#d0d8e4] [&_td:last-child]:border-r-0" style={{ tableLayout: 'fixed', width: widths.reduce((a, b) => a + b, 0) }}>
      <colgroup>{widths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
      <thead className="bg-[#E7EBF5] text-black sticky top-0 z-10">
        <tr>
          {COLS.map((col, i) => (
            <th key={col.key}
              onClick={() => handleSort(col.key)}
              className={`relative px-1.5 py-1.5 text-center text-[13px] font-medium select-none overflow-hidden border-r border-[#c8d0e0] last:border-r-0 ${col.key !== '_seq' ? 'cursor-pointer hover:bg-[#dce1ef]' : ''}`}>
              <span className="truncate flex items-center justify-center gap-0.5">
                {col.label}
                {sortKey === col.key && (
                  <span className="text-[11px] text-[#2b579a]">{sortDir === 'asc' ? '▲' : '▼'}</span>
                )}
              </span>
              <div onMouseDown={e => startResize(e, i)}
                className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-300 transition-colors" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={COLS.length} className="px-3 py-12 text-center text-slate-400 text-sm">
            {loading ? '조회중...' : '조회 버튼을 눌러 검색하세요.'}
          </td></tr>
        ) : sortedRows.map((r, idx) => {
          const total = r.B_QTY + r.A_QTY + r.X_QTY
          const sel = selectedBkCd === r.BK_CD
          return (
            <tr key={r.BK_CD} onClick={() => onRowClick(r.BK_CD)}
              className={`border-b border-[#dde4ed] cursor-pointer hover:bg-[#e8f0fe] transition-colors ${sel ? 'bg-[#FDF5E6] hover:bg-[#FDF5E6] text-[#1e3a5f] font-medium' : idx%2===0 ? 'bg-white' : 'bg-[#f6f8fb]'}`}>
              {/* 순번 */}
              <td className={`px-1 py-1.5 text-center text-[13px] ${sel ? '' : 'text-[#8a9ab0]'} overflow-hidden`}>{idx + 1}</td>
              {/* 도서코드 */}
              <td className={`px-2 py-1.5 font-mono text-[13px] truncate overflow-hidden ${sel ? '' : 'text-slate-800'}`}>{r.BK_CD}</td>
              {/* 바코드 */}
              <td className={`px-2 py-1.5 font-mono text-[13px] truncate overflow-hidden ${sel ? '' : 'text-slate-800'}`}>{r.BAR_CD}</td>
              {/* 도서명 */}
              <td className={`px-2 py-1.5 text-[13px] font-medium truncate overflow-hidden ${sel ? '' : 'text-slate-800'}`}>{r.BK_NM}</td>
              {/* 브랜드 */}
              <td className={`px-2 py-1.5 text-[13px] truncate overflow-hidden ${sel ? '' : 'text-slate-800'}`}>{r.PUB_NM}</td>
              {/* 저자 */}
              <td className={`px-2 py-1.5 text-[13px] truncate overflow-hidden ${sel ? '' : 'text-slate-800'}`}>{r.WRITER}</td>
              {/* 분류 */}
              <td className={`px-2 py-1.5 text-[13px] truncate overflow-hidden ${sel ? '' : 'text-slate-800'}`}>{r.BK_PTNM}</td>
              {/* 정가 */}
              <td className={`px-2 py-1.5 text-right tabular-nums text-[13px] overflow-hidden ${sel ? '' : ''}`}>{r.OUT_DANGA.toLocaleString()}</td>
              {/* 총재고 */}
              <td className={`px-2 py-1.5 text-right tabular-nums text-[13px] font-semibold overflow-hidden ${sel ? '' : 'text-slate-700'}`}>{total.toLocaleString()}</td>
              {/* 본사 */}
              <td className={`px-2 py-1.5 text-right tabular-nums text-[13px] overflow-hidden ${sel ? '' : 'text-slate-500'}`}>{r.B_QTY.toLocaleString()}</td>
              {/* 정품 */}
              <td className={`px-2 py-1.5 text-right tabular-nums text-[13px] overflow-hidden ${sel ? '' : 'text-blue-600'}`}>{r.A_QTY.toLocaleString()}</td>
              {/* 반품 */}
              <td className={`px-2 py-1.5 text-right tabular-nums text-[13px] overflow-hidden ${sel ? '' : 'text-rose-500'}`}>{r.X_QTY.toLocaleString()}</td>
              {/* 신간일자 */}
              <td className={`px-2 py-1.5 text-[13px] truncate overflow-hidden ${sel ? '' : 'text-slate-800'}`}>{r.NEW_DATE}</td>
              {/* 도서상태 */}
              <td className="px-1.5 py-1.5 overflow-hidden">
                {sel ? (
                  <span className="text-[13px]">{r.OUT_GBNM}</span>
                ) : (
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[13px] font-medium whitespace-nowrap ${
                    r.OUT_GB === '00' ? 'bg-green-100 text-green-700' :
                    r.OUT_GB === '10' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{r.OUT_GBNM}</span>
                )}
              </td>
              {/* 시리즈 */}
              <td className={`px-2 py-1.5 text-[13px] truncate overflow-hidden ${sel ? '' : 'text-slate-800'}`}>{r.SR_CD}</td>
              {/* 매칭코드 */}
              <td className={`px-2 py-1.5 text-[13px] truncate overflow-hidden ${sel ? '' : 'text-slate-800'}`}>{r.CUSTBK_CD}</td>
              {/* 단위구분 */}
              <td className={`px-2 py-1.5 text-[13px] truncate overflow-hidden ${sel ? '' : 'text-slate-800'}`}>{r.UNIT_GB}</td>
              {/* 세트수량 */}
              <td className={`px-2 py-1.5 text-right tabular-nums text-[13px] overflow-hidden ${sel ? '' : 'text-slate-500'}`}>{r.SET_QTY}</td>
              {/* 과세 */}
              <td className={`px-2 py-1.5 text-center text-[13px] overflow-hidden ${sel ? '' : r.VAT_YN === 'Y' ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>{r.VAT_YN}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
})

// ── 메인 페이지 ────────────────────────────────────────────────
export default function BookMasterPage() {
  const [sBkNm, setSBkNm] = useState('')
  const [sBkCd, setSBkCd] = useState('')
  const [sPubCd, setSPubCd] = useState('')
  const [sNewDate1, setSNewDate1] = useState('')
  const [sNewDate2, setSNewDate2] = useState('')
  const [sOutGb, setSOutGb] = useState('')

  const [rows, setRows] = useState<BookRow[]>([])
  const [loading, setLoading] = useState(false)

  const [selectedBkCd, setSelectedBkCd] = useState<string | null>(null)
  const [detail, setDetail] = useState<BookDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<BookDetail>>({})

  const [custchList, setCustchList] = useState<Custch[]>([])
  const [bkpartList, setBkpartList] = useState<Bkpart[]>([])

  const [detailWidth, setDetailWidth] = useState(520)
  const splitDragging = useRef<{ startX: number; startW: number } | null>(null)

  useEffect(() => {
    api.get('/p0/bookcd/meta/custch').then(r => setCustchList(r.data)).catch(() => {})
    api.get('/p0/bookcd/meta/bkpart').then(r => setBkpartList(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!splitDragging.current) return
      const delta = splitDragging.current.startX - e.clientX
      setDetailWidth(Math.max(400, Math.min(780, splitDragging.current.startW + delta)))
    }
    const onUp = () => { splitDragging.current = null; document.body.style.cursor = '' }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [])

  const handleSearch = useCallback(async () => {
    setLoading(true); setSelectedBkCd(null); setDetail(null)
    try {
      const res = await api.get('/p0/bookcd', {
        params: {
          bkNm: sBkNm || undefined, bkCd: sBkCd || undefined,
          pubCd: sPubCd || undefined, newDate1: sNewDate1 || undefined,
          newDate2: sNewDate2 || undefined, outGb: sOutGb || undefined,
        },
      })
      setRows(res.data)
      if (res.data.length === 0) toast.info('조회된 데이터가 없습니다.')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? '조회 중 오류가 발생했습니다.')
    } finally { setLoading(false) }
  }, [sBkNm, sBkCd, sPubCd, sNewDate1, sNewDate2, sOutGb])

  const handleClear = () => {
    setSBkNm(''); setSBkCd(''); setSPubCd('')
    setSNewDate1(''); setSNewDate2(''); setSOutGb('')
    setRows([]); setSelectedBkCd(null); setDetail(null)
  }

  const handleRowClick = useCallback(async (bkCd: string) => {
    if (selectedBkCd === bkCd) return
    setSelectedBkCd(bkCd)
    setDetailLoading(true)
    try {
      const res = await api.get(`/p0/bookcd/${bkCd}`)
      setDetail(res.data); setForm(res.data)
    } catch { toast.error('상세 조회 중 오류가 발생했습니다.') }
    finally { setDetailLoading(false) }
  }, [selectedBkCd])

  const handleSave = async () => {
    if (!selectedBkCd || !form) return
    setSaving(true)
    try {
      await api.put(`/p0/bookcd/${selectedBkCd}`, {
        bkNm: form.BK_NM, barCd: form.BAR_CD ?? null, pubCd: form.PUB_CD ?? null,
        outDanga: Number(form.OUT_DANGA), ipsuQty: Number(form.IPSU_QTY),
        pubRemk: form.PUB_REMK ?? null, custbkCd: form.CUSTBK_CD ?? null,
        outGb: form.OUT_GB ?? '00', writer: form.WRITER ?? null,
        translator: form.TRANSLATOR ?? null, bkPart: form.BK_PART ?? null,
        srCd: form.SR_CD ?? null, newDate: form.NEW_DATE ?? null,
        pubDate: form.PUB_DATE ?? null, setQty: Number(form.SET_QTY),
        unitGb: form.UNIT_GB ?? '1',
        sizeWidth: Number(form.SIZE_WIDTH), sizeHeight: Number(form.SIZE_HEIGHT),
        sizeThick: Number(form.SIZE_THICK), sizeWeight: Number(form.SIZE_WEIGHT),
        panQty: Number(form.PAN_QTY), printing: Number(form.PRINTING),
        sizeGb: form.SIZE_GB ?? null, page: Number(form.PAGE),
        chkCd: form.CHK_CD ?? null, avgQty: Number(form.AVG_QTY),
        useYn: form.USE_YN ?? 'N', banYn: form.BAN_YN ?? 'N',
        parcelBookYn: form.PARCEL_BOOK_YN ?? 'N', injiYn: form.INJI_YN ?? 'N',
        burokYn: form.BUROK_YN ?? 'N', vatYn: form.VAT_YN ?? 'N',
        meipCd: form.MEIP_CD ?? null, inRate: Number(form.IN_RATE),
        conNo: form.CON_NO ?? null,
      })
      toast.success('저장되었습니다.')
      const res = await api.get(`/p0/bookcd/${selectedBkCd}`)
      setDetail(res.data); setForm(res.data)
      setRows(prev => prev.map(r => r.BK_CD === selectedBkCd
        ? { ...r, BK_NM: form.BK_NM!, OUT_DANGA: Number(form.OUT_DANGA),
            OUT_GBNM: OUT_GB_OPTIONS.find(o => o.value === form.OUT_GB)?.label ?? r.OUT_GBNM }
        : r))
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? '저장 중 오류가 발생했습니다.')
    } finally { setSaving(false) }
  }

  const handleExcel = useCallback(() => {
    if (rows.length === 0) return
    const header = COLS.filter(c => c.key !== '_seq').map(c => c.label)
    const data = rows.map(r => {
      const total = r.B_QTY + r.A_QTY + r.X_QTY
      return COLS.filter(c => c.key !== '_seq').map(c => {
        if (c.key === '_total') return total
        return (r as unknown as Record<string, string | number>)[c.key] ?? ''
      })
    })
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    // 컬럼 너비 자동 설정
    ws['!cols'] = header.map((h, i) => ({ wch: Math.max(h.length * 2, ...data.map(d => String(d[i]).length)) + 2 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '도서마스터')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `도서마스터_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }, [rows])

  const setFormField = (key: keyof BookDetail, value: string | number) =>
    setForm(prev => ({ ...prev, [key]: value }))
  const toggleYn = (key: keyof BookDetail) =>
    setForm(prev => ({ ...prev, [key]: prev[key] === 'Y' ? 'N' : 'Y' }))

  return (
    <div className="flex flex-col h-full gap-1.5">

      {/* 검색 */}
      <div className="shrink-0 bg-[#E7EBF5] rounded-sm border border-[#b8c4d4] px-2 py-1.5">
        <div className="flex flex-wrap items-end gap-1.5">
          <div className="space-y-0.5">
            <Label className="text-[13px] text-[#5a6a7e]">도서명/ISBN</Label>
            <Input placeholder="도서명 또는 ISBN" value={sBkNm}
              onChange={e => setSBkNm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="h-8 text-[13px] w-44" />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[13px] text-[#5a6a7e]">도서코드</Label>
            <Input placeholder="도서코드" value={sBkCd}
              onChange={e => setSBkCd(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="h-8 text-[13px] w-28" />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[13px] text-[#5a6a7e]">출판사</Label>
            <Select value={sPubCd} onValueChange={v => setSPubCd(v ?? '')}>
              <SelectTrigger className="h-8 text-[13px] w-36"><SelectValue placeholder="전체" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">전체</SelectItem>
                {custchList.map(c => <SelectItem key={c.PUB_CD} value={c.PUB_CD}>{c.PUB_NM}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-0.5">
            <Label className="text-[13px] text-[#5a6a7e]">신간일</Label>
            <div className="flex items-center gap-1">
              <Input type="date" value={sNewDate1} onChange={e => setSNewDate1(e.target.value)} className="h-8 text-[13px] w-36" />
              <span className="text-[#8a9ab0] text-[13px]">~</span>
              <Input type="date" value={sNewDate2} onChange={e => setSNewDate2(e.target.value)} className="h-8 text-[13px] w-36" />
            </div>
          </div>
          <div className="space-y-0.5">
            <Label className="text-[13px] text-[#5a6a7e]">상태</Label>
            <Select value={sOutGb} onValueChange={v => setSOutGb(v ?? '')}>
              <SelectTrigger className="h-8 text-[13px] w-24"><SelectValue placeholder="전체" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">전체</SelectItem>
                {OUT_GB_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1 pb-0.5">
            <Button size="sm" onClick={handleSearch} disabled={loading} className="h-8 px-3 text-[13px]">
              <Search className="w-3.5 h-3.5 mr-1" />{loading ? '조회중...' : '조회'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleClear} className="h-8 px-2.5">
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* 그리드 상단 바: 총건수 + 엑셀 */}
      <div className="shrink-0 flex items-center justify-between bg-white rounded-sm border border-[#b8c4d4] px-2 py-1">
        <span className="text-[13px] text-[#5a6a7e]">
          총 <span className="font-semibold text-[#1e3a5f]">{rows.length.toLocaleString()}</span>건
        </span>
        <Button size="sm" variant="outline" onClick={handleExcel} disabled={rows.length === 0}
          className="h-7 px-2.5 text-[12px] gap-1 border-[#b8c4d4]">
          <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" />엑셀
        </Button>
      </div>

      {/* 목록 + 상세 */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 bg-white rounded-sm border border-[#b8c4d4] flex flex-col min-w-0 overflow-hidden min-h-0">
          <div className="overflow-auto flex-1 min-h-0">
            <ResizableGrid rows={rows} loading={loading} selectedBkCd={selectedBkCd} onRowClick={handleRowClick} />
          </div>
        </div>

        {selectedBkCd && (
          <div
            onMouseDown={e => {
              e.preventDefault()
              splitDragging.current = { startX: e.clientX, startW: detailWidth }
              document.body.style.cursor = 'col-resize'
            }}
            className="w-1 shrink-0 mx-0.5 rounded-full cursor-col-resize hover:bg-[#2b579a] active:bg-[#1e3a5f] transition-colors bg-[#b8c4d4]"
          />
        )}

        {selectedBkCd && (
          <div className="shrink-0 bg-white rounded-sm border border-[#b8c4d4] flex flex-col overflow-hidden relative"
            style={{ width: detailWidth }}>
            {detailLoading && (
              <div className="absolute inset-0 bg-white/60 z-20 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
              </div>
            )}
            <DetailPanel
              detail={detail} form={form} saving={saving}
              custchList={custchList} bkpartList={bkpartList}
              onSave={handleSave}
              onClose={() => { setSelectedBkCd(null); setDetail(null) }}
              onField={setFormField}
              onToggle={toggleYn}
            />
          </div>
        )}
      </div>
    </div>
  )
}
