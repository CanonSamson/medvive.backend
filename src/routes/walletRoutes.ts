import { Router } from 'express'
import { activateDoctorWallet } from '../controllers/wallets/walletController.js'

const router = Router()

// POST /v1/api/wallets/activate
router.post('/activate', activateDoctorWallet)

export const walletRoutes = router