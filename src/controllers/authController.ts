import { Request, Response } from 'express'
import { z } from 'zod'
import asyncWrapper from '../middlewares/asyncWrapper.js'
import { sendEmail } from '../services/emailService.js'
import { getDBAdmin, createDBAdmin, updateDBAdmin } from '../utils/firebase/admin-database.js'
import { generateOTP } from '../utils/generateOTP.js'
import { PatientData, OTPData } from '../../custom-types.js'

export const handleSendOTP = asyncWrapper(async (req: Request, res: Response) => {
  try {
    const body = req.body

    // Validate input
    const result = z
      .object({
        userId: z.string()
      })
      .safeParse(body)

    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues,
        success: false
      })
    }

    const { userId } = result.data

    const patientRecord = await getDBAdmin('patients', userId)

    if (!patientRecord?.data) {
      return res.status(404).json({
        error: 'Patient not found',
        success: false,
        patientRecord
      })
    }

    const patientData = patientRecord.data as PatientData
    const email = patientData.email
    const fullName = patientData.fullName

    // Generate OTP
    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now

    // Store OTP in Firebase (using email as document ID for easy retrieval)
    const otpData: OTPData = {
      otp,
      email,
      expiresAt: expiresAt.toISOString(),
      attempts: 0,
      verified: false,
      createdAt: new Date().toISOString()
    }

    // Create or update OTP record using Admin SDK
    await createDBAdmin(
      'email-verification-otps',
      email.replace(/[.#$\[\]]/g, '_'),
      otpData
    )

    // Send OTP email
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

      return res.status(201).json({
        message: 'OTP sent successfully',
        success: true,
        expiresAt: expiresAt.toISOString()
      })
    } catch (emailError) {
      console.error('Email sending failed:', emailError)
      return res.status(500).json({
        error: 'Failed to send OTP email',
        success: false
      })
    }
  } catch (error) {
    console.error('Server error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      success: false
    })
  }
})

export const handleVerifyOTP = asyncWrapper(async (req: Request, res: Response) => {
  try {
    const body = req.body

    // Validate input
    const result = z
      .object({
        otp: z.string().length(5, 'OTP must be 5 digits'),
        userId: z.string()
      })
      .safeParse(body)

    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues,
        success: false
      })
    }

    const { otp, userId } = result.data

    const patientRecord = await getDBAdmin('patients', userId)

    if (!patientRecord?.data) {
      return res.status(404).json({
        error: 'Patient not found',
        success: false,
        patientRecord
      })
    }

    const patientData = patientRecord.data as PatientData
    const email = patientData.email
    const emailKey = email.replace(/[.#$\[\]]/g, '_')

    // Get OTP record from Firebase using Admin SDK
    const otpRecord = await getDBAdmin('email-verification-otps', emailKey)

    if (!otpRecord.success || !otpRecord.data) {
      return res.status(404).json({
        error: 'OTP not found or expired',
        success: false
      })
    }

    const otpData = otpRecord.data as OTPData

    // Check if OTP is already verified
    if (otpData.verified) {
      return res.status(400).json({
        error: 'OTP already used',
        success: false
      })
    }

    // Check if OTP is expired
    const now = new Date()
    const expiresAt = new Date(otpData.expiresAt)
    if (now > expiresAt) {
      return res.status(400).json({
        error: 'OTP has expired',
        success: false
      })
    }

    // Check attempt limit
    if (otpData.attempts >= 3) {
      return res.status(429).json({
        error: 'Maximum verification attempts exceeded',
        success: false
      })
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      // Increment attempts
      await updateDBAdmin('email-verification-otps', emailKey, {
        attempts: otpData.attempts + 1
      })

      return res.status(400).json({
        error: 'Invalid OTP',
        success: false,
        attemptsLeft: 2 - otpData.attempts
      })
    }

    // OTP is valid - mark as verified
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

    return res.status(200).json({
      message: 'Email verified successfully',
      success: true
    })
  } catch (error) {
    console.error('Server error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      success: false
    })
  }
})