// JavaScript
// filepath: apps/web/src/modules/world/hooks/use-movement.js

import { useEffect } from "react";
import { sendMoveRequest } from "@/lib/sockets"; // network helper to send movement updates to server
import { useCreateWorldStore } from "@/stores/useWorldStore"; // state store (likely Zustand) for player/world data
import { toast } from "sonner"; // UI toast notifications

// Movement step in logical world units; the game uses a 32px grid for positions.
const STEP = 32;

export default function useMovement() {
  // Read the current player's id from the world store.
  const selfId = useCreateWorldStore((s) => s.selfId);
  // Read the players map (id -> player data) from the world store.
  const players = useCreateWorldStore((s) => s.players);

  // Side-effect: attach a keydown listener while dependencies (selfId, players) are stable.
  useEffect(() => {
    // Key handler that computes next position and performs collision checks before sending.
    function handleKey(e) {
      // Gate: movement only allowed when a global flag says so (set elsewhere, e.g., after join).
      if (!window.__canMove) return;
      // Gate: must know who "self" is (not yet joined/initialized).
      if (!selfId) return;

      // Lookup current player data (position, etc.). If missing, abort.
      const me = players.get(selfId);
      if (!me) return;

      // Compute delta based on arrow keys; ignore other keys.
      let dx = 0, dy = 0;
      if (e.key === "ArrowUp") dy = -STEP;     // up decreases Y
      if (e.key === "ArrowDown") dy = STEP;    // down increases Y
      if (e.key === "ArrowLeft") dx = -STEP;   // left decreases X
      if (e.key === "ArrowRight") dx = STEP;   // right increases X
      if (!dx && !dy) return; // no movement key pressed

      // Next logical position in the 32px grid space (player-local coords).
      const nextX = me.x + dx;
      const nextY = me.y + dy;

      // Integrate with Phaser scene for collision; scene is exposed globally elsewhere.
      const scene = window.__phaserScene;

      // Preferred collision API: check in world pixel space using isWallAtWorld.
      if (scene?.isWallAtWorld) {
        // Convert logical position to world pixel coords by adding map offset (camera/level origin).
        const worldX = nextX + (scene.mapOffsetX ?? 0);
        const worldY = nextY + (scene.mapOffsetY ?? 0);

        // Query collision in world pixels; if blocked, notify and abort movement.
        if (scene.isWallAtWorld(worldX, worldY)) {
          toast.error("You hit a wall!");
          // Convert to tile/grid coords (16px tiles) for debugging logs.
          const { tx, ty } = scene.worldToGrid(worldX, worldY);
          console.log("🧱 BLOCKED", tx, ty);
          return;
        }
      // Fallback collision API: convert to tiles and check via isWallTile when isWallAtWorld is unavailable.
      } else if (scene?.worldToGrid && scene?.isWallTile) {
        const worldX = nextX + (scene.mapOffsetX ?? 0);
        const worldY = nextY + (scene.mapOffsetY ?? 0);
        // Translate world pixels to tile coordinates.
        const { tx, ty } = scene.worldToGrid(worldX, worldY);
        // Query tile collision; if blocked, notify and abort movement.
        if (scene.isWallTile(tx, ty)) {
          toast.error("You hit a wall!");
          console.log("🧱 BLOCKED", tx, ty);
          return;
        }
      }

      // If not blocked, emit the proposed next position to the server.
      // Server should validate and broadcast updated position to other clients.
      sendMoveRequest(nextX, nextY);
    }

    // Register the keydown listener on window to capture arrow keys globally.
    window.addEventListener("keydown", handleKey);
    // Cleanup on effect re-run or component unmount: remove the listener to prevent leaks/duplicates.
    return () => window.removeEventListener("keydown", handleKey);
  }, [selfId, players]); // Re-bind handler when the player's id or players map changes.
}