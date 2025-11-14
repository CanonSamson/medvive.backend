import { Server, DefaultEventsMap } from 'socket.io'

let onlineUsers: {
  [key: string]: boolean
} = {}

export default (
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
) => {
  console.log('socket init...')
  io.on('connection', socket => {
    const rawUserId = socket.handshake.query.userId
    const userId = typeof rawUserId === 'string' && rawUserId.trim().length > 0 ? rawUserId.trim() : undefined

    if (userId) {
      console.log(`${userId} connected`)
      try {
        socket.join(userId)
      } catch (err) {
        console.error('Failed to join user room:', err)
      }
    } else {
      console.log(`anonymous user connected (socketId=${socket.id})`)
    }

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
      if (userId) {
        console.log(`${userId} disconnected`)
        io.emit('user:online-events:listen', { userId, online: false })
      } else {
        console.log(`anonymous user disconnected (socketId=${socket.id})`)
      }
    })
  })

  return io
}
