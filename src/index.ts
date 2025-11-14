import express, { Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import http from 'http'
import morgan from 'morgan'
import './services/passport.strategies'
import { Server } from 'socket.io'
import logger from './utils/logger.js'
import { authEmailRoutes } from './routes/authEmailRoutes.js'
import { kycEmailRoutes } from './routes/kycEmailRoutes.js'
import { alatPayRoutes } from './routes/alatPayRoutes.js'
import initializeSocket from './socket/index.js'
import { initializeFirebaseAdmin } from './utils/firebase/admin.js'
import { authRoutes } from './routes/authRoutes.js'
import { consultationRoutes } from './routes/consultationRoutes.js'
import { walletRoutes } from './routes/walletRoutes.js'
import { discordClient } from '../discord/index.js'
import { restoreUnSeenMessageJobs } from './utils/scheduler.js'
import passport from 'passport'
import './services/passport.strategies'
import session from 'express-session'
import { doctorRoutes } from './routes/doctorRoutes.js'
// import admin from 'firebase-admin'

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
    allowedHeaders: ['*']
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
    const app = express()
    discordClient.login(process.env.DISTOKEN)
    // Initialize Firebase Admin SDK
    initializeFirebaseAdmin()
    logger.info('Firebase Admin SDK initialized')

    // Restore scheduled jobs after Firebase is ready
    await restoreUnSeenMessageJobs()

    const PORT = process.env.PORT

    // Apply middleware
    app.use(loggingMiddleware)
    app.use(configureCors())
    app.use(express.json())
    app.use(express.json({ limit: '100mb' }))
    app.use(express.urlencoded({ limit: '100mb', extended: true }))

    dotenv.config()

    // Create HTTP server and Socket.IO instance
    const server = http.createServer(app)
    const io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })
    // Initialize socket handlers
    initializeSocket(io)

    // Setup routes
    app.use('/v1/api/auth/email', authEmailRoutes)
    app.use('/v1/api/auth', authRoutes)
    app.use('/v1/api/kyc/email', kycEmailRoutes)
    app.use('/v1/api/payments/alatpay', alatPayRoutes)
    app.use('/v1/api/consultation', consultationRoutes)
    app.use('/v1/api/wallets', walletRoutes)
    app.use('/v1/api/doctors', doctorRoutes)

    app.get('/health', healthCheck)
    app.get('/', (_req, res) => {
      res.json({ message: ' Service is running!' })
    })

    app.use(
      session({
        resave: false,
        saveUninitialized: true,
        secret: process.env.SESSION_SECRET || 'my-secret'
      })
    )
    app.use(passport.initialize())
    app.use(passport.session())

    passport.serializeUser(function (
      user: any,
      cb: (err: any, id?: unknown) => void
    ) {
      cb(null, user)
    })

    passport.deserializeUser(function (
      user: any,
      cb: (err: any, user?: any) => void
    ) {
      cb(null, user)
    })
    app.get(
      '/v1/api/auth/google',
      passport.authenticate('google', { scope: ['profile', 'email'] })
    )

    app.get(
      '/v1/api/auth/google/callback',
      passport.authenticate('google', {
        failureRedirect: `${process.env.FRONTEND_URL}`,
        failureMessage: true
      }),
      async (req: any, res: Response) => {
        try {
          res.redirect(
            `${process.env.FRONTEND_URL}/${req?.user.action}?token=${req?.user.token}`
          )
        } catch (error) {
          logger.error('Google auth redirect failed:', error)
          res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`)
        }
      }
    )
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

// async function deleteAllUsers () {
//   try {
//     let nextPageToken
//     let deletedCount = 0

//     do {
//       // list up to 1000 users at a time
//       const listUsersResult = await admin.auth().listUsers(1000, nextPageToken)

//       const uids = listUsersResult.users.map(user => user.uid)

//       if (uids.length > 0) {
//         await admin.auth().deleteUsers(uids)
//         deletedCount += uids.length
//         console.log(`Deleted ${uids.length} users`)
//       }

//       nextPageToken = listUsersResult.pageToken
//     } while (nextPageToken)

//     console.log(`✅ Finished deleting ${deletedCount} users.`)
//   } catch (error) {
//     console.error('Error deleting users:', error)
//   }
// }
