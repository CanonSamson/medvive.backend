import { Request, Response } from 'express'
import { z } from 'zod'
import asyncWrapper from '../middlewares/asyncWrapper.js'
import { sendEmail } from '../services/emailService.js'
import {
  getDBAdmin,
  createDBAdmin,
  updateDBAdmin,
  deleteDBAdmin
} from '../utils/firebase/admin-database.js'
import { generateOTP } from '../utils/generateOTP.js'
import { PatientData, OTPData } from '../../custom-types.js'
import logger from '../utils/logger.js'

export const handleSendOTP = asyncWrapper(
  async (req: Request, res: Response) => {
    const requestId = Math.random().toString(36).substring(7)
    logger.info('handleSendOTP: Request initiated', {
      requestId,
      body: req.body
    })

    try {
      const body = req.body

      // Validate input
      logger.debug('handleSendOTP: Starting input validation', { requestId })
      const result = z
        .object({
          userId: z.string()
        })
        .safeParse(body)

      if (!result.success) {
        logger.warn('handleSendOTP: Input validation failed', {
          requestId,
          errors: result.error.issues,
          body
        })
        return res.status(400).json({
          error: 'Validation failed',
          details: result.error.issues,
          success: false
        })
      }

      const { userId } = result.data
      logger.info('handleSendOTP: Input validation successful', {
        requestId,
        userId
      })

      logger.debug('handleSendOTP: Fetching patient record from database', {
        requestId,
        userId
      })
      const patientRecord = await getDBAdmin('patients', userId)

      if (!patientRecord?.data) {
        logger.warn('handleSendOTP: Patient not found in database', {
          requestId,
          userId,
          patientRecord
        })
        return res.status(404).json({
          error: 'Patient not found',
          success: false,
          patientRecord
        })
      }

      const patientData = patientRecord.data as PatientData
      const email = patientData.email
      const fullName = patientData.fullName
      logger.info('handleSendOTP: Patient record retrieved successfully', {
        requestId,
        userId,
        email: email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email for privacy
        fullName
      })

      // Generate OTP
      logger.debug('handleSendOTP: Generating OTP', { requestId })
      const otp = generateOTP()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
      logger.info('handleSendOTP: OTP generated successfully', {
        requestId,
        expiresAt: expiresAt.toISOString()
      })

      // Store OTP in Firebase (using email as document ID for easy retrieval)
      const otpData: OTPData = {
        otp,
        email,
        expiresAt: expiresAt.toISOString(),
        attempts: 0,
        verified: false,
        createdAt: new Date().toISOString()
      }

      const emailKey = email.replace(/[.#$\[\]]/g, '_')
      logger.debug('handleSendOTP: Storing OTP in database', {
        requestId,
        emailKey
      })

      // Create or update OTP record using Admin SDK
      await createDBAdmin('email-verification-otps', emailKey, otpData)
      logger.info('handleSendOTP: OTP stored in database successfully', {
        requestId,
        emailKey
      })

      // Send OTP email
      logger.debug('handleSendOTP: Sending OTP email', {
        requestId,
        email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
        template: 'otp-verification'
      })

      try {
        await sendEmail(
          email,
          'Email Verification - Your OTP Code',
          'otp-verification',
          {
            fullName: fullName || 'User',
            otp: otp,
            expiryMinutes: '5'
          }
        )

        logger.info('handleSendOTP: OTP email sent successfully', {
          requestId,
          email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
          expiresAt: expiresAt.toISOString()
        })

        return res.status(201).json({
          message: 'OTP sent successfully',
          success: true,
          expiresAt: expiresAt.toISOString()
        })
      } catch (emailError) {
        logger.error('handleSendOTP: Email sending failed', {
          requestId,
          error: emailError,
          email: email.replace(/(.{2}).*(@.*)/, '$1***$2')
        })
        return res.status(500).json({
          error: 'Failed to send OTP email',
          success: false
        })
      }
    } catch (error) {
      logger.error('handleSendOTP: Server error occurred', {
        requestId,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      return res.status(500).json({
        error: 'Internal server error',
        success: false
      })
    }
  }
)

export const handleVerifyOTP = asyncWrapper(
  async (req: Request, res: Response) => {
    const requestId = Math.random().toString(36).substring(7)
    logger.info('handleVerifyOTP: Request initiated', {
      requestId,
      body: req.body
    })

    try {
      const body = req.body

      // Validate input
      logger.debug('handleVerifyOTP: Starting input validation', { requestId })
      const result = z
        .object({
          otp: z.string().length(5, 'OTP must be 5 digits'),
          userId: z.string()
        })
        .safeParse(body)

      if (!result.success) {
        logger.warn('handleVerifyOTP: Input validation failed', {
          requestId,
          errors: result.error.issues,
          body
        })
        return res.status(400).json({
          error: 'Validation failed',
          details: result.error.issues,
          success: false
        })
      }

      const { otp, userId } = result.data
      logger.info('handleVerifyOTP: Input validation successful', {
        requestId,
        userId
      })

      logger.debug('handleVerifyOTP: Fetching patient record from database', {
        requestId,
        userId
      })
      const patientRecord = await getDBAdmin('patients', userId)

      if (!patientRecord?.data) {
        logger.warn('handleVerifyOTP: Patient not found in database', {
          requestId,
          userId,
          patientRecord
        })
        return res.status(404).json({
          error: 'Patient not found',
          success: false,
          patientRecord
        })
      }

      const patientData = patientRecord.data as PatientData
      const email = patientData.email
      const emailKey = email.replace(/[.#$\[\]]/g, '_')
      logger.info('handleVerifyOTP: Patient record retrieved successfully', {
        requestId,
        userId,
        email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
        fullEmail: email,
        emailKey
      })

      // Get OTP record from Firebase using Admin SDK
      logger.debug('handleVerifyOTP: Fetching OTP record from database', {
        requestId,
        emailKey
      })
      const otpRecord = await getDBAdmin('email-verification-otps', emailKey)

      if (!otpRecord.success || !otpRecord.data) {
        logger.warn('handleVerifyOTP: OTP record not found or expired', {
          requestId,
          emailKey,
          otpRecord
        })
        try {
          await deleteDBAdmin('email-verification-otps', emailKey)
          logger.info('handleVerifyOTP: Deleted stale/missing OTP record', {
            requestId,
            emailKey
          })
        } catch (deleteError: any) {
          logger.error(
            'handleVerifyOTP: Failed to delete stale/missing OTP record',
            {
              requestId,
              emailKey,
              error: deleteError?.message || deleteError
            }
          )
        }
        return res.status(404).json({
          error: 'OTP not found or expired',
          success: false
        })
      }

      const otpData = otpRecord.data as OTPData
      logger.info('handleVerifyOTP: OTP record retrieved successfully', {
        requestId,
        emailKey,
        attempts: otpData.attempts,
        verified: otpData.verified,
        expiresAt: otpData.expiresAt
      })

      // Check if OTP is already verified
      if (otpData.verified) {
        logger.warn('handleVerifyOTP: OTP already used', {
          requestId,
          emailKey
        })
        return res.status(400).json({
          error: 'OTP already used',
          success: false
        })
      }

      // Check if OTP is expired
      const now = new Date()
      const expiresAt = new Date(otpData.expiresAt)
      if (now > expiresAt) {
        logger.warn('handleVerifyOTP: OTP has expired', {
          requestId,
          emailKey,
          now: now.toISOString(),
          expiresAt: expiresAt.toISOString()
        })
        return res.status(400).json({
          error: 'OTP has expired',
          success: false
        })
      }

      // Check attempt limit
      if (otpData.attempts >= 3) {
        logger.warn('handleVerifyOTP: Maximum verification attempts exceeded', {
          requestId,
          emailKey,
          attempts: otpData.attempts
        })
        return res.status(429).json({
          error: 'Maximum verification attempts exceeded',
          success: false
        })
      }

      // Verify OTP
      logger.debug('handleVerifyOTP: Verifying OTP', { requestId, emailKey })
      if (otpData.otp !== otp) {
        logger.warn('handleVerifyOTP: Invalid OTP provided', {
          requestId,
          emailKey,
          attempts: otpData.attempts + 1,
          attemptsLeft: 2 - otpData.attempts
        })

        // Increment attempts
        await updateDBAdmin('email-verification-otps', emailKey, {
          attempts: otpData.attempts + 1
        })
        logger.info('handleVerifyOTP: OTP attempts incremented', {
          requestId,
          emailKey,
          newAttempts: otpData.attempts + 1
        })

        return res.status(400).json({
          error: 'Invalid OTP',
          success: false,
          attemptsLeft: 2 - otpData.attempts
        })
      }

      logger.info('handleVerifyOTP: OTP verification successful', {
        requestId,
        emailKey
      })

      // OTP is valid - mark as verified
      logger.debug(
        'handleVerifyOTP: Updating verification status in database',
        { requestId, emailKey, userId }
      )
      await Promise.all([
        updateDBAdmin('email-verification-otps', emailKey, {
          verified: true,
          verifiedAt: new Date().toISOString()
        }),
        updateDBAdmin('patients', userId, {
          emailVerification: true,
          emailVerifiedAt: new Date().toISOString()
        })
      ])

      logger.info(
        'handleVerifyOTP: Email verification completed successfully',
        {
          requestId,
          emailKey,
          userId,
          verifiedAt: new Date().toISOString()
        }
      )

      // Send email notification to user confirming verification
      try {
        logger.debug(
          'handleVerifyOTP: Sending verification confirmation email',
          {
            requestId,
            email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
            template: 'default'
          }
        )

        await sendEmail(email, 'Email Verified', 'default', {
          title: 'Email Verified',
          text: 'Your email has been successfully verified. You can now continue using Medvive.'
        })

        logger.info(
          'handleVerifyOTP: Verification confirmation email sent successfully',
          {
            requestId,
            email: email.replace(/(.{2}).*(@.*)/, '$1***$2')
          }
        )
      } catch (emailError) {
        logger.error(
          'handleVerifyOTP: Failed to send verification confirmation email',
          {
            requestId,
            email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
            error: emailError
          }
        )
        // Do not fail the verification response due to email errors
      }

      res.status(200).json({
        message: 'Email verified successfully',
        success: true
      })
    } catch (error) {
      logger.error('handleVerifyOTP: Server error occurred', {
        requestId,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      return res.status(500).json({
        error: 'Internal server error',
        success: false
      })
    }
  }
)

export const handleGetOTPTimeLeft = asyncWrapper(
  async (req: Request, res: Response) => {
    const requestId = Math.random().toString(36).substring(7)
    logger.info('handleGetOTPTimeLeft: Request initiated', {
      requestId,
      body: req.body
    })

    try {
      const userId = req.query?.userId as string

      if (!userId) {
        logger.warn('handleGetOTPTimeLeft: userId is required', { requestId })
        return res.status(400).json({
          error: 'userId is required',
          success: false
        })
      }

      logger.info('handleGetOTPTimeLeft: Input validation successful', {
        requestId,
        userId
      })

      logger.debug(
        'handleGetOTPTimeLeft: Fetching patient record from database',
        {
          requestId,
          userId
        }
      )
      const patientRecord = await getDBAdmin('patients', userId)

      if (!patientRecord?.data) {
        logger.warn('handleGetOTPTimeLeft: Patient not found in database', {
          requestId,
          userId,
          patientRecord
        })
        return res.status(404).json({
          error: 'Patient not found',
          success: false
        })
      }

      const email = (patientRecord.data as any)?.email as string
      const emailKey = email.replace(/[.#$\[\]]/g, '_')
      logger.debug('handleGetOTPTimeLeft: Fetching OTP record', {
        requestId,
        emailKey
      })

      const otpRecord = await getDBAdmin('email-verification-otps', emailKey)
      if (!otpRecord?.data) {
        logger.info('handleGetOTPTimeLeft: No OTP record found', {
          requestId,
          emailKey
        })
        return res.status(200).json({
          success: true,
          exists: false,
          expired: true,
          remainingMs: 0,
          remainingSeconds: 0
        })
      }

      const { expiresAt, verified } = otpRecord.data as OTPData
      const now = Date.now()
      const expiryMs = new Date(expiresAt).getTime()
      const remainingMs = Math.max(expiryMs - now, 0)
      const remainingSeconds = Math.floor(remainingMs / 1000)

      logger.info('handleGetOTPTimeLeft: Computed remaining time', {
        requestId,
        email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
        verified,
        expiresAt,
        remainingMs,
        remainingSeconds
      })

      return res.status(200).json({
        success: true,
        exists: true,
        verified,
        expired: remainingMs <= 0,
        remainingMs,
        remainingSeconds,
        expiresAt
      })
    } catch (error) {
      logger.error('handleGetOTPTimeLeft: Server error occurred', {
        requestId,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      return res.status(500).json({
        error: 'Internal server error',
        success: false
      })
    }
  }
)
