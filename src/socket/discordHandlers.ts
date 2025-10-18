import { Server, Socket } from 'socket.io'
import { discordClient } from '../../discord/index.js'
import { ChannelType, TextChannel } from 'discord.js'

export const discordHandlers = (io: Server, socket: Socket) => {
  socket.on('new-user', data => {
    const channel = discordClient.channels.cache.get('1316805882117492747')
    if (channel && channel.type === ChannelType.GuildText) {
      const textChannel = channel as TextChannel
      textChannel
        .send(`${data.name} just joined Medvive! 🥳`)
        .catch((err: any) => console.error('Failed to send message:', err))
    } else {
      console.error(
        'Channel not text-capable or not found for new user message.'
      )
    }
  })

  socket.on('new-consultation', data => {
    const channel = discordClient.channels.cache.get('1316810844050292870')
    if (channel && channel.type === ChannelType.GuildText) {
      const textChannel = channel as TextChannel
      if (data?.doctor?.name && data?.name) {
        textChannel
          .send(
            `${data?.name} just scheduled a consultation with Dr. ${data?.doctor?.name} on ${data.date}. 🥳`
          )
          .catch((err: any) => console.error('Failed to send message:', err))
      } else {
        textChannel
          .send(JSON.stringify(data))
          .catch((err: any) => console.error('Failed to send message:', err))
      }
    } else {
      console.error(
        'Channel not text-capable or not found for new consultation message.'
      )
    }
  })
}
