import { Router } from 'express'
import {
  handleGetOTPTimeLeft,
  handleSendOTP,
  handleVerifyOTP,
  handleTokenSignIn,
  handleTokenSignOut
} from '../controllers/authController.js'
import {
  forceResetUserPassword,
  sendPasswordResetEmail,
  passwordResetRedirect
} from '../controllers/auth/passwordResetController.js'
import { verifyUserToken } from '../middlewares/authMiddleware.js'

const router = Router()

router.post('/send-otp', handleSendOTP)
router.post('/verify-otp', handleVerifyOTP)
router.get('/get-otp-time-left', handleGetOTPTimeLeft)
// Token-only sign-in: requires Authorization Bearer token
router.post('/token-signin', verifyUserToken, handleTokenSignIn)
// Token sign-out: requires Authorization Bearer token (acknowledgement)
router.post('/token-signout', verifyUserToken, handleTokenSignOut)

// Password reset: generate Firebase reset link and email it
router.post('/password/reset-link', sendPasswordResetEmail)
// Password reset completion redirect (must be whitelisted in Firebase Auth)
router.get('/password/reset-complete', passwordResetRedirect)
// Force reset password by admin or authenticated service
router.post('/password/force-reset', verifyUserToken, forceResetUserPassword)

export const authRoutes = router
