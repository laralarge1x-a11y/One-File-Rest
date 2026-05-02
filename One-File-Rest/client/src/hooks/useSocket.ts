import { useEffect, useState, useCallback, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

type SocketHandler = (data: unknown) => void;

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  joinCase: (caseId: number) => void;
  leaveCase: (caseId: number) => void;
  sendMessage: (caseId: number, content: string, type: string) => void;
  on: (event: string, callback: SocketHandler) => void;
  off: (event: string) => void;
}

export function useSocket(): UseSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(window.location.origin, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(newSocket);
    socketRef.current = newSocket;

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const joinCase = useCallback((caseId: number) => {
    if (socketRef.current) {
      socketRef.current.emit('case:join', { caseId });
    }
  }, []);

  const leaveCase = useCallback((caseId: number) => {
    if (socketRef.current) {
      socketRef.current.emit('case:leave', { caseId });
    }
  }, []);

  const sendMessage = useCallback((caseId: number, content: string, type: string) => {
    if (socketRef.current) {
      socketRef.current.emit('message:send', { caseId, content, type });
    }
  }, []);

  const on = useCallback((event: string, callback: SocketHandler) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  const off = useCallback((event: string) => {
    if (socketRef.current) {
      socketRef.current.off(event);
    }
  }, []);

  return {
    socket,
    isConnected,
    joinCase,
    leaveCase,
    sendMessage,
    on,
    off,
  };
}
