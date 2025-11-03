import { SentMessageInfo } from 'nodemailer'
import { parseTemplate } from '../utils/templateParser.js'
import logger from '../utils/logger.js'
import { Resend } from 'resend'

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

    const apiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.EMAIL_FROM
    const fromName = process.env.EMAIL_FROM_NAME || 'Medvive'

    if (!apiKey) {
      logger.error('RESEND_API_KEY is not set in environment variables')
      throw new Error('Missing RESEND_API_KEY')
    }

    if (!fromEmail) {
      logger.error(
        'EMAIL_FROM is not set. Use an address on your verified domain'
      )
      throw new Error('Missing EMAIL_FROM')
    }

    if (!fromEmail.includes('@')) {
      logger.error(
        'EMAIL_FROM must be a full email address like noreply@medvive.ng',
        {
          provided: fromEmail
        }
      )
      throw new Error('Invalid EMAIL_FROM value: expected an email address')
    }

    const resend = new Resend(apiKey)

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html: htmlContent
    })

    if (error) {
      return console.error({ error })
    }

    console.log({ data })

    // const response = await axios.post(
    //   `${process.env.FRONTEND_BASE_URL}/api/send-email`,
    //   {
    //     to,
    //     subject,
    //     htmlContent
    //   }
    // )

    return {
      messageId: data.id,
      success: true
    }
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
