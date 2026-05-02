import { Server as SocketServer } from 'socket.io';

let _io: SocketServer | null = null;

export function setIO(io: SocketServer) {
  _io = io;
}

export function getIO(): SocketServer {
  if (!_io) throw new Error('Socket.io not initialized');
  return _io;
}
