import type { FastifyPluginAsync } from 'fastify'
import { query } from '../../db.js'

interface TopMenuRow {
  MENU_ID: string
  PGM_ID: string
  PGM_TITLE: string
  PGM_DESC: string
  PGM_SEQ: number
}

interface SubMenuRow {
  MENU_ID: string
  PGM_ID: string
  PGM_TITLE: string
  PGM_DESC: string
  PGM_SEQ: number
  FAV_YN: string
}

const menuRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/menu — DB 기반 메뉴 전체 반환 (C# Home.cs MakeMenu/MakeSubMenu 동일 로직)
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const { taxNo, salesNo } = request.user as { taxNo: string; salesNo: string }
    const sNo = salesNo || ''

    // ① 상위 메뉴 (PGM_CLASS='2', MENU_ID 2자리, 'P'로 시작)
    const topMenus = await query<TopMenuRow>(
      `SELECT MENU_ID, PGM_ID, PGM_TITLE, PGM_DESC, PGM_SEQ
       FROM PGMWRT A
       WHERE PGM_CLASS = '2'
         AND LENGTH(MENU_ID) = 2
         AND MENU_ID LIKE 'P%'
         AND MENU_ID IN (
           SELECT MENU_ID FROM CTROLE
           WHERE MENU_CD = (SELECT MENU_CD FROM CUSTCD WHERE TAX_NO = :taxNo)
             AND MENU_ID LIKE 'P%'
             AND LENGTH(MENU_ID) = 2
             AND NVL(JOB_YN, 'N') = 'Y'
         )
         AND NVL(
           (SELECT JOB_YN FROM PUBCTL
            WHERE TAX_NO = :taxNo
              AND SALES_NO = :salesNo
              AND PGM_ID = A.MENU_ID),
           'Y'
         ) = 'Y'
       ORDER BY PGM_SEQ`,
      { taxNo, salesNo: sNo }
    )

    // ② 하위 메뉴 전체 (PGM_CLASS='3', _INS/_SUB 제외)
    const subMenus = await query<SubMenuRow>(
      `SELECT
           A.MENU_ID, A.PGM_ID, A.PGM_TITLE, A.PGM_DESC, A.PGM_SEQ,
           (SELECT DECODE(COUNT(*), 1, 'Y', 'N') FROM PUBFAV
            WHERE TAX_NO = :taxNo
              AND SALES_NO = :salesNo
              AND MENU_ID = A.MENU_ID
              AND PGM_ID = A.PGM_ID) FAV_YN
       FROM PGMWRT A, CTROLE B
       WHERE A.MENU_ID = B.MENU_ID
         AND B.MENU_CD = (SELECT MENU_CD FROM CUSTCD WHERE TAX_NO = :taxNo)
         AND A.PGM_CLASS = '3'
         AND A.MENU_ID LIKE 'P%'
         AND A.MENU_ID NOT LIKE '%_INS'
         AND A.MENU_ID NOT LIKE '%_SUB'
         AND NVL(
           (SELECT JOB_YN FROM PUBCTL
            WHERE TAX_NO = :taxNo
              AND SALES_NO = :salesNo
              AND PGM_ID = A.PGM_ID),
           'Y'
         ) = 'Y'
         AND NVL(B.JOB_YN, 'N') = 'Y'
       ORDER BY A.PGM_SEQ, A.MENU_ID`,
      { taxNo, salesNo: sNo }
    )

    // ③ 상위메뉴에 하위메뉴 그룹핑 (MENU_ID 첫 2자리 = 상위 MENU_ID)
    return topMenus.map((top) => ({
      menuId: top.MENU_ID,
      pgmId: top.PGM_ID,
      title: top.PGM_TITLE,
      desc: top.PGM_DESC,
      seq: top.PGM_SEQ,
      children: subMenus
        .filter((sub) => sub.MENU_ID.startsWith(top.MENU_ID))
        .map((sub) => ({
          menuId: sub.MENU_ID,
          pgmId: sub.PGM_ID,
          title: sub.PGM_TITLE,
          desc: sub.PGM_DESC,
          seq: sub.PGM_SEQ,
          favYn: sub.FAV_YN,
        })),
    }))
  })
}

export default menuRoutes
