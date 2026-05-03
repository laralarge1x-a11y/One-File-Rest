import { io, Socket } from "socket.io-client";
import { API_BASE, getSessionCookie } from "@/api/client";

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket && socket.connected) return socket;
  const cookie = await getSessionCookie();
  socket = io(API_BASE, {
    transports: ["websocket"],
    withCredentials: true,
    extraHeaders: cookie ? { Cookie: cookie } : undefined,
    reconnection: true,
    reconnectionDelay: 1500,
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
