import { Router } from 'express'
import { checkConsultationPaymentStatus, initializeConsultation } from '../controllers/consultationController.js'

const router = Router()

router.post('/initialize', initializeConsultation)
router.get('/check-payment-status/:transactionId', checkConsultationPaymentStatus)


export const consultationRoutes = router