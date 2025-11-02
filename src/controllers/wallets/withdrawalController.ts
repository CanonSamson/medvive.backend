import { Request, Response } from 'express'
import asyncWrapper from '../../middlewares/asyncWrapper.js'
import logger from '../../utils/logger.js'
import { z } from 'zod'
import { withdrawalService } from '../../services/consultation/withdrawal.js'
import { discordBotService } from '../../services/discord-bot/index.js'

export const initiateWithdrawal = asyncWrapper(
  async (req: Request, res: Response) => {
    const requestId = Math.random().toString(36).substring(7)
    logger.info('initiateWithdrawal: Request initiated', {
      requestId,
      body: req.body
    })

    const schema = z.object({
      doctorId: z.string().min(1, 'doctorId is required'),
      amount: z.number().positive('amount must be greater than 0'),
      bankName: z.string().min(1, 'bankName is required'),
      accountNumber: z.string().min(1, 'accountNumber is required'),
      accountName: z.string().min(1, 'accountName is required')
    })

    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      logger.warn('initiateWithdrawal: Validation failed', {
        requestId,
        issues: parsed.error.issues
      })
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues
      })
    }

    const { doctorId, amount, bankName, accountNumber, accountName } =
      parsed.data

    try {
      const result = await withdrawalService.initiateWithdrawal({
        doctorId,
        amount,
        bankName,
        accountNumber,
        accountName
      })
      if (result.success) {
        logger.info('initiateWithdrawal: Withdrawal initiated successfully', {
          requestId,
          withdrawalId: result.withdrawalId,
          doctorId,
          amount
        })
        res.status(201).json({ ...result })

        // Send approval prompt to Discord
        await discordBotService.sendWithdrawalApprovalPrompt(
          `Withdrawal approval requested for ${amount} to ${bankName} (${accountNumber})`,
          {
            withdrawalId: result.withdrawalId as string,
            doctorId,
            amount,
            bankName,
            accountNumber,
            accountName
          }
        )
      } else {
        logger.error('initiateWithdrawal: Service returned failure', {
          requestId,
          doctorId,
          amount,
          message: result.message
        })
        return res.status(500).json({ success: false, error: result.message })
      }
    } catch (error: any) {
      logger.error('initiateWithdrawal: Unexpected error', {
        requestId,
        error: error?.message || error
      })
      return res
        .status(500)
        .json({ success: false, error: 'Internal server error' })
    }
  }
)

export const markWithdrawalProcessing = asyncWrapper(
  async (req: Request, res: Response) => {
    const requestId = Math.random().toString(36).substring(7)
    logger.info('markWithdrawalProcessing: Request initiated', {
      requestId,
      params: req.params,
      body: req.body
    })

    const schema = z.object({
      withdrawalId: z.string().min(1, 'withdrawalId is required')
    })
    const parsed = schema.safeParse({
      withdrawalId: req.params.withdrawalId || req.body.withdrawalId
    })
    if (!parsed.success) {
      logger.warn('markWithdrawalProcessing: Validation failed', {
        requestId,
        issues: parsed.error.issues
      })
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues
      })
    }

    const { withdrawalId } = parsed.data
    try {
      const result = await withdrawalService.markWithdrawalProcessing(
        withdrawalId
      )
      if (result.success) {
        logger.info('markWithdrawalProcessing: Status updated to PROCESSING', {
          requestId,
          withdrawalId
        })
        return res.status(200).json({ success: true })
      }
      logger.warn('markWithdrawalProcessing: Service returned failure', {
        requestId,
        withdrawalId,
        message: result.message
      })
      const statusCode = result.message === 'Withdrawal not found' ? 404 : 400
      return res
        .status(statusCode)
        .json({ success: false, error: result.message })
    } catch (error: any) {
      logger.error('markWithdrawalProcessing: Unexpected error', {
        requestId,
        withdrawalId,
        error: error?.message || error
      })
      return res
        .status(500)
        .json({ success: false, error: 'Internal server error' })
    }
  }
)

export const approveWithdrawal = asyncWrapper(
  async (req: Request, res: Response) => {
    const requestId = Math.random().toString(36).substring(7)
    logger.info('approveWithdrawal: Request initiated', {
      requestId,
      params: req.params,
      body: req.body
    })

    const schema = z.object({
      withdrawalId: z.string().min(1, 'withdrawalId is required'),
      approvedBy: z.string().optional(),
      note: z.string().optional()
    })
    const parsed = schema.safeParse({
      withdrawalId: req.params.withdrawalId || req.body.withdrawalId,
      approvedBy: req.body.approvedBy,
      note: req.body.note
    })
    if (!parsed.success) {
      logger.warn('approveWithdrawal: Validation failed', {
        requestId,
        issues: parsed.error.issues
      })
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.issues
      })
    }

    const { withdrawalId, approvedBy, note } = parsed.data
    try {
      const result = await withdrawalService.approveWithdrawal(withdrawalId, {
        approvedBy,
        note
      })
      if (result.success) {
        logger.info('approveWithdrawal: Withdrawal approved', {
          requestId,
          withdrawalId,
          approvedBy
        })
        return res.status(200).json({ success: true })
      }
      logger.warn('approveWithdrawal: Service returned failure', {
        requestId,
        withdrawalId,
        message: result.message
      })
      const statusCode = result.message === 'Withdrawal not found' ? 404 : 400
      return res
        .status(statusCode)
        .json({ success: false, error: result.message })
    } catch (error: any) {
      logger.error('approveWithdrawal: Unexpected error', {
        requestId,
        withdrawalId,
        error: error?.message || error
      })
      return res
        .status(500)
        .json({ success: false, error: 'Internal server error' })
    }
  }
)
