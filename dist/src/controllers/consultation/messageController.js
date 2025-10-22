import { scheduleJob } from 'node-schedule';
import { getDBAdmin } from '../../utils/firebase/admin-database.js';
import { sendEmail as sendTemplateEmail } from '../../services/emailService.js';
import logger from '../../utils/logger.js';
// Helper to send unseen message notification email
const unSeenEmail = async ({ sender, receiver, unseenMessages, isPatient }) => {
    const subject = `${sender?.fullName || 'A user'} just messaged you`;
    const userType = isPatient ? 'patient' : 'doctor';
    await sendTemplateEmail(receiver?.email, subject, 'unseen-message', {
        fullName: sender?.fullName || 'User',
        unseenMessages: String(unseenMessages || 0),
        profileImage: sender?.profileImage || '',
        userType
    });
};
export const sendEmail = async ({ consultationsChat, receiver_uid, sender_uid }) => {
    try {
        const { success, data: BookingChat } = await getDBAdmin('consultations-chats', consultationsChat);
        if (!success || !BookingChat) {
            return { error: 'BookingChat not found', receiver_uid, sender_uid };
        }
        const seen = BookingChat.seen?.[receiver_uid];
        if (seen)
            return { error: 'Chat has no unseen messages' };
        const { success: senderSuccess, data: sender } = await getDBAdmin(BookingChat.patientId !== sender_uid ? 'doctors' : 'patients', sender_uid);
        const { success: receiverSuccess, data: receiver } = await getDBAdmin(BookingChat.patientId !== receiver_uid ? 'doctors' : 'patients', receiver_uid);
        if (receiverSuccess && senderSuccess && receiver && sender) {
            await unSeenEmail({
                sender,
                unseenMessages: BookingChat.unseenMessages?.[receiver_uid] || 0,
                receiver,
                isPatient: BookingChat.patientId !== receiver_uid
            });
            return {
                sender: sender.email,
                unseenMessages: BookingChat.unseenMessages?.[receiver_uid] || 0,
                receiver: receiver.email,
                isPatient: BookingChat.patientId !== receiver_uid
            };
        }
        else {
            return { error: false };
        }
    }
    catch (error) {
        logger.error('sendEmail: Server error', { error });
        return { error: 'Server error' };
    }
};
const scheduledJobs = {};
export const handleCancelJobs = (id, maybeid) => {
    if (scheduledJobs[id]) {
        scheduledJobs[id].cancel();
        delete scheduledJobs[id];
    }
    if (scheduledJobs[maybeid]) {
        scheduledJobs[maybeid].cancel();
        delete scheduledJobs[maybeid];
    }
};
export const checkUnSeenMessages = async (req, res) => {
    const { consultationsChat, sender_uid, receiver_uid } = req.params;
    try {
        const id = `${sender_uid}${receiver_uid}`;
        logger.info('Scheduling unseen message check', { id });
        const maybeid = `${receiver_uid}${sender_uid}`;
        handleCancelJobs(id, maybeid);
        // Calculate the date and time when you want the job to run once
        const runDate = new Date();
        runDate.setMinutes(runDate.getMinutes() + 1);
        // Schedule the job to run once at the specified date and time
        const job = scheduleJob(runDate, async (fireDate) => {
            const response = await sendEmail({
                consultationsChat,
                receiver_uid,
                sender_uid
            });
            logger.info('Unseen message job executed', {
                fireDate,
                now: new Date(),
                response
            });
            handleCancelJobs(id, maybeid);
        });
        // Store the job reference if needed
        scheduledJobs[id] = job;
        res.status(200).json({ message: 'Job scheduled successfully' });
    }
    catch (error) {
        logger.error('Failed to schedule unseen message job', { error });
        res.status(500).json({ error });
    }
};
//# sourceMappingURL=messageController.js.map