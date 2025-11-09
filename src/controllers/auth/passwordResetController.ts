import { Request, Response } from 'express'
import asyncWrapper from '../../middlewares/asyncWrapper.js'
import { initializeFirebaseAdmin } from '../../utils/firebase/admin.js'
import { getAuth } from 'firebase-admin/auth'
import { randomBytes } from 'crypto'
import { sendEmail } from '../../services/emailService.js'
import logger from '../../utils/logger.js'

// Force set a new password for a user by UID
export const forceResetUserPassword = asyncWrapper(
  async (req: Request, res: Response) => {
    const { userId, newPassword } = req.body as {
      userId?: string
      newPassword?: string
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    initializeFirebaseAdmin()
    const auth = getAuth()

    const passwordToSet =
      newPassword ||
      randomBytes(12)
        .toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 12)

    await auth.updateUser(userId, { password: passwordToSet })
    // Invalidate existing refresh tokens so sessions are forced to reauthenticate
    await auth.revokeRefreshTokens(userId)

    return res.json({
      message: 'Password reset successfully',
      // Return temporary password only if we generated it here
      ...(newPassword ? {} : { temporaryPassword: passwordToSet })
    })
  }
)

// Generate a Firebase password reset link and email it to the user
export const sendPasswordResetEmail = asyncWrapper(
  async (req: Request, res: Response) => {
    const { userId, email } = req.body as { userId?: string; email?: string }

    initializeFirebaseAdmin()
    const auth = getAuth()

    let targetEmail = email
    if (!targetEmail) {
      if (!userId) {
        return res
          .status(400)
          .json({ error: 'Provide either email or userId' })
      }
      const userRecord = await auth.getUser(userId)
      targetEmail = userRecord.email || undefined
    }

    if (!targetEmail) {
      return res.status(400).json({ error: 'Email not found for user' })
    }

    const continueUrlEnv = process.env.FRONTEND_BASE_URL
    let resetLink: string
    try {
      if (continueUrlEnv) {
        // Append the email to continue URL so backend/front-end can track completion
        let continueUrl = continueUrlEnv
        try {
          const u = new URL(continueUrlEnv)
          u.searchParams.set('email', targetEmail)
          continueUrl = u.toString()
        } catch (e) {
          // If FRONTEND_BASE_URL is not a valid URL, log and use as-is
          logger.warn('FRONTEND_BASE_URL is not a valid URL; using as-is', {
            FRONTEND_BASE_URL: continueUrlEnv
          })
        }

        resetLink = await auth.generatePasswordResetLink(targetEmail, {
          url: continueUrl
        })
      } else {
        resetLink = await auth.generatePasswordResetLink(targetEmail)
      }
    } catch (err: any) {
      // If the continue URL domain is not authorized, fall back to generating a default link
      if (err?.errorInfo?.code === 'auth/unauthorized-continue-uri') {
        logger.warn('Continue URL not authorized; generated reset link without redirect', {
          email: targetEmail
        })
        resetLink = await auth.generatePasswordResetLink(targetEmail)
      } else {
        throw err
      }
    }

    await sendEmail(targetEmail, 'Reset your Medvive password', 'password-reset', {
      resetLink,
      userEmail: targetEmail
    })

    return res.json({ message: 'Password reset email sent' })
  }
)

// Endpoint to track when Firebase redirects after successful password reset
export const passwordResetRedirect = asyncWrapper(
  async (req: Request, res: Response) => {
    const email = (req.query.email as string) || undefined
    logger.info('Password reset completed redirect received', { email })

    // Optionally, update a user activity collection in Firestore here
    // or trigger any analytics/logging you require.

    // Redirect the user to your app login page or dashboard
    const appUrl = process.env.APP_LOGIN_URL || process.env.FRONTEND_BASE_URL || 'https://medvive.ng/'
    return res.redirect(appUrl)
  }
)