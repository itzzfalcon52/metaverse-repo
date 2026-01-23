// JavaScript
// filepath: apps/web/src/modules/world/hooks/use-movement.js
import { useEffect } from "react";
import { sendMoveRequest } from "@/lib/sockets";
import { useCreateWorldStore } from "@/stores/useWorldStore";
import { toast } from "sonner";

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

      let dx = 0, dy = 0;
      if (e.key === "ArrowUp") dy = -STEP;
      if (e.key === "ArrowDown") dy = STEP;
      if (e.key === "ArrowLeft") dx = -STEP;
      if (e.key === "ArrowRight") dx = STEP;
      if (!dx && !dy) return;

      const nextX = me.x + dx; // logical coords (32px grid)
      const nextY = me.y + dy;

      const scene = window.__phaserScene;
      if (scene?.isWallAtWorld) {
        // Convert to world pixels by adding map offsets, then check collision in 16px grid
        const worldX = nextX + (scene.mapOffsetX ?? 0);
        const worldY = nextY + (scene.mapOffsetY ?? 0);
        if (scene.isWallAtWorld(worldX, worldY)) {
          toast.error("You hit a wall!");
          const { tx, ty } = scene.worldToGrid(worldX, worldY);
          console.log("🧱 BLOCKED", tx, ty);
          return;
        }
      } else if (scene?.worldToGrid && scene?.isWallTile) {
        const worldX = nextX + (scene.mapOffsetX ?? 0);
        const worldY = nextY + (scene.mapOffsetY ?? 0);
        const { tx, ty } = scene.worldToGrid(worldX, worldY);
        if (scene.isWallTile(tx, ty)) {
          toast.error("You hit a wall!");
          console.log("🧱 BLOCKED", tx, ty);
          return;
        }
      }

      sendMoveRequest(nextX, nextY);
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selfId, players]);
}