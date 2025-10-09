import { Router } from 'express';
import { sendKycCompletedEmail } from '../controllers/kycEmailController.js';
const router = Router();
router.post('/kyc-complete', sendKycCompletedEmail);
export const kycEmailRoutes = router;
//# sourceMappingURL=kycEmailRoutes.js.map