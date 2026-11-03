import { io, Socket } from 'socket.io-client';

export type ServerUrlMode = 'dev' | 'prod';

export function serverUrl(mode: ServerUrlMode = 'dev'): string {
  if (import.meta.env.PROD) {
    // Deploy: set VITE_SERVER_URL in CI/build step. Do not commit it.
    return import.meta.env.VITE_SERVER_URL as string | undefined ?? 'https://chrome-dino-be.onrender.com';
  }
  return import.meta.env.VITE_SERVER_URL as string | undefined ?? 'http://localhost:4000';
}

export function createSocket(): Socket {
  return io(serverUrl(), {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
}
