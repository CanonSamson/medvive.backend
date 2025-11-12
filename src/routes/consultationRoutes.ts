import { Router } from 'express'
import { checkConsultationPaymentStatus, consultationPaymentCallback, initializeConsultation, endConsultation, consultationSuccessful } from '../controllers/consultationController.js'
import { checkUnSeenMessages } from '../controllers/consultation/messageController.js'
import { getDoctorAvailability, getDoctorTimeSlotsForDate, sendConsultationAcceptedEmail, sendConsultationStartedEmail } from '../controllers/consultation/index.js'
import { triggerPendingConsultationPaymentReminder } from '../controllers/reminder/consultationReminder.js'

const router = Router()

router.post('/initialize', initializeConsultation)
router.get('/check-payment-status/:transactionId', checkConsultationPaymentStatus)
router.get('/call-back', consultationPaymentCallback)
router.post('/messages/unseen/:consultationsChat/:senderId/:receiverId', checkUnSeenMessages)

// Consultation lifecycle endpoints
router.post('/end', endConsultation)
router.post('/successful', consultationSuccessful)

// Email endpoints
router.post('/email/accepted', sendConsultationAcceptedEmail)
router.post('/email/started', sendConsultationStartedEmail)

// Doctor availability endpoints
router.get('/doctors/:doctorId/availability', getDoctorAvailability)
router.get('/doctors/:doctorId/availability/:date', getDoctorTimeSlotsForDate)
router.post('/reminder/trigger', triggerPendingConsultationPaymentReminder)



export const consultationRoutes = router