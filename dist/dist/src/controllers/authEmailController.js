import asyncWrapper from '../middlewares/asyncWrapper.js';
import { sendEmail } from '../services/emailService.js';
export const sendWelcomeEmail = asyncWrapper(async (req, res) => {
    const { email, firstName, otp } = req.body;
    try {
        await sendEmail(email, 'Welcome to Our Service', 'signup-otp-verified', {
            firstName,
            otp
        });
        res.status(200).json({ message: 'Welcome email sent successfully!' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to send email', error });
    }
});
export const sendOtpVerifiedEmail = asyncWrapper(async (req, res) => {
    const { email, firstName } = req.body;
    try {
        await sendEmail(email, 'Welcome', 'welcome-email', {
            firstName
        });
        res.status(200).json({ message: 'Welcome email sent successfully!' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to send email', error });
    }
});
export const sendForgetPasswordEmail = asyncWrapper(async (req, res) => {
    const { email, link } = req.body;
    try {
        await sendEmail(email, 'Forgot Password', 'forgot-password', { link });
        res.status(200).json({ message: 'Password reset email sent successfully!' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to send email', error });
    }
});
//# sourceMappingURL=authEmailController.js.map
//# sourceMappingURL=authEmailController.js.map