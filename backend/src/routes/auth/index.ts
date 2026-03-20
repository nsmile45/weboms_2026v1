import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { queryOne, query } from '../../db.js'

const loginSchema = z.object({
  taxNo: z.string().min(1),
  salesNo: z.string().optional().default(''),
  password: z.string().min(1),
})

interface CustcdRow {
  TAX_NO: string
  CUST_NM: string
  END_YN2: string
  SPOOR_YN: string
}

interface SalesmRow {
  TAX_NO: string
  CUST_NM: string
  SALES_NO: string
  SALES_NM: string
  END_YN2: string
  SPOOR_YN: string
}

interface GncodeRow {
  FLD_NAME: string
}

interface CustcdFlagRow {
  DOME_YN: string
  JGCHG_YN: string
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/auth/login
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ message: '입력값을 확인해주세요.' })
    }

    const { taxNo, salesNo, password } = body.data

    let taxNoResult: string
    let custNm: string
    let salesNoResult: string
    let salesNm: string

    if (salesNo !== '') {
      // 영업사원 로그인
      const rows = await query<SalesmRow>(
        `SELECT A.TAX_NO, A.CUST_NM, B.SALES_NO, B.SNAME SALES_NM,
                NVL(A.END_YN2,'N') END_YN2, NVL(A.SPOOR_YN,'N') SPOOR_YN
         FROM CUSTCD A, SALESM B
         WHERE A.TAX_NO = B.TAX_NO
           AND A.TAX_NO = :taxNo
           AND B.SALES_NO = :salesNo
           AND B.PASSWD = :password`,
        { taxNo, salesNo, password }
      )
      if (rows.length !== 1) {
        return reply.status(401).send({ message: '로그인 ID 또는 PW를 확인하세요!' })
      }
      const row = rows[0]
      taxNoResult = row.TAX_NO
      custNm = row.CUST_NM
      salesNoResult = row.SALES_NO
      salesNm = row.SALES_NM
    } else {
      // 고객사 직접 로그인
      const rows = await query<CustcdRow>(
        `SELECT TAX_NO, CUST_NM, NVL(END_YN2,'N') END_YN2, NVL(SPOOR_YN,'N') SPOOR_YN
         FROM CUSTCD
         WHERE TAX_NO = :taxNo
           AND PASSWD = :password`,
        { taxNo, password }
      )
      if (rows.length !== 1) {
        return reply.status(401).send({ message: '로그인 ID 또는 PW를 확인하세요!' })
      }
      const row = rows[0]
      taxNoResult = row.TAX_NO
      custNm = row.CUST_NM
      salesNoResult = ''
      salesNm = ''
    }

    // GNCODE 조회
    const getGncode = async (fldId: string, fallback: string) => {
      const rows = await query<GncodeRow>(
        `SELECT FLD_NAME FROM GNCODE WHERE FLD_ID = :fldId AND FLD_CODE IS NOT NULL`,
        { fldId }
      )
      return rows[0]?.FLD_NAME || fallback
    }

    const [plocCd, rlocCd, jlocCd] = await Promise.all([
      getGncode('ploc_cd', 'Z000000'),
      getGncode('rloc_cd', 'R000000'),
      getGncode('jloc_cd', 'P000000'),
    ])

    // CUSTCD 플래그 조회
    const flagRows = await query<CustcdFlagRow>(
      `SELECT NVL(DOME_YN,'N') DOME_YN, NVL(JGCHG_YN,'N') JGCHG_YN
       FROM CUSTCD WHERE TAX_NO = :taxNo`,
      { taxNo: taxNoResult }
    )
    const domeYn = flagRows[0]?.DOME_YN ?? 'N'
    const jgchgYn = flagRows[0]?.JGCHG_YN ?? 'N'

    // MYINFO 조회 (SUBLSEQ_DIV: Y=날짜별순번, N=Oracle시퀀스)
    const myinfoRow = await queryOne<{ SUBLSEQ_DIV: string }>(
      `SELECT NVL(SUBLSEQ_DIV,'N') SUBLSEQ_DIV FROM MYINFO`
    )
    const sublseqDiv = myinfoRow?.SUBLSEQ_DIV ?? 'N'

    const empNo = salesNoResult !== '' ? `S${salesNoResult}` : `P${taxNoResult}`

    const token = fastify.jwt.sign({
      taxNo: taxNoResult,
      custNm,
      salesNo: salesNoResult,
      salesNm,
      empNo,
      plocCd,
      rlocCd,
      jlocCd,
      domeYn,
      jgchgYn,
      sublseqDiv,
    })

    return reply.send({
      token,
      user: {
        taxNo: taxNoResult,
        custNm,
        salesNo: salesNoResult,
        salesNm,
        empNo,
        plocCd,
        rlocCd,
        jlocCd,
        domeYn,
        jgchgYn,
        sublseqDiv,
      },
    })
  })

  // GET /api/auth/me
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request) => {
    return { user: request.user }
  })

  // POST /api/auth/logout
  fastify.post('/logout', async (_request, reply) => {
    return reply.send({ message: '로그아웃 되었습니다.' })
  })
}

export default authRoutes
