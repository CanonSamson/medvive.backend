import { SentMessageInfo } from 'nodemailer'
import { parseTemplate } from '../utils/templateParser.js'
import nodemailer from 'nodemailer'
import logger from '../utils/logger.js'
import axios from 'axios'


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


   const response=await axios.post(`${process.env.FRONTEND_BASE_URL}/api/send-email`, {
      to,
      subject,
      htmlContent
    })

    

    return {
      messageId: response.data.messageId,
      response: response.data.response,
      success: true
    }
    logger.debug('Checking email service configuration')

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      logger.error('Email auth credentials missing', {
        hasEmailUser: !!process.env.EMAIL_USER,
        hasEmailPassword: !!process.env.EMAIL_PASSWORD
      })
      throw new Error('Email user/password are not configured')
    }

    logger.debug('Creating email transporter')

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD 
      },
 
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
  }
}
