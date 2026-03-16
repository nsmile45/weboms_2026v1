import type { FastifyPluginAsync } from 'fastify'
import { query, queryOne, withTransaction } from '../../db.js'

interface JwtUser {
  taxNo: string
  empNo: string
  salesNo: string
}

const p121Routes: FastifyPluginAsync = async (fastify) => {
  // ──────────────────────────────────────────────────────────
  // GET /codes  — GNCODE 코드 목록
  // ──────────────────────────────────────────────────────────
  fastify.get('/codes', { preHandler: [fastify.authenticate] }, async () => {
    const loadCodes = (fldId: string, extraWhere = '') =>
      query<{ VALUE: string; NAME: string }>(
        `SELECT FLD_CODE VALUE, FLD_NAME NAME
           FROM GNCODE
          WHERE FLD_ID = :fldId ${extraWhere}
          ORDER BY FLD_CODE`,
        { fldId }
      )

    const [sublGb, meGb, besongGb, besongCd, chkGb] = await Promise.all([
      loadCodes('subl_gb', "AND FLD_CODE LIKE '5%'"),
      loadCodes('me_gb'),
      loadCodes('besong_gb'),
      loadCodes('besong_cd'),
      loadCodes('chk_gb'),
    ])

    return { sublGb, meGb, besongGb, besongCd, chkGb }
  })

  // ──────────────────────────────────────────────────────────
  // GET /custme?q=  — 서점 검색
  // ──────────────────────────────────────────────────────────
  fastify.get<{ Querystring: { q?: string } }>(
    '/custme',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = request.user as JwtUser
      const q = request.query.q ?? ''

      const rows = await query<{
        METAX_NO: string
        MECUST_NM: string
        BESONG_GB: string
        BESONG_CD: string
        PM_REMK: string
        AREA_GB: string
        CHUL_BLOCK_YN: string
        CHUL_BLOCK_YN_CUSTME: string
        USE_YN: string
        TEL_NO: string
        HAND_NO: string
        ADDR1: string
        ADDR2: string
        MAIL_NO: string
      }>(
        `SELECT A.METAX_NO,
                NVL(B.MECUST_NM,'') MECUST_NM,
                NVL(B.BESONG_GB,'') BESONG_GB, NVL(B.BESONG_CD,'') BESONG_CD,
                NVL(A.PM_REMK,'') PM_REMK, NVL(B.AREA_GB,'') AREA_GB,
                NVL(A.CHUL_BLOCK_YN,'N') CHUL_BLOCK_YN,
                NVL(B.CHUL_BLOCK_YN,'N') CHUL_BLOCK_YN_CUSTME,
                NVL(A.USE_YN,'Y') USE_YN,
                NVL(B.TEL_NO,'') TEL_NO, NVL(B.HAND_NO,'') HAND_NO,
                NVL(B.ADDR1,'') ADDR1, NVL(B.ADDR2,'') ADDR2, NVL(B.MAIL_NO,'') MAIL_NO
           FROM CUSTCL A, CUSTME B
          WHERE A.METAX_NO = B.METAX_NO
            AND A.TAX_NO = :taxNo
            AND (B.MECUST_NM LIKE '%' || :q || '%' OR A.METAX_NO LIKE '%' || :q || '%')
          ORDER BY B.MECUST_NM`,
        { taxNo: user.taxNo, q }
      )
      return rows
    }
  )

  // ──────────────────────────────────────────────────────────
  // GET /custme/:metaxNo/misu  — 미수금 조회
  // ──────────────────────────────────────────────────────────
  fastify.get<{ Params: { metaxNo: string } }>(
    '/custme/:metaxNo/misu',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = request.user as JwtUser
      const { metaxNo } = request.params
      const row = await queryOne<{ MISU_AMT: number }>(
        `SELECT F_IWMISU_PUB(TO_CHAR(SYSDATE,'YYYYMMDD'), :taxNo, :metaxNo) MISU_AMT FROM DUAL`,
        { taxNo: user.taxNo, metaxNo }
      )
      return { misuAmt: row?.MISU_AMT ?? 0 }
    }
  )

  // ──────────────────────────────────────────────────────────
  // GET /books?q=&metaxNo=&meGb=  — 도서 검색
  // ──────────────────────────────────────────────────────────
  fastify.get<{ Querystring: { q?: string; metaxNo?: string; meGb?: string } }>(
    '/books',
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const user = request.user as JwtUser
      const { q = '', metaxNo = '', meGb = '' } = request.query

      const rows = await query<{
        BK_CD: string
        TAX_NO: string
        BK_NM: string
        BAR_CD: string
        WRITER: string
        CUSTBK_CD: string
        OUT_DANGA: number
        BK_QTY10: number
        BK_QTY20: number
        JG_QTY: number
        MEDG_QTY: number
        AVG_QTY: number
        USE_YN: string
        OUT_RATE: number
      }>(
        `SELECT A.BK_CD, A.TAX_NO, A.SUBJECT BK_NM, NVL(A.BAR_CD,'') BAR_CD,
                NVL(A.WRITER,'') WRITER, NVL(A.CUSTBK_CD,'') CUSTBK_CD,
                NVL(A.OUT_DANGA,0) OUT_DANGA,
                NVL(A.BK_QTY10,0) BK_QTY10, NVL(A.BK_QTY20,0) BK_QTY20,
                NVL(A.BK_QTY10,0) - NVL(A.MEDG_QTY,0) JG_QTY,
                NVL(A.MEDG_QTY,0) MEDG_QTY, NVL(A.AVG_QTY,0) AVG_QTY,
                NVL(A.USE_YN,'N') USE_YN,
                NVL(F_MERATE(:taxNo, A.BK_CD, :metaxNo, :meGb), 0) OUT_RATE
           FROM BOOKCD A
          WHERE A.TAX_NO = :taxNo
            AND (UPPER(REPLACE(A.SUBJECT,' ','')) LIKE '%' || UPPER(REPLACE(:q,' ','')) || '%'
              OR A.BAR_CD LIKE '%' || :q || '%'
              OR A.BK_CD LIKE '%' || :q || '%')
          ORDER BY A.BK_CD`,
        { taxNo: user.taxNo, metaxNo, meGb, q }
      )
      return rows
    }
  )

  // ──────────────────────────────────────────────────────────
  // GET /orders  — 주문 목록 조회
  // ──────────────────────────────────────────────────────────
  fastify.get<{
    Querystring: {
      d1?: string
      d2?: string
      metaxNo?: string
      sublGb?: string
      besongGb?: string
      sendYn?: string
    }
  }>('/orders', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user as JwtUser
    const { d1, d2, metaxNo = '', sublGb = '', besongGb = '', sendYn = '' } = request.query

    const today = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const todayStr = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`
    const date1 = d1 ?? todayStr
    const date2 = d2 ?? todayStr

    let sql = `
      SELECT SUBL_DATE, SUBL_NO, TAX_NO, NVL(SUBL_GB,'') SUBL_GB,
             NVL(ME_GB,'') ME_GB, NVL(BESONG_GB,'') BESONG_GB,
             METAX_NO, F_CUSTME(METAX_NO) MECUST_NM,
             NVL(OD_QTY,0) OD_QTY, NVL(OD_AMT,0) OD_AMT,
             NVL(JU_QTY,0) JU_QTY, NVL(JU_AMT,0) JU_AMT,
             NVL(B_QTY,0) B_QTY, NVL(B_AMT,0) B_AMT,
             DECODE(NVL(DEL_YN,'N'),'Y','9', NVL(CHK_GB, '')) CHK_GB,
             NVL(JG_GB,'') JG_GB,
             SUBSTRB(UPD_DATE,9,2)||':'||SUBSTRB(UPD_DATE,11,2) UPD_TIME,
             ORDER_NO, NVL(PM_REMK,'') PM_REMK,
             NVL(MECUST_NM2,'') MECUST_NM2, NVL(PM_REMK2,'') PM_REMK2,
             NVL(ADDR1,'')||NVL(ADDR2,'') ADDR, NVL(TEL_NO,'') TEL_NO
        FROM CHULMT A
       WHERE SUBL_DATE BETWEEN :d1 AND :d2
         AND TAX_NO = :taxNo
         AND JG_GB != '00'
         AND NVL(DEL_YN,'N') != 'Y'`

    const binds: Record<string, unknown> = { d1: date1, d2: date2, taxNo: user.taxNo }

    if (metaxNo) { sql += ` AND METAX_NO = :metaxNo`; binds.metaxNo = metaxNo }
    if (sublGb)  { sql += ` AND SUBL_GB = :sublGb`;  binds.sublGb = sublGb }
    if (besongGb){ sql += ` AND BESONG_GB = :besongGb`; binds.besongGb = besongGb }
    if (sendYn === 'Y') { sql += ` AND CHK_GB IS NOT NULL` }
    else if (sendYn === 'N') { sql += ` AND CHK_GB IS NULL AND NVL(DEL_YN,'N') != 'Y'` }

    sql += ` ORDER BY ORDER_NO DESC`
    return await query(sql, binds)
  })

  // ──────────────────────────────────────────────────────────
  // GET /orders/:sublDate/:sublNo  — 주문 상세 조회
  // ──────────────────────────────────────────────────────────
  fastify.get<{ Params: { sublDate: string; sublNo: string } }>(
    '/orders/:sublDate/:sublNo',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as JwtUser
      const { sublDate, sublNo } = request.params

      const master = await queryOne<Record<string, unknown>>(
        `SELECT SUBL_DATE, NVL(SUBL_GB,'') SUBL_GB, JG_GB, SUBL_NO,
                METAX_NO, F_CUSTME(METAX_NO) MECUST_NM,
                NVL(AREA_GB,'') AREA_GB, NVL(ME_GB,'') ME_GB,
                NVL(BESONG_GB,'') BESONG_GB, NVL(BESONG_CD,'') BESONG_CD,
                NVL(PM_REMK,'') PM_REMK, NVL(EX_GB2,'N') EX_GB2,
                NVL(MECUST_NM2,'') BESONG_NAME, NVL(TEL_NO,'') TEL_NO,
                NVL(TEL_NO2,'') HAND_NO, NVL(ZIP_NO,'') ZIP_NO,
                NVL(ADDR1,'') ADDR1, NVL(ADDR2,'') ADDR2,
                NVL(PM_REMK2,'') PM_REMK2, NVL(DEL_YN,'N') DEL_YN,
                NVL(CHK_GB,'') CHK_GB, NVL(MIS_DESC,'') MIS_DESC, ORDER_NO,
                F_IWMISU_PUB(TO_CHAR(SYSDATE,'YYYYMMDD'), TAX_NO, METAX_NO) MISU_AMT,
                (SELECT NVL(PM_REMK,'') FROM CUSTCL
                  WHERE TAX_NO = A.TAX_NO AND METAX_NO = A.METAX_NO) CUST_PM_REMK
           FROM CHULMT A
          WHERE SUBL_DATE = :sublDate
            AND TAX_NO = :taxNo
            AND SUBL_NO = :sublNo
            AND JG_GB = '10'`,
        { sublDate, taxNo: user.taxNo, sublNo }
      )

      if (!master) return reply.status(404).send({ message: '전표를 찾을 수 없습니다.' })

      const chkGb = String(master.CHK_GB ?? '')

      const lines = await query(
        `SELECT A.SUBL_SEQ,
                A.BK_CD, B.SUBJECT BK_NM, NVL(B.BAR_CD,'') BAR_CD,
                NVL(B.WRITER,'') WRITER, NVL(A.OUT_DANGA,0) OUT_DANGA,
                A.OUT_RATE, NVL(A.PUB_REMK,'') PUB_REMK,
                NVL(B.BK_QTY10,0) BK_QTY10, NVL(B.BK_QTY20,0) BK_QTY20,
                NVL(B.BK_QTY10,0) - NVL(B.MEDG_QTY,0) JG_QTY,
                NVL(B.AVG_QTY,0) AVG_QTY, NVL(B.CUSTBK_CD,'') CUSTBK_CD,
                NVL(B.MEDG_QTY,0) MEDG_QTY,
                CASE WHEN :chkGb >= '1' THEN NVL(A.JU_QTY,0) ELSE NVL(A.OD_QTY,0) END OD_QTY,
                CASE WHEN :chkGb >= '1' THEN NVL(A.JU_AMT,0) ELSE NVL(A.OD_AMT,0) END OD_AMT
           FROM BJUMUN A, BOOKCD B
          WHERE A.BK_CD = B.BK_CD
            AND A.TAX_NO = B.TAX_NO
            AND A.SUBL_DATE = :sublDate
            AND A.TAX_NO = :taxNo
            AND A.SUBL_NO = :sublNo
          ORDER BY A.SUBL_SEQ`,
        { chkGb, sublDate, taxNo: user.taxNo, sublNo }
      )

      return { master, lines }
    }
  )

  // ──────────────────────────────────────────────────────────
  // POST /orders  — 신규 주문 + 첫 번째 도서 라인 동시 생성
  // ──────────────────────────────────────────────────────────
  fastify.post<{ Body: Record<string, unknown> }>(
    '/orders',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as JwtUser
      const b = request.body as any

      const sublDate: string = b.sublDate
      const metaxNo: string = b.metaxNo
      const besongGb: string = b.besongGb ?? ''
      const besongCd: string = b.besongCd ?? ''
      const sublGb: string = b.sublGb ?? '51'
      const meGb: string = b.meGb ?? '01'
      const exGb2: string = b.exGb2 ?? 'N'
      const areaGb: string = b.areaGb ?? ''
      const pmRemk: string = b.pmRemk ?? ''
      const pmRemk2: string = b.pmRemk2 ?? ''
      const besongName: string = b.besongName ?? ''
      const telNo: string = b.telNo ?? ''
      const handNo: string = b.handNo ?? ''
      const zipNo: string = b.zipNo ?? ''
      const addr1: string = b.addr1 ?? ''
      const addr2: string = b.addr2 ?? ''
      const mecustNm: string = b.mecustNm ?? ''
      // first line
      const bkCd: string = b.bkCd
      const outDanga: number = Number(b.outDanga) || 0
      const outRate: number = Number(b.outRate) || 0
      const odQty: number = Number(b.odQty) || 1
      const odAmt: number = Number(b.odAmt) || 0
      const pubRemk: string = b.pubRemk ?? ''

      if (!sublDate || !metaxNo || !bkCd) {
        return reply.status(400).send({ message: '필수값 누락 (sublDate, metaxNo, bkCd)' })
      }

      let sublNo: number
      let sublSeq = 1

      await withTransaction(async (conn: any) => {
        // SUBL_NO 생성 (MAX+1 방식)
        const seqRow = await conn.execute<any>(
          `SELECT NVL(MAX(SUBL_NO),0)+1 SUBL_NO FROM CHULMT
            WHERE SUBL_DATE = :sublDate AND TAX_NO = :taxNo AND SUBL_NO < 5000`,
          { sublDate, taxNo: user.taxNo },
          { outFormat: 3 }
        )
        sublNo = (seqRow.rows?.[0] as any)?.SUBL_NO ?? 1

        const zipDiv = zipNo ? '1' : ''
        const finalBesongName = besongName || mecustNm

        // CHULMT INSERT
        await conn.execute(
          `INSERT INTO CHULMT (
             SUBL_DATE, TAX_NO, SUBL_NO, INS_GB, ORDER_NO, AREA_GB,
             SUBL_GB, EX_GB2, ZIP_NO, ZIP_DIV,
             ME_GB, BESONG_GB, BESONG_CD, METAX_NO, JPTAX_NO, CHK_GB, JG_GB,
             TEL_NO, TEL_NO2, PM_REMK2, ADDR1, ADDR2, MECUST_NM2,
             PM_REMK, B_QTY, B_AMT,
             INS_EMP, INS_DATE, UPD_EMP, UPD_DATE, UPD_IP
           ) VALUES (
             :sublDate, :taxNo, :sublNo, '22', :sublNo, :areaGb,
             :sublGb, :exGb2, :zipNo, :zipDiv,
             :meGb, :besongGb, :besongCd, :metaxNo,
             (SELECT NVL(JPTAX_NO,'') FROM CUSTCL WHERE METAX_NO = :metaxNo AND TAX_NO = :taxNo),
             '', '10',
             :telNo, :handNo, :pmRemk2, :addr1, :addr2, :besongName,
             :pmRemk, 0, 0,
             :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'),
             :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'), 'W'
           )`,
          {
            sublDate, taxNo: user.taxNo, sublNo, areaGb,
            sublGb, exGb2, zipNo, zipDiv,
            meGb, besongGb, besongCd, metaxNo,
            telNo, handNo, pmRemk2, addr1, addr2, besongName: finalBesongName,
            pmRemk, empNo: user.empNo,
          }
        )

        // BJUMUN INSERT
        await conn.execute(
          `INSERT INTO BJUMUN (
             SUBL_DATE, TAX_NO, SUBL_NO, SUBL_SEQ, ORDER_NO, ORDER_SEQ,
             METAX_NO, JG_GB,
             BK_CD, OUT_RATE, OD_QTY, OD_AMT, JU_QTY, JU_AMT, OUT_DANGA, PUB_REMK,
             INS_EMP, INS_DATE, UPD_EMP, UPD_DATE, UPD_IP
           ) VALUES (
             :sublDate, :taxNo, :sublNo, :sublSeq, :sublNo, :sublSeq,
             :metaxNo, '10',
             :bkCd, :outRate, :odQty, :odAmt, :odQty, :odAmt, :outDanga, :pubRemk,
             :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'),
             :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'), 'W'
           )`,
          {
            sublDate, taxNo: user.taxNo, sublNo, sublSeq,
            metaxNo, bkCd, outRate, odQty, odAmt, outDanga, pubRemk,
            empNo: user.empNo,
          }
        )
      })

      return { sublDate, sublNo, sublSeq }
    }
  )

  // ──────────────────────────────────────────────────────────
  // PUT /orders/:sublDate/:sublNo  — 마스터 수정
  // ──────────────────────────────────────────────────────────
  fastify.put<{ Params: { sublDate: string; sublNo: string }; Body: Record<string, unknown> }>(
    '/orders/:sublDate/:sublNo',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as JwtUser
      const { sublDate, sublNo } = request.params
      const b = request.body as any

      // 상태 체크
      const chkRow = await queryOne<{ CHK_GB: string }>(
        `SELECT NVL(CHK_GB,'') CHK_GB FROM CHULMT
          WHERE SUBL_DATE = :sublDate AND TAX_NO = :taxNo AND SUBL_NO = :sublNo`,
        { sublDate, taxNo: user.taxNo, sublNo }
      )
      if (!chkRow) return reply.status(404).send({ message: '전표 없음' })
      if (chkRow.CHK_GB !== '' && chkRow.CHK_GB !== '0') {
        return reply.status(400).send({ message: '미전송/주문등록 상태에서만 수정가능합니다.' })
      }

      const besongGb: string = b.besongGb ?? ''
      const zipDiv = (b.zipNo as string) ? '1' : ''
      const finalBesongName = (b.besongName as string) || (b.mecustNm as string) || ''

      await withTransaction(async (conn: any) => {
        await conn.execute(
          `UPDATE CHULMT SET
             SUBL_GB = :sublGb, ME_GB = :meGb,
             BESONG_GB = :besongGb, BESONG_CD = :besongCd,
             EX_GB2 = :exGb2, PM_REMK = :pmRemk,
             MECUST_NM2 = :besongName, TEL_NO = :telNo, TEL_NO2 = :handNo,
             ZIP_NO = :zipNo, ZIP_DIV = :zipDiv, ADDR1 = :addr1, ADDR2 = :addr2,
             PM_REMK2 = :pmRemk2,
             UPD_EMP = :empNo, UPD_DATE = TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'), UPD_IP = 'W'
           WHERE SUBL_DATE = :sublDate AND TAX_NO = :taxNo AND SUBL_NO = :sublNo`,
          {
            sublGb: b.sublGb ?? '', meGb: b.meGb ?? '',
            besongGb, besongCd: b.besongCd ?? '',
            exGb2: b.exGb2 ?? 'N', pmRemk: b.pmRemk ?? '',
            besongName: finalBesongName,
            telNo: b.telNo ?? '', handNo: b.handNo ?? '',
            zipNo: b.zipNo ?? '', zipDiv,
            addr1: b.addr1 ?? '', addr2: b.addr2 ?? '',
            pmRemk2: b.pmRemk2 ?? '',
            empNo: user.empNo, sublDate, taxNo: user.taxNo, sublNo,
          }
        )
      })

      return { ok: true }
    }
  )

  // ──────────────────────────────────────────────────────────
  // DELETE /orders/:sublDate/:sublNo  — 전표 삭제 (CHK_GB='' 시 물리삭제)
  // ──────────────────────────────────────────────────────────
  fastify.delete<{ Params: { sublDate: string; sublNo: string } }>(
    '/orders/:sublDate/:sublNo',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as JwtUser
      const { sublDate, sublNo } = request.params

      const chkRow = await queryOne<{ CHK_GB: string }>(
        `SELECT NVL(CHK_GB,'') CHK_GB FROM CHULMT
          WHERE SUBL_DATE = :sublDate AND TAX_NO = :taxNo AND SUBL_NO = :sublNo`,
        { sublDate, taxNo: user.taxNo, sublNo }
      )
      if (!chkRow) return reply.status(404).send({ message: '전표 없음' })

      const chkGb = chkRow.CHK_GB
      if (chkGb !== '' && chkGb !== '0') {
        return reply.status(400).send({ message: '미전송/주문등록 상태에서만 삭제가능합니다.' })
      }

      await withTransaction(async (conn: any) => {
        await conn.execute(
          `DELETE FROM BJUMUN WHERE SUBL_DATE = :sublDate AND TAX_NO = :taxNo AND SUBL_NO = :sublNo`,
          { sublDate, taxNo: user.taxNo, sublNo }
        )
        await conn.execute(
          `DELETE FROM CHULMT WHERE SUBL_DATE = :sublDate AND TAX_NO = :taxNo AND SUBL_NO = :sublNo`,
          { sublDate, taxNo: user.taxNo, sublNo }
        )
      })

      return { ok: true }
    }
  )

  // ──────────────────────────────────────────────────────────
  // POST /orders/:sublDate/:sublNo/lines  — 도서 라인 추가
  // ──────────────────────────────────────────────────────────
  fastify.post<{
    Params: { sublDate: string; sublNo: string }
    Body: Record<string, unknown>
  }>(
    '/orders/:sublDate/:sublNo/lines',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as JwtUser
      const { sublDate, sublNo } = request.params
      const b = request.body as any

      // 상태 체크
      const chkRow = await queryOne<{ CHK_GB: string; METAX_NO: string }>(
        `SELECT NVL(CHK_GB,'') CHK_GB, METAX_NO FROM CHULMT
          WHERE SUBL_DATE = :sublDate AND TAX_NO = :taxNo AND SUBL_NO = :sublNo`,
        { sublDate, taxNo: user.taxNo, sublNo }
      )
      if (!chkRow) return reply.status(404).send({ message: '전표 없음' })
      if (chkRow.CHK_GB !== '' && chkRow.CHK_GB !== '0') {
        return reply.status(400).send({ message: '도서 추가 불가 상태입니다.' })
      }

      // 다음 SUBL_SEQ
      const seqRow = await queryOne<{ SUBL_SEQ: number }>(
        `SELECT NVL(MAX(SUBL_SEQ),0)+1 SUBL_SEQ FROM BJUMUN
          WHERE SUBL_DATE = :sublDate AND TAX_NO = :taxNo AND SUBL_NO = :sublNo`,
        { sublDate, taxNo: user.taxNo, sublNo }
      )
      const sublSeq = seqRow?.SUBL_SEQ ?? 1

      const bkCd: string = b.bkCd
      const outDanga: number = Number(b.outDanga) || 0
      const outRate: number = Number(b.outRate) || 0
      const odQty: number = Number(b.odQty) || 1
      const odAmt: number = Number(b.odAmt) || 0
      const pubRemk: string = b.pubRemk ?? ''
      const metaxNo: string = chkRow.METAX_NO

      if (!bkCd) return reply.status(400).send({ message: 'bkCd 필수' })

      await withTransaction(async (conn: any) => {
        await conn.execute(
          `INSERT INTO BJUMUN (
             SUBL_DATE, TAX_NO, SUBL_NO, SUBL_SEQ, ORDER_NO, ORDER_SEQ,
             METAX_NO, JG_GB,
             BK_CD, OUT_RATE, OD_QTY, OD_AMT, JU_QTY, JU_AMT, OUT_DANGA, PUB_REMK,
             INS_EMP, INS_DATE, UPD_EMP, UPD_DATE, UPD_IP
           ) VALUES (
             :sublDate, :taxNo, :sublNo, :sublSeq, :sublNo, :sublSeq,
             :metaxNo, '10',
             :bkCd, :outRate, :odQty, :odAmt, :odQty, :odAmt, :outDanga, :pubRemk,
             :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'),
             :empNo, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'), 'W'
           )`,
          {
            sublDate, taxNo: user.taxNo, sublNo, sublSeq, metaxNo,
            bkCd, outRate, odQty, odAmt, outDanga, pubRemk, empNo: user.empNo,
          }
        )
      })

      return { sublSeq }
    }
  )

  // ──────────────────────────────────────────────────────────
  // PUT /orders/:sublDate/:sublNo/lines/:sublSeq  — 도서 라인 수정
  // ──────────────────────────────────────────────────────────
  fastify.put<{
    Params: { sublDate: string; sublNo: string; sublSeq: string }
    Body: Record<string, unknown>
  }>(
    '/orders/:sublDate/:sublNo/lines/:sublSeq',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as JwtUser
      const { sublDate, sublNo, sublSeq } = request.params
      const b = request.body as any

      const chkRow = await queryOne<{ CHK_GB: string }>(
        `SELECT NVL(CHK_GB,'') CHK_GB FROM CHULMT
          WHERE SUBL_DATE = :sublDate AND TAX_NO = :taxNo AND SUBL_NO = :sublNo`,
        { sublDate, taxNo: user.taxNo, sublNo }
      )
      if (!chkRow) return reply.status(404).send({ message: '전표 없음' })
      if (chkRow.CHK_GB !== '' && chkRow.CHK_GB !== '0') {
        return reply.status(400).send({ message: '수정 불가 상태입니다.' })
      }

      const outDanga: number = Number(b.outDanga) || 0
      const outRate: number = Number(b.outRate) || 0
      const odQty: number = Number(b.odQty) || 0
      const odAmt: number = Math.floor((outDanga * outRate) / 100) * odQty
      const pubRemk: string = b.pubRemk ?? ''

      await withTransaction(async (conn: any) => {
        await conn.execute(
          `UPDATE BJUMUN SET
             OUT_DANGA = :outDanga, OD_QTY = :odQty, OD_AMT = :odAmt,
             JU_QTY = :odQty, JU_AMT = :odAmt, OUT_RATE = :outRate, PUB_REMK = :pubRemk,
             UPD_EMP = :empNo, UPD_DATE = TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'), UPD_IP = 'W'
           WHERE SUBL_DATE = :sublDate AND TAX_NO = :taxNo
             AND SUBL_NO = :sublNo AND SUBL_SEQ = :sublSeq`,
          {
            outDanga, odQty, odAmt, outRate, pubRemk,
            empNo: user.empNo, sublDate, taxNo: user.taxNo, sublNo, sublSeq,
          }
        )
      })

      return { ok: true }
    }
  )

  // ──────────────────────────────────────────────────────────
  // DELETE /orders/:sublDate/:sublNo/lines/:sublSeq  — 도서 라인 삭제
  // ──────────────────────────────────────────────────────────
  fastify.delete<{ Params: { sublDate: string; sublNo: string; sublSeq: string } }>(
    '/orders/:sublDate/:sublNo/lines/:sublSeq',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user as JwtUser
      const { sublDate, sublNo, sublSeq } = request.params

      const chkRow = await queryOne<{ CHK_GB: string }>(
        `SELECT NVL(CHK_GB,'') CHK_GB FROM CHULMT
          WHERE SUBL_DATE = :sublDate AND TAX_NO = :taxNo AND SUBL_NO = :sublNo`,
        { sublDate, taxNo: user.taxNo, sublNo }
      )
      if (!chkRow) return reply.status(404).send({ message: '전표 없음' })
      if (chkRow.CHK_GB !== '' && chkRow.CHK_GB !== '0') {
        return reply.status(400).send({ message: '삭제 불가 상태입니다.' })
      }

      // 마지막 라인이면 CHULMT도 삭제
      const cntRow = await queryOne<{ CNT: number }>(
        `SELECT COUNT(*) CNT FROM BJUMUN
          WHERE SUBL_DATE = :sublDate AND TAX_NO = :taxNo AND SUBL_NO = :sublNo`,
        { sublDate, taxNo: user.taxNo, sublNo }
      )
      const lineCount = cntRow?.CNT ?? 0

      await withTransaction(async (conn: any) => {
        await conn.execute(
          `DELETE FROM BJUMUN WHERE SUBL_DATE = :sublDate AND TAX_NO = :taxNo
             AND SUBL_NO = :sublNo AND SUBL_SEQ = :sublSeq`,
          { sublDate, taxNo: user.taxNo, sublNo, sublSeq }
        )
        if (lineCount <= 1) {
          await conn.execute(
            `DELETE FROM CHULMT WHERE SUBL_DATE = :sublDate AND TAX_NO = :taxNo AND SUBL_NO = :sublNo`,
            { sublDate, taxNo: user.taxNo, sublNo }
          )
        }
      })

      return { ok: true, orderDeleted: lineCount <= 1 }
    }
  )
}

export default p121Routes
