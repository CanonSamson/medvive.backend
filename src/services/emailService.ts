import { SentMessageInfo } from 'nodemailer'
import { parseTemplate } from '../utils/templateParser.js'
import nodemailer from 'nodemailer'
import logger from '../utils/logger.js'

export const sendEmail = async (
  to: string,
  subject: string,
  templateName: string,
  placeholders: { [key: string]: string }
): Promise<SentMessageInfo> => {
  logger.info('Starting email send process', {
    to,
    subject,
    templateName,
    placeholderKeys: Object.keys(placeholders)
  })

  try {
    logger.debug('Parsing email template', { templateName })
    const htmlContent = parseTemplate(templateName, placeholders)

    if (!htmlContent) {
      logger.error('Template parsing failed', { templateName })
      throw new Error(`Template ${templateName} could not be parsed`)
    }
    logger.debug('Template parsed successfully', { templateName })

    logger.debug('Checking email service configuration')
    const isGmail = (process.env.EMAIL_SERVICE || '').toLowerCase() === 'gmail'

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      logger.error('Email auth credentials missing', {
        hasEmailUser: !!process.env.EMAIL_USER,
        hasEmailPassword: !!process.env.EMAIL_PASSWORD
      })
      throw new Error('Email user/password are not configured')
    }

    if (!isGmail && !process.env.SMTP_HOST) {
      logger.error('SMTP host missing', { SMTP_HOST: process.env.SMTP_HOST })
      throw new Error('SMTP_HOST must be configured for non-Gmail services')
    }

    logger.debug('Email service configuration validated', {
      service: process.env.EMAIL_SERVICE,
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT
    })

    logger.debug('Creating email transporter')
    // Prefer explicit SMTP configuration to avoid provider-specific quirks
    const smtpHost = process.env.SMTP_HOST || (isGmail ? 'smtp.gmail.com' : undefined)
    const smtpPort = Number(process.env.SMTP_PORT || (isGmail ? 465 : 587))
    const smtpSecure = (process.env.SMTP_SECURE || (isGmail ? 'true' : 'false')) === 'true'

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true for 465, false for 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      // Connection tuning
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
      connectionTimeout: 20000,
      socketTimeout: 20000,
      greetingTimeout: 20000
    })

    logger.debug('Transporter configuration', {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure
    })

    // Verify transporter connection
    logger.debug('Verifying transporter connection')
    try {
      await transporter.verify()
      logger.debug('Transporter verified successfully')
    } catch (verifyError: any) {
      logger.error('Transporter verification failed', {
        message: verifyError.message,
        code: verifyError.code
      })
      throw new Error(`Email service connection failed: ${verifyError.message}`)
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html: htmlContent
    }

    logger.info('Sending email', {
      from: process.env.EMAIL_USER,
      to,
      subject
    })

    const result = await transporter.sendMail(mailOptions)
    
    logger.info('Email sent successfully', {
      messageId: result.messageId,
      response: result.response,
      to,
      subject
    })

    return result
  } catch (error: any) {
    logger.error('Error sending email:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      to,
      subject,
      templateName
    })
    throw error
  }
}