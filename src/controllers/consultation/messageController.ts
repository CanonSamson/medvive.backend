

import { Request, Response } from 'express'
import { scheduleJob, Job } from 'node-schedule'
import { getDBAdmin } from '../../utils/firebase/admin-database.js'
import { sendEmail as sendTemplateEmail } from '../../services/emailService.js'
import logger from '../../utils/logger.js'
import { createDBAdmin, updateDBAdmin } from '../../utils/firebase/admin-database.js'

// Helper to send unseen message notification email
const unSeenEmail = async ({
  sender,
  receiver,
  unseenMessages,
  isPatient
}: {
  sender: any
  receiver: any
  unseenMessages: number
  isPatient: boolean
}) => {
  const subject = `${sender?.fullName || 'A user'} just messaged you`
  const userType = isPatient ? 'patient' : 'doctor'

  await sendTemplateEmail(receiver?.email, subject, 'unseen-message', {
    fullName: sender?.fullName || 'User',
    unseenMessages: String(unseenMessages || 0),
    profileImage: sender?.profileImage || '',
    userType
  })
}

export const sendEmail = async ({
  consultationsChat,
  receiverId,
  senderId
}: {
  consultationsChat: string
  receiverId: string
  senderId: string
}) => {
  try {
    const { success, data: BookingChat } = await getDBAdmin(
      'consultations-chats',
      consultationsChat
    )

    if (!success || !BookingChat) {
      return { error: 'BookingChat not found', receiverId, senderId }
    }
    const seen = BookingChat.seen?.[receiverId]

    if (seen) return { error: 'Chat has no unseen messages' }

    const {
      success: senderSuccess,
      data: sender
    } = await getDBAdmin(
      BookingChat.patientId !== senderId ? 'doctors' : 'patients',
      senderId
    )

    const {
      success: receiverSuccess,
      data: receiver
    } = await getDBAdmin(
      BookingChat.patientId !== receiverId ? 'doctors' : 'patients',
      receiverId
    )
    if (receiverSuccess && senderSuccess && receiver && sender) {
      await unSeenEmail({
        sender,
        unseenMessages: BookingChat.unseenMessages?.[receiverId] || 0,
        receiver,
        isPatient: BookingChat.patientId !== receiverId
      })
      return {
        sender: sender.email,
        unseenMessages: BookingChat.unseenMessages?.[receiverId] || 0,
        receiver: receiver.email,
        isPatient: BookingChat.patientId !== receiverId
      }
    } else {
      return { error: false }
    }
  } catch (error: any) {
    logger.error('sendEmail: Server error', { error })
    return { error: 'Server error' }
  }
}

const scheduledJobs: Record<string, Job> = {}

export const handleCancelJobs = (id: string, maybeid: string) => {
  if (scheduledJobs[id]) {
    scheduledJobs[id].cancel()
    delete scheduledJobs[id]
    updateDBAdmin('scheduled-jobs', id, {
      status: 'canceled',
      canceledAt: new Date().toISOString()
    }).catch(() => {})
  }
  if (scheduledJobs[maybeid]) {
    scheduledJobs[maybeid].cancel()
    delete scheduledJobs[maybeid]
    updateDBAdmin('scheduled-jobs', maybeid, {
      status: 'canceled',
      canceledAt: new Date().toISOString()
    }).catch(() => {})
  }
}

export const checkUnSeenMessages = async (req: Request, res: Response) => {
  const { consultationsChat, senderId, receiverId } = req.params as any

  try {
    const id = `${senderId}${receiverId}`
    logger.info('Scheduling unseen message check', { id })
    const maybeid = `${receiverId}${senderId}`

    handleCancelJobs(id, maybeid)
    const runDate = new Date()
    runDate.setMinutes(runDate.getMinutes() + 1)

    const job = scheduleJob(runDate, async (fireDate: Date) => {
      const response = await sendEmail({
        consultationsChat,
        receiverId,
        senderId
      })
      logger.info('Unseen message job executed', {
        fireDate,
        now: new Date(),
        response
      })
      handleCancelJobs(id, maybeid)
      await updateDBAdmin('scheduled-jobs', id, {
        status: 'executed',
        executedAt: new Date().toISOString()
      }).catch(() => {})
    })

    scheduledJobs[id] = job as Job

    await createDBAdmin('scheduled-jobs', id, {
      type: 'unseen-message',
      runAt: runDate.toISOString(),
      status: 'scheduled',
      payload: { consultationsChat, receiverId, senderId },
      createdAt: new Date().toISOString()
    })

    res.status(200).json({ message: 'Job scheduled successfully' })
  } catch (error: any) {
    logger.error('Failed to schedule unseen message job', { error })
    res.status(500).json({ error })
  }
}
