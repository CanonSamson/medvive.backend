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
  try {
    const htmlContent = parseTemplate(templateName, placeholders)

    // Create a transporter with improved timeout and debugging
    // const transporter = nodemailer.createTransport({
    //   host: process.env.EMAIL_SERVICE, // SMTP server host
    //   port: 587, // Port for SMTP (587 is common for TLS)
    //   secure: false, // Use TLS (upgrade later with STARTTLS)
    //   auth: {
    //     user: process.env.EMAIL_USER, // SMTP username
    //     pass: process.env.EMAIL_PASSWORD // SMTP password
    //   },
    //   connectionTimeout: 60000, // Increase connection timeout to 60 seconds
    //   socketTimeout: 60000, // Increase socket timeout to 60 seconds
    //   debug: true, // Enable debugging for detailed logs
    //   logger: true // Log output to console
    // })
 const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
    
    const mailOptions = {
      from: process.env.EMAIL,
      to,
      subject,
      html: htmlContent
    }

    const result = await transporter.sendMail(mailOptions)
    console.log('Email sent:', result.messageId)
    return result
  } catch (error: any) {
    logger.error('Error sending email:', {
      error: error
    })
  }
}
