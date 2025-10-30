import passport from 'passport'
import { OAuth2Strategy as GoogleStrategy } from 'passport-google-oauth'
import logger from '../utils/logger.js'
import dotenv from 'dotenv'

// Load env variables so strategy configuration is available at import time
dotenv.config()

const clientID = process.env.GOOGLE_CLIENT_ID
const clientSecret = process.env.GOOGLE_CLIENT_SECRET
const backendUrl = process.env.BACKEND_URL

if (!clientID || !clientSecret || !backendUrl) {
  logger.warn('Google OAuth strategy not initialized: missing configuration', {
    hasClientID: !!clientID,
    hasClientSecret: !!clientSecret,
    hasBackendUrl: !!backendUrl
  })
} else {
  const googleStrategy = new GoogleStrategy(
    {
      callbackURL: `${backendUrl}/v1/api/auth/google/callback`,
      clientID,
      clientSecret
    },
    async function (
      accessToken: string,
      refreshToken: string,
      profile: any,
      cb: (err: any, user?: any) => void
    ) {
      try {
        logger.debug('Google OAuth callback received', {
          provider: 'google',
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          profileId: profile?.id,
          profileProvider: profile?.provider
        })

        const email = profile._json.email
        const firstName = profile._json.given_name
        const lastName = profile._json.family_name
        const picture = profile._json.picture
        const googleId = profile.id

        logger.info('Google profile parsed', {
          email,
          firstName,
          lastName,
          hasPicture: !!picture,
          googleId
        })

        const existingUser = true
        logger.info('Google authentication successful', {
          message: 'Google authentication successful',
          success: true,
          action: existingUser ? 'login' : 'register'
        })

        cb(null, {
          action: existingUser ? 'login' : 'register'
        })
      } catch (error: any) {
        console.error('Google Auth Error:', error)
        logger.error('Google authentication failed', {
          error: error.message,
          stack: error.stack,
          name: error.name
        })

        return cb(error, null)
      }
    }
  )

  passport.use(googleStrategy)
}
