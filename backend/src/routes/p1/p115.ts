import type { FastifyPluginAsync } from 'fastify'
import { query, queryOne, withTransaction } from '../../db.js'
import { kobicQuery } from '../../db-kobic.js'

interface JwtUser {
  taxNo: string
  empNo: string
  salesNo: string
  sublseqDiv: string
}

// ── OTG_TYPE(1/2/3/4) → ME_GB(01/02/03/04) 변환
function toMeGb(otgType: string | number): string {
  const map: Record<string, string> = { '1': '01', '2': '02', '3': '03', '4': '04' }
  return map[String(otgType)] ?? '01'
}

const p115Routes: FastifyPluginAsync = async (fastify) => {

  // ────────────────────────────────────────────────────────────
  // GET /codes  — ME_GB 코드 목록
  // ────────────────────────────────────────────────────────────
  fastify.get('/codes', { preHandler: [fastify.authenticate] }, async () => {
    const meGb = await query<{ VALUE: string; NAME: string }>(
      `SELECT FLD_CODE VALUE, FLD_NAME NAME
         FROM GNCODE
        WHERE FLD_ID = 'me_gb'
        ORDER BY FLD_CODE`,
      {}
    )
    return { meGb }
  })

  // ────────────────────────────────────────────────────────────
  // GET /meta/custme?q=  — 판매처 검색 (자동완성)
  // ────────────────────────────────────────────────────────────
  fastify.get<{ Querystring: { q?: string } }>(
    '/meta/custme',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = request.user as JwtUser
      const q = request.query.q ?? ''
      return query<{ METAX_NO: string; MECUST_NM: string }>(
        `SELECT A.METAX_NO, NVL(B.MECUST_NM,'') MECUST_NM
           FROM CUSTCL A, CUSTME B
          WHERE A.METAX_NO = B.METAX_NO
            AND A.TAX_NO = :taxNo
            AND (B.MECUST_NM LIKE '%' || :q || '%' OR A.METAX_NO LIKE '%' || :q || '%')
          ORDER BY B.MECUST_NM`,
        { taxNo: user.taxNo, q }
      )
    }
  )

  // ────────────────────────────────────────────────────────────
  // GET /kobicmst  — KOBICMST 조회
  // Querystring: d1, d2, metaxNo, moveYn
  // ────────────────────────────────────────────────────────────
  fastify.get<{
    Querystring: { d1?: string; d2?: string; metaxNo?: string; moveYn?: string }
  }>('/kobicmst', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user as JwtUser
    const { d1, d2, metaxNo, moveYn } = request.query

    const date1 = (d1 ?? '').replace(/-/g, '')
    const date2 = (d2 ?? '').replace(/-/g, '')

    let whereCustme = ''
    let whereMove = ''
    const binds: Record<string, unknown> = { taxNo: user.taxNo, date1, date2 }

    if (metaxNo) {
      whereCustme = `AND A.METAX_NO = :metaxNo`
      binds.metaxNo = metaxNo
    }
    if (moveYn === 'Y' || moveYn === 'N') {
      whereMove = `AND NVL(A.MOVE_YN,'N') = :moveYn`
      binds.moveYn = moveYn
    }

    return query(
      `SELECT A.OUTBOUND_DATE, A.OUT_NO, A.DELIVERY_CD, A.DELIVERY_NM,
              A.METAX_NO, NVL(B.MECUST_NM,'') MECUST_NM,
              f_gncode('me_gb', A.ME_GB) ME_GBNM, A.ME_GB,
              NVL(A.MOVE_YN,'N') MOVE_YN,
              NVL(A.ERROR_YN,'N') ERROR_YN,
              NVL(A.ERROR_TEXT,'') ERROR_TEXT
         FROM KOBICMST A, (SELECT METAX_NO, MECUST_NM FROM CUSTME) B
        WHERE A.METAX_NO = B.METAX_NO(+)
          AND A.TAX_NO = :taxNo
          AND A.OUTBOUND_DATE BETWEEN :date1 AND :date2
          ${whereCustme}
          ${whereMove}
        ORDER BY A.OUTBOUND_DATE DESC, A.OUT_NO`,
      binds
    )
  })

  // ────────────────────────────────────────────────────────────
  // GET /kobicmst/:date/:outNo/:deliveryCd/lines  — KOBICDTL 조회
  // ────────────────────────────────────────────────────────────
  fastify.get<{
    Params: { date: string; outNo: string; deliveryCd: string }
  }>('/kobicmst/:date/:outNo/:deliveryCd/lines', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user as JwtUser
    const { date, outNo, deliveryCd } = request.params

    return query(
      `SELECT A.LINE_NO, NVL(A.BAR_CD,'') BAR_CD, NVL(A.BK_CD,'') BK_CD,
              NVL(A.ITEM_NM,'') ITEM_NM, NVL(A.PRICE,0) PRICE,
              NVL(A.DISCOUNT,0) DISCOUNT, NVL(A.ORDER_QTY,0) ORDER_QTY,
              NVL(A.MOVE_YN,'N') MOVE_YN,
              NVL(A.ERROR_YN,'N') ERROR_YN,
              NVL(A.ERROR_TEXT,'') ERROR_TEXT,
              NVL(A.REMARK,'') REMARK,
              NVL(B.BK_QTY10,0) BK_QTY10,
              NVL(B.MEDG_QTY,0) MEDG_QTY,
              NVL(B.BK_QTY10,0) - NVL(B.MEDG_QTY,0) JG_QTY
         FROM KOBICDTL A, BOOKCD B
        WHERE A.TAX_NO = B.TAX_NO(+)
          AND A.BK_CD = B.BK_CD(+)
          AND A.OUTBOUND_DATE = :date
          AND A.TAX_NO = :taxNo
          AND A.DELIVERY_CD = :deliveryCd
          AND A.OUT_NO = :outNo
        ORDER BY A.LINE_NO`,
      { date, taxNo: user.taxNo, deliveryCd, outNo }
    )
  })

  // ────────────────────────────────────────────────────────────
  // POST /import  — KOBIC 외부DB에서 주문 불러오기
  // Body: { d1, d2, jgGb }
  // ────────────────────────────────────────────────────────────
  fastify.post<{
    Body: { d1: string; d2: string; jgGb: string }
  }>('/import', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as JwtUser

    const date1 = request.body.d1.replace(/-/g, '')
    const date2 = request.body.d2.replace(/-/g, '')

    // 1. 사업자번호(BIZ_NO) 조회
    const custcd = await queryOne<{ BIZ_NO: string }>(
      `SELECT REPLACE(TAX_NO1,'-','') BIZ_NO FROM CUSTCD WHERE TAX_NO = :taxNo`,
      { taxNo: user.taxNo }
    )
    if (!custcd) return reply.code(400).send({ message: '업체정보를 찾을 수 없습니다.' })
    const bizNo = custcd.BIZ_NO

    // 2. KOBIC 외부DB에서 주문 조회
    let kobicRows: any[]
    try {
      kobicRows = await kobicQuery(
        `SELECT A.ORDER_KEY, A.BIZ_NO, A.BOOKSTORE_CD, A.BRANCH_CD,
                A.ISBN, A.ORDER_DATE, A.ORDER_COUNT, A.OTG_TYPE,
                A.SUPPLY_RATE, A.DLV_TYPE, A.ORDER_CUST,
                (SELECT BOOKSTORE_NM||' '||BRANCH_NM
                   FROM KOBIC_BOOKSTORE
                  WHERE BOOKSTORE_CD = A.BOOKSTORE_CD
                    AND BRANCH_CD = A.BRANCH_CD) KOBICTAX_NM
           FROM KOBIC_ORDEROUT A
          WHERE A.ORDER_DATE BETWEEN :date1 AND :date2
            AND A.BIZ_NO = :bizNo
          ORDER BY A.ORDER_DATE, A.BOOKSTORE_CD, A.BRANCH_CD, A.OTG_TYPE`,
        { date1, date2, bizNo }
      )
    } catch (err: any) {
      return reply.code(502).send({ message: 'KOBIC 외부DB 연결 실패: ' + (err?.message ?? '') })
    }

    if (kobicRows.length === 0) return { inserted: 0, message: '불러올 KOBIC 주문이 없습니다.' }

    // 3. 현재 KOBICMST 최대 OUT_NO 로드
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const outNoRow = await queryOne<{ OUT_NO: number }>(
      `SELECT NVL(MAX(OUT_NO),0) OUT_NO FROM KOBICMST
        WHERE TAX_NO = :taxNo AND OUTBOUND_DATE = :today`,
      { taxNo: user.taxNo, today }
    )
    let outNo = (outNoRow?.OUT_NO ?? 0)

    // 4. 각 레코드 처리 — 트랜잭션
    let insertedCount = 0
    let prevKey = '' // 날짜+서점코드+매출구분 기준 마스터 키 추적
    let curDate = ''
    let curDeliveryCd = ''
    let curMeGb = ''
    let curOutNo = outNo

    await withTransaction(async (conn) => {
      for (const r of kobicRows) {
        const orderDate: string = String(r.ORDER_DATE ?? '').replace(/-/g, '').slice(0, 8)
        const deliveryCd = String(r.BOOKSTORE_CD ?? '') + String(r.BRANCH_CD ?? '')
        const meGb = toMeGb(r.OTG_TYPE)
        const orderKey = String(r.ORDER_KEY ?? '')
        const isbn = String(r.ISBN ?? '')
        const orderCount = Number(r.ORDER_COUNT ?? 0)
        const supplyRate = Number(r.SUPPLY_RATE ?? 0)
        const deliveryNm = String(r.KOBICTAX_NM ?? '')

        // ORDER_KEY 중복 체크
        const dupCheck = await queryOne<{ CNT: number }>(
          `SELECT COUNT(*) CNT FROM KOBICDTL WHERE ORDER_KEY = :orderKey`,
          { orderKey }
        )
        if ((dupCheck?.CNT ?? 0) > 0) continue

        // 마스터 key 변경 시 새 KOBICMST 생성
        const masterKey = orderDate + '|' + deliveryCd + '|' + meGb
        if (masterKey !== prevKey) {
          curDate = orderDate
          curDeliveryCd = deliveryCd

          // 해당 날짜의 OUT_NO 채번
          const outNoCheck = await queryOne<{ OUT_NO: number }>(
            `SELECT NVL(MAX(OUT_NO),0) OUT_NO FROM KOBICMST
              WHERE TAX_NO = :taxNo AND OUTBOUND_DATE = :orderDate`,
            { taxNo: user.taxNo, orderDate }
          )
          curOutNo = (outNoCheck?.OUT_NO ?? 0) + 1
          curMeGb = meGb
          prevKey = masterKey

          // KOBIC_MATCH로 METAX_NO 조회
          const matchRows = await query<{ METAX_NO: string }>(
            `SELECT A.METAX_NO
               FROM CUSTCL A, KOBIC_MATCH B
              WHERE A.METAX_NO = B.METAX_NO
                AND A.TAX_NO = B.TAX_NO
                AND A.TAX_NO = :taxNo
                AND B.STORE_CD = :deliveryCd`,
            { taxNo: user.taxNo, deliveryCd }
          )

          let metaxNo = ''
          let errorYn = 'N'
          let errorText = ''

          if (matchRows.length === 0) {
            errorYn = 'Y'
            errorText = '미등록 서점'
          } else if (matchRows.length > 1) {
            errorText = '서점매칭 중복'
            metaxNo = matchRows[0].METAX_NO
          } else {
            metaxNo = matchRows[0].METAX_NO
          }

          await conn.execute(
            `INSERT INTO KOBICMST (
               OUTBOUND_DATE, TAX_NO, OUT_NO, DELIVERY_CD, DELIVERY_NM,
               METAX_NO, ME_GB, ERROR_YN, ERROR_TEXT,
               INS_EMP, INS_DATE
             ) VALUES (
               :outboundDate, :taxNo, :outNo, :deliveryCd, :deliveryNm,
               :metaxNo, :meGb, :errorYn, :errorText,
               :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS')
             )`,
            {
              outboundDate: curDate,
              taxNo: user.taxNo,
              outNo: curOutNo,
              deliveryCd: curDeliveryCd,
              deliveryNm,
              metaxNo: metaxNo || null,
              meGb,
              errorYn,
              errorText: errorText || null,
              empNo: user.empNo,
            }
          )
        }

        // 도서정보 조회 (ISBN → BK_CD)
        const bookRows = await query<{
          BK_CD: string; BK_NM: string; WRITER: string; OUT_DANGA: number
        }>(
          `SELECT BK_CD, BK_NM, NVL(WRITER,'') WRITER, NVL(OUT_DANGA,0) OUT_DANGA
             FROM BOOKCD
            WHERE TAX_NO = :taxNo AND BAR_CD = :barCd AND NVL(USE_YN,'N') != 'Y'`,
          { taxNo: user.taxNo, barCd: isbn }
        )

        // KOBICDTL INSERT할 기본값 구성
        let bkCd = ''
        let itemNm = ''
        let price = 0
        let writer = ''
        let dtlErrorYn = 'N'
        let dtlErrorText = ''

        if (bookRows.length === 0) {
          dtlErrorYn = 'Y'
          dtlErrorText = '미등록도서'
        } else if (bookRows.length > 1) {
          dtlErrorText = '바코드중복'
          bkCd = bookRows[0].BK_CD
          itemNm = bookRows[0].BK_NM
          price = bookRows[0].OUT_DANGA
          writer = bookRows[0].WRITER
        } else {
          bkCd = bookRows[0].BK_CD
          itemNm = bookRows[0].BK_NM
          price = bookRows[0].OUT_DANGA
          writer = bookRows[0].WRITER
        }

        // 라인번호 채번
        const lineNoRow = await queryOne<{ LINE_NO: number }>(
          `SELECT NVL(MAX(LINE_NO),0) LINE_NO FROM KOBICDTL
            WHERE TAX_NO = :taxNo AND OUTBOUND_DATE = :date
              AND DELIVERY_CD = :deliveryCd AND OUT_NO = :outNo`,
          { taxNo: user.taxNo, date: curDate, deliveryCd: curDeliveryCd, outNo: curOutNo }
        )
        const lineNo = (lineNoRow?.LINE_NO ?? 0) + 1

        // KOBICDTL INSERT
        await conn.execute(
          `INSERT INTO KOBICDTL (
             OUTBOUND_DATE, TAX_NO, OUT_NO, DELIVERY_CD, LINE_NO,
             ITEM_CD, BAR_CD, ITEM_NM, PUB_NM, ORDER_QTY,
             PRICE, REMARK, DISCOUNT, BK_CD, WRITER,
             MOVE_YN, ERROR_YN, ERROR_TEXT, INS_EMP, INS_DATE, ORDER_KEY
           ) VALUES (
             :outboundDate, :taxNo, :outNo, :deliveryCd, :lineNo,
             :isbn, :isbn, :itemNm, NULL, :orderQty,
             :price, NULL, :discount, :bkCd, :writer,
             'N', :errorYn, :errorText,
             :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'), :orderKey
           )`,
          {
            outboundDate: curDate,
            taxNo: user.taxNo,
            outNo: curOutNo,
            deliveryCd: curDeliveryCd,
            lineNo,
            isbn,
            itemNm: itemNm || null,
            orderQty: orderCount,
            price,
            discount: supplyRate,
            bkCd: bkCd || null,
            writer: writer || null,
            errorYn: dtlErrorYn,
            errorText: dtlErrorText || null,
            empNo: user.empNo,
            orderKey,
          }
        )

        insertedCount++
      }
    })

    return { inserted: insertedCount, message: `${insertedCount}건 불러오기 완료` }
  })

  // ────────────────────────────────────────────────────────────
  // POST /order  — 주문등록 (KOBICMST → CHULMT + BKMECH or BJUMUN)
  // Body: { date, outNo, deliveryCd, jgGb }
  // ────────────────────────────────────────────────────────────
  fastify.post<{
    Body: { date: string; outNo: string; deliveryCd: string; jgGb: string }
  }>('/order', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as JwtUser
    const { date, outNo, deliveryCd, jgGb } = request.body

    // 마스터 조회
    const mst = await queryOne<{
      OUTBOUND_DATE: string; OUT_NO: string; DELIVERY_CD: string
      METAX_NO: string; ME_GB: string; MOVE_YN: string; ERROR_YN: string
    }>(
      `SELECT OUTBOUND_DATE, OUT_NO, DELIVERY_CD, METAX_NO, ME_GB,
              NVL(MOVE_YN,'N') MOVE_YN, NVL(ERROR_YN,'N') ERROR_YN
         FROM KOBICMST
        WHERE TAX_NO = :taxNo AND OUTBOUND_DATE = :date
          AND OUT_NO = :outNo AND DELIVERY_CD = :deliveryCd`,
      { taxNo: user.taxNo, date, outNo, deliveryCd }
    )
    if (!mst) return reply.code(404).send({ message: '주문마스터를 찾을 수 없습니다.' })
    if (mst.MOVE_YN === 'Y') return reply.code(400).send({ message: '이미 전송된 주문입니다.' })
    if (mst.ERROR_YN === 'Y') return reply.code(400).send({ message: '오류가 있는 주문은 등록할 수 없습니다.' })

    // 상세 라인 조회
    const lines = await query<{
      LINE_NO: string; BK_CD: string; BAR_CD: string
      ORDER_QTY: number; PRICE: number; DISCOUNT: number
      ERROR_YN: string; REMARK: string
    }>(
      `SELECT LINE_NO, NVL(BK_CD,'') BK_CD, NVL(BAR_CD,'') BAR_CD,
              NVL(ORDER_QTY,0) ORDER_QTY, NVL(PRICE,0) PRICE,
              NVL(DISCOUNT,0) DISCOUNT, NVL(ERROR_YN,'N') ERROR_YN,
              NVL(REMARK,'') REMARK
         FROM KOBICDTL
        WHERE TAX_NO = :taxNo AND OUTBOUND_DATE = :date
          AND DELIVERY_CD = :deliveryCd AND OUT_NO = :outNo
          AND NVL(MOVE_YN,'N') = 'N'
        ORDER BY LINE_NO`,
      { taxNo: user.taxNo, date, deliveryCd, outNo }
    )
    if (lines.length === 0) return reply.code(400).send({ message: '등록할 주문 라인이 없습니다.' })

    const hasError = lines.some(l => l.ERROR_YN === 'Y')
    if (hasError) return reply.code(400).send({ message: '미매칭/오류 도서가 있어 주문등록할 수 없습니다.' })

    // 판매처 정보 조회
    const custme = await queryOne<{
      BESONG_GB: string; BESONG_CD: string; JPTAX_NO: string; AREA_GB: string
      CHUL_BLOCK_YN: string; CHUL_BLOCK_YN_CL: string
    }>(
      `SELECT NVL(B.BESONG_GB,'') BESONG_GB, NVL(B.BESONG_CD,'') BESONG_CD,
              NVL(B.JPTAX_NO, A.METAX_NO) JPTAX_NO, NVL(B.AREA_GB,'') AREA_GB,
              NVL(A.CHUL_BLOCK_YN,'N') CHUL_BLOCK_YN,
              NVL(B.CHUL_BLOCK_YN,'N') CHUL_BLOCK_YN_CL
         FROM CUSTME A, CUSTCL B
        WHERE A.METAX_NO = :metaxNo AND A.METAX_NO = B.METAX_NO AND A.TAX_NO = :taxNo`,
      { taxNo: user.taxNo, metaxNo: mst.METAX_NO }
    )
    if (!custme) return reply.code(400).send({ message: '판매처 정보를 찾을 수 없습니다.' })
    if (custme.CHUL_BLOCK_YN === 'Y' || custme.CHUL_BLOCK_YN_CL === 'Y') {
      return reply.code(400).send({ message: '출고불가 거래처입니다.' })
    }

    // 재고체크 설정 확인
    const cfgTable = jgGb === '00' ? 'PMSCONFIG' : 'WMSCONFIG'
    const cfgRow = await queryOne<{ JGCHK_YN: string }>(
      `SELECT NVL(JGCHK_YN,'N') JGCHK_YN FROM ${cfgTable} WHERE TAX_NO = :taxNo`,
      { taxNo: user.taxNo }
    )
    const jgChkYn = cfgRow?.JGCHK_YN ?? 'N'

    // JGSHARE_YN (재고공유여부)
    const jgShareRow = await queryOne<{ JGSHARE_YN: string }>(
      `SELECT NVL(JGSHARE_YN,'N') JGSHARE_YN FROM CUSTCD WHERE TAX_NO = :taxNo`,
      { taxNo: user.taxNo }
    )
    const jgShareYn = jgShareRow?.JGSHARE_YN ?? 'N'

    // SUBL_DATE = date (KOBICMST 주문일자 사용)
    const sublDate = date

    await withTransaction(async (conn) => {
      // SUBL_NO 채번
      let sublNo: string
      if (user.sublseqDiv === 'Y') {
        // 날짜 기반: 일자NNNN
        const maxRow = await queryOne<{ SUBL_NO: string }>(
          `SELECT NVL(MAX(SUBL_NO),'0') SUBL_NO FROM CHULMT
            WHERE TAX_NO = :taxNo AND SUBL_DATE = :sublDate`,
          { taxNo: user.taxNo, sublDate }
        )
        const maxNum = parseInt(maxRow?.SUBL_NO?.slice(-4) ?? '0', 10)
        sublNo = sublDate + String(maxNum + 1).padStart(4, '0')
      } else {
        // 시퀀스 기반
        const seqRow = await queryOne<{ SUBL_NO: string }>(
          `SELECT CHULMT_NUM.NEXTVAL SUBL_NO FROM DUAL`,
          {}
        )
        sublNo = seqRow?.SUBL_NO ?? '0'
      }

      const sublGb = '51'
      const insGb = '23'
      const chkGb = jgGb === '00' ? '3' : ''

      // CHULMT INSERT
      await conn.execute(
        `INSERT INTO CHULMT (
           SUBL_DATE, TAX_NO, SUBL_NO, INS_GB, SUBL_GB, ME_GB,
           BESONG_GB, BESONG_CD, AREA_GB, METAX_NO, JPTAX_NO,
           CHK_GB, JG_GB, PM_REMK,
           INS_EMP, INS_DATE, UPD_EMP, UPD_DATE, UPD_IP
         ) VALUES (
           :sublDate, :taxNo, :sublNo, :insGb, :sublGb, :meGb,
           :besongGb, :besongCd, :areaGb, :metaxNo, :jptaxNo,
           :chkGb, :jgGb, :pmRemk,
           :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'),
           :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'), NULL
         )`,
        {
          sublDate,
          taxNo: user.taxNo,
          sublNo,
          insGb,
          sublGb,
          meGb: mst.ME_GB,
          besongGb: custme.BESONG_GB,
          besongCd: custme.BESONG_CD,
          areaGb: custme.AREA_GB,
          metaxNo: mst.METAX_NO,
          jptaxNo: custme.JPTAX_NO,
          chkGb,
          jgGb,
          pmRemk: null,
          empNo: user.empNo,
        }
      )

      let sublSeq = 0

      for (const line of lines) {
        sublSeq++
        const outDanga = line.PRICE
        const outRate = line.DISCOUNT
        const odQty = line.ORDER_QTY
        const odAmt = Math.floor((outDanga * outRate) / 100) * odQty

        // 재고 체크
        let juQty = odQty
        if (jgChkYn === 'Y') {
          if (jgGb === '00') {
            // 본사: BOOKCD.BK_QTY10 - MEDG_QTY
            const stockRow = await queryOne<{ AVAIL: number }>(
              `SELECT NVL(BK_QTY10,0) - NVL(MEDG_QTY,0) AVAIL
                 FROM BOOKCD WHERE BK_CD = :bkCd AND TAX_NO = :taxNo`,
              { bkCd: line.BK_CD, taxNo: user.taxNo }
            )
            const avail = stockRow?.AVAIL ?? 0
            if (avail < odQty) juQty = Math.max(avail, 0)
          } else {
            // 물류: BKSBJG JG_QTY
            const stockRow = await queryOne<{ JG_QTY: number }>(
              `SELECT SUM(NVL(JG_QTY,0)) JG_QTY FROM BKSBJG
                WHERE TAX_NO = :taxNo AND BK_CD = :bkCd AND JG_GB = '10'`,
              { taxNo: user.taxNo, bkCd: line.BK_CD }
            )
            const avail = stockRow?.JG_QTY ?? 0
            if (avail < odQty) {
              juQty = Math.max(avail, 0)
              // 재고공유 처리
              if (jgShareYn === 'Y' && juQty < odQty) {
                await conn.execute(
                  `BEGIN P_JUMUNJG_INSERT(
                     :sublDate,:taxNo,:taxNo,:sublNo,:sublSeq,
                     :bkCd,:bkCd,:qty
                   ); END;`,
                  {
                    sublDate,
                    taxNo: user.taxNo,
                    sublNo,
                    sublSeq,
                    bkCd: line.BK_CD,
                    qty: odQty - juQty,
                  }
                )
              }
            }
          }
        }

        const juAmt = Math.floor((outDanga * outRate) / 100) * juQty

        if (jgGb === '00') {
          // 본사: BKMECH INSERT
          await conn.execute(
            `INSERT INTO BKMECH (
               SUBL_DATE, TAX_NO, SUBL_NO, SUBL_SEQ, SUBL_SEQ2, METAX_NO, JG_GB,
               JPTAX_NO, BK_CD, OUT_DANGA, OUT_RATE, LOC_CD,
               JU_QTY, JU_AMT, B_QTY, B_AMT,
               INS_EMP, INS_DATE, UPD_EMP, UPD_DATE
             ) VALUES (
               :sublDate, :taxNo, :sublNo, :sublSeq, :sublSeq, :metaxNo, :jgGb,
               :jptaxNo, :bkCd, :outDanga, :outRate, NULL,
               :juQty, :juAmt, :odQty, :odAmt,
               :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'),
               :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS')
             )`,
            {
              sublDate, taxNo: user.taxNo, sublNo, sublSeq,
              metaxNo: mst.METAX_NO, jgGb, jptaxNo: custme.JPTAX_NO,
              bkCd: line.BK_CD, outDanga, outRate,
              juQty, juAmt, odQty, odAmt, empNo: user.empNo,
            }
          )
        } else {
          // 물류: BJUMUN INSERT
          await conn.execute(
            `INSERT INTO BJUMUN (
               SUBL_DATE, TAX_NO, SUBL_NO, SUBL_SEQ, ORDER_NO, ORDER_SEQ,
               METAX_NO, JG_GB, BK_CD, OUT_RATE,
               OD_QTY, OD_AMT, JU_QTY, JU_AMT, OUT_DANGA, PUB_REMK,
               INS_EMP, INS_DATE, UPD_EMP, UPD_DATE, UPD_IP
             ) VALUES (
               :sublDate, :taxNo, :sublNo, :sublSeq, NULL, NULL,
               :metaxNo, :jgGb, :bkCd, :outRate,
               :odQty, :odAmt, :juQty, :juAmt, :outDanga, :pubRemk,
               :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'),
               :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'), NULL
             )`,
            {
              sublDate, taxNo: user.taxNo, sublNo, sublSeq,
              metaxNo: mst.METAX_NO, jgGb, bkCd: line.BK_CD, outRate,
              odQty, odAmt, juQty, juAmt, outDanga,
              pubRemk: line.REMARK || null, empNo: user.empNo,
            }
          )
        }

        // KOBICDTL MOVE_YN = 'Y'
        await conn.execute(
          `UPDATE KOBICDTL SET MOVE_YN = 'Y',
                  UPD_EMP = :empNo, UPD_DATE = TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS')
            WHERE TAX_NO = :taxNo AND OUTBOUND_DATE = :date
              AND DELIVERY_CD = :deliveryCd AND OUT_NO = :outNo AND LINE_NO = :lineNo`,
          { empNo: user.empNo, taxNo: user.taxNo, date, deliveryCd, outNo, lineNo: line.LINE_NO }
        )
      }

      // KOBICMST MOVE_YN = 'Y'
      await conn.execute(
        `UPDATE KOBICMST SET MOVE_YN = 'Y',
                UPD_EMP = :empNo, UPD_DATE = TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS')
          WHERE TAX_NO = :taxNo AND OUTBOUND_DATE = :date
            AND DELIVERY_CD = :deliveryCd AND OUT_NO = :outNo`,
        { empNo: user.empNo, taxNo: user.taxNo, date, deliveryCd, outNo }
      )
    })

    return { ok: true, message: '주문등록이 완료되었습니다.' }
  })

  // ────────────────────────────────────────────────────────────
  // POST /rematch  — 미매칭 판매처 재매칭
  // Body: { date, outNo, deliveryCd }
  // ────────────────────────────────────────────────────────────
  fastify.post<{
    Body: { date: string; outNo: string; deliveryCd: string }
  }>('/rematch', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as JwtUser
    const { date, outNo, deliveryCd } = request.body

    // KOBIC_MATCH에서 METAX_NO 조회
    const matchRows = await query<{ METAX_NO: string }>(
      `SELECT A.METAX_NO
         FROM CUSTCL A, KOBIC_MATCH B
        WHERE A.METAX_NO = B.METAX_NO AND A.TAX_NO = B.TAX_NO
          AND A.TAX_NO = :taxNo AND B.STORE_CD = :deliveryCd`,
      { taxNo: user.taxNo, deliveryCd }
    )

    if (matchRows.length === 0) {
      return reply.code(400).send({ message: '매칭된 판매처가 없습니다. KOBIC코드관리에서 등록하세요.' })
    }

    const metaxNo = matchRows[0].METAX_NO

    await withTransaction(async (conn) => {
      // KOBICMST METAX_NO 업데이트 + 오류 초기화
      await conn.execute(
        `UPDATE KOBICMST
            SET METAX_NO = :metaxNo, ERROR_YN = 'N', ERROR_TEXT = NULL,
                UPD_EMP = :empNo, UPD_DATE = TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS')
          WHERE TAX_NO = :taxNo AND OUTBOUND_DATE = :date
            AND OUT_NO = :outNo AND DELIVERY_CD = :deliveryCd
            AND NVL(MOVE_YN,'N') = 'N'`,
        { metaxNo, empNo: user.empNo, taxNo: user.taxNo, date, outNo, deliveryCd }
      )

      // KOBICDTL 공급률 재계산 (BK_CD 있는 것만)
      await conn.execute(
        `UPDATE KOBICDTL
            SET DISCOUNT = F_MERATE(:taxNo, BK_CD, :metaxNo, (
                  SELECT ME_GB FROM KOBICMST
                  WHERE TAX_NO = :taxNo AND OUTBOUND_DATE = :date
                    AND OUT_NO = :outNo AND DELIVERY_CD = :deliveryCd
                )),
                UPD_EMP = :empNo, UPD_DATE = TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS')
          WHERE TAX_NO = :taxNo AND OUTBOUND_DATE = :date
            AND OUT_NO = :outNo AND DELIVERY_CD = :deliveryCd
            AND BK_CD IS NOT NULL AND NVL(MOVE_YN,'N') = 'N'`,
        { taxNo: user.taxNo, metaxNo, date, outNo, deliveryCd, empNo: user.empNo }
      )
    })

    return { ok: true, message: '재매칭 완료' }
  })

  // ────────────────────────────────────────────────────────────
  // DELETE /kobicmst  — 조건부 일괄 삭제
  // Body: { d1, d2, metaxNo }
  // ────────────────────────────────────────────────────────────
  fastify.delete<{
    Body: { d1: string; d2: string; metaxNo?: string }
  }>('/kobicmst', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as JwtUser
    const { d1, d2, metaxNo } = request.body
    const date1 = d1.replace(/-/g, '')
    const date2 = d2.replace(/-/g, '')

    const binds: Record<string, unknown> = { taxNo: user.taxNo, date1, date2 }
    let whereMetax = `AND NVL(METAX_NO,'!') LIKE :metaxPat`
    binds.metaxPat = metaxNo ? metaxNo + '%' : '%'

    await withTransaction(async (conn) => {
      await conn.execute(
        `DELETE FROM KOBICDTL
          WHERE TAX_NO = :taxNo AND OUTBOUND_DATE BETWEEN :date1 AND :date2
            AND NVL(MOVE_YN,'N') = 'N'
            AND (OUTBOUND_DATE, OUT_NO, DELIVERY_CD) IN (
              SELECT OUTBOUND_DATE, OUT_NO, DELIVERY_CD FROM KOBICMST
               WHERE TAX_NO = :taxNo AND OUTBOUND_DATE BETWEEN :date1 AND :date2
                 AND NVL(MOVE_YN,'N') = 'N' ${whereMetax}
            )`,
        binds
      )
      await conn.execute(
        `DELETE FROM KOBICMST
          WHERE TAX_NO = :taxNo AND OUTBOUND_DATE BETWEEN :date1 AND :date2
            AND NVL(MOVE_YN,'N') = 'N' ${whereMetax}`,
        binds
      )
    })

    return { ok: true }
  })

  // ────────────────────────────────────────────────────────────
  // DELETE /kobicmst/:date/:outNo/:deliveryCd  — 단건 마스터 삭제
  // ────────────────────────────────────────────────────────────
  fastify.delete<{
    Params: { date: string; outNo: string; deliveryCd: string }
  }>('/kobicmst/:date/:outNo/:deliveryCd', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as JwtUser
    const { date, outNo, deliveryCd } = request.params

    const mst = await queryOne<{ MOVE_YN: string }>(
      `SELECT NVL(MOVE_YN,'N') MOVE_YN FROM KOBICMST
        WHERE TAX_NO = :taxNo AND OUTBOUND_DATE = :date
          AND OUT_NO = :outNo AND DELIVERY_CD = :deliveryCd`,
      { taxNo: user.taxNo, date, outNo, deliveryCd }
    )
    if (!mst) return reply.code(404).send({ message: '해당 레코드가 없습니다.' })
    if (mst.MOVE_YN === 'Y') return reply.code(400).send({ message: '이미 전송된 주문은 삭제할 수 없습니다.' })

    await withTransaction(async (conn) => {
      await conn.execute(
        `DELETE FROM KOBICDTL
          WHERE TAX_NO = :taxNo AND OUTBOUND_DATE = :date
            AND OUT_NO = :outNo AND DELIVERY_CD = :deliveryCd`,
        { taxNo: user.taxNo, date, outNo, deliveryCd }
      )
      await conn.execute(
        `DELETE FROM KOBICMST
          WHERE TAX_NO = :taxNo AND OUTBOUND_DATE = :date
            AND OUT_NO = :outNo AND DELIVERY_CD = :deliveryCd`,
        { taxNo: user.taxNo, date, outNo, deliveryCd }
      )
    })

    return { ok: true }
  })

  // ────────────────────────────────────────────────────────────
  // DELETE /kobicmst/:date/:outNo/:deliveryCd/lines/:lineNo  — 단건 라인 삭제
  // ────────────────────────────────────────────────────────────
  fastify.delete<{
    Params: { date: string; outNo: string; deliveryCd: string; lineNo: string }
  }>('/kobicmst/:date/:outNo/:deliveryCd/lines/:lineNo', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as JwtUser
    const { date, outNo, deliveryCd, lineNo } = request.params

    const dtl = await queryOne<{ MOVE_YN: string }>(
      `SELECT NVL(MOVE_YN,'N') MOVE_YN FROM KOBICDTL
        WHERE TAX_NO = :taxNo AND OUTBOUND_DATE = :date
          AND OUT_NO = :outNo AND DELIVERY_CD = :deliveryCd AND LINE_NO = :lineNo`,
      { taxNo: user.taxNo, date, outNo, deliveryCd, lineNo }
    )
    if (!dtl) return reply.code(404).send({ message: '해당 라인이 없습니다.' })
    if (dtl.MOVE_YN === 'Y') return reply.code(400).send({ message: '이미 전송된 라인은 삭제할 수 없습니다.' })

    await withTransaction(async (conn) => {
      await conn.execute(
        `DELETE FROM KOBICDTL
          WHERE TAX_NO = :taxNo AND OUTBOUND_DATE = :date
            AND OUT_NO = :outNo AND DELIVERY_CD = :deliveryCd AND LINE_NO = :lineNo`,
        { taxNo: user.taxNo, date, outNo, deliveryCd, lineNo }
      )
    })

    return { ok: true }
  })

  // ────────────────────────────────────────────────────────────
  // GET /kobic-match  — KOBIC_MATCH 목록
  // Querystring: storeCd, metaxNo
  // ────────────────────────────────────────────────────────────
  fastify.get<{
    Querystring: { storeCd?: string; metaxNo?: string }
  }>('/kobic-match', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user as JwtUser
    const { storeCd, metaxNo } = request.query

    let where = ''
    const binds: Record<string, unknown> = { taxNo: user.taxNo }

    if (storeCd) { where += ` AND A.STORE_CD LIKE '%' || :storeCd || '%'`; binds.storeCd = storeCd }
    if (metaxNo) { where += ` AND A.METAX_NO LIKE '%' || :metaxNo || '%'`; binds.metaxNo = metaxNo }

    return query(
      `SELECT ROW_NUMBER() OVER (ORDER BY A.STORE_CD) SEQ,
              A.STORE_CD, A.METAX_NO,
              F_CUSTME(A.METAX_NO) MECUST_NM,
              A.UPD_EMP, A.UPD_DATE
         FROM KOBIC_MATCH A
        WHERE A.TAX_NO = :taxNo ${where}
        ORDER BY A.STORE_CD`,
      binds
    )
  })

  // ────────────────────────────────────────────────────────────
  // POST /kobic-match  — KOBIC_MATCH 등록
  // ────────────────────────────────────────────────────────────
  fastify.post<{
    Body: { storeCd: string; metaxNo: string }
  }>('/kobic-match', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as JwtUser
    const { storeCd, metaxNo } = request.body

    if (!storeCd || !metaxNo) return reply.code(400).send({ message: 'KOBIC코드와 판매처는 필수입니다.' })

    const dup = await queryOne<{ CNT: number }>(
      `SELECT COUNT(*) CNT FROM KOBIC_MATCH
        WHERE TAX_NO = :taxNo AND STORE_CD = :storeCd`,
      { taxNo: user.taxNo, storeCd }
    )
    if ((dup?.CNT ?? 0) > 0) return reply.code(409).send({ message: '이미 등록된 KOBIC코드입니다.' })

    await withTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO KOBIC_MATCH (TAX_NO, STORE_CD, METAX_NO, UPD_EMP, UPD_DATE)
         VALUES (:taxNo, :storeCd, :metaxNo, :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'))`,
        { taxNo: user.taxNo, storeCd, metaxNo, empNo: user.empNo }
      )
    })

    return { ok: true }
  })

  // ────────────────────────────────────────────────────────────
  // PUT /kobic-match/:storeCd  — KOBIC_MATCH 수정
  // ────────────────────────────────────────────────────────────
  fastify.put<{
    Params: { storeCd: string }
    Body: { metaxNo: string; newStoreCd?: string }
  }>('/kobic-match/:storeCd', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as JwtUser
    const oldStoreCd = request.params.storeCd
    const { metaxNo, newStoreCd } = request.body

    if (!metaxNo) return reply.code(400).send({ message: '판매처는 필수입니다.' })

    await withTransaction(async (conn) => {
      if (newStoreCd && newStoreCd !== oldStoreCd) {
        // STORE_CD 변경 시: 기존 삭제 후 신규 등록
        await conn.execute(
          `DELETE FROM KOBIC_MATCH WHERE TAX_NO = :taxNo AND STORE_CD = :storeCd`,
          { taxNo: user.taxNo, storeCd: oldStoreCd }
        )
        await conn.execute(
          `INSERT INTO KOBIC_MATCH (TAX_NO, STORE_CD, METAX_NO, UPD_EMP, UPD_DATE)
           VALUES (:taxNo, :storeCd, :metaxNo, :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'))`,
          { taxNo: user.taxNo, storeCd: newStoreCd, metaxNo, empNo: user.empNo }
        )
      } else {
        await conn.execute(
          `UPDATE KOBIC_MATCH
              SET METAX_NO = :metaxNo, UPD_EMP = :empNo,
                  UPD_DATE = TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS')
            WHERE TAX_NO = :taxNo AND STORE_CD = :storeCd`,
          { metaxNo, empNo: user.empNo, taxNo: user.taxNo, storeCd: oldStoreCd }
        )
      }
    })

    return { ok: true }
  })

  // ────────────────────────────────────────────────────────────
  // DELETE /kobic-match/:storeCd  — KOBIC_MATCH 삭제
  // ────────────────────────────────────────────────────────────
  fastify.delete<{
    Params: { storeCd: string }
  }>('/kobic-match/:storeCd', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as JwtUser
    const { storeCd } = request.params

    const row = await queryOne<{ CNT: number }>(
      `SELECT COUNT(*) CNT FROM KOBIC_MATCH WHERE TAX_NO = :taxNo AND STORE_CD = :storeCd`,
      { taxNo: user.taxNo, storeCd }
    )
    if ((row?.CNT ?? 0) === 0) return reply.code(404).send({ message: '해당 코드가 없습니다.' })

    await withTransaction(async (conn) => {
      await conn.execute(
        `DELETE FROM KOBIC_MATCH WHERE TAX_NO = :taxNo AND STORE_CD = :storeCd`,
        { taxNo: user.taxNo, storeCd }
      )
    })

    return { ok: true }
  })
}

export default p115Routes
