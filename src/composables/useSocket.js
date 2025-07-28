// src/composables/useSocket.js
import { io } from 'socket.io-client'

const socket = io('https://192.168.4.23:8080', {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  secure: true,
})

export default socket
