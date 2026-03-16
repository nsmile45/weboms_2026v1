export interface JwtPayload {
  userId: string
  empNo: string
  empNm: string
  custCd: string
  custNm: string
  authLevel: string
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}
