import oracledb from 'oracledb'
import 'dotenv/config'

// Oracle Instant Client 경로 (구버전 DB용 Thick mode 필요)
if (process.env.ORACLE_CLIENT_PATH) {
  oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_PATH })
  console.log('Oracle Thick mode enabled:', process.env.ORACLE_CLIENT_PATH)
}

const dbConfig = {
  user: process.env.DB_USER!,
  password: process.env.DB_PASS!,
  connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SID}`,
  poolMin: Number(process.env.DB_POOL_MIN ?? 2),
  poolMax: Number(process.env.DB_POOL_MAX ?? 10),
  poolIncrement: 1,
}

export async function initDb() {
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
  await oracledb.createPool(dbConfig)
  console.log('✅ Oracle DB pool created')
}

export async function closeDb() {
  await oracledb.getPool().close(10)
  console.log('Oracle DB pool closed')
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  binds: oracledb.BindParameters = [],
  opts: oracledb.ExecuteOptions = {}
): Promise<T[]> {
  const conn = await oracledb.getConnection()
  try {
    const result = await conn.execute<T>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...opts,
    })
    return (result.rows ?? []) as T[]
  } finally {
    await conn.close()
  }
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  binds: oracledb.BindParameters = []
): Promise<T | null> {
  const rows = await query<T>(sql, binds)
  return rows[0] ?? null
}

export async function execute(
  sql: string,
  binds: oracledb.BindParameters = []
): Promise<oracledb.Result<unknown>> {
  const conn = await oracledb.getConnection()
  try {
    const result = await conn.execute(sql, binds, { autoCommit: true })
    return result
  } finally {
    await conn.close()
  }
}

export async function withTransaction(
  fn: (conn: any) => Promise<void>
): Promise<void> {
  const conn = await oracledb.getConnection()
  try {
    await fn(conn)
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    await conn.close()
  }
}
