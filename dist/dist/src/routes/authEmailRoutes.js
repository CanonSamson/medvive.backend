import { Router } from 'express';
import { sendWelcomeEmail, sendOtpVerifiedEmail, sendForgetPasswordEmail } from '../controllers/authEmailController.js';
const router = Router();
router.post('/welcome', sendWelcomeEmail);
router.post('/forgot-password', sendForgetPasswordEmail);
router.post('/otp-verified', sendOtpVerifiedEmail);
export const authEmailRoutes = router;
//# sourceMappingURL=authEmailRoutes.js.map
//# sourceMappingURL=authEmailRoutes.js.map