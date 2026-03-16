import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { initDb, closeDb } from './db.js'
import authPlugin from './plugins/auth.js'
import authRoutes from './routes/auth/index.js'
import menuRoutes from './routes/menu/index.js'
import bookcdRoutes from './routes/p0/bookcd.js'
import p121Routes from './routes/p1/p121.js'

const fastify = Fastify({ logger: true })

// Plugins
await fastify.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:4173'],
  credentials: true,
})

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET!,
})

await fastify.register(authPlugin)

// Routes
await fastify.register(authRoutes, { prefix: '/api/auth' })
await fastify.register(menuRoutes, { prefix: '/api/menu' })
await fastify.register(bookcdRoutes, { prefix: '/api/p0/bookcd' })
await fastify.register(p121Routes, { prefix: '/api/p1/p121' })

// Health check
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

// Start
const PORT = Number(process.env.PORT ?? 3000)

try {
  await initDb()
  await fastify.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`🚀 Server running on http://localhost:${PORT}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}

process.on('SIGINT', async () => {
  await closeDb()
  await fastify.close()
  process.exit(0)
})
