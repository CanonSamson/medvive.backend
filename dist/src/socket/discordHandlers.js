import { discordClient } from '../../discord/index.js';
import { ChannelType } from 'discord.js';
export const discordHandlers = (io, socket) => {
    socket.on('new-user', data => {
        const channel = discordClient.channels.cache.get('1316805882117492747');
        if (channel && channel.type === ChannelType.GuildText) {
            const textChannel = channel;
            textChannel
                .send(`${data.name} just joined Medvive! 🥳`)
                .catch((err) => console.error('Failed to send message:', err));
        }
        else {
            console.error('Channel not text-capable or not found for new user message.');
        }
    });
    socket.on('new-consultation', data => {
        const channel = discordClient.channels.cache.get('1316810844050292870');
        if (channel && channel.type === ChannelType.GuildText) {
            const textChannel = channel;
            if (data?.doctor?.name && data?.name) {
                textChannel
                    .send(`${data?.name} just scheduled a consultation with Dr. ${data?.doctor?.name} on ${data.date}. 🥳`)
                    .catch((err) => console.error('Failed to send message:', err));
            }
            else {
                textChannel
                    .send(JSON.stringify(data))
                    .catch((err) => console.error('Failed to send message:', err));
            }
        }
        else {
            console.error('Channel not text-capable or not found for new consultation message.');
        }
    });
};
//# sourceMappingURL=discordHandlers.js.map