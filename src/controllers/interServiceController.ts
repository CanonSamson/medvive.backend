import asyncWrapper from '../middlewares/asyncWrapper.js'
import { sendEmail } from '../services/emailService.js'
import logger from '../utils/logger.js'

export const sendEmailHandler = asyncWrapper(async (req, res) => {
  const { data, subject, email, templateName } = req.body
  logger.info('Received email send request', { email, subject, templateName })

  try {
    await sendEmail(email, subject, templateName, data)

    logger.debug('Successfully sent email', { email, subject })
    res.status(200).json({ success: true })
  } catch (error) {
    logger.error('Failed to send email', {
      error,
      email,
      subject,
      templateName
    })
    res
      .status(500)
      .json({ success: false, message: 'Failed to send email', error })
  }
})
