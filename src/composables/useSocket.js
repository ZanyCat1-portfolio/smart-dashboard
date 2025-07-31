// src/composables/useSocket.js
import { io } from 'socket.io-client'

const origin = window.location.origin.replace(/^http/, 'ws');
const socket = io(origin, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  secure: true,
})

export default socket
