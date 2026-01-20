let game;

/**
 * Creates the Phaser game ONLY on the client.
 * Call this from a "use client" component inside useEffect().
 */
export async function createGame({ mapKey = "map1", tileSize = 32, onPlacementsChanged } = {}) {
  // Next.js can run module code on the server during SSR.
  // Phaser touches browser-only globals like navigator/window, so we must guard.
  if (typeof window === "undefined") return null;

  // Singleton pattern: don't create more than one Phaser.Game instance,
  // otherwise you'll get multiple canvases + duplicated input handlers.
  if (game) return game;

  // Phaser will inject its <canvas> into this DOM node (parent).
  const container = document.getElementById("game-container");
  if (!container) throw new Error("Missing #game-container");

  // Dynamic import keeps Phaser out of the server bundle and prevents "navigator is not defined".
  const Phaser = await import("phaser");

  // Import the Scene dynamically for the same reason (and to keep eval on client).
  const { EditorScene } = await import("../components/LoadMap");

  // Helper to get current container size.
  // We use this because the container is often inside flex layouts and can change size.
  const getSize = () => ({
    width: Math.max(1, container.clientWidth),
    height: Math.max(1, container.clientHeight),
  });

  // Initial size at the moment we create the game.
  const { width, height } = getSize();

  // Create Phaser.Game (the top-level Phaser runtime).
  // This creates a WebGL/canvas renderer and manages scenes and input.
  game = new Phaser.Game({
    type: Phaser.AUTO, // let Phaser choose WebGL if available, otherwise Canvas
    parent: "game-container", // attach the canvas to this element id
    width, // initial canvas width
    height, // initial canvas height
    backgroundColor: "#0b0f14",
    pixelArt: true, // avoids texture smoothing (useful for pixel-style assets)

    // Scale manager controls how the canvas adapts to its parent.
    // RESIZE makes the canvas match the container size exactly.
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },

    // Physics is optional for an editor, but you use this.physics.world.setBounds in the Scene.
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },

    // Scene list for the game. We include EditorScene so we can start it.
    scene: [EditorScene],
  });

  // Start the editor scene and pass initial config values into EditorScene.init(...)
  game.scene.start("EditorScene", { mapKey, tileSize, onPlacementsChanged });

  // Force the canvas element to fill the container using CSS.
  // Even with RESIZE, CSS can make the canvas look smaller if width/height aren't 100%.
  const canvas = container.querySelector("canvas");
  if (canvas) {
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
  }

  // Resize function that tells Phaser Scale Manager to re-measure.
  // This is needed when the container changes (sidebar open/close, window resize, etc).
  const resize = () => {
    if (!game) return;
    const s = getSize();
    game.scale.resize(s.width, s.height);
  };

  // Handle normal browser window resizing.
  window.addEventListener("resize", resize);

  // Handle container resizing caused by layout changes (flexbox changes, sidebar, devtools, etc).
  // ResizeObserver triggers even when window size stays the same.
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // Run one resize after layout settles (important with Next + flex layouts).
  requestAnimationFrame(resize);

  // Store cleanup function on the game instance to remove listeners when unmounting.
  // (This prevents leaks and duplicate handlers when navigating away/back.)
  game.__cleanup = () => {
    window.removeEventListener("resize", resize);
    ro.disconnect();
  };

  return game;
}

export function destroyGame() {
  // No-op if game was never created.
  if (!game) return;

  // Remove event listeners/observers created in createGame().
  game.__cleanup?.();

  // Destroy Phaser game and optionally remove canvas from DOM (true).
  game.destroy(true);

  // Clear singleton reference so the game can be re-created.
  game = undefined;
}

/**
 * ===========================
 * DETAILED EXPLANATION (READ)
 * ===========================
 *
 * This file is the "bootstrap" for Phaser inside your Next.js app.
 * React/Next renders DOM, and this code creates a single Phaser.Game instance inside #game-container.
 *
 * WHY WE USE DYNAMIC IMPORT(S):
 * - Next.js can evaluate imports on the server during SSR.
 * - Phaser depends on browser-only globals like `window` and `navigator`.
 * - Importing Phaser at module top-level often causes: "navigator is not defined".
 * - By importing Phaser INSIDE createGame(), we ensure it only happens in the browser.
 *
 * WHY WE CHECK `typeof window === "undefined"`:
 * - That condition is true during server-side rendering.
 * - Returning early prevents SSR crashes and ensures Phaser runs only on the client.
 *
 * WHY WE KEEP `let game` OUTSIDE THE FUNCTION:
 * - It's a singleton holder.
 * - Without it, every React re-render or route transition could create a second Phaser.Game.
 * - Multiple games cause: multiple canvases, duplicated input, performance issues.
 *
 * HOW SIZING WORKS:
 * - Phaser gets an initial width/height from `container.clientWidth/Height`.
 * - We use `scale.mode = Phaser.Scale.RESIZE` so the canvas matches container size.
 * - We also set the `<canvas>` style width/height to `100%` so CSS doesn't shrink it.
 *
 * WHY WE RESIZE ON BOTH window AND container:
 * - window.resize: catches browser window size changes.
 * - ResizeObserver(container): catches layout changes (sidebar, flex changes, devtools, etc).
 * - This combination avoids the "canvas only fills a small corner" problem.
 *
 * HOW DATA GETS INTO YOUR SCENE:
 * - `game.scene.start("EditorScene", { mapKey, tileSize, onPlacementsChanged })`
 * - Phaser passes that object into `EditorScene.init(data)`.
 * - That lets the Scene know which map folder to load and how big the grid tiles are.
 *
 * CLEANUP:
 * - destroyGame() is called when the React page unmounts.
 * - It removes listeners/observers and destroys the Phaser game to avoid memory leaks.
 */