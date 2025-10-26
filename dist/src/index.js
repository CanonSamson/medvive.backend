import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import morgan from 'morgan';
import { Server } from 'socket.io';
import logger from './utils/logger.js';
import { authEmailRoutes } from './routes/authEmailRoutes.js';
import { kycEmailRoutes } from './routes/kycEmailRoutes.js';
import { alatPayRoutes } from './routes/alatPayRoutes.js';
import initializeSocket from './socket/index.js';
import { initializeFirebaseAdmin } from './utils/firebase/admin.js';
import { authRoutes } from './routes/authRoutes.js';
import { consultationRoutes } from './routes/consultationRoutes.js';
import { discordClient } from '../discord/index.js';
import { restoreUnSeenMessageJobs } from './utils/scheduler.js';
// Configure logging
const morganFormat = ':method :url :status :response-time ms';
const loggingMiddleware = morgan(morganFormat, {
    stream: {
        write: message => {
            const logObject = {
                method: message.split(' ')[0],
                url: message.split(' ')[1],
                status: message.split(' ')[2],
                responseTime: message.split(' ')[3]
            };
            logger.info(JSON.stringify(logObject));
        }
    }
});
// Configure middleware
const configureCors = () => {
    return cors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['*']
    });
};
// Error handling middleware
const errorHandler = (err, _req, res, _next) => {
    logger.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
};
// Health check route handler
const healthCheck = async (_req, res) => {
    try {
        logger.info({
            status: 'healthy'
        });
        res.json({ status: 'healthy' });
    }
    catch (error) {
        logger.error('Health check failed:');
        res.status(503).json({
            status: 'unhealthy'
        });
    }
};
// Cleanup handlers
const setupCleanupHandlers = () => {
    const cleanup = async () => {
        logger.info('Shutting down server...');
        process.exit(0);
    };
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
};
async function startServer() {
    try {
        dotenv.config();
        discordClient.login(process.env.DISTOKEN);
        // Initialize Firebase Admin SDK
        initializeFirebaseAdmin();
        logger.info('Firebase Admin SDK initialized');
        // Restore scheduled jobs after Firebase is ready
        await restoreUnSeenMessageJobs();
        const app = express();
        const PORT = process.env.PORT;
        // Apply middleware
        app.use(loggingMiddleware);
        app.use(configureCors());
        app.use(express.json());
        // Create HTTP server and Socket.IO instance
        const server = http.createServer(app);
        const io = new Server(server, {
            path: '/ws/',
            cors: {
                origin: '*',
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
            }
        });
        // Initialize socket handlers
        initializeSocket(io);
        // Setup routes
        app.use('/v1/api/auth/email', authEmailRoutes);
        app.use('/v1/api/auth', authRoutes);
        app.use('/v1/api/kyc/email', kycEmailRoutes);
        app.use('/v1/api/payments/alatpay', alatPayRoutes);
        app.use('/v1/api/consultation', consultationRoutes);
        app.get('/health', healthCheck);
        app.get('/', (_req, res) => {
            res.json({ message: 'Notification Service is running!' });
        });
        // Apply error handling
        app.use(errorHandler);
        // Setup cleanup handlers
        setupCleanupHandlers();
        // Start server
        server.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
        });
    }
    catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
//# sourceMappingURL=index.js.map