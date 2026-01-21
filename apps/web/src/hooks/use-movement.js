import { useEffect } from "react";
import { sendMoveRequest } from "@/lib/sockets";
import { useCreateWorldStore } from "@/stores/useWorldStore";
import {toast} from "sonner";

const STEP = 32;

export default function useMovement() {
  const selfId = useCreateWorldStore((s) => s.selfId);
  const players = useCreateWorldStore((s) => s.players);

  useEffect(() => {
    function handleKey(e) {
      if (!window.__canMove) return;
      if (!selfId) return;

      const me = players.get(selfId);
      if (!me) return;

      let dx = 0;
      let dy = 0;

      if (e.key === "ArrowUp") dy = -STEP;
      if (e.key === "ArrowDown") dy = STEP;
      if (e.key === "ArrowLeft") dx = -STEP;
      if (e.key === "ArrowRight") dx = STEP;

      if (!dx && !dy) return;

      const nextX = me.x + dx;
      const nextY = me.y + dy;

      const tileX = nextX / 32;
      const tileY = nextY / 32;
      
      if (window.__phaserScene?.isWallTile(tileX, tileY)) {
        toast.error("You hit a wall!");
        console.log("🧱 BLOCKED", tileX, tileY);
        return;
      }

      // ✅ Allowed → send to server
      sendMoveRequest(nextX, nextY);
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selfId, players]);
}
