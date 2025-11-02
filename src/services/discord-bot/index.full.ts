import { discordClient } from '../../../discord/index.js'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  EmbedBuilder,
  type MessageActionRowComponentBuilder,
  type TextChannel
} from 'discord.js'
import { consultationPaymentService } from '../consultation/payment.js'
import { withdrawalService } from '../consultation/withdrawal.js'
import logger from '../../utils/logger.js'
import { getDBAdmin } from '../../utils/firebase/admin-database.js'
import { getAdminFirestore } from '../../utils/firebase/admin.js'

type ApprovalPayload = {
  consultationId: string
  patientId: string
  doctorId: string
  walletTransactionId?: string
  amount?: number
}

type WithdrawalApprovalPayload = {
  withdrawalId: string
  doctorId: string
  amount?: number
  bankName?: string
  accountNumber?: string
  accountName?: string
}

type ApprovalTokenData = {
  kind?: 'CONSULTATION_PAYOUT' | 'WITHDRAWAL'
  payload: ApprovalPayload | WithdrawalApprovalPayload
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  processedAt?: string
  processedBy?: string
  channelId?: string
  messageId?: string
}

async function createApprovalToken (
  payload: ApprovalPayload | WithdrawalApprovalPayload,
  meta?: { channelId?: string; messageId?: string },
  kind: 'CONSULTATION_PAYOUT' | 'WITHDRAWAL' = 'CONSULTATION_PAYOUT'
): Promise<string> {
  const db = getAdminFirestore()
  const doc: ApprovalTokenData = {
    kind,
    payload,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    channelId: meta?.channelId,
    messageId: meta?.messageId
  }
  const ref = await db.collection('discord-approval-prompts').add(doc)
  return ref.id
}

function buildCustomId (
  action: 'approve' | 'reject',
  tokenId?: string
): string {
  return tokenId ? `${action}|${tokenId}` : action
}

function parseCustomId (customId: string): {
  action?: 'approve' | 'reject'
  tokenId?: string
  consultationId?: string // legacy
  patientId?: string // legacy
  doctorId?: string // legacy
  walletTransactionId?: string // legacy
} {
  const parts = customId.split('|')
  const action = parts[0]
  const isAction = action === 'approve' || action === 'reject'
  if (parts.length === 2) {
    return {
      action: isAction ? (action as 'approve' | 'reject') : undefined,
      tokenId: parts[1]
    }
  }
  const [_, consultationId, patientId, doctorId, walletTransactionId] = parts
  return {
    action: isAction ? (action as 'approve' | 'reject') : undefined,
    consultationId,
    patientId,
    doctorId,
    walletTransactionId
  }
}

export class DiscordBotService {
  async sendApprovalPrompt (
    channelId: string,
    content = 'A new request is pending approval. What would you like to do?',
    payload?: ApprovalPayload
  ) {
    logger.info('DiscordBotService.sendApprovalPrompt: Attempting to send prompt', {
      channelId,
      content,
      payload
    })
    const channel = discordClient.channels.cache.get(channelId)

    if (!channel || !channel.isTextBased()) {
      logger.warn('DiscordBotService.sendApprovalPrompt: Channel not found or not text-based', {
        channelId
      })
      throw new Error('Channel not found or not text-based')
    }

    // Buttons are attached after sending embed to capture messageId in token metadata

    // Build embed card with doctor/patient details
    let doctorName = 'Unknown doctor'
    let doctorEmail = '—'
    let doctorPhone = '—'
    let doctorSpecialty = '—'
    let patientName = 'Unknown patient'
    let patientEmail = '—'
    let patientPhone = '—'

    try {
      if (payload?.doctorId) {
        const d = await getDBAdmin('doctors', payload.doctorId)
        const dd = (d?.data || {}) as any
        doctorName = dd.fullName || dd.name || `Doctor ${payload.doctorId}`
        doctorEmail = dd.email || dd.medviveEmail || '—'
        doctorPhone = dd.phoneNumber || '—'
        doctorSpecialty = dd.specialty || '—'
      }
      if (payload?.patientId) {
        const p = await getDBAdmin('patients', payload.patientId)
        const pd = (p?.data || {}) as any
        patientName = pd.fullName || pd.name || `Patient ${payload.patientId}`
        patientEmail = pd.email || '—'
        patientPhone = pd.phoneNumber || pd.mobilenumber || '—'
      }
    } catch (e: any) {
      logger.warn('DiscordBotService.sendApprovalPrompt: Failed to fetch doctor/patient details', {
        channelId,
        error: e?.message || e
      })
    }

    const amountStr =
      payload?.amount != null
        ? `₦${Number(payload.amount).toLocaleString('en-NG')}`
        : 'N/A'

    const embed = new EmbedBuilder()
      .setTitle('Consultation Payout Approval')
      .setDescription(content)
      .addFields(
        { name: 'Consultation ID', value: payload?.consultationId || 'N/A', inline: true },
        { name: 'Amount', value: amountStr, inline: true },
        { name: 'Transaction ID', value: payload?.walletTransactionId || 'N/A', inline: true },
        { name: 'Doctor', value: `${doctorName}\nID: ${payload?.doctorId || 'N/A'}\nEmail: ${doctorEmail}\nPhone: ${doctorPhone}\nSpecialty: ${doctorSpecialty}`, inline: false },
        { name: 'Patient', value: `${patientName}\nID: ${payload?.patientId || 'N/A'}\nEmail: ${patientEmail}\nPhone: ${patientPhone}`, inline: false }
      )
      .setTimestamp(new Date())
      .setColor(0x2ecc71)

    // Send message with embed card only first
    const sentMessage = await (channel as TextChannel).send({
      embeds: [embed]
    })
    // Create a short approval token in Firestore to keep customId within length limits
    const tokenId = payload ? await createApprovalToken(payload, { channelId, messageId: sentMessage.id }, 'CONSULTATION_PAYOUT') : undefined

    // Now attach buttons referencing the token
    const approveButton = new ButtonBuilder()
      .setCustomId(buildCustomId('approve', tokenId))
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success)

    const rejectButton = new ButtonBuilder()
      .setCustomId(buildCustomId('reject', tokenId))
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger)

    const row =
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        approveButton,
        rejectButton
      )

    await sentMessage.edit({ components: [row] })
    logger.info('DiscordBotService.sendApprovalPrompt: Prompt sent', {
      channelId,
      messageId: sentMessage.id
    })
  }

  async sendWithdrawalApprovalPrompt (
    channelId: string,
    content = 'A withdrawal is pending approval. What would you like to do?',
    payload?: WithdrawalApprovalPayload
  ) {
    logger.info('DiscordBotService.sendWithdrawalApprovalPrompt: Attempting to send prompt', {
      channelId,
      content,
      payload
    })
    const channel = discordClient.channels.cache.get(channelId)

    if (!channel || !channel.isTextBased()) {
      logger.warn('DiscordBotService.sendWithdrawalApprovalPrompt: Channel not found or not text-based', {
        channelId
      })
      throw new Error('Channel not found or not text-based')
    }

    // Build embed card with doctor details and withdrawal info
    let doctorName = 'Unknown doctor'
    let doctorEmail = '—'
    let doctorPhone = '—'
    try {
      if (payload?.doctorId) {
        const d = await getDBAdmin('doctors', payload.doctorId)
        const dd = (d?.data || {}) as any
        doctorName = dd.fullName || dd.name || `Doctor ${payload.doctorId}`
        doctorEmail = dd.email || dd.medviveEmail || '—'
        doctorPhone = dd.phoneNumber || '—'
      }
    } catch (e: any) {
      logger.warn('DiscordBotService.sendWithdrawalApprovalPrompt: Failed to fetch doctor details', {
        channelId,
        error: e?.message || e
      })
    }

    const amountStr =
      payload?.amount != null
        ? `₦${Number(payload.amount).toLocaleString('en-NG')}`
        : 'N/A'

    const bankSummary = `${payload?.bankName || '—'} | ${payload?.accountName || '—'} | ${payload?.accountNumber || '—'}`

    const embed = new EmbedBuilder()
      .setTitle('Withdrawal Approval')
      .setDescription(content)
      .addFields(
        { name: 'Withdrawal ID', value: payload?.withdrawalId || 'N/A', inline: true },
        { name: 'Amount', value: amountStr, inline: true },
        { name: 'Doctor', value: `${doctorName}\nID: ${payload?.doctorId || 'N/A'}\nEmail: ${doctorEmail}\nPhone: ${doctorPhone}`, inline: false },
        { name: 'Bank Details', value: bankSummary, inline: false }
      )
      .setTimestamp(new Date())
      .setColor(0xf1c40f)

    const sentMessage = await (channel as TextChannel).send({ embeds: [embed] })
    const tokenId = payload ? await createApprovalToken(payload, { channelId, messageId: sentMessage.id }, 'WITHDRAWAL') : undefined

    const approveButton = new ButtonBuilder()
      .setCustomId(buildCustomId('approve', tokenId))
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success)
    const rejectButton = new ButtonBuilder()
      .setCustomId(buildCustomId('reject', tokenId))
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger)
    const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(approveButton, rejectButton)
    await sentMessage.edit({ components: [row] })
    logger.info('DiscordBotService.sendWithdrawalApprovalPrompt: Prompt sent', {
      channelId,
      messageId: sentMessage.id
    })
  }

  registerApprovalButtonsHandler () {
    discordClient.on('interactionCreate', async interaction => {
      const requestId = Math.random().toString(36).substring(7)
      try {
        if (!interaction.isButton()) return
        logger.info('DiscordBotService.registerApprovalButtonsHandler: Button interaction received', {
          requestId,
          userId: interaction.user?.id,
          customId: interaction.customId,
          channelId: interaction.channelId,
          messageId: interaction.message?.id
        })
        const meta = parseCustomId(interaction.customId)
        const db = getAdminFirestore()
        let payloadFromToken: (ApprovalPayload | WithdrawalApprovalPayload) | undefined
        let tokenStatus: string | undefined
        let tokenKind: 'CONSULTATION_PAYOUT' | 'WITHDRAWAL' = 'CONSULTATION_PAYOUT'
        if (meta.tokenId) {
          const doc = await db.collection('discord-approval-prompts').doc(meta.tokenId).get()
          const data = doc.data() as ApprovalTokenData | undefined
          payloadFromToken = data?.payload
          tokenStatus = data?.status
          tokenKind = (data?.kind || 'CONSULTATION_PAYOUT')
        }
        const p = payloadFromToken as any
        const baseInfo = tokenKind === 'WITHDRAWAL'
          ? `withdrawalId=${p?.withdrawalId || 'N/A'}, doctorId=${p?.doctorId || 'N/A'}`
          : `consultationId=${p?.consultationId || 'N/A'}, patientId=${p?.patientId || 'N/A'}, doctorId=${p?.doctorId || 'N/A'}`

        // Defer immediately to avoid Discord 3s timeout on heavy operations
        if (meta.action === 'approve' || meta.action === 'reject') {
          try {
            if (!interaction.deferred && !interaction.replied) {
              await interaction.deferReply({ ephemeral: true })
            }
          } catch (e: any) {
            logger.warn('DiscordBotService.registerApprovalButtonsHandler: Failed to defer reply', {
              requestId,
              error: e?.message || e
            })
          }
        }

        const safeRespond = async (opts: { content?: string; embeds?: any; components?: any }) => {
          if (interaction.deferred || interaction.replied) {
            const { content, embeds, components } = opts
            return interaction.editReply({ content, embeds, components })
          } else {
            return interaction.reply({ ...opts, flags: MessageFlags.Ephemeral })
          }
        }

        if (meta.action === 'approve') {
          if (tokenStatus && tokenStatus !== 'PENDING') {
            await safeRespond({
              content: 'This request has already been processed.'
            })
            return
          }
          if (tokenKind === 'WITHDRAWAL') {
            if (!p?.withdrawalId || !p?.doctorId) {
              logger.warn('DiscordBotService.registerApprovalButtonsHandler: Missing metadata for withdrawal approval', {
                requestId,
                meta,
                tokenStatus
              })
              await safeRespond({ content: 'Missing metadata to approve withdrawal.' })
              return
            }
            logger.info('DiscordBotService.registerApprovalButtonsHandler: Approving withdrawal', {
              requestId,
              meta,
              tokenId: meta.tokenId
            })
            const result = await withdrawalService.approveWithdrawal(p.withdrawalId, {
              approvedBy: interaction.user?.id
            })
            if (result.success) {
              logger.info('DiscordBotService.registerApprovalButtonsHandler: Withdrawal approval succeeded', {
                requestId,
                meta,
                tokenId: meta.tokenId
              })
              if (meta.tokenId) {
                await db.collection('discord-approval-prompts').doc(meta.tokenId).update({
                  status: 'APPROVED',
                  processedAt: new Date().toISOString(),
                  processedBy: interaction.user?.id
                })
              }
              const disabledRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                new ButtonBuilder().setCustomId('approve').setLabel('Approve').setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setCustomId('reject').setLabel('Reject').setStyle(ButtonStyle.Danger).setDisabled(true)
              )
              await interaction.message.edit({ components: [disabledRow] })
              logger.debug('DiscordBotService.registerApprovalButtonsHandler: Disabled buttons after withdrawal approval', {
                requestId,
                messageId: interaction.message.id
              })
              await safeRespond({ content: `Withdrawal Approved 👍 (${baseInfo})` })
            } else {
              logger.error('DiscordBotService.registerApprovalButtonsHandler: Withdrawal approval failed', {
                requestId,
                error: result.message,
                meta,
                tokenId: meta.tokenId
              })
              await safeRespond({ content: `Approval failed: ${result.message || 'Unknown error'}` })
            }
          } else {
            if (!p?.consultationId || !p?.doctorId || !p?.patientId) {
              logger.warn('DiscordBotService.registerApprovalButtonsHandler: Missing metadata for approval', {
                requestId,
                meta,
                tokenStatus
              })
              await safeRespond({
                content: 'Missing metadata to approve payout.'
              })
              return
            }
            logger.info('DiscordBotService.registerApprovalButtonsHandler: Approving initialized payout', {
              requestId,
              meta,
              tokenId: meta.tokenId
            })
            const result = await consultationPaymentService.approveInitializedPaymentToDoctorWallet(
              p.consultationId,
              p.doctorId,
              p.patientId,
              p.walletTransactionId
            )
            if (result.success) {
              logger.info('DiscordBotService.registerApprovalButtonsHandler: Approval succeeded', {
                requestId,
                walletTransactionId: result.walletTransactionId,
                amount: (result as any).amount,
                meta,
                tokenId: meta.tokenId
              })
              if (meta.tokenId) {
                await db.collection('discord-approval-prompts').doc(meta.tokenId).update({
                  status: 'APPROVED',
                  processedAt: new Date().toISOString(),
                  processedBy: interaction.user?.id
                })
              }
              const disabledRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                new ButtonBuilder().setCustomId('approve').setLabel('Approve').setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setCustomId('reject').setLabel('Reject').setStyle(ButtonStyle.Danger).setDisabled(true)
              )
              await interaction.message.edit({ components: [disabledRow] })
              logger.debug('DiscordBotService.registerApprovalButtonsHandler: Disabled buttons after approval', {
                requestId,
                messageId: interaction.message.id
              })
              await safeRespond({ content: `Approved 👍 (${baseInfo}) Tx: ${result.walletTransactionId} Amount: ${result.amount}` })
            } else {
              logger.error('DiscordBotService.registerApprovalButtonsHandler: Approval failed', {
                requestId,
                error: result.error,
                meta,
                tokenId: meta.tokenId
              })
              await safeRespond({ content: `Approval failed: ${result.error || 'Unknown error'}` })
            }
          }
          return
        }

        if (meta.action === 'reject') {
          if (tokenStatus && tokenStatus !== 'PENDING') {
            await safeRespond({
              content: 'This request has already been processed.'
            })
            return
          }
          if (tokenKind === 'WITHDRAWAL') {
            if (!p?.withdrawalId || !p?.doctorId) {
              logger.warn('DiscordBotService.registerApprovalButtonsHandler: Missing metadata for withdrawal rejection', {
                requestId,
                meta,
                tokenStatus
              })
              await safeRespond({ content: 'Missing metadata to reject withdrawal.' })
              return
            }
            logger.info('DiscordBotService.registerApprovalButtonsHandler: Rejecting withdrawal', {
              requestId,
              meta,
              tokenId: meta.tokenId
            })
            const result = await withdrawalService.rejectWithdrawal(p.withdrawalId, {
              rejectedBy: interaction.user?.id,
              reason: 'Rejected via Discord'
            })
            if (result.success) {
              logger.info('DiscordBotService.registerApprovalButtonsHandler: Withdrawal rejection succeeded', {
                requestId,
                meta,
                tokenId: meta.tokenId
              })
              if (meta.tokenId) {
                await db.collection('discord-approval-prompts').doc(meta.tokenId).update({
                  status: 'REJECTED',
                  processedAt: new Date().toISOString(),
                  processedBy: interaction.user?.id
                })
              }
              const disabledRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                new ButtonBuilder().setCustomId('approve').setLabel('Approve').setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setCustomId('reject').setLabel('Reject').setStyle(ButtonStyle.Danger).setDisabled(true)
              )
              await interaction.message.edit({ components: [disabledRow] })
              logger.debug('DiscordBotService.registerApprovalButtonsHandler: Disabled buttons after withdrawal rejection', {
                requestId,
                messageId: interaction.message.id
              })
              await safeRespond({ content: `Withdrawal Rejected 👎 (${baseInfo})` })
            } else {
              logger.error('DiscordBotService.registerApprovalButtonsHandler: Withdrawal rejection failed', {
                requestId,
                error: result.message,
                meta,
                tokenId: meta.tokenId
              })
              await safeRespond({ content: `Rejection failed: ${result.message || 'Unknown error'}` })
            }
          } else {
            if (!p?.consultationId || !p?.doctorId || !p?.patientId) {
              logger.warn('DiscordBotService.registerApprovalButtonsHandler: Missing metadata for rejection', {
                requestId,
                meta,
                tokenStatus
              })
              await safeRespond({
                content: 'Missing metadata to reject payout.'
              })
              return
            }
            logger.info('DiscordBotService.registerApprovalButtonsHandler: Rejecting initialized payout', {
              requestId,
              meta,
              tokenId: meta.tokenId
            })
            const result = await consultationPaymentService.rejectInitializedPaymentToDoctorWallet(
              p.consultationId,
              p.doctorId,
              p.patientId,
              p.walletTransactionId,
              'Rejected via Discord'
            )
            if (result.success) {
              logger.info('DiscordBotService.registerApprovalButtonsHandler: Rejection succeeded', {
                requestId,
                walletTransactionId: result.walletTransactionId,
                meta,
                tokenId: meta.tokenId
              })
              if (meta.tokenId) {
                await db.collection('discord-approval-prompts').doc(meta.tokenId).update({
                  status: 'REJECTED',
                  processedAt: new Date().toISOString(),
                  processedBy: interaction.user?.id
                })
              }
              const disabledRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                new ButtonBuilder().setCustomId('approve').setLabel('Approve').setStyle(ButtonStyle.Success).setDisabled(true),
                new ButtonBuilder().setCustomId('reject').setLabel('Reject').setStyle(ButtonStyle.Danger).setDisabled(true)
              )
              await interaction.message.edit({ components: [disabledRow] })
              logger.debug('DiscordBotService.registerApprovalButtonsHandler: Disabled buttons after rejection', {
                requestId,
                messageId: interaction.message.id
              })
              await safeRespond({ content: `Rejected 👎 (${baseInfo}) Tx: ${result.walletTransactionId}` })
            } else {
              logger.error('DiscordBotService.registerApprovalButtonsHandler: Rejection failed', {
                requestId,
                error: result.error,
                meta,
                tokenId: meta.tokenId
              })
              await safeRespond({ content: `Rejection failed: ${result.error || 'Unknown error'}` })
            }
          }
          return
        }
        logger.warn('DiscordBotService.registerApprovalButtonsHandler: Unknown action', {
          requestId,
          customId: interaction.customId
        })
        await safeRespond({ content: 'Unknown action' })
      } catch (err: any) {
        logger.error('DiscordBotService.registerApprovalButtonsHandler: Handler error', {
          requestId,
          error: err?.message || err
        })
        if (interaction.isRepliable()) {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: `Error: ${err?.message || err}` })
          } else {
            await interaction.reply({ content: `Error: ${err?.message || err}`, flags: MessageFlags.Ephemeral })
          }
        }
      }
    })
  }
}


export const discordBotService = new DiscordBotService()