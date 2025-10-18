import { Router } from 'express';
import { checkConsultationPaymentStatus, consultationPaymentCallback, initializeConsultation } from '../controllers/consultationController.js';
const router = Router();
router.post('/initialize', initializeConsultation);
router.get('/check-payment-status/:transactionId', checkConsultationPaymentStatus);
router.get('/call-back', consultationPaymentCallback);
export const consultationRoutes = router;
//# sourceMappingURL=consultationRoutes.js.map