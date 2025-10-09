import asyncWrapper from '../middlewares/asyncWrapper.js';
import { sendEmail } from '../services/emailService.js';
export const sendKycCompletedEmail = asyncWrapper(async (req, res) => {
    const { email, link } = req.body;
    try {
        await sendEmail(email, 'Congratulations! 🎉', 'kyc-complete', {
            link
        });
        res.status(200).json({ message: 'Congratulations! 🎉' });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to send email', error });
    }
});
//# sourceMappingURL=kycEmailController.js.map