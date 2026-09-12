import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

/**
 * Singleton Socket.io client.
 * - autoConnect: false — Room.jsx connects on mount and controls lifecycle
 * - transports matches the server config so the handshake never fails
 *   behind Render's reverse proxy (tries WebSocket first, falls back to polling)
 * - withCredentials: true required when server uses credentials:true CORS
 */
const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,   // keep retrying on mobile network drops
  reconnectionDelay: 1000,
  reconnectionDelayMax: 8000,
  timeout: 20000,
});

export default socket;
