import { connectSocket, sendJoinRequest } from "@/lib/sockets";
import { useEffect } from "react";
import { useCreateWorldStore } from "@/stores/useWorldStore";
import { toast } from "sonner";

function getJwtFromCookie() {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)jwt=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export default function useWorldSocket(spaceID, token) {
  const addPlayer = useCreateWorldStore((s) => s.addPlayer);
  const removePlayer = useCreateWorldStore((s) => s.removePlayer);
  const movePlayer = useCreateWorldStore((s) => s.movePlayer);
  const setSelfId = useCreateWorldStore((s) => s.setSelfId);

  useEffect(() => {
    // Resolve JWT before connecting
    const jwt = token || getJwtFromCookie();
    if (!spaceID) return;
    if (!jwt) {
      toast.error("Missing auth token. Please log in.");
      return;
    }

    // Open a single socket and join
    const socket = connectSocket(jwt);

    socket.onopen = () => {
      sendJoinRequest(spaceID, jwt);
    };

    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        console.warn("WS message parse error");
        return;
      }

      switch (message.type) {
        case "space-joined": {
          window.__canMove = true;

          const self = message.payload?.self?.id;
          if (self) {
            setSelfId(self);
            addPlayer(self);
          }

          const users = Array.isArray(message.payload?.users) ? message.payload.users : [];
          users.forEach((u) => addPlayer(u));
          window.__canMove = true;
          toast.success("You have joined the space!");
          break;
        }
        case "user-joined": {
          const p = message.payload;
          addPlayer(p);
          break;
        }
        case "movement": {
          const p = message.payload;
          if (p?.id != null) movePlayer(p.id, p.x, p.y);
          else if (p?.userId != null) movePlayer(p.userId, p.x, p.y);
          break;
        }
        case "movement-rejected": {
          toast.error("Invalid movement!");
          break;
        }
        case "user-left": {
          const id = message.payload?.id ?? message.payload?.userId;
          if (id != null) removePlayer(id);
          break;
        }
        case "chat": {
          // handled in page
          break;
        }
        default:
          console.warn("Unknown message type:", message.type);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      toast.error("WebSocket connection error. Check token and WS URL.");
    };

    return () => {
      try {
        window.__canMove = false;

        socket.close();
      } catch {}
    };
  }, [spaceID, token, addPlayer, removePlayer, movePlayer, setSelfId]);
}