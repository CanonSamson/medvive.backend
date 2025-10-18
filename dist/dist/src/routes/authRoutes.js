import { Router } from 'express';
import { handleSendOTP, handleVerifyOTP } from '../controllers/authController.js';
const router = Router();
router.post('/send-otp', handleSendOTP);
router.post('/verify-otp', handleVerifyOTP);
export const authRoutes = router;
//# sourceMappingURL=authRoutes.js.map
//# sourceMappingURL=authRoutes.js.map