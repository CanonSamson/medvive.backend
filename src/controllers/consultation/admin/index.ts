import { Request, Response } from 'express'
import asyncWrapper from '../../../middlewares/asyncWrapper.js'
import logger from '../../../utils/logger.js'
import { z } from 'zod'
import { consultationPaymentService } from '../../../services/consultation/payment.js'

// Approve initialized payout to doctor's wallet
export const approveConsultationWalletPayout = asyncWrapper(
  async (req: Request, res: Response) => {
    const requestId = Math.random().toString(36).substring(7)
    logger.info('approveConsultationWalletPayout: Request initiated', {
      requestId,
      body: req.body,
      params: req.params,
      query: req.query
    })

    const schema = z.object({
      consultationId: z.string().min(1, 'consultationId is required'),
      doctorId: z.string().min(1, 'doctorId is required'),
      patientId: z.string().min(1, 'patientId is required'),
      walletTransactionId: z.string().optional()
    })

    const parsed = schema.safeParse({
      ...req.body,
      ...req.params,
      ...req.query
    })

    if (!parsed.success) {
      logger.warn('approveConsultationWalletPayout: Validation failed', {
        requestId,
        issues: parsed.error.issues
      })
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues
      })
    }

    const { consultationId, doctorId, patientId, walletTransactionId } =
      parsed.data

    try {
      const result =
        await consultationPaymentService.approveInitializedPaymentToDoctorWallet(
          consultationId,
          doctorId,
          patientId,
          walletTransactionId
        )

      if (result.success) {
        logger.info('approveConsultationWalletPayout: Approval successful', {
          requestId,
          consultationId,
          doctorId,
          walletTransactionId: result.walletTransactionId
        })
        const { success: _svcSuccess, ...payload } = result as any
        return res.status(200).json({ success: true, ...payload })
      }

      const errorMsg = String(result.error || '')
      if (errorMsg.includes('not found')) {
        return res
          .status(404)
          .json({ success: false, error: 'Wallet transaction not found' })
      }
      if (errorMsg.toLowerCase().includes('not activated')) {
        return res
          .status(409)
          .json({ success: false, error: 'Doctor wallet not activated' })
      }

      logger.error('approveConsultationWalletPayout: Approval failed', {
        requestId,
        consultationId,
        doctorId,
        error: result.error
      })
      return res.status(500).json({ success: false, error: result.error })
    } catch (error: any) {
      logger.error('approveConsultationWalletPayout: Unexpected error', {
        requestId,
        consultationId,
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

// Reject initialized payout to doctor's wallet
export const rejectConsultationWalletPayout = asyncWrapper(
  async (req: Request, res: Response) => {
    const requestId = Math.random().toString(36).substring(7)
    logger.info('rejectConsultationWalletPayout: Request initiated', {
      requestId,
      body: req.body,
      params: req.params,
      query: req.query
    })

    const schema = z.object({
      consultationId: z.string().min(1, 'consultationId is required'),
      doctorId: z.string().min(1, 'doctorId is required'),
      patientId: z.string().min(1, 'patientId is required'),
      walletTransactionId: z.string().optional(),
      reason: z.string().optional()
    })

    const parsed = schema.safeParse({
      ...req.body,
      ...req.params,
      ...req.query
    })

    if (!parsed.success) {
      logger.warn('rejectConsultationWalletPayout: Validation failed', {
        requestId,
        issues: parsed.error.issues
      })
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues
      })
    }

    const { consultationId, doctorId, patientId, walletTransactionId, reason } =
      parsed.data

    try {
      const result =
        await consultationPaymentService.rejectInitializedPaymentToDoctorWallet(
          consultationId,
          doctorId,
          patientId,
          walletTransactionId,
          reason
        )

      if (result.success) {
        logger.info('rejectConsultationWalletPayout: Rejection successful', {
          requestId,
          consultationId,
          doctorId,
          walletTransactionId: result.walletTransactionId
        })
        const { success: _svcSuccess, ...payload } = result as any
        return res.status(200).json({ success: true, ...payload })
      }

      const errorMsg = String(result.error || '')
      if (errorMsg.includes('not found')) {
        return res
          .status(404)
          .json({ success: false, error: 'Wallet transaction not found' })
      }

      logger.error('rejectConsultationWalletPayout: Rejection failed', {
        requestId,
        consultationId,
        doctorId,
        error: result.error
      })
      return res.status(500).json({ success: false, error: result.error })
    } catch (error: any) {
      logger.error('rejectConsultationWalletPayout: Unexpected error', {
        requestId,
        consultationId,
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
