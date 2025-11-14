import type { ApprovalPayload, WithdrawalApprovalPayload } from './types.js'
import { sendApprovalPrompt, sendWithdrawalApprovalPrompt } from './prompts.js'
import { registerApprovalButtonsHandler, registerDoctorOnboardingHandler } from './handlers.js'

export class DiscordBotService {
  async sendApprovalPrompt (
    channelId: string,
    content: string,
    payload: ApprovalPayload
  ) {
    return sendApprovalPrompt(channelId, content, payload)
  }

  async sendWithdrawalApprovalPrompt (
    content: string,
    payload: WithdrawalApprovalPayload
  ) {
    const channelId = process.env.DISCORD_WALLET_WITHDRAWAL_CHANNEL_ID

    if (channelId)
      return sendWithdrawalApprovalPrompt(channelId, content, payload)
    else return null
  }

  

  registerApprovalButtonsHandler () {
    return registerApprovalButtonsHandler()
  }

  registerDoctorOnboardingHandler () {
    return registerDoctorOnboardingHandler()
  }
}

export const discordBotService = new DiscordBotService()
