import { Router } from 'express'
import {
  generateVirtualAccount,
  getServiceStatus,
  healthCheck,
  confirmTransactionStatus
} from '../controllers/alatPayController.js'
import { 
  validateVirtualAccountRequest,
  validateTransactionStatusRequest 
} from '../middlewares/alatPayValidation.js'

const router = Router()

// Virtual account generation with validation middleware
router.post(
  '/virtual-account',
  validateVirtualAccountRequest,
  generateVirtualAccount
)

// Transaction status confirmation with validation middleware
router.get(
  '/transaction/:transactionId/status',
  validateTransactionStatusRequest,
  confirmTransactionStatus
)

// Service status and health check endpoints (no validation needed)
router.get('/status', getServiceStatus)
router.get('/health', healthCheck)

export const alatPayRoutes = router


