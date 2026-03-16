import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { query, queryOne, execute } from '../../db.js'

interface BookRow {
  BAR_CD: string
  BK_CD: string
  BK_NM: string
  PUB_CD: string
  PUB_NM: string
  WRITER: string
  BK_PTNM: string
  OUT_DANGA: number
  PUB_REMK: string
  CUSTBK_CD: string
  NEW_DATE: string
  OUT_GB: string
  OUT_GBNM: string
  SR_CD: string
  SET_QTY: number
  UNIT_GB: string
  VAT_YN: string
  B_QTY: number
  A_QTY: number
  X_QTY: number
  MEIP_CD: string
  MEIP_NM: string
  IN_RATE: number
}

interface BookDetailRow {
  BAR_CD: string
  BK_CD: string
  BK_NM: string
  PUB_CD: string
  OUT_DANGA: number
  IPSU_QTY: number
  PUB_REMK: string
  CUSTBK_CD: string
  OUT_GB: string
  WRITER: string
  TRANSLATOR: string
  BK_PART: string
  SR_CD: string
  NEW_DATE: string
  PUB_DATE: string
  SET_QTY: number
  UNIT_GB: string
  SIZE_WIDTH: number
  SIZE_HEIGHT: number
  SIZE_THICK: number
  SIZE_WEIGHT: number
  PAN_QTY: number
  PRINTING: number
  SIZE_GB: string
  PAGE: number
  CHK_CD: string
  AVG_QTY: number
  USE_YN: string
  BAN_YN: string
  PARCEL_BOOK_YN: string
  INJI_YN: string
  BUROK_YN: string
  VAT_YN: string
  MEIP_CD: string
  MEIP_NM: string
  IN_RATE: number
  IN_DANGA: number
  CON_NO: string
  CON_NM: string
}

interface CustchRow {
  PUB_CD: string
  PUB_NM: string
}

interface BkpartRow {
  BK_PART: string
  BK_PTNM: string
}

interface PanhistRow {
  PAN_QTY: number
  PRINTING: number
  MAKE_QTY: number
  PAN_DATE: string | null
  PM_REMK: string
}

interface SetcodRow {
  BK_CD: string
  BK_NM: string
  BAR_CD: string
  OUT_DANGA: number
  ADD_QTY: number
}

const bookcdRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/p0/bookcd - 목록 조회
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const { taxNo } = request.user as { taxNo: string }
    const q = request.query as Record<string, string>

    const bkNm = q.bkNm?.trim() ?? ''
    const bkCd = q.bkCd?.trim() ?? ''
    const pubCd = q.pubCd?.trim() ?? ''
    const newDate1 = q.newDate1?.trim() ?? ''
    const newDate2 = q.newDate2?.trim() ?? ''
    const outGb = q.outGb?.trim() ?? ''

    let sql = `
      SELECT A.BAR_CD, A.BK_CD, A.BK_NM,
             A.PUB_CD, NVL(C.PUB_NM, A.PUB_CD) PUB_NM,
             A.WRITER,
             NVL(P.BK_PTNM, A.BK_PART) BK_PTNM,
             NVL(A.OUT_DANGA, 0) OUT_DANGA,
             A.PUB_REMK,
             NVL(A.CUSTBK_CD, '') CUSTBK_CD,
             CASE WHEN A.NEW_DATE IS NOT NULL AND A.NEW_DATE != '00000000' THEN TO_CHAR(TO_DATE(A.NEW_DATE,'YYYYMMDD'),'YYYY-MM-DD') ELSE NULL END NEW_DATE,
             NVL(A.OUT_GB, '00') OUT_GB,
             NVL(G.FLD_NAME, '정상') OUT_GBNM,
             NVL(A.SR_CD, '') SR_CD,
             NVL(A.SET_QTY, 0) SET_QTY,
             NVL(A.UNIT_GB, '1') UNIT_GB,
             NVL(A.VAT_YN, 'N') VAT_YN,
             NVL(B.B_QTY, 0) B_QTY,
             NVL(B.A_QTY, 0) A_QTY,
             NVL(B.X_QTY, 0) X_QTY,
             A.MEIP_CD,
             NVL(M.MEIP_NM, '') MEIP_NM,
             NVL(A.IN_RATE, 0) IN_RATE
      FROM BOOKCD A
      LEFT JOIN (
        SELECT TAX_NO, BK_CD,
               SUM(CASE WHEN JG_GB = '00' THEN PJG_QTY ELSE 0 END) B_QTY,
               SUM(CASE WHEN JG_GB = '10' THEN PJG_QTY ELSE 0 END) A_QTY,
               SUM(CASE WHEN JG_GB = '20' THEN PJG_QTY ELSE 0 END) X_QTY
        FROM BKSBJG
        WHERE TAX_NO = :taxNo
        GROUP BY TAX_NO, BK_CD
      ) B ON A.BK_CD = B.BK_CD
      LEFT JOIN CUSTCH C ON C.TAX_NO = :taxNo AND C.PUB_CD = A.PUB_CD
      LEFT JOIN BKPART P ON P.TAX_NO = :taxNo AND P.BK_PART = A.BK_PART
      LEFT JOIN GNCODE G ON G.FLD_ID = 'out_gb' AND G.FLD_CODE = A.OUT_GB
      LEFT JOIN MEIPCD M ON M.TAX_NO = :taxNo AND M.MEIP_CD = A.MEIP_CD
      WHERE A.TAX_NO = :taxNo
    `

    const binds: Record<string, string> = { taxNo }

    if (bkNm) {
      sql += ` AND UPPER(A.BK_NM) LIKE UPPER(:bkNm)`
      binds.bkNm = `%${bkNm}%`
    }
    if (bkCd) {
      sql += ` AND A.BK_CD = :bkCd`
      binds.bkCd = bkCd
    }
    if (pubCd) {
      sql += ` AND A.PUB_CD = :pubCd`
      binds.pubCd = pubCd
    }
    if (newDate1) {
      sql += ` AND A.NEW_DATE >= TO_CHAR(TO_DATE(:newDate1,'YYYY-MM-DD'),'YYYYMMDD')`
      binds.newDate1 = newDate1
    }
    if (newDate2) {
      sql += ` AND A.NEW_DATE <= TO_CHAR(TO_DATE(:newDate2,'YYYY-MM-DD'),'YYYYMMDD')`
      binds.newDate2 = newDate2
    }
    if (outGb) {
      sql += ` AND NVL(A.OUT_GB, '00') = :outGb`
      binds.outGb = outGb
    }

    sql += ` ORDER BY A.BK_CD`

    const rows = await query<BookRow>(sql, binds)
    return rows
  })

  // GET /api/p0/bookcd/:bkCd - 상세 조회
  fastify.get('/:bkCd', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { taxNo } = request.user as { taxNo: string }
    const { bkCd } = request.params as { bkCd: string }

    const row = await queryOne<BookDetailRow>(
      `SELECT BAR_CD, BK_CD, BK_NM, PUB_CD, NVL(OUT_DANGA,0) OUT_DANGA,
              NVL(IPSU_QTY,0) IPSU_QTY, PUB_REMK, CUSTBK_CD, NVL(OUT_GB,'00') OUT_GB,
              WRITER, TRANSLATOR, BK_PART, SR_CD,
              CASE WHEN NEW_DATE IS NOT NULL AND NEW_DATE != '00000000' THEN TO_CHAR(TO_DATE(NEW_DATE,'YYYYMMDD'),'YYYY-MM-DD') ELSE NULL END NEW_DATE,
              CASE WHEN PUB_DATE IS NOT NULL AND PUB_DATE != '00000000' THEN TO_CHAR(TO_DATE(PUB_DATE,'YYYYMMDD'),'YYYY-MM-DD') ELSE NULL END PUB_DATE,
              NVL(SET_QTY,0) SET_QTY, NVL(UNIT_GB,'1') UNIT_GB,
              NVL(SIZE_WIDTH,0) SIZE_WIDTH, NVL(SIZE_HEIGHT,0) SIZE_HEIGHT,
              NVL(SIZE_THICK,0) SIZE_THICK, NVL(SIZE_WEIGHT,0) SIZE_WEIGHT,
              NVL(PAN_QTY,0) PAN_QTY, NVL(PRINTING,0) PRINTING,
              NVL(SIZE_GB,'') SIZE_GB, NVL(PAGE,0) PAGE, NVL(CHK_CD,'') CHK_CD,
              NVL(AVG_QTY,0) AVG_QTY,
              NVL(USE_YN,'N') USE_YN, NVL(BAN_YN,'N') BAN_YN,
              NVL(PARCEL_BOOK_YN,'N') PARCEL_BOOK_YN, NVL(INJI_YN,'N') INJI_YN,
              NVL(BUROK_YN,'N') BUROK_YN, NVL(VAT_YN,'N') VAT_YN,
              MEIP_CD, NVL(IN_RATE,0) IN_RATE,
              ROUND(NVL(OUT_DANGA,0)*NVL(IN_RATE,0)*0.01) IN_DANGA,
              CON_NO,
              NVL((SELECT CON_NM FROM CONTRACT WHERE TAX_NO=:taxNo AND CON_NO=A.CON_NO),
                  (SELECT CON_NM FROM CONTRACT_ROYALTY WHERE TAX_NO=:taxNo AND CON_NO=A.CON_NO)) CON_NM
       FROM BOOKCD A
       WHERE BK_CD = :bkCd AND TAX_NO = :taxNo`,
      { taxNo, bkCd }
    )

    if (!row) return reply.status(404).send({ message: '도서를 찾을 수 없습니다.' })
    return row
  })

  // PUT /api/p0/bookcd/:bkCd - 수정
  const updateSchema = z.object({
    barCd: z.string().nullish(),
    bkNm: z.string().min(1, '도서명을 입력해주세요.'),
    pubCd: z.string().nullish(),
    outDanga: z.number().optional(),
    ipsuQty: z.number().optional(),
    pubRemk: z.string().nullish(),
    custbkCd: z.string().nullish(),
    outGb: z.string().nullish(),
    writer: z.string().nullish(),
    translator: z.string().nullish(),
    bkPart: z.string().nullish(),
    srCd: z.string().nullish(),
    newDate: z.string().nullish(),
    pubDate: z.string().nullish(),
    setQty: z.number().optional(),
    unitGb: z.string().nullish(),
    sizeWidth: z.number().optional(),
    sizeHeight: z.number().optional(),
    sizeThick: z.number().optional(),
    sizeWeight: z.number().optional(),
    panQty: z.number().optional(),
    printing: z.number().optional(),
    sizeGb: z.string().nullish(),
    page: z.number().optional(),
    chkCd: z.string().nullish(),
    avgQty: z.number().optional(),
    useYn: z.string().nullish(),
    banYn: z.string().nullish(),
    parcelBookYn: z.string().nullish(),
    injiYn: z.string().nullish(),
    burokYn: z.string().nullish(),
    vatYn: z.string().nullish(),
    meipCd: z.string().nullish(),
    inRate: z.number().optional(),
    conNo: z.string().nullish(),
  })

  fastify.put('/:bkCd', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { taxNo } = request.user as { taxNo: string }
    const { bkCd } = request.params as { bkCd: string }
    const body = updateSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ message: body.error.errors[0].message })
    }
    const d = body.data

    await execute(
      `UPDATE BOOKCD SET
         BK_NM       = :bkNm,
         BAR_CD      = :barCd,
         PUB_CD      = :pubCd,
         CUSTBK_CD   = :custbkCd,
         OUT_GB      = :outGb,
         WRITER      = :writer,
         TRANSLATOR  = :translator,
         BK_PART     = :bkPart,
         SR_CD       = :srCd,
         NEW_DATE    = CASE WHEN :newDate IS NULL OR :newDate = '' THEN NULL ELSE TO_CHAR(TO_DATE(:newDate,'YYYY-MM-DD'),'YYYYMMDD') END,
         PUB_DATE    = CASE WHEN :pubDate IS NULL OR :pubDate = '' THEN NULL ELSE TO_CHAR(TO_DATE(:pubDate,'YYYY-MM-DD'),'YYYYMMDD') END,
         OUT_DANGA   = :outDanga,
         IPSU_QTY    = :ipsuQty,
         SET_QTY     = :setQty,
         UNIT_GB     = :unitGb,
         SIZE_WIDTH  = :sizeWidth,
         SIZE_HEIGHT = :sizeHeight,
         SIZE_THICK  = :sizeThick,
         SIZE_WEIGHT = :sizeWeight,
         PAN_QTY     = :panQty,
         PRINTING    = :printing,
         SIZE_GB     = :sizeGb,
         PAGE        = :page,
         CHK_CD      = :chkCd,
         AVG_QTY     = :avgQty,
         USE_YN      = :useYn,
         BAN_YN      = :banYn,
         PARCEL_BOOK_YN = :parcelBookYn,
         INJI_YN     = :injiYn,
         BUROK_YN    = :burokYn,
         VAT_YN      = :vatYn,
         MEIP_CD     = :meipCd,
         IN_RATE     = :inRate,
         CON_NO      = :conNo,
         PUB_REMK    = :pubRemk
       WHERE BK_CD = :bkCd AND TAX_NO = :taxNo`,
      {
        bkNm: d.bkNm,
        barCd: d.barCd ?? '',
        pubCd: d.pubCd ?? '',
        custbkCd: d.custbkCd ?? '',
        outGb: d.outGb ?? '00',
        writer: d.writer ?? '',
        translator: d.translator ?? '',
        bkPart: d.bkPart ?? '',
        srCd: d.srCd ?? '',
        newDate: d.newDate ?? '',
        pubDate: d.pubDate ?? '',
        outDanga: d.outDanga ?? 0,
        ipsuQty: d.ipsuQty ?? 0,
        setQty: d.setQty ?? 0,
        unitGb: d.unitGb ?? '1',
        sizeWidth: d.sizeWidth ?? 0,
        sizeHeight: d.sizeHeight ?? 0,
        sizeThick: d.sizeThick ?? 0,
        sizeWeight: d.sizeWeight ?? 0,
        panQty: d.panQty ?? 0,
        printing: d.printing ?? 0,
        sizeGb: d.sizeGb ?? '',
        page: d.page ?? 0,
        chkCd: d.chkCd ?? '',
        avgQty: d.avgQty ?? 0,
        useYn: d.useYn ?? 'N',
        banYn: d.banYn ?? 'N',
        parcelBookYn: d.parcelBookYn ?? 'N',
        injiYn: d.injiYn ?? 'N',
        burokYn: d.burokYn ?? 'N',
        vatYn: d.vatYn ?? 'N',
        meipCd: d.meipCd ?? '',
        inRate: d.inRate ?? 0,
        conNo: d.conNo ?? '',
        pubRemk: d.pubRemk ?? '',
        bkCd,
        taxNo,
      }
    )
    return { message: '저장되었습니다.' }
  })

  // GET /api/p0/bookcd/meta/custch - 출판사 목록
  fastify.get('/meta/custch', { preHandler: [fastify.authenticate] }, async (request) => {
    const { taxNo } = request.user as { taxNo: string }
    return query<CustchRow>(
      `SELECT PUB_CD, PUB_NM FROM CUSTCH WHERE TAX_NO = :taxNo ORDER BY PUB_NM`,
      { taxNo }
    )
  })

  // GET /api/p0/bookcd/meta/bkpart - 도서분류 목록
  fastify.get('/meta/bkpart', { preHandler: [fastify.authenticate] }, async (request) => {
    const { taxNo } = request.user as { taxNo: string }
    return query<BkpartRow>(
      `SELECT BK_PART, BK_PTNM FROM BKPART WHERE TAX_NO = :taxNo ORDER BY BK_PART`,
      { taxNo }
    )
  })

  // ── 판쇄정보 ──────────────────────────────────────────────────

  // GET /api/p0/bookcd/:bkCd/panhist
  fastify.get('/:bkCd/panhist', { preHandler: [fastify.authenticate] }, async (request) => {
    const { taxNo } = request.user as { taxNo: string }
    const { bkCd } = request.params as { bkCd: string }
    return query<PanhistRow>(
      `SELECT NVL(PAN_QTY,0) PAN_QTY, NVL(PRINTING,0) PRINTING, NVL(MAKE_QTY,0) MAKE_QTY,
              CASE WHEN PAN_DATE IS NOT NULL AND PAN_DATE != '00000000'
                   THEN TO_CHAR(TO_DATE(PAN_DATE,'YYYYMMDD'),'YYYY-MM-DD') ELSE NULL END PAN_DATE,
              NVL(PM_REMK,'') PM_REMK
       FROM PANHIST WHERE BK_CD = :bkCd AND TAX_NO = :taxNo
       ORDER BY PAN_QTY, PRINTING`,
      { taxNo, bkCd }
    )
  })

  // POST /api/p0/bookcd/:bkCd/panhist
  const panhistSchema = z.object({
    panQty: z.number(),
    printing: z.number(),
    makeQty: z.number().optional(),
    panDate: z.string().nullish(),
    pmRemk: z.string().nullish(),
  })

  fastify.post('/:bkCd/panhist', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { taxNo } = request.user as { taxNo: string }
    const { bkCd } = request.params as { bkCd: string }
    const body = panhistSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ message: body.error.errors[0].message })
    const d = body.data
    await execute(
      `INSERT INTO PANHIST (BK_CD, TAX_NO, PAN_QTY, PRINTING, MAKE_QTY, PAN_DATE, PM_REMK, INS_DATE)
       VALUES (:bkCd, :taxNo, :panQty, :printing, :makeQty,
               CASE WHEN :panDate IS NULL OR :panDate = '' THEN NULL
                    ELSE TO_CHAR(TO_DATE(:panDate,'YYYY-MM-DD'),'YYYYMMDD') END,
               :pmRemk, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'))`,
      { bkCd, taxNo, panQty: d.panQty, printing: d.printing, makeQty: d.makeQty ?? 0,
        panDate: d.panDate ?? '', pmRemk: d.pmRemk ?? '' }
    )
    return { message: '등록되었습니다.' }
  })

  // DELETE /api/p0/bookcd/:bkCd/panhist
  fastify.delete('/:bkCd/panhist', { preHandler: [fastify.authenticate] }, async (request) => {
    const { taxNo } = request.user as { taxNo: string }
    const { bkCd } = request.params as { bkCd: string }
    const { panQty, printing } = request.query as { panQty: string; printing: string }
    await execute(
      `DELETE FROM PANHIST WHERE BK_CD = :bkCd AND TAX_NO = :taxNo AND PAN_QTY = :panQty AND PRINTING = :printing`,
      { bkCd, taxNo, panQty: Number(panQty), printing: Number(printing) }
    )
    return { message: '삭제되었습니다.' }
  })

  // ── 세트정보 ──────────────────────────────────────────────────

  // GET /api/p0/bookcd/:bkCd/setcod
  fastify.get('/:bkCd/setcod', { preHandler: [fastify.authenticate] }, async (request) => {
    const { taxNo } = request.user as { taxNo: string }
    const { bkCd } = request.params as { bkCd: string }
    return query<SetcodRow>(
      `SELECT A.BK_CD, NVL(B.BK_NM, A.BK_CD) BK_NM, NVL(B.BAR_CD,'') BAR_CD,
              NVL(B.OUT_DANGA,0) OUT_DANGA, NVL(A.ADD_QTY,1) ADD_QTY
       FROM SETCOD A
       LEFT JOIN BOOKCD B ON B.BK_CD = A.BK_CD AND B.TAX_NO = A.TAX_NO
       WHERE A.SET_CD = :bkCd AND A.TAX_NO = :taxNo
       ORDER BY A.BK_CD`,
      { taxNo, bkCd }
    )
  })

  // POST /api/p0/bookcd/:bkCd/setcod
  fastify.post('/:bkCd/setcod', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { taxNo } = request.user as { taxNo: string }
    const { bkCd } = request.params as { bkCd: string }
    const body = z.object({ addBkCd: z.string().min(1), addQty: z.number().default(1) }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ message: body.error.errors[0].message })
    const d = body.data
    await execute(
      `INSERT INTO SETCOD (SET_CD, TAX_NO, BK_CD, ADD_QTY, INS_DATE)
       VALUES (:bkCd, :taxNo, :addBkCd, :addQty, TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS'))`,
      { bkCd, taxNo, addBkCd: d.addBkCd, addQty: d.addQty }
    )
    return { message: '등록되었습니다.' }
  })

  // PUT /api/p0/bookcd/:bkCd/setcod/:itemBkCd
  fastify.put('/:bkCd/setcod/:itemBkCd', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { taxNo } = request.user as { taxNo: string }
    const { bkCd, itemBkCd } = request.params as { bkCd: string; itemBkCd: string }
    const body = z.object({ addQty: z.number() }).safeParse(request.body)
    if (!body.success) return reply.status(400).send({ message: body.error.errors[0].message })
    await execute(
      `UPDATE SETCOD SET ADD_QTY = :addQty, UPD_DATE = TO_CHAR(SYSDATE,'YYYYMMDDHH24MISS')
       WHERE SET_CD = :bkCd AND TAX_NO = :taxNo AND BK_CD = :itemBkCd`,
      { bkCd, taxNo, itemBkCd, addQty: body.data.addQty }
    )
    return { message: '수정되었습니다.' }
  })

  // DELETE /api/p0/bookcd/:bkCd/setcod/:itemBkCd
  fastify.delete('/:bkCd/setcod/:itemBkCd', { preHandler: [fastify.authenticate] }, async (request) => {
    const { taxNo } = request.user as { taxNo: string }
    const { bkCd, itemBkCd } = request.params as { bkCd: string; itemBkCd: string }
    await execute(
      `DELETE FROM SETCOD WHERE SET_CD = :bkCd AND TAX_NO = :taxNo AND BK_CD = :itemBkCd`,
      { bkCd, taxNo, itemBkCd }
    )
    return { message: '삭제되었습니다.' }
  })
}

export default bookcdRoutes
