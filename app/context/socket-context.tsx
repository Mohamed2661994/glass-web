"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { io, Socket } from "socket.io-client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://glass-system-backend.onrender.com";

type SocketEvent = {
  action: string;
  path: string;
  ts: number;
};

type SocketContextValue = {
  connected: boolean;
  /** Subscribe to a data channel. Returns unsubscribe function */
  on: (channel: string, handler: (ev: SocketEvent) => void) => () => void;
};

const SocketContext = createContext<SocketContextValue>({
  connected: false,
  on: () => () => {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(API_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    s.on("connect", () => {
      console.log("🔌 Socket connected:", s.id);
      setConnected(true);
    });

    s.on("disconnect", () => {
      console.log("🔌 Socket disconnected");
      setConnected(false);
    });

    socketRef.current = s;

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  const on = useCallback(
    (channel: string, handler: (ev: SocketEvent) => void) => {
      const s = socketRef.current;
      if (!s) return () => {};
      s.on(channel, handler);
      return () => {
        s.off(channel, handler);
      };
    },
    [],
  );

  return (
    <SocketContext.Provider value={{ connected, on }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
