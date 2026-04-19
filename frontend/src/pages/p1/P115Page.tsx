import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

// ─── 타입 ────────────────────────────────────────────────────────────────────
interface MstRow {
  OUTBOUND_DATE: string; OUT_NO: string; DELIVERY_CD: string; DELIVERY_NM: string
  METAX_NO: string; MECUST_NM: string; ME_GBNM: string; ME_GB: string
  MOVE_YN: string; ERROR_YN: string; ERROR_TEXT: string
}
interface DtlRow {
  LINE_NO: string; BAR_CD: string; BK_CD: string; ITEM_NM: string
  PRICE: number; DISCOUNT: number; ORDER_QTY: number
  MOVE_YN: string; ERROR_YN: string; ERROR_TEXT: string; REMARK: string
  BK_QTY10: number; MEDG_QTY: number; JG_QTY: number
}
interface MatchRow {
  SEQ: number; STORE_CD: string; METAX_NO: string; MECUST_NM: string
  UPD_EMP: string; UPD_DATE: string
}
interface CustItem { METAX_NO: string; MECUST_NM: string }

// ─── 헬퍼 ───────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function weekAgoStr() {
  const d = new Date(); d.setDate(d.getDate() - 7)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtDate(s: string) {
  if (!s || s.length < 8) return s
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`
}
function fmtNum(n: number) { return n?.toLocaleString() ?? '0' }

// 공통 스타일
const inp  = 'h-7 px-2 text-[13px] border border-[#b8c4d4] rounded-sm bg-white w-full focus:outline-none focus:ring-1 focus:ring-[#2b579a]/30 focus:border-[#2b579a] transition-colors'
const inpD = 'h-7 px-2 text-[13px] border border-[#d8dfe8] rounded-sm bg-[#f4f6f8] w-full text-[#8a9ab0] cursor-default'
const selS = 'h-7 px-1.5 text-[13px] border border-[#b8c4d4] rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#2b579a]/30 focus:border-[#2b579a] transition-colors'
const btnPrimary = 'h-7 px-3 text-[13px] rounded-sm bg-[#2b579a] text-white hover:bg-[#1e3f73] active:bg-[#162e54] transition-colors flex items-center gap-1.5 shrink-0'
const btnSecondary = 'h-7 px-3 text-[13px] rounded-sm border border-[#b8c4d4] bg-white text-[#374151] hover:bg-[#f0f4f8] active:bg-[#e4eaf2] transition-colors flex items-center gap-1.5 shrink-0'
const btnDanger = 'h-7 px-3 text-[13px] rounded-sm border border-[#f5c2c7] bg-[#fff5f5] text-[#c0392b] hover:bg-[#fde8e8] active:bg-[#fad4d4] transition-colors flex items-center gap-1.5 shrink-0'

// ─── 컬럼 정의 ───────────────────────────────────────────────────────────────
const MST_COLS = [
  { key: 'chk',           label: '',         w: 32,  align: 'center' as const },
  { key: 'OUTBOUND_DATE', label: '주문일자',  w: 90,  align: 'center' as const },
  { key: 'OUT_NO',        label: '출고번호',  w: 60,  align: 'center' as const },
  { key: 'DELIVERY_CD',   label: '서점코드',  w: 85,  align: 'left'   as const },
  { key: 'DELIVERY_NM',   label: '서점명',    w: 130, align: 'left'   as const },
  { key: 'MECUST_NM',     label: '판매처명',  w: 130, align: 'left'   as const },
  { key: 'ME_GBNM',       label: '매출구분',  w: 70,  align: 'center' as const },
  { key: 'MOVE_YN',       label: '전송',      w: 50,  align: 'center' as const },
  { key: 'ERROR_YN',      label: '오류',      w: 45,  align: 'center' as const },
  { key: 'ERROR_TEXT',    label: '오류내용',  w: 150, align: 'left'   as const },
]
const DTL_COLS = [
  { key: 'LINE_NO',   label: '라인',    w: 45,  align: 'center' as const },
  { key: 'BAR_CD',    label: 'ISBN',    w: 120, align: 'left'   as const },
  { key: 'BK_CD',     label: '도서코드', w: 80,  align: 'left'   as const },
  { key: 'ITEM_NM',   label: '도서명',   w: 220, align: 'left'   as const },
  { key: 'PRICE',     label: '정가',    w: 75,  align: 'right'  as const },
  { key: 'DISCOUNT',  label: '공급률',  w: 60,  align: 'right'  as const },
  { key: 'ORDER_QTY', label: '주문수량', w: 65,  align: 'right'  as const },
  { key: 'JG_QTY',    label: '재고',    w: 60,  align: 'right'  as const },
  { key: 'MOVE_YN',   label: '전송',    w: 45,  align: 'center' as const },
  { key: 'ERROR_TEXT',label: '오류내용', w: 170, align: 'left'   as const },
  { key: 'REMARK',    label: '비고',    w: 120, align: 'left'   as const },
]

export default function P115Page() {
  // ── 탭 ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'order' | 'match'>('order')

  // ── Tab1 검색조건 ────────────────────────────────────────────────────────
  const [d1, setD1] = useState(weekAgoStr())
  const [d2, setD2] = useState(todayStr())
  const [searchMetaxNo, setSearchMetaxNo] = useState('')
  const [moveYn, setMoveYn] = useState('')
  const [jgGb, setJgGb] = useState('00')

  // ── Tab1 데이터 ──────────────────────────────────────────────────────────
  const [mstRows, setMstRows] = useState<MstRow[]>([])
  const [dtlRows, setDtlRows] = useState<DtlRow[]>([])
  const [selMstIdx, setSelMstIdx] = useState<number | null>(null)
  const [checkedSet, setCheckedSet] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)

  // 판매처 자동완성
  const [custDisplay, setCustDisplay] = useState('')
  const [custResults, setCustResults] = useState<CustItem[]>([])
  const [showCustDrop, setShowCustDrop] = useState(false)
  const custTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const custRef = useRef<HTMLDivElement>(null)
  const custDropIdx = useRef(-1)

  // ── Tab2 ─────────────────────────────────────────────────────────────────
  const [matchRows, setMatchRows] = useState<MatchRow[]>([])
  const [selMatchIdx, setSelMatchIdx] = useState<number | null>(null)
  const [mSearchStoreCd, setMSearchStoreCd] = useState('')
  const [mSearchMetaxNo, setMSearchMetaxNo] = useState('')

  // Tab2 편집폼
  const [formStoreCd, setFormStoreCd] = useState('')
  const [formMetaxNo, setFormMetaxNo] = useState('')
  const [formCustNm, setFormCustNm] = useState('')
  const [formMode, setFormMode] = useState<'new' | 'edit'>('new')
  const [oldStoreCd, setOldStoreCd] = useState('')

  // Tab2 판매처 자동완성
  const [mCustDisplay, setMCustDisplay] = useState('')
  const [mCustResults, setMCustResults] = useState<CustItem[]>([])
  const [showMCustDrop, setShowMCustDrop] = useState(false)
  const mCustTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mCustRef = useRef<HTMLDivElement>(null)

  // ── 컬럼 너비 (리사이즈) ──────────────────────────────────────────────────
  const [mstWidths, setMstWidths] = useState(MST_COLS.map(c => c.w))
  const [dtlWidths, setDtlWidths] = useState(DTL_COLS.map(c => c.w))
  const mstResizing = useRef<{ idx: number; startX: number; startW: number } | null>(null)
  const dtlResizing = useRef<{ idx: number; startX: number; startW: number } | null>(null)

  // ── 그리드 참조 ──────────────────────────────────────────────────────────
  const mstBodyRef = useRef<HTMLDivElement>(null)
  const dtlBodyRef = useRef<HTMLDivElement>(null)

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab1 — 판매처 검색 자동완성
  // ═══════════════════════════════════════════════════════════════════════════
  function onCustChange(v: string) {
    setCustDisplay(v)
    if (!v.trim()) { setSearchMetaxNo(''); setCustResults([]); setShowCustDrop(false); return }
    if (custTimer.current) clearTimeout(custTimer.current)
    custTimer.current = setTimeout(() => doSearchCust(v), 250)
  }
  async function doSearchCust(kw: string) {
    try {
      const res = await api.get('/p1/p115/meta/custme', { params: { q: kw.trim() } })
      setCustResults(res.data)
      setShowCustDrop(res.data.length > 0)
      custDropIdx.current = -1
    } catch { /* 무시 */ }
  }
  function applyCust(c: CustItem) {
    setCustDisplay(c.MECUST_NM)
    setSearchMetaxNo(c.METAX_NO)
    setCustResults([]); setShowCustDrop(false)
  }
  function onCustKeyDown(e: React.KeyboardEvent) {
    if (!showCustDrop || custResults.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); custDropIdx.current = Math.min(custDropIdx.current + 1, custResults.length - 1); forceRenderCustDrop() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); custDropIdx.current = Math.max(custDropIdx.current - 1, 0); forceRenderCustDrop() }
    else if (e.key === 'Enter' && custDropIdx.current >= 0) { e.preventDefault(); applyCust(custResults[custDropIdx.current]) }
    else if (e.key === 'Escape') { setShowCustDrop(false) }
  }
  const [, setCustDropForce] = useState(0)
  function forceRenderCustDrop() { setCustDropForce(n => n + 1) }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab1 — 조회
  // ═══════════════════════════════════════════════════════════════════════════
  const handleSearch = useCallback(async () => {
    setLoading(true)
    setSelMstIdx(null); setDtlRows([]); setCheckedSet(new Set())
    try {
      const res = await api.get('/p1/p115/kobicmst', {
        params: { d1, d2, metaxNo: searchMetaxNo || undefined, moveYn: moveYn || undefined }
      })
      setMstRows(res.data)
      if (res.data.length === 0) toast.info('조회된 데이터가 없습니다.')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? '조회 중 오류가 발생했습니다.')
    } finally { setLoading(false) }
  }, [d1, d2, searchMetaxNo, moveYn])

  // 마스터 선택 → 상세 로드
  async function selectMst(idx: number) {
    setSelMstIdx(idx)
    const r = mstRows[idx]
    try {
      const res = await api.get(`/p1/p115/kobicmst/${r.OUTBOUND_DATE}/${r.OUT_NO}/${r.DELIVERY_CD}/lines`)
      setDtlRows(res.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? '상세 조회 오류')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab1 — 불러오기
  // ═══════════════════════════════════════════════════════════════════════════
  async function handleImport() {
    if (!window.confirm(`KOBIC 주문을 ${d1} ~ ${d2} 기간으로 불러오시겠습니까?`)) return
    setImporting(true)
    try {
      const res = await api.post('/p1/p115/import', { d1, d2, jgGb })
      toast.success(res.data.message)
      await handleSearch()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? '불러오기 오류')
    } finally { setImporting(false) }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab1 — 주문등록 (선택된 마스터들)
  // ═══════════════════════════════════════════════════════════════════════════
  async function handleOrder() {
    const targets = selMstIdx !== null
      ? [selMstIdx]
      : Array.from(checkedSet)
    if (targets.length === 0) { toast.warning('주문등록할 항목을 선택하세요.'); return }

    const toProcess = targets.map(i => mstRows[i]).filter(r => r.MOVE_YN === 'N' && r.ERROR_YN === 'N')
    if (toProcess.length === 0) { toast.warning('등록 가능한 항목이 없습니다. (미전송·오류없음 항목만 가능)'); return }
    if (!window.confirm(`${toProcess.length}건을 주문등록하시겠습니까?`)) return

    setLoading(true)
    let ok = 0, fail = 0
    for (const r of toProcess) {
      try {
        await api.post('/p1/p115/order', {
          date: r.OUTBOUND_DATE, outNo: r.OUT_NO, deliveryCd: r.DELIVERY_CD, jgGb
        })
        ok++
      } catch (err: any) {
        fail++
        toast.error(`[${r.DELIVERY_NM}] ${err?.response?.data?.message ?? '오류'}`)
      }
    }
    setLoading(false)
    if (ok > 0) toast.success(`${ok}건 주문등록 완료${fail > 0 ? ` (실패 ${fail}건)` : ''}`)
    await handleSearch()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab1 — 삭제
  // ═══════════════════════════════════════════════════════════════════════════
  async function handleDeleteMst(idx: number) {
    const r = mstRows[idx]
    if (r.MOVE_YN === 'Y') { toast.warning('이미 전송된 주문은 삭제할 수 없습니다.'); return }
    if (!window.confirm(`[${r.DELIVERY_NM}] 주문을 삭제하시겠습니까?`)) return
    try {
      await api.delete(`/p1/p115/kobicmst/${r.OUTBOUND_DATE}/${r.OUT_NO}/${r.DELIVERY_CD}`)
      toast.success('삭제 완료')
      setSelMstIdx(null); setDtlRows([])
      await handleSearch()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? '삭제 오류')
    }
  }

  async function handleDeleteDtl(lineNo: string) {
    if (selMstIdx === null) return
    const r = mstRows[selMstIdx]
    if (!window.confirm('이 라인을 삭제하시겠습니까?')) return
    try {
      await api.delete(`/p1/p115/kobicmst/${r.OUTBOUND_DATE}/${r.OUT_NO}/${r.DELIVERY_CD}/lines/${lineNo}`)
      toast.success('라인 삭제 완료')
      const res = await api.get(`/p1/p115/kobicmst/${r.OUTBOUND_DATE}/${r.OUT_NO}/${r.DELIVERY_CD}/lines`)
      setDtlRows(res.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? '삭제 오류')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab1 — 재매칭
  // ═══════════════════════════════════════════════════════════════════════════
  async function handleRematch() {
    if (selMstIdx === null) { toast.warning('재매칭할 항목을 선택하세요.'); return }
    const r = mstRows[selMstIdx]
    if (r.MOVE_YN === 'Y') { toast.warning('이미 전송된 주문입니다.'); return }
    try {
      await api.post('/p1/p115/rematch', { date: r.OUTBOUND_DATE, outNo: r.OUT_NO, deliveryCd: r.DELIVERY_CD })
      toast.success('재매칭 완료')
      await handleSearch()
      const res = await api.get(`/p1/p115/kobicmst/${r.OUTBOUND_DATE}/${r.OUT_NO}/${r.DELIVERY_CD}/lines`)
      setDtlRows(res.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? '재매칭 오류')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab1 — 초기화 (F3) : C# ClearText()와 동일
  // ═══════════════════════════════════════════════════════════════════════════
  function handleClear() {
    setD1(todayStr()); setD2(todayStr())
    setCustDisplay(''); setSearchMetaxNo('')
    setMoveYn(''); setJgGb('00')
    setMstRows([]); setDtlRows([])
    setSelMstIdx(null); setCheckedSet(new Set())
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab1 — 일괄삭제 (F9) : C# delEdiJumun()과 동일
  // 조건 : 미전송(MOVE_YN='N')만, 검색조건(기간+판매처) 기준
  // ═══════════════════════════════════════════════════════════════════════════
  async function handleBulkDelete() {
    if (moveYn === 'Y') { toast.warning('미전송 상태에서만 삭제됩니다.'); return }
    if (!window.confirm('조회 조건에 해당하는 미전송 주문을 전체 삭제하시겠습니까?')) return
    try {
      await api.delete('/p1/p115/kobicmst', {
        data: { d1, d2, metaxNo: searchMetaxNo || undefined }
      })
      toast.success('삭제 완료')
      handleClear()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? '삭제 오류')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab1 — 엑셀 출력 : 상단 그리드(KOBICMST) 기준
  // ═══════════════════════════════════════════════════════════════════════════
  function handleExcel() {
    if (mstRows.length === 0) { toast.warning('출력할 데이터가 없습니다.'); return }
    const data = mstRows.map(r => ({
      '주문일자':  r.OUTBOUND_DATE ? `${r.OUTBOUND_DATE.slice(0,4)}-${r.OUTBOUND_DATE.slice(4,6)}-${r.OUTBOUND_DATE.slice(6,8)}` : '',
      '출고번호':  r.OUT_NO,
      '서점코드':  r.DELIVERY_CD,
      '서점명':    r.DELIVERY_NM,
      '판매처명':  r.MECUST_NM,
      '매출구분':  r.ME_GBNM,
      '전송여부':  r.MOVE_YN === 'Y' ? '전송' : '미전송',
      '오류여부':  r.ERROR_YN === 'Y' ? '오류' : '',
      '오류내용':  r.ERROR_TEXT,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'KOBIC주문')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `KOBIC주문_${d1}_${d2}.xlsx`)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 체크박스 처리
  // ═══════════════════════════════════════════════════════════════════════════
  function toggleCheck(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation()
    setCheckedSet(prev => {
      const n = new Set(prev)
      if (n.has(idx)) n.delete(idx); else n.add(idx)
      return n
    })
  }
  function toggleAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) setCheckedSet(new Set(mstRows.map((_, i) => i)))
    else setCheckedSet(new Set())
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 그리드 컬럼 리사이즈
  // ═══════════════════════════════════════════════════════════════════════════
  function startMstResize(e: React.MouseEvent, idx: number) {
    e.preventDefault()
    mstResizing.current = { idx, startX: e.clientX, startW: mstWidths[idx] }
    const onMove = (ev: MouseEvent) => {
      if (!mstResizing.current) return
      const diff = ev.clientX - mstResizing.current.startX
      setMstWidths(prev => { const n=[...prev]; n[mstResizing.current!.idx]=Math.max(30, mstResizing.current!.startW+diff); return n })
    }
    const onUp = () => { mstResizing.current = null; window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  function startDtlResize(e: React.MouseEvent, idx: number) {
    e.preventDefault()
    dtlResizing.current = { idx, startX: e.clientX, startW: dtlWidths[idx] }
    const onMove = (ev: MouseEvent) => {
      if (!dtlResizing.current) return
      const diff = ev.clientX - dtlResizing.current.startX
      setDtlWidths(prev => { const n=[...prev]; n[dtlResizing.current!.idx]=Math.max(30, dtlResizing.current!.startW+diff); return n })
    }
    const onUp = () => { dtlResizing.current = null; window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab2 — KOBIC_MATCH 조회
  // ═══════════════════════════════════════════════════════════════════════════
  const handleMatchSearch = useCallback(async () => {
    try {
      const res = await api.get('/p1/p115/kobic-match', {
        params: {
          storeCd: mSearchStoreCd || undefined,
          metaxNo: mSearchMetaxNo || undefined,
        }
      })
      setMatchRows(res.data)
      setSelMatchIdx(null)
      if (res.data.length === 0) toast.info('조회된 데이터가 없습니다.')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? '조회 오류')
    }
  }, [mSearchStoreCd, mSearchMetaxNo])

  useEffect(() => { if (tab === 'match') handleMatchSearch() }, [tab])

  // Tab2 매칭 행 선택
  function selectMatch(idx: number) {
    setSelMatchIdx(idx)
    const r = matchRows[idx]
    setFormStoreCd(r.STORE_CD)
    setOldStoreCd(r.STORE_CD)
    setFormMetaxNo(r.METAX_NO)
    setFormCustNm(r.MECUST_NM)
    setMCustDisplay(r.MECUST_NM)
    setFormMode('edit')
  }

  // Tab2 신규
  function handleMatchNew() {
    setSelMatchIdx(null)
    setFormStoreCd(''); setFormMetaxNo(''); setFormCustNm('')
    setMCustDisplay(''); setOldStoreCd('')
    setFormMode('new')
  }

  // Tab2 판매처 자동완성
  function onMCustChange(v: string) {
    setMCustDisplay(v)
    if (!v.trim()) { setFormMetaxNo(''); setFormCustNm(''); setMCustResults([]); setShowMCustDrop(false); return }
    if (mCustTimer.current) clearTimeout(mCustTimer.current)
    mCustTimer.current = setTimeout(() => doSearchMCust(v), 250)
  }
  async function doSearchMCust(kw: string) {
    try {
      const res = await api.get('/p1/p115/meta/custme', { params: { q: kw.trim() } })
      setMCustResults(res.data); setShowMCustDrop(res.data.length > 0)
    } catch { /* 무시 */ }
  }
  function applyMCust(c: CustItem) {
    setMCustDisplay(c.MECUST_NM); setFormMetaxNo(c.METAX_NO); setFormCustNm(c.MECUST_NM)
    setMCustResults([]); setShowMCustDrop(false)
  }

  // Tab2 저장
  async function handleMatchSave() {
    if (!formStoreCd) { toast.warning('KOBIC코드를 입력하세요.'); return }
    if (!formMetaxNo) { toast.warning('판매처를 선택하세요.'); return }
    try {
      if (formMode === 'new') {
        await api.post('/p1/p115/kobic-match', { storeCd: formStoreCd, metaxNo: formMetaxNo })
        toast.success('등록 완료')
      } else {
        await api.put(`/p1/p115/kobic-match/${oldStoreCd}`, {
          metaxNo: formMetaxNo,
          newStoreCd: formStoreCd !== oldStoreCd ? formStoreCd : undefined,
        })
        toast.success('수정 완료')
      }
      await handleMatchSearch()
      handleMatchNew()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? '저장 오류')
    }
  }

  // Tab2 삭제
  async function handleMatchDelete() {
    if (formMode === 'new' || !oldStoreCd) { toast.warning('삭제할 항목을 선택하세요.'); return }
    if (!window.confirm(`[${oldStoreCd}] KOBIC 코드 매핑을 삭제하시겠습니까?`)) return
    try {
      await api.delete(`/p1/p115/kobic-match/${oldStoreCd}`)
      toast.success('삭제 완료')
      await handleMatchSearch()
      handleMatchNew()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? '삭제 오류')
    }
  }

  // 키보드 단축키 (F3=초기화, F9=삭제, F10=조회) — C# ProcessCmdKey와 동일
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F3')  { e.preventDefault(); if (tab === 'order') handleClear() }
      if (e.key === 'F9')  { e.preventDefault(); if (tab === 'order') handleBulkDelete() }
      if (e.key === 'F10') { e.preventDefault(); if (tab === 'order') handleSearch() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab, d1, d2, searchMetaxNo, moveYn, handleSearch])

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (custRef.current && !custRef.current.contains(e.target as Node)) setShowCustDrop(false)
      if (mCustRef.current && !mCustRef.current.contains(e.target as Node)) setShowMCustDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ─── 공통 헤더 동기 스크롤 ──────────────────────────────────────────────
  const mstHeadRef = useRef<HTMLDivElement>(null)
  const dtlHeadRef = useRef<HTMLDivElement>(null)
  function syncMstScroll(e: React.UIEvent<HTMLDivElement>) {
    if (mstHeadRef.current) mstHeadRef.current.scrollLeft = e.currentTarget.scrollLeft
  }
  function syncDtlScroll(e: React.UIEvent<HTMLDivElement>) {
    if (dtlHeadRef.current) dtlHeadRef.current.scrollLeft = e.currentTarget.scrollLeft
  }

  // ─── MOVE_YN 뱃지 ────────────────────────────────────────────────────────
  function moveYnBadge(yn: string) {
    return yn === 'Y'
      ? <span className="px-1.5 py-0.5 rounded text-[11px] bg-[#e6f4ea] text-[#1e7e34] border border-[#b7dfc4]">전송</span>
      : <span className="px-1.5 py-0.5 rounded text-[11px] bg-[#e8f0fe] text-[#2b579a] border border-[#b8cde8]">미전송</span>
  }
  function errorBadge(yn: string) {
    return yn === 'Y'
      ? <span className="px-1.5 py-0.5 rounded text-[11px] bg-[#fff5f5] text-[#c0392b] border border-[#f5c2c7]">오류</span>
      : null
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full bg-[#eef2f7] text-[13px] select-none">

      {/* ── 탭 헤더 ─────────────────────────────────────────────────────── */}
      <div className="flex items-end px-3 pt-2 gap-0.5 shrink-0">
        {[
          { key: 'order', label: '주문받기' },
          { key: 'match', label: 'KOBIC코드관리' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-1.5 text-[13px] rounded-t-sm border-t border-l border-r transition-colors ${
              tab === t.key
                ? 'bg-white border-[#b8c4d4] text-[#1e3f73] font-semibold'
                : 'bg-[#d8e0ec] border-[#b8c4d4] text-[#5a6a7e] hover:bg-[#cdd7e8]'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — 주문받기                                                  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'order' && (
        <div className="flex flex-col flex-1 min-h-0 bg-white border border-[#b8c4d4] rounded-b-sm rounded-tr-sm mx-3 mb-3 overflow-hidden">

          {/* ── 툴바 ──────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[#f0f4f9] border-b border-[#d0d8e4] shrink-0">
            <button className={btnPrimary} onClick={handleImport} disabled={importing || loading}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              {importing ? '불러오는 중...' : '불러오기'}
            </button>
            <button className={btnPrimary} onClick={handleOrder} disabled={loading}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              주문등록
            </button>
            <button className={btnSecondary} onClick={handleRematch} disabled={loading}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              재매칭
            </button>
            <div className="w-px h-5 bg-[#ccd5e0] mx-0.5" />
            <button className={btnDanger} onClick={handleBulkDelete} disabled={loading}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              삭제(F9)
            </button>
            <button className={btnSecondary} onClick={handleClear}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              초기화(F3)
            </button>
            <button className={btnSecondary} onClick={handleExcel}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              엑셀
            </button>
            <div className="w-px h-5 bg-[#ccd5e0] mx-0.5" />
            <button className={btnSecondary}
              onClick={() => window.open('https://bsi.kpa21.or.kr/pub/login.do','_blank')}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              KOBIC사이트
            </button>
            {selMstIdx !== null && mstRows[selMstIdx]?.MOVE_YN === 'N' && (
              <>
                <div className="w-px h-5 bg-[#ccd5e0] mx-0.5" />
                <button className={btnDanger} onClick={() => handleDeleteMst(selMstIdx!)}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  행삭제
                </button>
              </>
            )}
            <div className="flex-1" />
            {/* 창고구분 */}
            <span className="text-[#5a6a7e]">창고</span>
            <select className={selS} value={jgGb} onChange={e => setJgGb(e.target.value)}>
              <option value="00">본사</option>
              <option value="10">물류</option>
            </select>
          </div>

          {/* ── 검색조건 ──────────────────────────────────────────────────── */}
          <div className="shrink-0 bg-[#E7EBF5] border-b border-[#b8c4d4] px-3 py-1.5">
            <div className="flex flex-wrap items-end gap-1.5">
              {/* 기간 */}
              <div className="space-y-0.5">
                <div className="text-[12px] text-[#5a6a7e]">주문일자</div>
                <div className="flex items-center gap-1">
                  <input type="date" value={d1} onChange={e=>setD1(e.target.value)} className={`${inp} w-36`} />
                  <span className="text-[#8a9ab0] text-[13px]">~</span>
                  <input type="date" value={d2} onChange={e=>setD2(e.target.value)} className={`${inp} w-36`} />
                </div>
              </div>

              {/* 판매처 자동완성 */}
              <div className="space-y-0.5">
                <div className="text-[12px] text-[#5a6a7e]">판매처</div>
                <div ref={custRef} className="relative">
                  <input
                    className={`${inp} w-40`}
                    placeholder="판매처명 검색"
                    value={custDisplay}
                    onChange={e => onCustChange(e.target.value)}
                    onKeyDown={onCustKeyDown}
                    onFocus={() => { if (custResults.length > 0) setShowCustDrop(true) }}
                  />
                  {showCustDrop && custResults.length > 0 && (
                    <div className="absolute top-full left-0 z-50 bg-white border border-[#b8c4d4] rounded-sm shadow-lg max-h-52 overflow-y-auto min-w-[220px]">
                      {custResults.map((c, i) => (
                        <div key={c.METAX_NO}
                          className={`px-2 py-1.5 cursor-pointer text-[13px] ${i === custDropIdx.current ? 'bg-[#2b579a] text-white' : 'hover:bg-[#f0f4f8]'}`}
                          onMouseDown={() => applyCust(c)}>
                          <span className="font-medium">{c.MECUST_NM}</span>
                          <span className="ml-2 text-[11px] opacity-60">{c.METAX_NO}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 전송여부 */}
              <div className="space-y-0.5">
                <div className="text-[12px] text-[#5a6a7e]">전송여부</div>
                <select className={`${selS} w-24`} value={moveYn} onChange={e=>setMoveYn(e.target.value)}>
                  <option value="">전체</option>
                  <option value="N">미전송</option>
                  <option value="Y">전송</option>
                </select>
              </div>

              {/* 조회/초기화 버튼 */}
              <div className="flex gap-1 pb-0">
                <button className={btnPrimary} onClick={handleSearch} disabled={loading}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  {loading ? '조회중...' : '조회'}
                </button>
                <button className={btnSecondary} onClick={() => {
                  setD1(weekAgoStr()); setD2(todayStr())
                  setCustDisplay(''); setSearchMetaxNo(''); setMoveYn('')
                }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </div>
          </div>

          {/* ── 상단 그리드 (KOBICMST) ───────────────────────────────────── */}
          <div className="flex flex-col" style={{ flex: '0 0 40%', minHeight: 0 }}>
            {/* 헤더 */}
            <div ref={mstHeadRef} className="overflow-hidden shrink-0 border-b border-[#d0d8e4] bg-[#f0f4f9]">
              <div className="flex" style={{ minWidth: mstWidths.reduce((a,b)=>a+b,0) }}>
                {MST_COLS.map((col, ci) => (
                  <div key={col.key}
                    className={`relative shrink-0 px-2 py-1.5 text-[12px] font-semibold text-[#374151] border-r border-[#d0d8e4] last:border-r-0 flex items-center ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : ''}`}
                    style={{ width: mstWidths[ci] }}
                  >
                    {col.key === 'chk'
                      ? <input type="checkbox" className="w-3.5 h-3.5"
                          checked={mstRows.length > 0 && checkedSet.size === mstRows.length}
                          onChange={toggleAll} />
                      : col.label}
                    {ci < MST_COLS.length - 1 && (
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#2b579a]/30"
                        onMouseDown={e => startMstResize(e, ci)} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* 바디 */}
            <div ref={mstBodyRef} className="overflow-auto flex-1" onScroll={syncMstScroll}>
              <div style={{ minWidth: mstWidths.reduce((a,b)=>a+b,0) }}>
                {mstRows.length === 0
                  ? <div className="flex items-center justify-center h-20 text-[#8a9ab0]">데이터가 없습니다.</div>
                  : mstRows.map((r, ri) => {
                    const isSel = selMstIdx === ri
                    const isChk = checkedSet.has(ri)
                    const isErr = r.ERROR_YN === 'Y'
                    return (
                      <div key={ri}
                        onClick={() => selectMst(ri)}
                        className={`flex border-b border-[#edf1f7] cursor-pointer transition-colors ${
                          isSel ? 'bg-[#dce8f8]' : isChk ? 'bg-[#f0f6ff]' : isErr ? 'bg-[#fff9f9]' : ri%2===0 ? 'bg-white' : 'bg-[#fafbfd]'
                        } hover:bg-[#e8f0fb]`}
                      >
                        {MST_COLS.map((col, ci) => (
                          <div key={col.key}
                            className={`shrink-0 px-2 py-1 text-[13px] border-r border-[#edf1f7] last:border-r-0 overflow-hidden truncate ${
                              col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : ''
                            }`}
                            style={{ width: mstWidths[ci] }}
                          >
                            {col.key === 'chk' && (
                              <input type="checkbox" className="w-3.5 h-3.5"
                                checked={isChk}
                                onChange={e => toggleCheck(ri, e)}
                                onClick={e => e.stopPropagation()} />
                            )}
                            {col.key === 'OUTBOUND_DATE' && fmtDate(r.OUTBOUND_DATE)}
                            {col.key === 'OUT_NO' && r.OUT_NO}
                            {col.key === 'DELIVERY_CD' && r.DELIVERY_CD}
                            {col.key === 'DELIVERY_NM' && r.DELIVERY_NM}
                            {col.key === 'MECUST_NM' && r.MECUST_NM}
                            {col.key === 'ME_GBNM' && r.ME_GBNM}
                            {col.key === 'MOVE_YN' && moveYnBadge(r.MOVE_YN)}
                            {col.key === 'ERROR_YN' && errorBadge(r.ERROR_YN)}
                            {col.key === 'ERROR_TEXT' && <span className={isErr ? 'text-[#c0392b]' : ''}>{r.ERROR_TEXT}</span>}
                          </div>
                        ))}
                      </div>
                    )
                  })
                }
              </div>
            </div>
            {/* 상태바 */}
            <div className="shrink-0 px-3 py-0.5 bg-[#f8fafc] border-t border-[#d0d8e4] text-[12px] text-[#5a6a7e] flex gap-3">
              <span>총 <strong className="text-[#1e3f73]">{mstRows.length}</strong>건</span>
              {checkedSet.size > 0 && <span>선택 <strong className="text-[#2b579a]">{checkedSet.size}</strong>건</span>}
              {selMstIdx !== null && <span>선택: <strong>{mstRows[selMstIdx]?.DELIVERY_NM}</strong></span>}
            </div>
          </div>

          {/* ── 구분선 ────────────────────────────────────────────────────── */}
          <div className="shrink-0 h-1.5 bg-[#e4eaf2] border-y border-[#d0d8e4]" />

          {/* ── 하단 그리드 (KOBICDTL) ───────────────────────────────────── */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* 헤더 */}
            <div ref={dtlHeadRef} className="overflow-hidden shrink-0 border-b border-[#d0d8e4] bg-[#f0f4f9]">
              <div className="flex" style={{ minWidth: dtlWidths.reduce((a,b)=>a+b,0) }}>
                {DTL_COLS.map((col, ci) => (
                  <div key={col.key}
                    className={`relative shrink-0 px-2 py-1.5 text-[12px] font-semibold text-[#374151] border-r border-[#d0d8e4] last:border-r-0 flex items-center ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : ''}`}
                    style={{ width: dtlWidths[ci] }}
                  >
                    {col.label}
                    {ci < DTL_COLS.length - 1 && (
                      <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#2b579a]/30"
                        onMouseDown={e => startDtlResize(e, ci)} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* 바디 */}
            <div ref={dtlBodyRef} className="overflow-auto flex-1" onScroll={syncDtlScroll}>
              <div style={{ minWidth: dtlWidths.reduce((a,b)=>a+b,0) }}>
                {dtlRows.length === 0
                  ? <div className="flex items-center justify-center h-16 text-[#8a9ab0]">
                      {selMstIdx === null ? '상단에서 항목을 선택하세요.' : '상세 데이터가 없습니다.'}
                    </div>
                  : dtlRows.map((r, ri) => {
                    const isErr = r.ERROR_YN === 'Y'
                    return (
                      <div key={ri}
                        className={`flex border-b border-[#edf1f7] group ${isErr ? 'bg-[#fff9f9]' : ri%2===0 ? 'bg-white' : 'bg-[#fafbfd]'} hover:bg-[#f4f8fd]`}
                      >
                        {DTL_COLS.map((col, ci) => (
                          <div key={col.key}
                            className={`shrink-0 px-2 py-1 text-[13px] border-r border-[#edf1f7] last:border-r-0 overflow-hidden truncate ${
                              col.align === 'right' ? 'text-right tabular-nums' : col.align === 'center' ? 'text-center' : ''
                            }`}
                            style={{ width: dtlWidths[ci] }}
                          >
                            {col.key === 'LINE_NO' && r.LINE_NO}
                            {col.key === 'BAR_CD' && r.BAR_CD}
                            {col.key === 'BK_CD' && (r.BK_CD || <span className="text-[#aaa]">-</span>)}
                            {col.key === 'ITEM_NM' && r.ITEM_NM}
                            {col.key === 'PRICE' && fmtNum(r.PRICE)}
                            {col.key === 'DISCOUNT' && r.DISCOUNT}
                            {col.key === 'ORDER_QTY' && fmtNum(r.ORDER_QTY)}
                            {col.key === 'JG_QTY' && (
                              <span className={r.JG_QTY < r.ORDER_QTY ? 'text-rose-500' : ''}>{fmtNum(r.JG_QTY)}</span>
                            )}
                            {col.key === 'MOVE_YN' && moveYnBadge(r.MOVE_YN)}
                            {col.key === 'ERROR_TEXT' && <span className={isErr ? 'text-[#c0392b]' : ''}>{r.ERROR_TEXT}</span>}
                            {col.key === 'REMARK' && r.REMARK}
                          </div>
                        ))}
                      </div>
                    )
                  })
                }
              </div>
            </div>
            {/* 상태바 */}
            <div className="shrink-0 px-3 py-0.5 bg-[#f8fafc] border-t border-[#d0d8e4] text-[12px] text-[#5a6a7e] flex gap-3">
              <span>총 <strong className="text-[#1e3f73]">{dtlRows.length}</strong>건</span>
              {dtlRows.length > 0 && (
                <span>주문수량 합계: <strong className="tabular-nums text-[#1e3f73]">{fmtNum(dtlRows.reduce((s,r)=>s+r.ORDER_QTY,0))}</strong></span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2 — KOBIC코드관리                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'match' && (
        <div className="flex flex-1 min-h-0 bg-white border border-[#b8c4d4] rounded-b-sm rounded-tr-sm mx-3 mb-3 overflow-hidden gap-0">

          {/* 좌측: 목록 */}
          <div className="flex flex-col flex-1 min-w-0 border-r border-[#d0d8e4]">
            {/* 검색 */}
            <div className="shrink-0 bg-[#E7EBF5] border-b border-[#b8c4d4] px-3 py-1.5">
              <div className="flex items-end gap-1.5">
                <div className="space-y-0.5">
                  <div className="text-[12px] text-[#5a6a7e]">KOBIC코드</div>
                  <input className={`${inp} w-32`} placeholder="코드" value={mSearchStoreCd}
                    onChange={e=>setMSearchStoreCd(e.target.value)}
                    onKeyDown={e=>e.key==='Enter' && handleMatchSearch()} />
                </div>
                <div className="space-y-0.5">
                  <div className="text-[12px] text-[#5a6a7e]">판매처(사업자번호)</div>
                  <input className={`${inp} w-40`} placeholder="사업자번호" value={mSearchMetaxNo}
                    onChange={e=>setMSearchMetaxNo(e.target.value)}
                    onKeyDown={e=>e.key==='Enter' && handleMatchSearch()} />
                </div>
                <button className={btnPrimary} onClick={handleMatchSearch}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  조회
                </button>
                <button className={btnSecondary} onClick={handleMatchNew}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  신규
                </button>
              </div>
            </div>

            {/* 그리드 헤더 */}
            <div className="shrink-0 flex bg-[#f0f4f9] border-b border-[#d0d8e4] text-[12px] font-semibold text-[#374151]">
              <div className="w-12 px-2 py-1.5 border-r border-[#d0d8e4] text-center">번호</div>
              <div className="w-32 px-2 py-1.5 border-r border-[#d0d8e4]">KOBIC코드</div>
              <div className="flex-1 px-2 py-1.5 border-r border-[#d0d8e4]">판매처명</div>
              <div className="w-36 px-2 py-1.5">사업자번호</div>
            </div>

            {/* 그리드 바디 */}
            <div className="flex-1 overflow-auto">
              {matchRows.length === 0
                ? <div className="flex items-center justify-center h-24 text-[#8a9ab0]">데이터가 없습니다.</div>
                : matchRows.map((r, ri) => {
                  const isSel = selMatchIdx === ri
                  return (
                    <div key={ri}
                      onClick={() => selectMatch(ri)}
                      className={`flex border-b border-[#edf1f7] cursor-pointer ${isSel ? 'bg-[#dce8f8]' : ri%2===0 ? 'bg-white' : 'bg-[#fafbfd]'} hover:bg-[#e8f0fb]`}
                    >
                      <div className="w-12 px-2 py-1 text-center text-[13px] border-r border-[#edf1f7] text-[#8a9ab0]">{r.SEQ}</div>
                      <div className="w-32 px-2 py-1 text-[13px] border-r border-[#edf1f7] font-mono">{r.STORE_CD}</div>
                      <div className="flex-1 px-2 py-1 text-[13px] border-r border-[#edf1f7] truncate">{r.MECUST_NM}</div>
                      <div className="w-36 px-2 py-1 text-[13px] font-mono">{r.METAX_NO}</div>
                    </div>
                  )
                })
              }
            </div>

            <div className="shrink-0 px-3 py-0.5 bg-[#f8fafc] border-t border-[#d0d8e4] text-[12px] text-[#5a6a7e]">
              총 <strong className="text-[#1e3f73]">{matchRows.length}</strong>건
            </div>
          </div>

          {/* 우측: 편집폼 */}
          <div className="w-80 shrink-0 flex flex-col bg-[#f8fafc]">
            <div className="px-4 py-2.5 border-b border-[#d0d8e4] bg-[#f0f4f9]">
              <span className="text-[13px] font-semibold text-[#374151]">
                {formMode === 'new' ? '신규 등록' : 'KOBIC코드 수정'}
              </span>
            </div>
            <div className="flex-1 px-4 py-4 space-y-3 overflow-auto">
              <div className="space-y-1">
                <label className="text-[12px] text-[#5a6a7e]">KOBIC코드 <span className="text-red-500">*</span></label>
                <input className={`${inp} w-full`} placeholder="KOBIC 서점코드"
                  value={formStoreCd} onChange={e=>setFormStoreCd(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="text-[12px] text-[#5a6a7e]">판매처 검색 <span className="text-red-500">*</span></label>
                <div ref={mCustRef} className="relative">
                  <input className={`${inp} w-full`} placeholder="판매처명 입력"
                    value={mCustDisplay}
                    onChange={e=>onMCustChange(e.target.value)}
                    onFocus={()=>{ if(mCustResults.length>0) setShowMCustDrop(true) }} />
                  {showMCustDrop && mCustResults.length > 0 && (
                    <div className="absolute top-full left-0 z-50 bg-white border border-[#b8c4d4] rounded-sm shadow-lg max-h-48 overflow-y-auto w-full">
                      {mCustResults.map(c => (
                        <div key={c.METAX_NO}
                          className="px-2 py-1.5 cursor-pointer text-[13px] hover:bg-[#f0f4f8]"
                          onMouseDown={()=>applyMCust(c)}>
                          <span className="font-medium">{c.MECUST_NM}</span>
                          <span className="ml-2 text-[11px] text-[#8a9ab0]">{c.METAX_NO}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] text-[#5a6a7e]">판매처명</label>
                <input className={`${inpD} w-full`} value={formCustNm} readOnly />
              </div>

              <div className="space-y-1">
                <label className="text-[12px] text-[#5a6a7e]">사업자번호</label>
                <input className={`${inpD} w-full`} value={formMetaxNo} readOnly />
              </div>
            </div>

            <div className="shrink-0 px-4 py-3 border-t border-[#d0d8e4] flex gap-2">
              <button className={`${btnPrimary} flex-1 justify-center`} onClick={handleMatchSave}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                저장
              </button>
              {formMode === 'edit' && (
                <button className={`${btnDanger} flex-1 justify-center`} onClick={handleMatchDelete}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
