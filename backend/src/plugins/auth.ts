import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ message: '인증이 필요합니다.' })
    }
  })
}

export default fp(authPlugin)
