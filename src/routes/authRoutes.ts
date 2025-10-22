import { Router } from 'express'
import {
  handleGetOTPTimeLeft,
  handleSendOTP,
  handleVerifyOTP
} from '../controllers/authController.js'

const router = Router()

router.post('/send-otp', handleSendOTP)
router.post('/verify-otp', handleVerifyOTP)
router.get('/get-otp-time-left', handleGetOTPTimeLeft)

export const authRoutes = router