import { io } from 'socket.io-client'

// Use VITE_BASE_PATH for subdirectory hosting
const basePath = import.meta.env.VITE_BASE_PATH || '/';
const wsOrigin = window.location.origin.replace(/^http/, 'ws');

const socket = io(wsOrigin, {
  path: `${basePath.replace(/\/+$/, '')}/socket.io`, // ensures single slash
  transports: ['websocket', 'polling'],
  secure: true,
})

export default socket
