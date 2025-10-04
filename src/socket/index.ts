import { Server, DefaultEventsMap } from 'socket.io'

let onlineUsers: {
  [key: string]: boolean
} = {}

export default (
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
) => {
  console.log('socket init...')
  io.on('connection', socket => {
    const userId = socket.handshake.query.userId as string
    if (userId != 'undefined') {
      console.log(`${userId} connected`)
      socket.join(userId)

      socket.on('listen:events', async (key: string) => {
        console.log('chatroomId', key)
        try {
          await socket.join(key)
        } catch (error) {
          console.error('Error in listen:events:', error)
        }
      })

      socket.on('unlisten:events', async (key: string) => {
        console.log('chatroomId', key)
        try {
          await socket.leave(key)
        } catch (error) {
          console.error('Error in unlisten:events:', error)
        }
      })

      // Handle typing notification
      socket.on('user-is-typing', ({ id, currentUser, socketId }) => {
        // Notify all users in the chatroom about typing status
        socket.to(socketId).emit('is-typing', { id, user: currentUser })
      })

      socket.on('user-stopped-typing', ({ id, currentUser, socketId }) => {
        // Notify all users in the chatroom about typing status
        socket.to(socketId).emit('stopped-typing', { id, user: currentUser })
      })

      socket.on('user:online-events', userId => {
        onlineUsers[userId] = true
        console.log('user_online')
        io.emit('user:online-events:listen', onlineUsers)
      })

      socket.on('user:offline-events', userId => {
        onlineUsers[userId] = false
        console.log('user_offline')
        io.emit('user:online-events:listen', onlineUsers)
      })

      socket.on('disconnect', () => {
        console.log(`${userId} disconnected`)
        io.emit('user:online-events:listen', { userId, online: false })
      })
    }
  })

  return io
}
