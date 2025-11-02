import { MessageFlags } from 'discord.js'
import { discordClient } from '../../../discord/index.js'
import logger from '../../utils/logger.js'
import { getAdminFirestore } from '../../utils/firebase/admin.js'
import { parseCustomId } from './tokens.js'
import { consultationPaymentService } from '../consultation/payment.js'
import { withdrawalService } from '../consultation/withdrawal.js'

export function registerApprovalButtonsHandler() {
  const safeRespond = async (
    interaction: any,
    content: string
  ) => {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral })
      } else {
        await interaction.editReply({ content })
      }
    } catch (err) {
      logger.error('Discord response failure', { error: (err as Error).message })
    }
  }

  discordClient.on('interactionCreate', async (interaction: any) => {
    try {
      if (!interaction.isButton()) return

      const { action, tokenId } = parseCustomId(interaction.customId)
      if (!['approve', 'reject'].includes(action)) return

      await interaction.deferReply({ ephemeral: true })

      if (!tokenId) {
        return safeRespond(interaction, 'Unknown interaction: missing token id.')
      }

      const adminDb =  getAdminFirestore()
      const tokenSnap = await adminDb.collection('discordApprovalTokens').doc(tokenId).get()
      if (!tokenSnap.exists) {
        return safeRespond(interaction, 'Unknown interaction: token not found.')
      }

      const tokenData = tokenSnap.data() || {}
      const tokenKind = tokenData.kind || 'CONSULTATION_PAYOUT'

      if (tokenKind === 'CONSULTATION_PAYOUT') {
        const p = tokenData?.payload || {}
        if (action === 'approve') {
          await consultationPaymentService.approveInitializedPaymentToDoctorWallet(
            p.consultationId,
            p.doctorId,
            p.patientId,
            p.walletTransactionId
          )
          await adminDb.collection('discordApprovalTokens').doc(tokenId).update({ status: 'APPROVED', processedAt: new Date().toISOString() })
          return safeRespond(interaction, 'Consultation payout approved.')
        } else {
          await consultationPaymentService.rejectInitializedPaymentToDoctorWallet(
            p.consultationId,
            p.doctorId,
            p.patientId,
            p.walletTransactionId,
            'Rejected via Discord'
          )
          await adminDb.collection('discordApprovalTokens').doc(tokenId).update({ status: 'REJECTED', processedAt: new Date().toISOString() })
          return safeRespond(interaction, 'Consultation payout rejected.')
        }
      }

      if (tokenKind === 'WITHDRAWAL') {
        const wid = tokenData?.payload?.withdrawalId
        if (action === 'approve') {
          const result = await withdrawalService.approveWithdrawal(wid, { approvedBy: interaction?.user?.id })
          await adminDb.collection('discordApprovalTokens').doc(tokenId).update({ status: 'APPROVED', processedAt: new Date().toISOString() })
          return safeRespond(interaction, result.message || 'Withdrawal approved.')
        } else {
          const result = await withdrawalService.rejectWithdrawal(wid, { rejectedBy: interaction?.user?.id, reason: 'Rejected via Discord' })
          await adminDb.collection('discordApprovalTokens').doc(tokenId).update({ status: 'REJECTED', processedAt: new Date().toISOString() })
          return safeRespond(interaction, result.message || 'Withdrawal rejected.')
        }
      }

      return safeRespond(interaction, 'Unknown token kind.')
    } catch (error) {
      logger.error('Error handling Discord interaction', { error: (error as Error).message })
      try {
        await safeRespond(interaction, 'An error occurred while processing your action.')
      } catch {}
    }
  })

  logger.info('Discord approval button handler registered')
}