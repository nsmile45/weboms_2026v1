import 'dotenv/config'
import oracledb from 'oracledb'

const connectString = `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SID}`
console.log('Connecting to:', connectString)
console.log('User:', process.env.DB_USER)

try {
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
  const conn = await oracledb.getConnection({
    user: process.env.DB_USER!,
    password: process.env.DB_PASS!,
    connectString,
  })

  console.log('✅ Oracle DB 연결 성공!')

  // 테이블 목록 조회
  const result = await conn.execute<{ TABLE_NAME: string }>(
    `SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME`,
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  )

  console.log(`\n📋 테이블 수: ${result.rows?.length ?? 0}`)
  result.rows?.slice(0, 20).forEach(r => console.log(' -', r.TABLE_NAME))
  if ((result.rows?.length ?? 0) > 20) {
    console.log(` ... 외 ${(result.rows?.length ?? 0) - 20}개`)
  }

  await conn.close()
} catch (err) {
  console.error('❌ Oracle DB 연결 실패:', err)
  process.exit(1)
}
