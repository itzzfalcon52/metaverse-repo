import { connectSocket, sendJoinRequest } from "@/lib/sockets";
import { useEffect } from "react";
import { useCreateWorldStore } from "@/stores/useWorldStore";
import { toast } from "sonner";

export default function useWorldSocket(spaceID, token) {
  const addPlayer = useCreateWorldStore((s) => s.addPlayer);
  const removePlayer = useCreateWorldStore((s) => s.removePlayer);
  const movePlayer = useCreateWorldStore((s) => s.movePlayer);
  const setSelfId = useCreateWorldStore((s) => s.setSelfId);

  useEffect(() => {
    console.log("🧪 WS INIT", { spaceID, token });

    if (!spaceID || !token) return;

    const socket = connectSocket(); // ✅ DO NOT PASS TOKEN HERE
    window.__ws = socket;

    const handleOpen = () => {
      console.log("✅ WS OPEN → sending JOIN");
      sendJoinRequest(spaceID, token);
    };

    const handleMessage = (event) => {
      console.log("📩 WS MESSAGE RAW:", event.data);
      const message = JSON.parse(event.data);
      console.log("📩 WS MESSAGE PARSED:", message);

      switch (message.type) {
        case "space-joined": {
          const self = message.payload.self;

          setSelfId(self.id);
          addPlayer(self);
          message.payload.users.forEach(addPlayer);

          window.__canMove = true;
          toast.success("Joined space");
          break;
        }

        case "join-rejected": {
          const reason = message.payload?.reason;
          toast.error(
            reason === "already-in-space"
              ? "You are already in this space from another session."
              : "Join rejected."
          );
          try { socket.close(); } catch {}
          window.__canMove = false;
          break;
        }

        case "user-joined":
          addPlayer(message.payload);
          break;

        case "movement":
          movePlayer(message.payload.id, message.payload.x, message.payload.y);
          break;

        case "user-left":
          removePlayer(message.payload.id);
          break;
      }
    };

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("message", handleMessage);
      try { socket.close(); } catch {}
    };
  }, [spaceID, token]);
}
