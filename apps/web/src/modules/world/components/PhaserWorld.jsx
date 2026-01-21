"use client";
import { useEffect } from "react";
import { createWorldGame, destroyWorldGame } from "@/modules/world/phaser/createWorldGame";
import { useCreateWorldStore } from "@/stores/useWorldStore";

export default function PhaserWorld({ map }) {
  useEffect(() => {
    if (!map) return;

    createWorldGame({
      mapKey: "map1",

      // ✅ ALWAYS READ LIVE STORE
      getPlayers: () => useCreateWorldStore.getState().players,
      getSelfId: () => useCreateWorldStore.getState().selfId,
    });

    return () => destroyWorldGame();
  }, [map]);

  return <div id="game-container" className="absolute inset-0 w-full h-full" />;
}
