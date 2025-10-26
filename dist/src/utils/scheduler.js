import { scheduleJob } from 'node-schedule';
import { getAdminFirestore } from './firebase/admin.js';
import { updateDBAdmin } from './firebase/admin-database.js';
import logger from './logger.js';
import { sendEmail, handleCancelJobs } from '../controllers/consultation/messageController.js';
const restoredJobs = {};
export const restoreUnSeenMessageJobs = async () => {
    try {
        const db = getAdminFirestore();
        const snapshot = await db
            .collection('scheduled-jobs')
            .where('type', '==', 'unseen-message')
            .where('status', '==', 'scheduled')
            .get();
        const now = new Date();
        snapshot.forEach(doc => {
            const data = doc.data();
            const runAt = new Date(data.runAt);
            const scheduleDate = runAt > now ? runAt : new Date(now.getTime() + 10000);
            const id = doc.id;
            if (restoredJobs[id]) {
                restoredJobs[id].cancel();
                delete restoredJobs[id];
            }
            const job = scheduleJob(scheduleDate, async (fireDate) => {
                const payload = data.payload || {};
                const response = await sendEmail(payload);
                logger.info('Restored unseen message job executed', {
                    id,
                    fireDate,
                    response
                });
                await updateDBAdmin('scheduled-jobs', id, {
                    status: 'executed',
                    executedAt: new Date().toISOString()
                }).catch(() => { });
                // cancel any controller-side job tracking as well
                handleCancelJobs(id, id);
                // remove local restored job reference
                if (restoredJobs[id]) {
                    restoredJobs[id].cancel();
                    delete restoredJobs[id];
                }
            });
            restoredJobs[id] = job;
            logger.info('Restored unseen message job scheduled', { id, scheduleDate });
        });
        logger.info('Restore routine completed for unseen-message jobs', {
            count: snapshot.size
        });
    }
    catch (error) {
        logger.error('Failed to restore unseen-message jobs', { error });
    }
};
//# sourceMappingURL=scheduler.js.map