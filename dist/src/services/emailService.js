import { parseTemplate } from '../utils/templateParser.js';
import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';
export const sendEmail = async (to, subject, templateName, placeholders) => {
    logger.info('Starting email send process', {
        to,
        subject,
        templateName,
        placeholderKeys: Object.keys(placeholders)
    });
    try {
        logger.debug('Parsing email template', { templateName });
        const htmlContent = parseTemplate(templateName, placeholders);
        if (!htmlContent) {
            logger.error('Template parsing failed', { templateName });
            throw new Error(`Template ${templateName} could not be parsed`);
        }
        logger.debug('Template parsed successfully', { templateName });
        logger.debug('Checking email service configuration');
        if (!process.env.EMAIL_SERVICE ||
            !process.env.EMAIL_USER ||
            !process.env.EMAIL_PASSWORD) {
            logger.error('Email service credentials missing', {
                hasEmailService: !!process.env.EMAIL_SERVICE,
                hasEmailUser: !!process.env.EMAIL_USER,
                hasEmailPassword: !!process.env.EMAIL_PASSWORD
            });
            throw new Error('Email service credentials are not configured');
        }
        logger.debug('Email service configuration validated');
        logger.debug('Creating email transporter');
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            },
            // Add timeout settings
            connectionTimeout: 10000,
            greetingTimeout: 10000
        });
        // Verify transporter connection
        logger.debug('Verifying transporter connection');
        try {
            await transporter.verify();
            logger.debug('Transporter verified successfully');
        }
        catch (verifyError) {
            logger.error('Transporter verification failed', {
                message: verifyError.message,
                code: verifyError.code
            });
            throw new Error(`Email service connection failed: ${verifyError.message}`);
        }
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            html: htmlContent
        };
        logger.info('Sending email', {
            from: process.env.EMAIL_USER,
            to,
            subject
        });
        const result = await transporter.sendMail(mailOptions);
        logger.info('Email sent successfully', {
            messageId: result.messageId,
            response: result.response,
            to,
            subject
        });
        return result;
    }
    catch (error) {
        logger.error('Error sending email:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            command: error.command,
            responseCode: error.responseCode,
            to,
            subject,
            templateName
        });
        throw error;
    }
};
//# sourceMappingURL=emailService.js.map