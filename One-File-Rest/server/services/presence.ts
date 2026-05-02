import { Server } from 'socket.io';

const sockets = new Map<string, Set<string>>();

export function trackConnect(discordId: string, socketId: string, io?: Server) {
  let set = sockets.get(discordId);
  if (!set) { set = new Set(); sockets.set(discordId, set); }
  const wasOffline = set.size === 0;
  set.add(socketId);
  if (wasOffline && io) {
    io.to('admin').emit('presence:update', { discordId, online: true });
  }
}

export function trackDisconnect(discordId: string, socketId: string, io?: Server) {
  const set = sockets.get(discordId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) {
    sockets.delete(discordId);
    if (io) io.to('admin').emit('presence:update', { discordId, online: false });
  }
}

export function isOnline(discordId: string): boolean {
  const set = sockets.get(discordId);
  return !!(set && set.size > 0);
}

export function getOnlineIds(): string[] {
  return Array.from(sockets.keys());
}
