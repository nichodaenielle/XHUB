'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { accessToken } = useAuthStore();

  useEffect(() => {
    if (!accessToken) return;

    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001', {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
    });

    return () => {
      newSocket.disconnect();
    };
  }, [accessToken]);

  return <>{children}</>;
}
