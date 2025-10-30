import { Request, Response } from 'express'
import asyncWrapper from '../../middlewares/asyncWrapper.js'
import logger from '../../utils/logger.js'
import { z } from 'zod'
import {
  getDBAdmin,
  createDBAdmin,
  updateDBAdmin
} from '../../utils/firebase/admin-database.js'

/**
 * Wallet record stored in Firebase
 */
export interface WalletData {
  doctorId: string
  balance: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export const activateDoctorWallet = asyncWrapper(
  async (req: Request, res: Response) => {
    const requestId = Math.random().toString(36).substring(7)
    logger.info('activateDoctorWallet: Request initiated', {
      requestId,
      body: req.body
    })

    // Validate input
    const schema = z.object({
      doctorId: z
        .string()
        .min(1, 'doctorId is required')
        .max(1000, 'doctorId is too long')
    })
    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
      logger.warn('activateDoctorWallet: Validation failed', {
        requestId,
        issues: parsed.error.issues
      })
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues
      })
    }

    const { doctorId } = parsed.data

    try {
      // Ensure doctor exists
      logger.debug('activateDoctorWallet: Checking doctor existence', {
        requestId,
        doctorId
      })
      const doctorRecord = await getDBAdmin('doctors', doctorId)
      if (!doctorRecord?.data) {
        logger.warn('activateDoctorWallet: Doctor not found', {
          requestId,
          doctorId
        })
        return res.status(404).json({
          success: false,
          error: 'Doctor not found'
        })
      }

      // Check if wallet already exists
      logger.debug('activateDoctorWallet: Checking existing wallet', {
        requestId,
        doctorId
      })
      const walletRecord = await getDBAdmin('wallets', doctorId)
      if (walletRecord?.data) {
        logger.info('activateDoctorWallet: Wallet already exists', {
          requestId,
          doctorId
        })
        return res.status(200).json({
          success: true,
          message: 'Wallet already active',
          wallet: walletRecord.data as WalletData
        })
      }

      // Create new wallet
      const timestamp = new Date().toISOString()
      const newWallet: WalletData = {
        doctorId,
        balance: 0,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp
      }

      logger.info('activateDoctorWallet: Creating new wallet', {
        requestId,
        doctorId
      })
      await createDBAdmin('wallets', doctorId, newWallet)

      logger.info('activateDoctorWallet: Wallet created successfully', {
        requestId,
        doctorId
      })
      await updateDBAdmin('doctors', doctorId, {
        isWalletActivated: true
      })
      return res.status(201).json({
        success: true,
        message: 'Wallet activated successfully',
        wallet: newWallet
      })
    } catch (error: any) {
      logger.error('activateDoctorWallet: Database operation failed', {
        requestId,
        doctorId,
        error: error?.message || error
      })
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      })
    }
  }
)
