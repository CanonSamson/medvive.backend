import { Router } from 'express'
import {
  handleGetOTPTimeLeft,
  handleSendOTP,
  handleVerifyOTP,
  handleTokenSignIn,
  handleTokenSignOut
} from '../controllers/authController.js'
import { verifyUserToken } from '../middlewares/authMiddleware.js'

const router = Router()

router.post('/send-otp', handleSendOTP)
router.post('/verify-otp', handleVerifyOTP)
router.get('/get-otp-time-left', handleGetOTPTimeLeft)
// Token-only sign-in: requires Authorization Bearer token
router.post('/token-signin', verifyUserToken, handleTokenSignIn)
// Token sign-out: requires Authorization Bearer token (acknowledgement)
router.post('/token-signout', verifyUserToken, handleTokenSignOut)

export const authRoutes = router