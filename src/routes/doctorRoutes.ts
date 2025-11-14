import { Router } from 'express'
import { onboardDoctor } from '../controllers/doctor/authController.js'

const router = Router()

router.post('/auth/onboard', onboardDoctor)

export const doctorRoutes = router
