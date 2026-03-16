import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'

// ─── 타입 ───────────────────────────────────────────────────────────────
interface CodeItem { VALUE: string; NAME: string }
interface Codes { sublGb: CodeItem[]; meGb: CodeItem[]; besongGb: CodeItem[]; besongCd: CodeItem[]; chkGb: CodeItem[] }

interface OrderRow {
  SUBL_DATE: string; SUBL_NO: string; METAX_NO: string; MECUST_NM: string
  SUBL_GB: string; ME_GB: string; BESONG_GB: string; CHK_GB: string
  OD_QTY: number; OD_AMT: number; ORDER_NO: string; PM_REMK: string
  MECUST_NM2: string; TEL_NO: string
}
interface MasterForm {
  SUBL_DATE: string; SUBL_NO: string; ORDER_NO: string; CHK_GB: string
  SUBL_GB: string; ME_GB: string; BESONG_GB: string; BESONG_CD: string
  METAX_NO: string; MECUST_NM: string; AREA_GB: string; EX_GB2: string
  PM_REMK: string; CUST_PM_REMK: string; MIS_DESC: string; MISU_AMT: number
  // 택배
  BESONG_NAME: string; TEL_NO: string; HAND_NO: string
  ZIP_NO: string; ADDR1: string; ADDR2: string; PM_REMK2: string
}
interface LineRow {
  SUBL_SEQ: number; BK_CD: string; BK_NM: string; BAR_CD: string; WRITER: string
  OUT_DANGA: number; OUT_RATE: number; OD_QTY: number; OD_AMT: number
  BK_QTY10: number; JG_QTY: number; AVG_QTY: number; PUB_REMK: string; CUSTBK_CD: string
}
interface BookResult {
  BK_CD: string; BK_NM: string; BAR_CD: string; WRITER: string; CUSTBK_CD: string
  OUT_DANGA: number; BK_QTY10: number; JG_QTY: number; AVG_QTY: number; USE_YN: string; OUT_RATE: number
}
interface CustResult {
  METAX_NO: string; MECUST_NM: string; BESONG_GB: string; BESONG_CD: string
  PM_REMK: string; AREA_GB: string; CHUL_BLOCK_YN: string; CHUL_BLOCK_YN_CUSTME: string
  USE_YN: string; TEL_NO: string; HAND_NO: string; ADDR1: string; ADDR2: string; MAIL_NO: string
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function emptyMaster(): MasterForm {
  return {
    SUBL_DATE: todayStr(), SUBL_NO: '', ORDER_NO: '', CHK_GB: '',
    SUBL_GB: '51', ME_GB: '01', BESONG_GB: '', BESONG_CD: '',
    METAX_NO: '', MECUST_NM: '', AREA_GB: '', EX_GB2: 'N',
    PM_REMK: '', CUST_PM_REMK: '', MIS_DESC: '', MISU_AMT: 0,
    BESONG_NAME: '', TEL_NO: '', HAND_NO: '',
    ZIP_NO: '', ADDR1: '', ADDR2: '', PM_REMK2: '',
  }
}
function emptyLine(): Omit<LineRow,'SUBL_SEQ'> {
  return { BK_CD:'', BK_NM:'', BAR_CD:'', WRITER:'', CUSTBK_CD:'', OUT_DANGA:0, OUT_RATE:0, OD_QTY:1, OD_AMT:0, BK_QTY10:0, JG_QTY:0, AVG_QTY:0, PUB_REMK:'' }
}
function calcAmt(danga: number, rate: number, qty: number) { return Math.floor((danga * rate) / 100) * qty }

function chkColor(chk: string) {
  if (chk === '')  return 'bg-blue-100 text-blue-700 border border-blue-200'
  if (chk === '0') return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  if (chk === '9') return 'bg-red-100 text-red-600 border border-red-200'
  return 'bg-amber-100 text-amber-700 border border-amber-200'
}
function chkLabel(chk: string, codes: Codes) {
  if (chk === '') return '미전송'
  if (chk === '9') return '삭제'
  return codes.chkGb.find(c => c.VALUE === chk)?.NAME ?? chk
}

// ─── 서점 검색 모달 (c_custcl) ───────────────────────────────────────────
interface CustSearchModalProps {
  initialKeyword: string
  onSelect: (c: CustResult) => void
  onClose: () => void
}
function CustSearchModal({ initialKeyword, onSelect, onClose }: CustSearchModalProps) {
  const [custNm, setCustNm] = useState(initialKeyword)
  const [metaxNo, setMetaxNo] = useState('')
  const [results, setResults] = useState<CustResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    search(initialKeyword, '')
  }, [])

  async function search(nm: string, cd: string) {
    setLoading(true)
    setError('')
    try {
      // 서점코드 입력 시 코드로, 아니면 서점명으로 검색
      const q = cd.trim() || nm.trim()
      const res = await api.get('/p1/p121/custme', { params: { q } })
      setResults(res.data)
      setSelectedIdx(res.data.length > 0 ? 0 : null)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? '검색 오류가 발생했습니다.')
    } finally { setLoading(false) }
  }

  function handleRowKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(Math.min(idx + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(Math.max(idx - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); onSelect(results[idx]) }
    if (e.key === 'Escape')    { onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-[620px] max-h-[80vh] flex flex-col" onClick={e=>e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-700 text-white rounded-t-lg flex-shrink-0">
          <span className="text-sm font-semibold">서점 검색</span>
          <button onClick={onClose} className="text-slate-300 hover:text-white text-lg leading-none">✕</button>
        </div>
        {/* 검색 조건 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <span className="text-xs text-gray-500 flex-shrink-0">서점명</span>
          <input
            ref={inputRef}
            value={custNm}
            onChange={e => setCustNm(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search(custNm, metaxNo) } }}
            placeholder="서점명"
            className="flex-1 h-8 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
          <span className="text-xs text-gray-500 flex-shrink-0">서점코드</span>
          <input
            value={metaxNo}
            onChange={e => setMetaxNo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search(custNm, metaxNo) } }}
            placeholder="서점코드"
            className="w-28 h-8 px-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
          <button onClick={() => search(custNm, metaxNo)}
            className="h-8 px-4 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex-shrink-0">
            조회
          </button>
        </div>
        {/* 컬럼 헤더 */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 flex-shrink-0">
          <span>서점명</span>
          <span>서점코드</span>
          <span>배송구분</span>
          <span>전화번호</span>
        </div>
        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-400">조회 중...</div>
          ) : error ? (
            <div className="flex items-center justify-center py-10 text-sm text-red-400">{error}</div>
          ) : results.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-400">검색 결과가 없습니다</div>
          ) : results.map((c, i) => (
            <div
              key={c.METAX_NO}
              tabIndex={0}
              onFocus={() => setSelectedIdx(i)}
              onKeyDown={e => handleRowKeyDown(e, i)}
              onClick={() => { setSelectedIdx(i); onSelect(c) }}
              className={`grid grid-cols-[2fr_1fr_1fr_1fr] px-3 py-2 text-xs border-b border-gray-100 cursor-pointer transition-colors ${
                selectedIdx === i ? 'bg-blue-600 text-white' : 'hover:bg-blue-50'
              } ${c.CHUL_BLOCK_YN === 'Y' || c.USE_YN !== 'Y' ? 'opacity-50' : ''}`}
            >
              <span className="font-medium truncate">{c.MECUST_NM}</span>
              <span className={selectedIdx === i ? 'text-blue-200' : 'text-gray-400'}>{c.METAX_NO}</span>
              <span className={selectedIdx === i ? 'text-blue-200' : 'text-gray-400'}>{c.BESONG_GB}</span>
              <span className={selectedIdx === i ? 'text-blue-200' : 'text-gray-400'}>{c.TEL_NO}</span>
            </div>
          ))}
        </div>
        {/* 푸터 */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 rounded-b-lg flex-shrink-0">
          <span className="text-xs text-gray-400">{results.length > 0 ? `총 ${results.length}건 · Enter로 선택` : ''}</span>
          <button onClick={onClose} className="h-7 px-4 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-100 transition-colors">닫기</button>
        </div>
      </div>
    </div>
  )
}

// ─── 전표조회 모달 ────────────────────────────────────────────────────────
interface SearchModalProps {
  codes: Codes
  onSelect: (o: OrderRow) => void
  onClose: () => void
}
function SearchModal({ codes, onSelect, onClose }: SearchModalProps) {
  const [d1, setD1] = useState(todayStr())
  const [d2, setD2] = useState(todayStr())
  const [custNm, setCustNm] = useState('')
  const [sublGb, setSublGb] = useState('')
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { search() }, [])

  async function search() {
    setLoading(true)
    try {
      const res = await api.get('/p1/p121/orders', {
        params: { d1: d1.replace(/-/g,''), d2: d2.replace(/-/g,''), metaxNo: '', sublGb }
      })
      let list: OrderRow[] = res.data
      if (custNm) list = list.filter(o => o.MECUST_NM.includes(custNm) || o.METAX_NO.includes(custNm))
      setOrders(list)
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded shadow-2xl w-[800px] max-h-[85vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-700 text-white rounded-t">
          <span className="text-sm font-bold">전표 조회</span>
          <button onClick={onClose} className="text-white hover:text-slate-300 text-lg leading-none">✕</button>
        </div>
        {/* 검색 조건 */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 flex-wrap">
          <input type="date" value={d1} onChange={e=>setD1(e.target.value)} className="h-7 px-1.5 text-xs border border-slate-300 rounded w-32" />
          <span className="text-slate-400 text-xs">~</span>
          <input type="date" value={d2} onChange={e=>setD2(e.target.value)} className="h-7 px-1.5 text-xs border border-slate-300 rounded w-32" />
          <input value={custNm} onChange={e=>setCustNm(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter') search() }}
            placeholder="서점명" className="h-7 px-1.5 text-xs border border-slate-300 rounded w-28" />
          <select value={sublGb} onChange={e=>setSublGb(e.target.value)} className="h-7 px-1 text-xs border border-slate-300 rounded w-28">
            <option value="">주문구분(전체)</option>
            {codes.sublGb.map(c=><option key={c.VALUE} value={c.VALUE}>{c.NAME}</option>)}
          </select>
          <button onClick={search} className="h-7 px-3 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">조회</button>
        </div>
        {/* 목록 */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                {['일자','전표번호','서점','주문구분','부수','금액','상태','비고'].map(h=>(
                  <th key={h} className="px-2 py-1 text-left border-b border-slate-200 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-6 text-slate-400">조회 중...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-6 text-slate-400">데이터 없음</td></tr>
              ) : orders.map(o=>(
                <tr key={`${o.SUBL_DATE}-${o.SUBL_NO}`}
                  className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer"
                  onDoubleClick={()=>onSelect(o)}
                  onClick={()=>onSelect(o)}>
                  <td className="px-2 py-1">{o.SUBL_DATE.slice(0,4)}-{o.SUBL_DATE.slice(4,6)}-{o.SUBL_DATE.slice(6,8)}</td>
                  <td className="px-2 py-1">{o.SUBL_NO}</td>
                  <td className="px-2 py-1 font-medium">{o.MECUST_NM}</td>
                  <td className="px-2 py-1">{codes.sublGb.find(c=>c.VALUE===o.SUBL_GB)?.NAME ?? o.SUBL_GB}</td>
                  <td className="px-2 py-1 text-right">{o.OD_QTY}</td>
                  <td className="px-2 py-1 text-right">{o.OD_AMT.toLocaleString()}</td>
                  <td className="px-2 py-1">
                    <span className={`text-[10px] px-1 py-0.5 rounded ${chkColor(o.CHK_GB)}`}>{chkLabel(o.CHK_GB,codes)}</span>
                  </td>
                  <td className="px-2 py-1 text-slate-400">{o.PM_REMK}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 ─────────────────────────────────────────────────────────────────
export default function P121Page() {
  const [codes, setCodes] = useState<Codes>({ sublGb:[], meGb:[], besongGb:[], besongCd:[], chkGb:[] })
  const [master, setMaster] = useState<MasterForm>(emptyMaster())
  const [lines, setLines] = useState<LineRow[]>([])
  const [mode, setMode] = useState<'none'|'new'|'view'>('none')   // 'none'=초기화, 'new'=신규입력, 'view'=전표조회
  const [statusMsg, setStatusMsg] = useState('화면 초기화')
  const [loading, setLoading] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showCustModal, setShowCustModal] = useState(false)

  // 서점 검색
  const custInputRef = useRef('')   // 항상 최신 입력값 보관 (Enter 이벤트용)
  const [custDisplay, setCustDisplay] = useState('')   // input 표시값
  const [custResults, setCustResults] = useState<CustResult[]>([])
  const [showCustDrop, setShowCustDrop] = useState(false)
  const custTimer = useRef<ReturnType<typeof setTimeout>>()

  // 도서 검색 (신규 행)
  const bookInputRef = useRef('')
  const [bookDisplay, setBookDisplay] = useState('')
  const [bookResults, setBookResults] = useState<BookResult[]>([])
  const [showBookDrop, setShowBookDrop] = useState(false)
  const bookTimer = useRef<ReturnType<typeof setTimeout>>()
  const [newLine, setNewLine] = useState<Omit<LineRow,'SUBL_SEQ'>>(emptyLine())

  // 도서 인라인 편집
  const [editIdx, setEditIdx] = useState<number|null>(null)
  const [editLine, setEditLine] = useState<Omit<LineRow,'SUBL_SEQ'>>(emptyLine())
  const [editBookDisplay, setEditBookDisplay] = useState('')
  const [editBookResults, setEditBookResults] = useState<BookResult[]>([])
  const [showEditBookDrop, setShowEditBookDrop] = useState(false)
  const editBookTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => { api.get('/p1/p121/codes').then(r=>setCodes(r.data)) }, [])

  // ── 초기화 ──
  function doReset() {
    setMaster(emptyMaster())
    setLines([])
    setMode('none')
    setCustDisplay('')
    custInputRef.current = ''
    setNewLine(emptyLine())
    setBookDisplay('')
    bookInputRef.current = ''
    setEditIdx(null)
    setStatusMsg('화면 초기화')
  }

  // ── 서점 ──────────────────────────────────────────────────────────
  function onCustChange(v: string) {
    custInputRef.current = v
    setCustDisplay(v)
    setMaster(p=>({...p, MECUST_NM: v, METAX_NO: ''}))
    clearTimeout(custTimer.current)
    if (!v) { setCustResults([]); setShowCustDrop(false); return }
    custTimer.current = setTimeout(() => doSearchCust(v), 300)
  }

  async function doSearchCust(keyword: string) {
    const q = keyword.trim()
    if (!q) return
    try {
      const res = await api.get('/p1/p121/custme', { params: { q } })
      const list: CustResult[] = res.data
      setCustResults(list)
      if (list.length === 1) {
        applyCust(list[0])
      } else if (list.length > 1) {
        setShowCustDrop(true)
      } else {
        setStatusMsg('서점을 찾을 수 없습니다.')
        setShowCustDrop(false)
      }
    } catch { setStatusMsg('서점 검색 오류') }
  }

  function applyCust(c: CustResult) {
    if (c.CHUL_BLOCK_YN === 'Y' || c.CHUL_BLOCK_YN_CUSTME === 'Y') { setStatusMsg('출고불가 서점입니다!!'); return }
    if (c.USE_YN !== 'Y') { setStatusMsg('거래 종료된 서점입니다!!'); return }
    const isParcel = c.BESONG_GB === '21' || c.BESONG_GB === '51'
    custInputRef.current = c.MECUST_NM
    setCustDisplay(c.MECUST_NM)
    setMaster(p=>({
      ...p, METAX_NO: c.METAX_NO, MECUST_NM: c.MECUST_NM,
      BESONG_GB: c.BESONG_GB, BESONG_CD: c.BESONG_CD,
      CUST_PM_REMK: c.PM_REMK, AREA_GB: c.AREA_GB,
      BESONG_NAME: isParcel ? c.MECUST_NM : '',
      TEL_NO: isParcel ? c.TEL_NO : '',
      HAND_NO: isParcel ? c.HAND_NO : '',
      ADDR1: isParcel ? c.ADDR1 : '',
      ADDR2: isParcel ? c.ADDR2 : '',
      ZIP_NO: isParcel ? c.MAIL_NO : '',
    }))
    api.get(`/p1/p121/custme/${c.METAX_NO}/misu`).then(r=>setMaster(p=>({...p, MISU_AMT: r.data.misuAmt})))
    setShowCustDrop(false)
    setStatusMsg('')
    if (mode === 'none') setMode('new')
  }

  // ── 도서 검색 (신규 행) ──────────────────────────────────────────────
  function onBookChange(v: string) {
    bookInputRef.current = v
    setBookDisplay(v)
    setNewLine(p=>({...p, BK_NM: v, BK_CD: ''}))
    clearTimeout(bookTimer.current)
    if (!v) { setBookResults([]); setShowBookDrop(false); return }
    bookTimer.current = setTimeout(() => doSearchBook(v), 300)
  }

  async function doSearchBook(keyword: string) {
    const q = keyword.trim()
    if (!q) return
    const res = await api.get('/p1/p121/books', {
      params: { q, metaxNo: master.METAX_NO, meGb: master.ME_GB }
    })
    setBookResults(res.data)
    setShowBookDrop(true)
  }

  function applyBook(b: BookResult) {
    if (b.USE_YN === 'Y') { setStatusMsg(`${b.BK_NM} - 사용불가도서`); return }
    const qty = newLine.OD_QTY || 1
    bookInputRef.current = b.BK_NM
    setBookDisplay(b.BK_NM)
    setNewLine({ BK_CD: b.BK_CD, BK_NM: b.BK_NM, BAR_CD: b.BAR_CD, WRITER: b.WRITER,
      CUSTBK_CD: b.CUSTBK_CD, OUT_DANGA: b.OUT_DANGA, OUT_RATE: b.OUT_RATE,
      OD_QTY: qty, OD_AMT: calcAmt(b.OUT_DANGA, b.OUT_RATE, qty),
      BK_QTY10: b.BK_QTY10, JG_QTY: b.JG_QTY, AVG_QTY: b.AVG_QTY, PUB_REMK: '' })
    setShowBookDrop(false)
  }

  // ── 편집 행 도서 검색 ──────────────────────────────────────────────
  function onEditBookChange(v: string) {
    setEditBookDisplay(v)
    setEditLine(p=>({...p, BK_NM: v, BK_CD: ''}))
    clearTimeout(editBookTimer.current)
    if (!v) { setEditBookResults([]); setShowEditBookDrop(false); return }
    editBookTimer.current = setTimeout(async () => {
      const res = await api.get('/p1/p121/books', { params: { q: v, metaxNo: master.METAX_NO, meGb: master.ME_GB } })
      setEditBookResults(res.data)
      setShowEditBookDrop(true)
    }, 300)
  }
  function applyEditBook(b: BookResult) {
    const qty = editLine.OD_QTY || 1
    setEditBookDisplay(b.BK_NM)
    setEditLine(p=>({...p, BK_CD: b.BK_CD, BK_NM: b.BK_NM, BAR_CD: b.BAR_CD,
      WRITER: b.WRITER, CUSTBK_CD: b.CUSTBK_CD, OUT_DANGA: b.OUT_DANGA, OUT_RATE: b.OUT_RATE,
      OD_AMT: calcAmt(b.OUT_DANGA, b.OUT_RATE, qty), BK_QTY10: b.BK_QTY10, JG_QTY: b.JG_QTY, AVG_QTY: b.AVG_QTY }))
    setShowEditBookDrop(false)
  }

  // ── 전표 상세 불러오기 ─────────────────────────────────────────────
  async function loadDetail(sublDate: string, sublNo: string) {
    try {
      setLoading(true)
      const res = await api.get(`/p1/p121/orders/${sublDate}/${sublNo}`)
      const { master: m, lines: ls } = res.data
      setMaster(m)
      setLines(ls)
      setMode('view')
      custInputRef.current = m.MECUST_NM ?? ''
      setCustDisplay(m.MECUST_NM ?? '')
      setNewLine(emptyLine())
      setBookDisplay(''); bookInputRef.current = ''
      setEditIdx(null)
      setStatusMsg('전표 조회 완료')
    } catch(e: any) {
      setStatusMsg(e.response?.data?.message ?? '조회 오류')
    } finally { setLoading(false) }
  }

  // ── 전표 선택 (모달) ──────────────────────────────────────────────
  async function onSelectOrder(o: OrderRow) {
    setShowSearchModal(false)
    await loadDetail(o.SUBL_DATE, o.SUBL_NO)
  }

  // ── 도서 라인 저장 (신규) ─────────────────────────────────────────
  async function saveNewLine() {
    if (!newLine.BK_CD) { setStatusMsg('도서를 선택해주세요.'); return }
    if (!master.METAX_NO) { setStatusMsg('서점을 선택해주세요.'); return }
    if (!master.BESONG_GB) { setStatusMsg('배송구분을 선택해주세요.'); return }
    try {
      setLoading(true)
      const sublDate = master.SUBL_DATE.replace(/-/g,'')

      if (mode === 'new') {
        const res = await api.post('/p1/p121/orders', {
          sublDate, metaxNo: master.METAX_NO, besongGb: master.BESONG_GB, besongCd: master.BESONG_CD,
          sublGb: master.SUBL_GB, meGb: master.ME_GB, exGb2: master.EX_GB2,
          areaGb: master.AREA_GB, pmRemk: master.PM_REMK, pmRemk2: master.PM_REMK2,
          besongName: master.BESONG_NAME, mecustNm: master.MECUST_NM,
          telNo: master.TEL_NO, handNo: master.HAND_NO, zipNo: master.ZIP_NO,
          addr1: master.ADDR1, addr2: master.ADDR2,
          bkCd: newLine.BK_CD, outDanga: newLine.OUT_DANGA, outRate: newLine.OUT_RATE,
          odQty: newLine.OD_QTY, odAmt: newLine.OD_AMT, pubRemk: newLine.PUB_REMK,
        })
        await loadDetail(res.data.sublDate, String(res.data.sublNo))
        setStatusMsg('전표 생성 완료')
      } else {
        await api.post(`/p1/p121/orders/${sublDate}/${master.SUBL_NO}/lines`, {
          bkCd: newLine.BK_CD, outDanga: newLine.OUT_DANGA, outRate: newLine.OUT_RATE,
          odQty: newLine.OD_QTY, odAmt: newLine.OD_AMT, pubRemk: newLine.PUB_REMK,
        })
        await loadDetail(sublDate, master.SUBL_NO)
        setStatusMsg('도서 추가 완료')
      }
      setNewLine(emptyLine()); setBookDisplay(''); bookInputRef.current = ''
    } catch(e: any) {
      setStatusMsg(e.response?.data?.message ?? '저장 오류')
    } finally { setLoading(false) }
  }

  // ── 편집 행 저장 ──────────────────────────────────────────────────
  async function saveEditLine() {
    const ln = lines[editIdx!]
    const sublDate = master.SUBL_DATE.replace(/-/g,'')
    try {
      setLoading(true)
      await api.put(`/p1/p121/orders/${sublDate}/${master.SUBL_NO}/lines/${ln.SUBL_SEQ}`, {
        outDanga: editLine.OUT_DANGA, outRate: editLine.OUT_RATE,
        odQty: editLine.OD_QTY, odAmt: editLine.OD_AMT, pubRemk: editLine.PUB_REMK,
      })
      await loadDetail(sublDate, master.SUBL_NO)
      setEditIdx(null)
      setStatusMsg('수정 완료')
    } catch(e: any) { setStatusMsg(e.response?.data?.message ?? '수정 오류')
    } finally { setLoading(false) }
  }

  // ── 도서 삭제 ────────────────────────────────────────────────────
  async function deleteLine(sublSeq: number) {
    if (!confirm('도서를 삭제하시겠습니까?')) return
    const sublDate = master.SUBL_DATE.replace(/-/g,'')
    try {
      setLoading(true)
      const res = await api.delete(`/p1/p121/orders/${sublDate}/${master.SUBL_NO}/lines/${sublSeq}`)
      if (res.data.orderDeleted) { doReset(); setStatusMsg('전표 삭제 완료') }
      else { await loadDetail(sublDate, master.SUBL_NO); setStatusMsg('도서 삭제 완료') }
    } catch(e: any) { setStatusMsg(e.response?.data?.message ?? '삭제 오류')
    } finally { setLoading(false) }
  }

  // ── 전표 삭제 ────────────────────────────────────────────────────
  async function deleteOrder() {
    if (!master.SUBL_NO) { setStatusMsg('조회된 전표가 없습니다.'); return }
    if (!confirm('전표를 삭제하시겠습니까?')) return
    const sublDate = master.SUBL_DATE.replace(/-/g,'')
    try {
      setLoading(true)
      await api.delete(`/p1/p121/orders/${sublDate}/${master.SUBL_NO}`)
      doReset(); setStatusMsg('전표 삭제 완료')
    } catch(e: any) { setStatusMsg(e.response?.data?.message ?? '삭제 오류')
    } finally { setLoading(false) }
  }

  // ── 마스터 수정 ──────────────────────────────────────────────────
  async function saveMaster() {
    if (!master.SUBL_NO) { setStatusMsg('조회된 전표가 없습니다.'); return }
    const sublDate = master.SUBL_DATE.replace(/-/g,'')
    try {
      setLoading(true)
      await api.put(`/p1/p121/orders/${sublDate}/${master.SUBL_NO}`, {
        sublGb: master.SUBL_GB, meGb: master.ME_GB,
        besongGb: master.BESONG_GB, besongCd: master.BESONG_CD,
        exGb2: master.EX_GB2, pmRemk: master.PM_REMK, pmRemk2: master.PM_REMK2,
        besongName: master.BESONG_NAME, mecustNm: master.MECUST_NM,
        telNo: master.TEL_NO, handNo: master.HAND_NO,
        zipNo: master.ZIP_NO, addr1: master.ADDR1, addr2: master.ADDR2,
      })
      setStatusMsg('마스터 수정 완료')
    } catch(e: any) { setStatusMsg(e.response?.data?.message ?? '수정 오류')
    } finally { setLoading(false) }
  }

  const canEdit = isEditable(master.CHK_GB)
  function isEditable(chk: string) { return chk === '' || chk === '0' }
  const isDelivery = master.BESONG_GB === '21' || master.BESONG_GB === '51'
  const totalQty = lines.reduce((s,l)=>s+l.OD_QTY,0)
  const totalAmt = lines.reduce((s,l)=>s+l.OD_AMT,0)

  // ─── 공통 인풋 스타일 ─────────────────────────────────────────────
  const inp  = 'h-7 px-2 text-xs border border-slate-200 rounded-md bg-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors'
  const inpD = 'h-7 px-2 text-xs border border-slate-100 rounded-md bg-slate-50 w-full text-slate-400 cursor-default'
  const sel  = 'h-7 px-2 text-xs border border-slate-200 rounded-md bg-white w-full focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors'
  const selD = 'h-7 px-2 text-xs border border-slate-100 rounded-md bg-slate-50 w-full text-slate-400 cursor-default'

  return (
    <div className="flex flex-col h-full bg-gray-50 text-sm select-none">

      {/* ── 상단 툴바 ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-white border-b border-gray-200 shadow-sm">
        <ToolBtn icon="🔄" label="초기화" onClick={doReset} />
        <ToolBtn icon="🗑" label="삭제" onClick={deleteOrder} disabled={!master.SUBL_NO} className="text-red-600 hover:border-red-300 hover:bg-red-50" />
        <div className="flex-1" />
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${master.SUBL_NO ? chkColor(master.CHK_GB) : 'text-slate-400'}`}>
          {statusMsg}
        </span>
      </div>

      {/* ── 본문 ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0 p-2 gap-2">

        {/* ── 마스터 영역 ─────────────────────────────────────────── */}
        <div className="flex gap-2">

          {/* 마스터정보 */}
          <fieldset className="w-[470px] flex-shrink-0 border border-gray-200 bg-white rounded-lg px-3 pt-0 pb-2 shadow-sm">
            <legend className="text-[11px] font-semibold text-gray-400 px-1 uppercase tracking-wide">마스터정보</legend>
            <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-1.5 gap-y-1 items-center">

              <L>일자</L>
              <input type="date" value={master.SUBL_DATE}
                readOnly={mode !== 'new'} onChange={e=>setMaster(p=>({...p,SUBL_DATE:e.target.value}))}
                className={mode==='new' ? inp : inpD} />
              <L>주문구분</L>
              <select value={master.SUBL_GB} disabled={!canEdit} onChange={e=>setMaster(p=>({...p,SUBL_GB:e.target.value}))} className={canEdit ? sel : selD}>
                {codes.sublGb.map(c=><option key={c.VALUE} value={c.VALUE}>{c.NAME}</option>)}
              </select>

              <L>서점</L>
              <div className="relative flex items-center gap-1 col-span-3">
                {/* 서점명 */}
                <div className="relative w-[7.5rem] flex-shrink-0">
                  <input
                    value={custDisplay}
                    readOnly={!canEdit && mode !== 'none'}
                    onChange={e=>onCustChange(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); doSearchCust(custInputRef.current) }}}
                    onBlur={()=>setTimeout(()=>setShowCustDrop(false),200)}
                    placeholder="서점명 입력"
                    className={`${inp} w-full`} />
                  {showCustDrop && custResults.length > 0 && (
                    <div className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-80 max-h-56 overflow-y-auto mt-1">
                      {custResults.map(c=>(
                        <div key={c.METAX_NO} onMouseDown={()=>applyCust(c)}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-xs border-b border-gray-100 last:border-0 flex justify-between items-center">
                          <span className="font-semibold text-gray-700">{c.MECUST_NM}</span>
                          <span className="text-gray-400 text-[11px]">{c.METAX_NO}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* 서점코드 */}
                <input value={master.METAX_NO} readOnly placeholder="코드"
                  className="h-7 px-2 text-xs border border-slate-100 rounded-md bg-slate-50 text-slate-400 cursor-default flex-shrink-0 w-[4.5rem]" />
                {/* 검색 버튼 */}
                <button onClick={()=>setShowCustModal(true)}
                  className="h-7 px-2.5 text-xs font-semibold border border-blue-300 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors whitespace-nowrap flex-shrink-0">검색</button>
                <div className="w-px h-4 bg-gray-200 mx-0.5 flex-shrink-0" />
                {/* 전표 */}
                <L>전표</L>
                <input value={master.SUBL_NO || ''} readOnly
                  className="h-7 px-2 text-xs border border-slate-100 rounded-md bg-slate-50 text-slate-400 cursor-default flex-shrink-0 w-[4.5rem]" />
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${chkColor(master.CHK_GB)}`}>
                  {chkLabel(master.CHK_GB, codes)}
                </span>
              </div>

              <L>매출구분</L>
              <select value={master.ME_GB} disabled={!canEdit} onChange={e=>setMaster(p=>({...p,ME_GB:e.target.value}))} className={canEdit ? sel : selD}>
                {codes.meGb.map(c=><option key={c.VALUE} value={c.VALUE}>{c.NAME}</option>)}
              </select>
              <L>미수금</L>
              <input value={master.MISU_AMT.toLocaleString()} readOnly className={inpD} />

              <L>배송구분</L>
              <div className="flex gap-1 items-center">
                <select value={master.BESONG_GB} disabled={!canEdit} onChange={e=>setMaster(p=>({...p,BESONG_GB:e.target.value}))} className={`${canEdit ? sel : selD} flex-1`}>
                  <option value="">선택안함</option>
                  {codes.besongGb.map(c=><option key={c.VALUE} value={c.VALUE}>{c.NAME}</option>)}
                </select>
                <label className="flex items-center gap-0.5 text-xs text-slate-600 whitespace-nowrap">
                  <input type="checkbox" checked={master.EX_GB2==='Y'} disabled={!canEdit}
                    onChange={e=>setMaster(p=>({...p,EX_GB2:e.target.checked?'Y':'N'}))} className="w-3 h-3" />착불
                </label>
              </div>
              <L>배송업체</L>
              <select value={master.BESONG_CD} disabled={!canEdit} onChange={e=>setMaster(p=>({...p,BESONG_CD:e.target.value}))} className={`col-span-3 ${canEdit ? sel : selD}`}>
                <option value="">선택안함</option>
                {codes.besongCd.map(c=><option key={c.VALUE} value={c.VALUE}>{c.NAME}</option>)}
              </select>

              <L>서점비고</L>
              <input value={master.CUST_PM_REMK} readOnly className={`col-span-3 ${inpD}`} />
            </div>
          </fieldset>

          {/* 택배정보 */}
          <fieldset className="w-[340px] border border-gray-200 bg-white rounded-lg px-3 pt-0 pb-2 shadow-sm">
            <legend className="text-[11px] font-semibold text-gray-400 px-1 uppercase tracking-wide">택배정보</legend>
            <div className="grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-1 items-center">
              <L>받는분</L>
              <input value={master.BESONG_NAME} readOnly={!canEdit || !isDelivery}
                onChange={e=>setMaster(p=>({...p,BESONG_NAME:e.target.value}))}
                className={canEdit && isDelivery ? inp : inpD} />
              <L>연락처1</L>
              <input value={master.TEL_NO} readOnly={!canEdit || !isDelivery}
                onChange={e=>setMaster(p=>({...p,TEL_NO:e.target.value}))}
                className={canEdit && isDelivery ? inp : inpD} />
              <L>연락처2</L>
              <input value={master.HAND_NO} readOnly={!canEdit || !isDelivery}
                onChange={e=>setMaster(p=>({...p,HAND_NO:e.target.value}))}
                className={canEdit && isDelivery ? inp : inpD} />
              <L>기본주소</L>
              <div className="flex gap-0.5">
                <input value={master.ADDR1} readOnly={!canEdit || !isDelivery}
                  onChange={e=>setMaster(p=>({...p,ADDR1:e.target.value}))}
                  className={canEdit && isDelivery ? `${inp} flex-1` : `${inpD} flex-1`} />
                <button className="h-6 px-1.5 text-xs border border-slate-300 rounded bg-slate-50 hover:bg-slate-200">O</button>
              </div>
              <L>상세주소</L>
              <input value={master.ADDR2} readOnly={!canEdit || !isDelivery}
                onChange={e=>setMaster(p=>({...p,ADDR2:e.target.value}))}
                className={canEdit && isDelivery ? inp : inpD} />
              <L>택배비고</L>
              <input value={master.PM_REMK2} readOnly={!canEdit || !isDelivery}
                onChange={e=>setMaster(p=>({...p,PM_REMK2:e.target.value}))}
                className={canEdit && isDelivery ? inp : inpD} />
            </div>
          </fieldset>

          {/* 부가기능 */}
          <div className="w-[130px] border border-gray-200 bg-white rounded-lg px-2 py-2 flex flex-col gap-1.5 shadow-sm">
            <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">부가기능</div>
            <button onClick={()=>setShowSearchModal(true)}
              className="h-7 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-semibold transition-colors">전표조회 및 전송</button>
            <button onClick={saveMaster} disabled={!master.SUBL_NO || !canEdit}
              className="h-7 text-xs border border-gray-200 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 disabled:opacity-40 transition-colors">마스터 수정</button>
            <button disabled className="h-7 text-xs border border-gray-100 bg-gray-50 text-gray-300 rounded-md cursor-not-allowed">매출을 재계산</button>
            <button disabled className="h-7 text-xs border border-gray-100 bg-gray-50 text-gray-300 rounded-md cursor-not-allowed">세트도서 등록</button>
          </div>

          {/* 도서검색 안내 */}
          <div className="flex-1 min-w-[160px] border border-gray-200 bg-white rounded-lg px-3 py-2 shadow-sm">
            <div className="text-[11px] font-semibold text-gray-500 mb-1.5">도서 검색 방법</div>
            <div className="space-y-0.5 text-[11px] text-gray-400 leading-5">
              <div>① 도서코드</div>
              <div>② 바코드 (ISBN)</div>
              <div>③ 도서명 중간자</div>
              <div>④ 도서명 + 저자</div>
              <div>⑤ 띄어쓰기 + 저자</div>
              <div>⑥ 띄어쓰기 + 바코드중간</div>
            </div>
          </div>
        </div>

        {/* ── 명세서비고 / 삭제사유 ──────────────────────────────── */}
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
          <span className="text-xs text-slate-500 whitespace-nowrap w-16">명세서비고</span>
          <input value={master.PM_REMK} readOnly={!canEdit}
            onChange={e=>setMaster(p=>({...p,PM_REMK:e.target.value}))}
            className={`flex-1 ${canEdit ? inp : inpD}`} />
          <span className="text-xs text-slate-500 whitespace-nowrap w-14">삭제사유</span>
          <input value={master.MIS_DESC} readOnly className={`flex-1 ${inpD}`} />
        </div>

        {/* ── 도서 그리드 ─────────────────────────────────────────── */}
        <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col shadow-sm">
          {/* 합계 표시 */}
          <div className="flex items-center gap-4 px-3 py-1.5 bg-gray-800 text-white text-xs">
            <span className="font-semibold text-gray-300 uppercase tracking-wide text-[11px]">주문도서</span>
            <span className="font-bold">{lines.length}<span className="font-normal text-gray-400 ml-0.5">종</span></span>
            <span className="font-bold">{totalQty.toLocaleString()}<span className="font-normal text-gray-400 ml-0.5">부</span></span>
            <span className="font-bold text-blue-300">{totalAmt.toLocaleString()}<span className="font-normal text-gray-400 ml-0.5">원</span></span>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs border-collapse" style={{minWidth:900}}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-700 text-gray-100">
                  {['번호','도서코드','도서명','바코드','저자','정가','물류재고','반품재고','출고대기','출고가능','부수','%','주문금액','도서비고(출판사도서관...)','삭제'].map(h=>(
                    <th key={h} className="px-1.5 py-1 text-center font-medium whitespace-nowrap border-r border-slate-500 last:border-r-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((ln,i)=>{
                  const isEdit = editIdx === i
                  const stockLow = ln.JG_QTY < ln.OD_QTY
                  return (
                    <tr key={ln.SUBL_SEQ}
                      className={`border-b border-gray-100 ${isEdit ? 'bg-blue-50' : i%2===0 ? 'bg-white' : 'bg-gray-50/60'} hover:bg-blue-50/70 transition-colors`}>
                      <td className="px-1.5 py-0.5 text-center text-slate-400 border-r border-slate-200">{i+1}</td>
                      {isEdit ? (
                        <>
                          <td className="px-1 py-0.5 border-r border-slate-200">{editLine.BK_CD}</td>
                          <td className="px-1 py-0.5 border-r border-slate-200 relative min-w-[140px]">
                            <input value={editBookDisplay} onChange={e=>onEditBookChange(e.target.value)}
                              onBlur={()=>setTimeout(()=>setShowEditBookDrop(false),200)}
                              className="h-5 px-1 text-xs border border-blue-400 rounded w-full" />
                            {showEditBookDrop && editBookResults.length > 0 && (
                              <div className="absolute top-full left-0 z-50 bg-white border border-slate-300 rounded shadow-xl w-72 max-h-48 overflow-y-auto">
                                {editBookResults.map(b=>(
                                  <div key={b.BK_CD} onMouseDown={()=>applyEditBook(b)}
                                    className="px-2 py-1 hover:bg-blue-50 cursor-pointer text-xs border-b">
                                    <div className="font-medium">{b.BK_NM}</div>
                                    <div className="text-slate-400">{b.BAR_CD} / 재고{b.JG_QTY}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-1 py-0.5 border-r border-slate-200">{editLine.BAR_CD}</td>
                          <td className="px-1 py-0.5 border-r border-slate-200">{editLine.WRITER}</td>
                          <td className="px-1 py-0.5 border-r border-slate-200">
                            <input type="number" value={editLine.OUT_DANGA}
                              onChange={e=>{const v=+e.target.value; setEditLine(p=>({...p,OUT_DANGA:v,OD_AMT:calcAmt(v,p.OUT_RATE,p.OD_QTY)}))}}
                              className="h-5 px-1 text-xs border border-blue-400 rounded w-16 text-right" />
                          </td>
                          <td className="px-1 py-0.5 border-r border-slate-200">{editLine.BK_QTY10}</td>
                          <td className="px-1 py-0.5 border-r border-slate-200">-</td>
                          <td className="px-1 py-0.5 border-r border-slate-200">-</td>
                          <td className="px-1 py-0.5 border-r border-slate-200">{editLine.JG_QTY}</td>
                          <td className="px-1 py-0.5 border-r border-slate-200">
                            <input type="number" value={editLine.OD_QTY}
                              onChange={e=>{const v=+e.target.value; setEditLine(p=>({...p,OD_QTY:v,OD_AMT:calcAmt(p.OUT_DANGA,p.OUT_RATE,v)}))}}
                              className="h-5 px-1 text-xs border border-blue-400 rounded w-12 text-center" />
                          </td>
                          <td className="px-1 py-0.5 border-r border-slate-200">
                            <input type="number" value={editLine.OUT_RATE}
                              onChange={e=>{const v=+e.target.value; setEditLine(p=>({...p,OUT_RATE:v,OD_AMT:calcAmt(p.OUT_DANGA,v,p.OD_QTY)}))}}
                              className="h-5 px-1 text-xs border border-blue-400 rounded w-12 text-center" />
                          </td>
                          <td className="px-1 py-0.5 border-r border-slate-200 text-right">{editLine.OD_AMT.toLocaleString()}</td>
                          <td className="px-1 py-0.5 border-r border-slate-200">
                            <input value={editLine.PUB_REMK} onChange={e=>setEditLine(p=>({...p,PUB_REMK:e.target.value}))}
                              className="h-5 px-1 text-xs border border-blue-400 rounded w-full" />
                          </td>
                          <td className="px-1 py-0.5 text-center">
                            <button onClick={saveEditLine} className="text-[10px] px-1.5 py-0.5 bg-blue-600 text-white rounded mr-0.5">저장</button>
                            <button onClick={()=>setEditIdx(null)} className="text-[10px] px-1 py-0.5 bg-slate-300 rounded">취소</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-1.5 py-0.5 text-center border-r border-slate-200">{ln.BK_CD}</td>
                          <td className="px-1.5 py-0.5 border-r border-slate-200 max-w-[180px]">
                            <div className="truncate" title={ln.BK_NM}>{ln.BK_NM}</div>
                          </td>
                          <td className="px-1.5 py-0.5 border-r border-slate-200">{ln.BAR_CD}</td>
                          <td className="px-1.5 py-0.5 border-r border-slate-200">{ln.WRITER}</td>
                          <td className="px-1.5 py-0.5 text-right border-r border-slate-200">{ln.OUT_DANGA.toLocaleString()}</td>
                          <td className={`px-1.5 py-0.5 text-right border-r border-slate-200 ${stockLow?'text-red-600 font-bold':''}`}>{ln.BK_QTY10}</td>
                          <td className="px-1.5 py-0.5 text-right border-r border-slate-200">-</td>
                          <td className="px-1.5 py-0.5 text-right border-r border-slate-200">-</td>
                          <td className={`px-1.5 py-0.5 text-right border-r border-slate-200 ${stockLow?'text-red-600 font-bold':''}`}>{ln.JG_QTY}</td>
                          <td className="px-1.5 py-0.5 text-center font-bold border-r border-slate-200">{ln.OD_QTY}</td>
                          <td className="px-1.5 py-0.5 text-center border-r border-slate-200">{ln.OUT_RATE}</td>
                          <td className="px-1.5 py-0.5 text-right border-r border-slate-200">{ln.OD_AMT.toLocaleString()}</td>
                          <td className="px-1.5 py-0.5 border-r border-slate-200 text-slate-500 max-w-[120px] truncate">{ln.PUB_REMK}</td>
                          <td className="px-1.5 py-0.5 text-center">
                            {canEdit ? (
                              <button onClick={()=>{setEditIdx(i);setEditLine({...ln});setEditBookDisplay(ln.BK_NM);setEditBookResults([]);setShowEditBookDrop(false)}}
                                className="text-red-600 hover:text-red-800 font-bold text-base leading-none px-1">×</button>
                            ) : <span className="text-slate-300">×</span>}
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}

                {/* ── 신규 입력 행 (→) ── */}
                {canEdit && (
                  <tr className="bg-indigo-50 border-b border-indigo-100">
                    <td className="px-1.5 py-0.5 text-center text-indigo-400 font-bold border-r border-indigo-100">→</td>
                    <td className="px-1 py-0.5 border-r border-indigo-100">{newLine.BK_CD}</td>
                    <td className="px-1 py-0.5 border-r border-indigo-100 relative min-w-[160px]">
                      <input value={bookDisplay}
                        onChange={e=>onBookChange(e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter') doSearchBook(bookInputRef.current) }}
                        onBlur={()=>setTimeout(()=>setShowBookDrop(false),200)}
                        placeholder="도서명/ISBN..."
                        className="h-5 px-1 text-xs border border-indigo-300 rounded w-full bg-white focus:outline-none focus:border-indigo-400" />
                      {showBookDrop && bookResults.length > 0 && (
                        <div className="absolute top-full left-0 z-50 bg-white border border-slate-300 rounded shadow-xl w-80 max-h-56 overflow-y-auto">
                          {bookResults.map(b=>(
                            <div key={b.BK_CD} onMouseDown={()=>applyBook(b)}
                              className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer text-xs border-b border-slate-100">
                              <div className="font-medium">{b.BK_NM}</div>
                              <div className="text-slate-400 flex gap-2">
                                <span>{b.BAR_CD}</span>
                                <span>{b.WRITER}</span>
                                <span className={b.JG_QTY<0?'text-red-500':'text-green-600'}>재고{b.JG_QTY}</span>
                                <span>{b.OUT_RATE}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-1 py-0.5 border-r border-indigo-100">{newLine.BAR_CD}</td>
                    <td className="px-1 py-0.5 border-r border-indigo-100">{newLine.WRITER}</td>
                    <td className="px-1 py-0.5 border-r border-indigo-100">
                      <input type="number" value={newLine.OUT_DANGA}
                        onChange={e=>{const v=+e.target.value;setNewLine(p=>({...p,OUT_DANGA:v,OD_AMT:calcAmt(v,p.OUT_RATE,p.OD_QTY)}))}}
                        className="h-5 px-1 text-xs border border-indigo-300 rounded w-16 text-right bg-white focus:outline-none" />
                    </td>
                    <td className="px-1 py-0.5 text-right border-r border-indigo-100">{newLine.BK_QTY10||0}</td>
                    <td className="px-1 py-0.5 text-right border-r border-indigo-100">-</td>
                    <td className="px-1 py-0.5 text-right border-r border-indigo-100">-</td>
                    <td className="px-1 py-0.5 text-right border-r border-indigo-100">{newLine.JG_QTY||0}</td>
                    <td className="px-1 py-0.5 border-r border-indigo-100">
                      <input type="number" value={newLine.OD_QTY}
                        onChange={e=>{const v=+e.target.value;setNewLine(p=>({...p,OD_QTY:v,OD_AMT:calcAmt(p.OUT_DANGA,p.OUT_RATE,v)}))}}
                        className="h-5 px-1 text-xs border border-indigo-300 rounded w-12 text-center bg-white focus:outline-none" />
                    </td>
                    <td className="px-1 py-0.5 border-r border-indigo-100">
                      <input type="number" value={newLine.OUT_RATE}
                        onChange={e=>{const v=+e.target.value;setNewLine(p=>({...p,OUT_RATE:v,OD_AMT:calcAmt(p.OUT_DANGA,v,p.OD_QTY)}))}}
                        className="h-5 px-1 text-xs border border-indigo-300 rounded w-12 text-center bg-white focus:outline-none" />
                    </td>
                    <td className="px-1 py-0.5 text-right border-r border-indigo-100">{newLine.OD_AMT.toLocaleString()||0}</td>
                    <td className="px-1 py-0.5 border-r border-indigo-100">
                      <input value={newLine.PUB_REMK} onChange={e=>setNewLine(p=>({...p,PUB_REMK:e.target.value}))}
                        className="h-5 px-1 text-xs border border-indigo-300 rounded w-full bg-white focus:outline-none" />
                    </td>
                    <td className="px-1 py-0.5 text-center">
                      <button onMouseDown={saveNewLine} disabled={!newLine.BK_CD||loading}
                        className="text-red-600 font-bold text-base leading-none disabled:opacity-30 px-1">×</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── 전표조회 모달 ─────────────────────────────────────────── */}
      {showSearchModal && (
        <SearchModal codes={codes} onSelect={onSelectOrder} onClose={()=>setShowSearchModal(false)} />
      )}
      {showCustModal && (
        <CustSearchModal
          initialKeyword={custInputRef.current}
          onSelect={c=>{ applyCust(c); setShowCustModal(false) }}
          onClose={()=>setShowCustModal(false)}
        />
      )}
    </div>
  )
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────────
function L({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] text-slate-500 whitespace-nowrap text-right pr-0.5">{children}</span>
}
function ToolBtn({ icon, label, onClick, disabled, className='' }: {
  icon: string; label: string; onClick?: ()=>void; disabled?: boolean; className?: string
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-default transition-colors shadow-sm ${className}`}>
      <span>{icon}</span><span>{label}</span>
    </button>
  )
}
