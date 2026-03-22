import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'

interface CodeItem { VALUE: string; NAME: string }
interface Codes {
  sublGb: CodeItem[]; meGb: CodeItem[]; besongGb: CodeItem[]
  besongCd: CodeItem[]; chkGb: CodeItem[]
}

interface SubOrderRow {
  SUBL_DATE: string; SUBL_NO: string; ORDER_NO: string; TAX_NO: string
  CHK_GB: string; SUBL_GB: string; JG_GB: string; JG_GBNM: string
  ME_GB: string; BESONG_GB: string; METAX_NO: string; MECUST_NM: string
  OD_QTY: number; OD_AMT: number; JU_QTY: number; JU_AMT: number
  UPD_TIME: string; INS_NM: string; REORDER_YN: string; AREA_GB: string
  PM_REMK: string; MECUST_NM2: string; PM_REMK2: string
  ADDR: string; TEL_NO: string
}

interface SubDetailLine {
  SUBL_SEQ: number; BK_CD: string; BK_NM: string; BAR_CD: string
  OUT_DANGA: number; OD_QTY: number; OUT_RATE: number; OD_AMT: number; PUB_REMK: string
}

interface Props {
  codes: Codes
  onSelect: (sublDate: string, sublNo: string) => void
  onClose: () => void
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function codeName(list: CodeItem[], val: string) {
  return list.find(c => c.VALUE === val)?.NAME ?? val
}
function chkLabel(chk: string, codes: Codes) {
  if (chk === '') return '미전송'
  if (chk === '9') return '삭제'
  return codes.chkGb.find(c => c.VALUE === chk)?.NAME ?? chk
}
function chkBadgeClass(chk: string) {
  if (chk === '9') return 'bg-red-300 text-red-900'
  if (chk === '') return 'bg-sky-200 text-sky-900'
  if (chk === '0') return 'bg-green-200 text-green-900'
  if (chk === '1') return 'bg-pink-200 text-pink-900'
  if (chk === '2') return 'bg-orange-200 text-orange-900'
  if (chk === '3' || chk === '4') return 'bg-yellow-200 text-yellow-900'
  return 'bg-blue-200 text-blue-900'
}

const TH = 'relative px-1.5 py-1.5 text-center text-[13px] font-medium border-r border-[#c8d0e0] last:border-r-0 select-none whitespace-nowrap overflow-hidden'
const TD = 'px-2 py-1.5 text-[13px] border-r border-[#d0d8e4] last:border-r-0 whitespace-nowrap overflow-hidden'

// 컬럼 리사이즈 핸들
function RH({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 h-full w-1 cursor-col-resize z-20 hover:bg-[#2b579a]/50 active:bg-[#2b579a]/70"
      style={{ userSelect: 'none' }}
    />
  )
}

// 상단 그리드 초기 컬럼 너비 (서점명 80→240, 3배)
const UPPER_INIT = [30, 38, 52, 76, 76, 68, 76, 64, 64, 64, 56, 240, 48, 78, 48, 78, 56, 76, 64, 160, 100, 76, 100, 100]
// 하단 그리드 초기 컬럼 너비
const LOWER_INIT = [38, 78, 200, 116, 76, 60, 46, 86, 120]

export default function P121SubModal({ codes, onSelect, onClose }: Props) {
  const [d1, setD1] = useState(todayStr())
  const [d2, setD2] = useState(todayStr())
  const [custNm, setCustNm] = useState('')
  const [metaxNo, setMetaxNo] = useState('')
  const [filterSublGb, setFilterSublGb] = useState('')
  const [filterBesongGb, setFilterBesongGb] = useState('')
  const [sendYn, setSendYn] = useState('N')
  const sendYnRef = useRef('N')

  const [orders, setOrders] = useState<SubOrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [checkedSet, setCheckedSet] = useState<Set<number>>(new Set())

  const [detailLines, setDetailLines] = useState<SubDetailLine[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  // 컬럼 리사이저
  const [upperWidths, setUpperWidths] = useState<number[]>(UPPER_INIT)
  const [lowerWidths, setLowerWidths] = useState<number[]>(LOWER_INIT)
  const resizingRef = useRef<{ isUpper: boolean; colIdx: number; startX: number; startW: number } | null>(null)

  function startResize(e: React.MouseEvent, colIdx: number, isUpper: boolean) {
    e.preventDefault()
    e.stopPropagation()
    const w = isUpper ? upperWidths[colIdx] : lowerWidths[colIdx]
    resizingRef.current = { isUpper, colIdx, startX: e.clientX, startW: w }
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizingRef.current) return
      const { isUpper, colIdx, startX, startW } = resizingRef.current
      const newW = Math.max(24, startW + e.clientX - startX)
      if (isUpper) setUpperWidths(p => { const n = [...p]; n[colIdx] = newW; return n })
      else setLowerWidths(p => { const n = [...p]; n[colIdx] = newW; return n })
    }
    function onUp() { resizingRef.current = null }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [])

  useEffect(() => { doSearch('N') }, [])

  async function doSearch(overrideSendYn?: string) {
    const yn = overrideSendYn ?? sendYnRef.current
    setLoading(true)
    setStatusMsg('')
    setOrders([])
    setDetailLines([])
    setSelectedIdx(null)
    setCheckedSet(new Set())
    try {
      const res = await api.get('/p1/p121/orders-sub', {
        params: {
          d1: d1.replace(/-/g, ''), d2: d2.replace(/-/g, ''),
          metaxNo, sublGb: filterSublGb, besongGb: filterBesongGb, sendYn: yn,
        }
      })
      setOrders(res.data)
      if (res.data.length === 0) setStatusMsg('조회 결과 없음')
    } catch (e: any) {
      setStatusMsg(e?.response?.data?.message ?? '조회 오류')
    } finally { setLoading(false) }
  }

  async function loadDetail(row: SubOrderRow) {
    setDetailLoading(true)
    try {
      const res = await api.get(`/p1/p121/orders-sub/${row.SUBL_DATE}/${row.SUBL_NO}/lines`)
      setDetailLines(res.data)
    } catch { setDetailLines([]) }
    finally { setDetailLoading(false) }
  }

  function selectRow(idx: number) {
    setSelectedIdx(idx)
    loadDetail(orders[idx])
  }

  async function sendOne(e: React.MouseEvent, row: SubOrderRow) {
    e.stopPropagation()
    if (row.CHK_GB !== '') { alert('이미 전송된 전표입니다.'); return }
    if (!confirm('* [ 개별 ] 전송하시겠습니까?')) return
    try {
      await api.post(`/p1/p121/orders/${row.SUBL_DATE}/${row.SUBL_NO}/send`)
      setStatusMsg('개별전송 완료 !!')
      doSearch()
    } catch (ex: any) { alert(ex?.response?.data?.message ?? '전송 오류') }
  }

  async function sendAll() {
    if (sendYnRef.current !== 'N') { alert('미전송 상태에서만 전송됩니다!!'); return }
    const selected = [...checkedSet].map(i => orders[i]).filter(o => o.CHK_GB === '')
    if (selected.length === 0) { alert('전송할 미전송 주문을 체크해주세요.'); return }
    if (!confirm(`* ${selected.length}건을 [ 일괄 ] 전송하시겠습니까?`)) return
    try {
      await api.post('/p1/p121/orders/send-all', {
        orders: selected.map(o => ({ sublDate: o.SUBL_DATE, sublNo: o.SUBL_NO }))
      })
      setStatusMsg(`전송 완료 !! (${selected.length}건)`)
      doSearch()
    } catch (ex: any) { alert(ex?.response?.data?.message ?? '전송 오류') }
  }

  async function deleteOrder() {
    if (selectedIdx === null) { alert('삭제할 전표를 선택하세요.'); return }
    const row = orders[selectedIdx]
    if (!confirm(`[${row.MECUST_NM}] 전표를 삭제하시겠습니까?`)) return
    try {
      await api.delete(`/p1/p121/orders/${row.SUBL_DATE}/${row.SUBL_NO}`)
      setStatusMsg('삭제 완료')
      doSearch()
    } catch (ex: any) { alert(ex?.response?.data?.message ?? '삭제 오류') }
  }

  function exportCsv() {
    const headers = ['날짜','원주문번호','상태','수불구분','창고','매출구분','배송구분','코드','서점명',
      '주문수','주문금액','출고수','출고금액','진행시간','주문형태','물류전표',
      '주소','전화번호','받는사람','택배비고','명세서비고']
    const rows = orders.map(o => [
      o.SUBL_DATE, o.ORDER_NO, chkLabel(o.CHK_GB, codes),
      codeName(codes.sublGb, o.SUBL_GB), o.JG_GBNM,
      codeName(codes.meGb, o.ME_GB), codeName(codes.besongGb, o.BESONG_GB),
      o.METAX_NO, o.MECUST_NM, o.OD_QTY, o.OD_AMT, o.JU_QTY, o.JU_AMT,
      o.UPD_TIME, o.INS_NM, o.SUBL_NO,
      o.ADDR, o.TEL_NO, o.MECUST_NM2, o.PM_REMK2, o.PM_REMK,
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv' }))
    a.download = `주문전표조회_${d1}_${d2}.csv`
    a.click()
  }

  function doClear() {
    setD1(todayStr()); setD2(todayStr())
    setCustNm(''); setMetaxNo('')
    setFilterSublGb(''); setFilterBesongGb('')
    setSendYn('N'); sendYnRef.current = 'N'
    setOrders([]); setDetailLines([]); setSelectedIdx(null); setCheckedSet(new Set())
    setStatusMsg('')
  }

  const allChecked = orders.length > 0 && checkedSet.size === orders.length
  const someChecked = checkedSet.size > 0 && !allChecked
  function toggleAll() { setCheckedSet(allChecked ? new Set() : new Set(orders.map((_, i) => i))) }
  function toggleRow(i: number, e: React.MouseEvent) {
    e.stopPropagation()
    const s = new Set(checkedSet)
    if (s.has(i)) s.delete(i); else s.add(i)
    setCheckedSet(s)
  }

  const totalOdQty = orders.reduce((s, o) => s + o.OD_QTY, 0)
  const totalOdAmt = orders.reduce((s, o) => s + o.OD_AMT, 0)
  const totalJuQty = orders.reduce((s, o) => s + o.JU_QTY, 0)
  const totalJuAmt = orders.reduce((s, o) => s + o.JU_AMT, 0)
  const detailTotalQty = detailLines.reduce((s, l) => s + l.OD_QTY, 0)
  const detailTotalAmt = detailLines.reduce((s, l) => s + l.OD_AMT, 0)
  const hasReorder = selectedIdx !== null && orders[selectedIdx]?.REORDER_YN === 'Y'

  const inp = 'h-8 px-2 text-[13px] border border-[#b8c4d4] rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#2b579a]/30'
  const sel = 'h-8 px-1.5 text-[13px] border border-[#b8c4d4] rounded-sm bg-white focus:outline-none'
  const btn = (cls: string) => `h-8 px-3 text-[13px] font-medium rounded-sm transition-colors ${cls}`

  const upperTotal = upperWidths.reduce((a, b) => a + b, 0)
  const lowerTotal = lowerWidths.reduce((a, b) => a + b, 0)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      tabIndex={-1}
    >
      <div className="bg-white rounded-sm shadow-2xl flex flex-col" style={{ width: '86vw', height: '84vh' }}>

        {/* ── 타이틀 바 ── */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#2b579a] text-white shrink-0">
          <span className="text-[13px] font-semibold">주문전표조회 [P121_Sub]</span>
          <button onClick={onClose} className="text-blue-200 hover:text-white text-lg leading-none px-1">✕</button>
        </div>

        {/* ── 툴바 ── */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#f4f6f8] border-b border-[#c8d1dc] shrink-0">
          <button onClick={() => doSearch()} className={btn('bg-[#2b579a] text-white hover:bg-[#1e3a5f]')}>조회</button>
          <button onClick={exportCsv}        className={btn('bg-[#217346] text-white hover:bg-[#166333]')}>엑셀</button>
          <button onClick={doClear}          className={btn('border border-[#b8c4d4] bg-white text-[#5a6a7e] hover:bg-[#eef2f7]')}>초기화</button>
          {statusMsg && <span className="ml-1 text-[13px] font-semibold text-red-600">{statusMsg}</span>}
        </div>

        {/* ── 조회 조건 ── */}
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 px-2 py-1.5 bg-[#f9fafb] border-b border-[#c8d1dc] shrink-0">
          <span className="text-[13px] text-[#2b579a] font-semibold">조회</span>
          <span className="text-[13px] text-[#4a5a6e] font-medium">주문일자</span>
          <input type="date" value={d1} onChange={e => setD1(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doSearch() }} className={`${inp} w-34`} />
          <span className="text-[#8a9ab0] text-[13px]">~</span>
          <input type="date" value={d2} onChange={e => setD2(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doSearch() }} className={`${inp} w-34`} />
          <span className="text-[13px] text-[#4a5a6e] font-medium">서점</span>
          <input value={custNm} onChange={e => setCustNm(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
            placeholder="서점명" className={`${inp} w-28`} />
          <input value={metaxNo} onChange={e => setMetaxNo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
            placeholder="코드" className={`${inp} w-20`} />
          <button onClick={() => doSearch()}
            className="h-8 w-8 text-[13px] border border-[#b8c4d4] rounded-sm bg-white hover:bg-[#eef2f7] flex items-center justify-center shrink-0">
            O
          </button>
          <span className="text-[13px] text-[#4a5a6e] font-medium">수불구분</span>
          <select value={filterSublGb} onChange={e => setFilterSublGb(e.target.value)} className={`${sel} w-28`}>
            <option value="">전체</option>
            {codes.sublGb.map(c => <option key={c.VALUE} value={c.VALUE}>{c.NAME}</option>)}
          </select>
          <span className="text-[13px] text-[#4a5a6e] font-medium">배송구분</span>
          <select value={filterBesongGb} onChange={e => setFilterBesongGb(e.target.value)} className={`${sel} w-28`}>
            <option value="">전체</option>
            {codes.besongGb.map(c => <option key={c.VALUE} value={c.VALUE}>{c.NAME}</option>)}
          </select>
        </div>

        {/* ── 액션 바 ── */}
        <div className="flex items-center gap-2 px-2 py-1.5 bg-white border-b border-[#c8d1dc] shrink-0">
          <button onClick={sendAll} className={btn('bg-[#d63384] text-white hover:bg-[#b02a5f]')}>주문전송</button>
          <div className="flex items-center gap-2 ml-1 text-[13px]">
            <span className="text-[13px] text-[#4a5a6e] font-medium">상태</span>
            {([['', '전체'], ['Y', '전송'], ['N', '미전송']] as const).map(([val, lbl]) => (
              <label key={val} className="flex items-center gap-0.5 cursor-pointer select-none text-[13px]">
                <input type="radio" name="p121sub_sendYn" value={val}
                  checked={sendYn === val}
                  onChange={() => { setSendYn(val); sendYnRef.current = val; doSearch(val) }}
                  className="w-3.5 h-3.5 accent-[#2b579a]" />
                <span className={sendYn === val ? 'font-semibold text-[#2b579a]' : ''}>{lbl}</span>
              </label>
            ))}
          </div>
          {hasReorder && (
            <span className="ml-1 text-[13px] font-semibold text-white bg-red-600 px-2 py-0.5 rounded-sm">
              * 결품도서 재주문 전표입니다.
            </span>
          )}
          <div className="flex-1" />
          <button onClick={deleteOrder} className={btn('bg-red-600 text-white hover:bg-red-800')}>주문삭제</button>
        </div>

        {/* ── 본문 ── */}
        <div className="flex flex-col flex-1 min-h-0">

          {/* 상단 그리드 */}
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="text-[13px] border-collapse"
              style={{ width: upperTotal, tableLayout: 'fixed' }}>
              <colgroup>
                {upperWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
              <thead className="bg-[#E7EBF5] text-black sticky top-0 z-10">
                <tr>
                  <th className={TH}>
                    <input type="checkbox" checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked }}
                      onChange={toggleAll} className="w-3.5 h-3.5" />
                    <RH onMouseDown={e => startResize(e, 0, true)} />
                  </th>
                  <th className={TH}>순번<RH onMouseDown={e => startResize(e, 1, true)} /></th>
                  <th className={TH}>개별전송<RH onMouseDown={e => startResize(e, 2, true)} /></th>
                  <th className={TH}>날짜<RH onMouseDown={e => startResize(e, 3, true)} /></th>
                  <th className={TH}>원주문번호<RH onMouseDown={e => startResize(e, 4, true)} /></th>
                  <th className={TH}>상태<RH onMouseDown={e => startResize(e, 5, true)} /></th>
                  <th className={TH}>수불구분<RH onMouseDown={e => startResize(e, 6, true)} /></th>
                  <th className={TH}>창고<RH onMouseDown={e => startResize(e, 7, true)} /></th>
                  <th className={TH}>매출구분<RH onMouseDown={e => startResize(e, 8, true)} /></th>
                  <th className={TH}>배송구분<RH onMouseDown={e => startResize(e, 9, true)} /></th>
                  <th className={TH}>코드<RH onMouseDown={e => startResize(e, 10, true)} /></th>
                  <th className={TH}>서점명<RH onMouseDown={e => startResize(e, 11, true)} /></th>
                  <th className={TH}>주문수<RH onMouseDown={e => startResize(e, 12, true)} /></th>
                  <th className={TH}>주문금액<RH onMouseDown={e => startResize(e, 13, true)} /></th>
                  <th className={TH}>출고수<RH onMouseDown={e => startResize(e, 14, true)} /></th>
                  <th className={TH}>출고금액<RH onMouseDown={e => startResize(e, 15, true)} /></th>
                  <th className={TH}>진행시간<RH onMouseDown={e => startResize(e, 16, true)} /></th>
                  <th className={TH}>주문형태<RH onMouseDown={e => startResize(e, 17, true)} /></th>
                  <th className={TH}>물류전표<RH onMouseDown={e => startResize(e, 18, true)} /></th>
                  <th className={TH}>주소<RH onMouseDown={e => startResize(e, 19, true)} /></th>
                  <th className={TH}>전화번호<RH onMouseDown={e => startResize(e, 20, true)} /></th>
                  <th className={TH}>받는사람<RH onMouseDown={e => startResize(e, 21, true)} /></th>
                  <th className={TH}>택배비고<RH onMouseDown={e => startResize(e, 22, true)} /></th>
                  <th className={TH}>명세서비고<RH onMouseDown={e => startResize(e, 23, true)} /></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={24} className="text-center py-10 text-[#8a9ab0] text-[13px]">조회 중...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={24} className="text-center py-10 text-[#b8c4d4] text-[13px]">데이터 없음</td></tr>
                ) : orders.map((o, i) => {
                  const isSel = selectedIdx === i
                  return (
                    <tr key={`${o.SUBL_DATE}-${o.SUBL_NO}`}
                      className={`border-b border-[#dde4ed] cursor-pointer transition-all ${isSel ? 'bg-[#FDF5E6] text-[#1e3a5f] font-medium' : 'bg-white hover:bg-[#f0f4fa]'}`}
                      onClick={() => selectRow(i)}
                      onDoubleClick={() => { onSelect(o.SUBL_DATE, o.SUBL_NO) }}
                    >
                      <td className={`${TD} text-center`}>
                        <input type="checkbox" checked={checkedSet.has(i)}
                          onClick={e => toggleRow(i, e)} onChange={() => {}} className="w-3.5 h-3.5" />
                      </td>
                      <td className={`${TD} text-center text-[#8a9ab0]`}>{i + 1}</td>
                      <td className={`${TD} text-center`}>
                        <button title="개별전송" disabled={o.CHK_GB !== ''}
                          onClick={e => sendOne(e, o)}
                          className={`text-[13px] px-2 py-0.5 rounded border font-bold ${
                            o.CHK_GB === ''
                              ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                              : 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed'
                          }`}>↩</button>
                      </td>
                      <td className={TD}>
                        {o.SUBL_DATE.slice(0,4)}.{o.SUBL_DATE.slice(4,6)}.{o.SUBL_DATE.slice(6,8)}
                      </td>
                      <td className={TD}>{String(o.ORDER_NO).slice(0, 8)}</td>
                      <td className={`${TD} text-center`}>
                        <span className={`text-[12px] px-1 py-0.5 rounded font-medium ${chkBadgeClass(o.CHK_GB)}`}>
                          {chkLabel(o.CHK_GB, codes)}
                        </span>
                      </td>
                      <td className={TD}>{codeName(codes.sublGb, o.SUBL_GB)}</td>
                      <td className={TD}>{o.JG_GBNM}</td>
                      <td className={TD}>{codeName(codes.meGb, o.ME_GB)}</td>
                      <td className={TD}>{codeName(codes.besongGb, o.BESONG_GB)}</td>
                      <td className={TD}>{o.METAX_NO}</td>
                      <td className={`${TD} font-medium truncate`} title={o.MECUST_NM}>{o.MECUST_NM}</td>
                      <td className={`${TD} text-right tabular-nums`}>{o.OD_QTY}</td>
                      <td className={`${TD} text-right tabular-nums`}>{o.OD_AMT.toLocaleString()}</td>
                      <td className={`${TD} text-right tabular-nums`}>{o.JU_QTY}</td>
                      <td className={`${TD} text-right tabular-nums`}>{o.JU_AMT.toLocaleString()}</td>
                      <td className={`${TD} text-center`}>{o.UPD_TIME}</td>
                      <td className={TD}>{o.INS_NM}</td>
                      <td className={`${TD} text-center tabular-nums`}>{o.SUBL_NO}</td>
                      <td className={`${TD} truncate`} title={o.ADDR}>{o.ADDR}</td>
                      <td className={`${TD} tabular-nums`}>{o.TEL_NO}</td>
                      <td className={TD}>{o.MECUST_NM2}</td>
                      <td className={`${TD} truncate`} title={o.PM_REMK2}>{o.PM_REMK2}</td>
                      <td className={`${TD} truncate`} title={o.PM_REMK}>{o.PM_REMK}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 상단 합계 바 */}
          <div className="flex items-center gap-3 px-3 py-1.5 bg-[#eef2f7] border-t border-[#c8d1dc] text-[13px] shrink-0">
            <span className="font-semibold text-[#1e3a5f]">{orders.length}건</span>
            <span className="text-[#8a9ab0]">주문수</span>
            <span className="font-bold text-[#1e3a5f] tabular-nums">{totalOdQty.toLocaleString()}</span>
            <span className="text-[#8a9ab0]">주문금액</span>
            <span className="font-bold text-[#2b579a] tabular-nums">{totalOdAmt.toLocaleString()}</span>
            <span className="text-[#8a9ab0]">출고수</span>
            <span className="font-bold text-[#1e3a5f] tabular-nums">{totalJuQty.toLocaleString()}</span>
            <span className="text-[#8a9ab0]">출고금액</span>
            <span className="font-bold text-[#2b579a] tabular-nums">{totalJuAmt.toLocaleString()}</span>
          </div>

          {/* 구분선 */}
          <div className="h-1.5 bg-[#c8d1dc] shrink-0" />

          {/* 하단 그리드 (도서 상세) */}
          <div className="shrink-0 overflow-auto" style={{ height: 190 }}>
            <table className="text-[13px] border-collapse"
              style={{ width: lowerTotal, tableLayout: 'fixed' }}>
              <colgroup>
                {lowerWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
              </colgroup>
              <thead className="bg-[#E7EBF5] text-black sticky top-0 z-10">
                <tr>
                  <th className={TH}>순번<RH onMouseDown={e => startResize(e, 0, false)} /></th>
                  <th className={TH}>도서코드<RH onMouseDown={e => startResize(e, 1, false)} /></th>
                  <th className={TH}>도서명<RH onMouseDown={e => startResize(e, 2, false)} /></th>
                  <th className={TH}>ISBN<RH onMouseDown={e => startResize(e, 3, false)} /></th>
                  <th className={TH}>정가<RH onMouseDown={e => startResize(e, 4, false)} /></th>
                  <th className={TH}>등록부수<RH onMouseDown={e => startResize(e, 5, false)} /></th>
                  <th className={TH}>%<RH onMouseDown={e => startResize(e, 6, false)} /></th>
                  <th className={TH}>등록금액<RH onMouseDown={e => startResize(e, 7, false)} /></th>
                  <th className={TH}>도서비고<RH onMouseDown={e => startResize(e, 8, false)} /></th>
                </tr>
              </thead>
              <tbody>
                {detailLoading ? (
                  <tr><td colSpan={9} className="text-center py-4 text-[#8a9ab0] text-[13px]">불러오는 중...</td></tr>
                ) : detailLines.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-4 text-[#b8c4d4] text-[13px]">전표를 선택하면 도서 내용이 표시됩니다.</td></tr>
                ) : detailLines.map((ln, i) => (
                  <tr key={ln.SUBL_SEQ}
                    className={`border-b border-[#dde4ed] ${i % 2 === 0 ? 'bg-white' : 'bg-[#f6f8fb]'}`}>
                    <td className={`${TD} text-center text-[#8a9ab0]`}>{i + 1}</td>
                    <td className={`${TD} text-center font-mono`}>{ln.BK_CD}</td>
                    <td className={TD}>{ln.BK_NM}</td>
                    <td className={`${TD} text-center font-mono`}>{ln.BAR_CD}</td>
                    <td className={`${TD} text-right tabular-nums`}>{ln.OUT_DANGA.toLocaleString()}</td>
                    <td className={`${TD} text-center tabular-nums`}>{ln.OD_QTY}</td>
                    <td className={`${TD} text-center tabular-nums`}>{ln.OUT_RATE}</td>
                    <td className={`${TD} text-right tabular-nums`}>{ln.OD_AMT.toLocaleString()}</td>
                    <td className={TD}>{ln.PUB_REMK}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 하단 합계 바 */}
          <div className="flex items-center gap-3 px-3 py-1.5 bg-[#eef2f7] border-t border-[#c8d1dc] text-[13px] shrink-0">
            <span className="font-semibold text-[#1e3a5f]">{detailLines.length}종</span>
            <span className="font-bold text-[#1e3a5f] tabular-nums">{detailTotalQty.toLocaleString()}부</span>
            <span className="font-bold text-[#2b579a] tabular-nums">{detailTotalAmt.toLocaleString()}원</span>
          </div>
        </div>
      </div>
    </div>
  )
}
