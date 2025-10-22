import { Router } from 'express'
import { checkConsultationPaymentStatus, consultationPaymentCallback, initializeConsultation } from '../controllers/consultationController.js'
import { checkUnSeenMessages } from '../controllers/consultation/messageController.js'

const router = Router()

router.post('/initialize', initializeConsultation)
router.get('/check-payment-status/:transactionId', checkConsultationPaymentStatus)
router.get('/call-back', consultationPaymentCallback)
router.post('/messages/unseen/:consultationsChat/:senderId/:receiverId', checkUnSeenMessages)



export const consultationRoutes = router