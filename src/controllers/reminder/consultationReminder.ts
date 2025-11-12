import asyncWrapper from '../../middlewares/asyncWrapper.js'
import logger from '../../utils/logger.js'
import { sendPendingConsultationPaymentReminder } from '../../utils/scheduler/pendingReminder.js'

// POST/GET handler to manually trigger a payment reminder by transactionId
export const triggerPendingConsultationPaymentReminder = asyncWrapper(
  async (req, res) => {
    const { transactionId, force } = {
      ...req.body,
      ...req.params,
      ...req.query
    } as { transactionId?: string; force?: boolean }

    if (!transactionId || typeof transactionId !== 'string') {
      logger.warn('Manual reminder trigger: missing or invalid transactionId', {
        transactionId
      })
      return res
        .status(400)
        .json({ success: false, error: 'transactionId is required' })
    }

    logger.info('Manual payment reminder trigger initiated', { transactionId })

    await sendPendingConsultationPaymentReminder(transactionId, {
      force: force === true
    })

    return res.status(200).json({ success: true, transactionId })
  }
)
