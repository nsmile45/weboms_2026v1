export interface JwtPayload {
  taxNo: string
  custNm: string
  salesNo: string
  salesNm: string
  empNo: string
  plocCd: string
  rlocCd: string
  jlocCd: string
  domeYn: string
  jgchgYn: string
  sublseqDiv: string
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}
