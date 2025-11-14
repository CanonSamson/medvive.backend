import { Request, Response } from 'express'
import logger from '../../utils/logger.js'
import { doctorService } from '../../services/doctor/index.js'
import { initializeFirebaseAdmin } from '../../utils/firebase/admin.js'
import { getAuth } from 'firebase-admin/auth'
import { sendEmail } from '../../services/emailService.js'

// Onboard a doctor: create Firebase Auth user and Firestore profile
export const onboardDoctor = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body

    const result = await doctorService.onboardDoctor({
      email,
      password,
      fullName
    })

    if (result.success) {


      return res.status(201).json(result)
    }

    const msg = (result.message || '').toLowerCase()
    if (result.error === 'VALIDATION_ERROR' || msg.includes('required')) {
      return res.status(400).json(result)
    }
    if (msg.includes('already exists')) {
      return res.status(409).json(result)
    }
    return res.status(500).json(result)
  } catch (error: any) {
    logger.error('onboardDoctor: unexpected error', {
      error: error?.message || error
    })
    return res.status(500).json({
      success: false,
      message: 'Unexpected error',
      error: error?.message || String(error)
    })
  }
}
