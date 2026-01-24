"use client";
import { useEffect } from "react";
import { createWorldGame, destroyWorldGame } from "@/modules/world/phaser/createWorldGame";
import { useCreateWorldStore } from "@/stores/useWorldStore";

export default function PhaserWorld({ map }) {
  useEffect(() => {
    if (!map) return;

    createWorldGame({
      world: map, // ✅ PASS FULL WORLD DATA FROM API

      // ✅ ALWAYS READ LIVE STORE
      getPlayers: () => useCreateWorldStore.getState().players,
      getSelfId: () => useCreateWorldStore.getState().selfId,
    });

    return () => destroyWorldGame();
  }, [map]);

  return <div id="game-container" className="absolute inset-0 w-full h-full" />;
}
