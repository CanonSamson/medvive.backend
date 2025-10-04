import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import http from 'http'
import morgan from 'morgan'
import { Server } from 'socket.io'
import logger from './utils/logger.js'
import { authEmailRoutes } from './routes/authEmailRoutes.js'
import { kycEmailRoutes } from './routes/kycEmailRoutes.js'
import initializeSocket from './socket/index.js'
import { initializeFirebaseAdmin } from './utils/firebase/admin.js'
import { authRoutes } from './routes/authRoutes.js'

// Configure logging
const morganFormat = ':method :url :status :response-time ms'
const loggingMiddleware = morgan(morganFormat, {
  stream: {
    write: message => {
      const logObject = {
        method: message.split(' ')[0],
        url: message.split(' ')[1],
        status: message.split(' ')[2],
        responseTime: message.split(' ')[3]
      }
      logger.info(JSON.stringify(logObject))
    }
  }
})

// Configure middleware
const configureCors = () => {
  return cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
}

// Error handling middleware
const errorHandler = (
  err: any,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) => {
  logger.error('Error:', err)
  res.status(500).json({ error: 'Internal server error' })
}

// Health check route handler
const healthCheck = async (_req: express.Request, res: express.Response) => {
  try {
    logger.info({
      status: 'healthy'
    })
    res.json({ status: 'healthy' })
  } catch (error) {
    logger.error('Health check failed:')
    res.status(503).json({
      status: 'unhealthy'
    })
  }
}

// Cleanup handlers
const setupCleanupHandlers = () => {
  const cleanup = async () => {
    logger.info('Shutting down server...')
    process.exit(0)
  }

  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)
}

async function startServer () {
  try {
    dotenv.config()

    // Initialize Firebase Admin SDK
    initializeFirebaseAdmin()
    logger.info('Firebase Admin SDK initialized')

    const app = express()
    const PORT = process.env.PORT || 4004

    // Apply middleware
    app.use(loggingMiddleware)
    app.use(configureCors())
    app.use(express.json())

    // Create HTTP server and Socket.IO instance
    const server = http.createServer(app)
    const io = new Server(server, {
      path: '/ws/',
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
      }
    })
    // Initialize socket handlers
    initializeSocket(io)

    // Setup routes
    app.use('/auth/email', authEmailRoutes)
    app.use('/auth', authRoutes)
    app.use('/kyc/email', kycEmailRoutes)

    app.get('/health', healthCheck)
    app.get('/', (_req, res) => {
      res.json({ message: 'Notification Service is running!' })
    })

    // Apply error handling
    app.use(errorHandler)

    // Setup cleanup handlers
    setupCleanupHandlers()

    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`)
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
