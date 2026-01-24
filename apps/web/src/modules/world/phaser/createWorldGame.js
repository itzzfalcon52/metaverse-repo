// JavaScript
// filepath: /apps/web/src/modules/world/phaser/createWorldGame.js
// ...existing code...
let game;

export async function createWorldGame({ world, getPlayers, getSelfId }) {
  if (typeof window === "undefined") return;
  if (game) return game;

  // Obtain the DOM container that should host the Phaser canvas
  const container = document.getElementById("game-container");
  if (!container) throw new Error("Missing #game-container");

  // Lazy import Phaser and the scene to avoid SSR issues
  const Phaser = await import("phaser");
  const { WorldScene } = await import("./WorldScene");

  // Measure container size so initial canvas matches its bounds
  const { width, height } = container.getBoundingClientRect();

  // Create the Phaser.Game instance with RESIZE scale mode
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-container",
    width,
    height,
    backgroundColor: "#000000",
    scale: {
      mode: Phaser.Scale.RESIZE,       // canvas follows parent size
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    scene: [WorldScene],
  });

  // Start the scene with provided getters (unchanged logic)
  game.scene.start("WorldScene", { world, getPlayers, getSelfId });

  // Ensure canvas tracks container size changes (Mac/VS Code/Next layout)
  const onResize = () => {
    const r = container.getBoundingClientRect();
    game.scale.resize(r.width, r.height);
  };
  window.addEventListener("resize", onResize);
  // Also observe container size mutations (flex changes)
  const ro = new ResizeObserver(onResize);
  ro.observe(container);
  game.__resizeObserver = ro;

  return game;
}

export function destroyWorldGame() {
  if (!game) return;
  // Clean up resize observer to avoid leaks
  game.__resizeObserver?.disconnect?.();
  game.destroy(true);
  game = null;
}
// ...existing code...