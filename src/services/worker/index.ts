import axios from 'axios'
import logger from '../../utils/logger.js'
import { sendEmail } from '../emailService.js'

export class NotificationWorkerService {
  async emailNotificationQueueHandler ({
    subject,
    email,
    htmlContent
  }: {
    subject: string
    email: string
    htmlContent: string
  }) {
    try {
      await sendEmail(email, subject, htmlContent)
      logger.info('Email sent successfully:', {
        email,
        subject
      })
    } catch (error: any) {
      logger.error('Error sending email:', {
        error: error
      })
      throw new Error(
        error.response?.data?.message || 'Failed to confirm campaign funds'
      )
    }
  }
}

export const notificationWorkerService = new NotificationWorkerService()
