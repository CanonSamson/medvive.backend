import { Router } from 'express'
import { activateDoctorWallet } from '../controllers/wallets/walletController.js'
import {
  initiateWithdrawal,
  markWithdrawalProcessing,
  approveWithdrawal
} from '../controllers/wallets/withdrawalController.js'

const router = Router()

// POST /v1/api/wallets/activate
router.post('/activate', activateDoctorWallet)

// Withdrawals
// POST /v1/api/wallets/withdrawals/initiate
router.post('/withdrawals/initiate', initiateWithdrawal)
// POST /v1/api/wallets/withdrawals/:withdrawalId/processing
router.post('/withdrawals/:withdrawalId/processing', markWithdrawalProcessing)
// POST /v1/api/wallets/withdrawals/:withdrawalId/approve
router.post('/withdrawals/:withdrawalId/approve', approveWithdrawal)

export const walletRoutes = router