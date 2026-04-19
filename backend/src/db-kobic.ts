import oracledb from 'oracledb'
import 'dotenv/config'

const KOBIC_POOL_ALIAS = 'kobic'

const kobicConfig = {
  user: process.env.KOBIC_DB_USER ?? 'EASYAPI',
  password: process.env.KOBIC_DB_PASS ?? 'EASY2022',
  connectString: `${process.env.KOBIC_DB_HOST ?? '115.94.5.157'}:${process.env.KOBIC_DB_PORT ?? '1521'}/${process.env.KOBIC_DB_SID ?? 'ORCL'}`,
  poolAlias: KOBIC_POOL_ALIAS,
  poolMin: 1,
  poolMax: 5,
  poolIncrement: 1,
}

export async function initKobicDb() {
  try {
    await oracledb.createPool(kobicConfig)
    console.log('✅ KOBIC external DB pool created')
  } catch (err: any) {
    console.warn('⚠️  KOBIC external DB pool 생성 실패 (불러오기 기능 사용 불가):', err?.message)
  }
}

export async function closeKobicDb() {
  try {
    await oracledb.getPool(KOBIC_POOL_ALIAS).close(5)
    console.log('KOBIC DB pool closed')
  } catch {
    // 이미 닫혔거나 미연결 상태
  }
}

export async function kobicQuery<T = Record<string, unknown>>(
  sql: string,
  binds: oracledb.BindParameters = []
): Promise<T[]> {
  const conn = await oracledb.getConnection(KOBIC_POOL_ALIAS)
  try {
    const result = await conn.execute<T>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    })
    return (result.rows ?? []) as T[]
  } finally {
    await conn.close()
  }
}
