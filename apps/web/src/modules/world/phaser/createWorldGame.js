let game;

export async function createWorldGame({ mapKey, getPlayers, getSelfId }) {
  if (typeof window === "undefined") return;
  if (game) return game;

  const container = document.getElementById("game-container");
  if (!container) throw new Error("Missing #game-container");

  const Phaser = await import("phaser");
  const { WorldScene } = await import("./WorldScene");

  const { width, height } = container.getBoundingClientRect();

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-container",
    width,
    height,
    backgroundColor: "#000000",
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    scene: [WorldScene],
  });

  game.scene.start("WorldScene", { mapKey, getPlayers, getSelfId });

  return game;
}

export function destroyWorldGame() {
  if (!game) return;
  game.destroy(true);
  game = null;
}
