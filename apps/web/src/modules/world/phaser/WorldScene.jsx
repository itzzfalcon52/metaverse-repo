// JavaScript
// filepath: /Users/hussain/Desktop/web dev projects/metaverse-app/metaverse-repo/apps/web/src/modules/world/phaser/WorldScene.jsx
"use client";

/**
 * WorldScene:
 * - Renders layered map images (from /{mapKey}/data.json + layers list).
 * - Loads IntGrid.csv for collision (0=open,1=wall) at collisionTileSize resolution.
 * - Spawns/animates player sprites using external getters (getPlayers/getSelfId).
 * - Fits the camera to the map and draws debug collision cells for visibility.
 *
 * Notes:
 * - Visual tiles remain 32px (art), collision grid is 16px (your IntGrid).
 * - We PRESERVE your logic, only add:
 *   1) Strict IntGrid normalization (crop to exact map width/height in 16px cells).
 *   2) Utility to convert world pixels -> IntGrid indices (non-breaking).
 */
import * as Phaser from "phaser";

export class WorldScene extends Phaser.Scene {
  constructor() {
    super({ key: "WorldScene" });

    // Default map key (overridden by init(data))
    this.mapKey = "map1";

    // Track currently visible player sprites
    this.playerSprites = new Map();

    // Visual tile size used by your art and conceptual grid (unchanged)
    this.tileSize = 32;

    // Collision grid resolution (IntGrid) you chose
    this.collisionTileSize = 16;
  }

  // Store external callbacks (no logic changes)
  init(data) {
    this.world = data.world;                  // ✅ FULL WORLD FROM DB
    this.mapData = data.world.tilemapJson;    // ✅ MAP JSON FROM DB
    this.getPlayers = data.getPlayers;
    this.getSelfId = data.getSelfId;
  }

  // Load map JSON + IntGrid, then enqueue layer images
  preload() {
    const map = this.mapData;
    if (!map) return;
  
    (map.layers || []).forEach((file) => {
      this.load.image(`layer:${file}`, `/${file.startsWith("/") ? file.slice(1) : this.mapKey + "/" + file}`);
    });
  
    // Load collision grid if you want (optional, keep your old one if needed)
    this.load.text("collision", `/${this.mapKey}/IntGrid.csv`);
  }

  create() {
    console.log("🌍 WORLD PAYLOAD:", this.world);
    // Expose for console debugging
    window.__phaserScene = this;

    // Read map JSON from cache
    const map = this.mapData; 
    if (!map) {
      console.error("❌ mapData missing");
      return;
    }

    // Keep offsets (map origin) and map reference
    this.mapData = map;
    this.mapOffsetX = this.mapData.x ?? 0;
    this.mapOffsetY = this.mapData.y ?? 0;

    // Parse IntGrid CSV preserving empty cells as 0 (keeps column alignment)
    const raw = this.cache.text.get("collision") ?? "";
    const rows = raw.trim().split("\n");
    let grid = rows.map((row) =>
      row.split(",").map((v) => {
        const t = v.trim();
        if (t === "") return 0;
        const n = Number(t);
        return Number.isFinite(n) ? n : 0;
      })
    );

    // Debug: original grid dimensions from CSV
    console.log("Grid size:", grid.length, grid[0]?.length);
    console.log("🧱 Collision grid loaded", grid);

    // Compute expected IntGrid size from map pixels and collisionTileSize
    const expectedCols = Math.floor(map.width / this.collisionTileSize);
    const expectedRows = Math.floor(map.height / this.collisionTileSize);
    const gotCols = grid[0]?.length ?? 0;
    const gotRows = grid.length;

    // If CSV has extra trailing cols/rows (common from export), crop them to match the map exactly.
    // This prevents sampling "phantom" cells outside the visible map that can cause random blocking.
    if (gotCols !== expectedCols || gotRows !== expectedRows) {
      console.warn(
        "IntGrid size mismatch",
        { expectedRows, expectedCols, collisionTileSize: this.collisionTileSize },
        { gotRows, gotCols }
      );
      // Normalize to expected size (non-destructive: we only crop, never expand).
      grid = grid.slice(0, expectedRows).map((r) => r.slice(0, expectedCols));
    }

    // Store the normalized grid
    this.collisionGrid = grid;

    // Cache offsets for math below
    const offsetX = this.mapOffsetX;
    const offsetY = this.mapOffsetY;

    console.log("🗺️ Map offset:", offsetX, offsetY);

    // Draw map layers (top-left anchored at offset)
    (map.layers || []).forEach((file) => {
      const key = `layer:${file}`;
      this.add.image(offsetX, offsetY, key).setOrigin(0, 0).setDepth(0);
    });
    // ===============================
// RENDER SPACE ELEMENTS FROM DB
// ===============================
const elements = this.world?.elements || [];

console.log("🧱 Rendering space elements:", elements);

// Preload all element textures
for (const el of elements) {
  const key = `space-el:${el.id}`;
  if (!this.textures.exists(key)) {
    this.load.image(key, el.imageUrl);
  }
}

// After load, place them
this.load.once(Phaser.Loader.Events.COMPLETE, () => {
  for (const el of elements) {
    const key = `space-el:${el.id}`;

    // Elements are already stored in MAP-LOCAL coordinates
// The map itself is already offset, so DO NOT add offset again
const x = el.x;
const y = el.y;

this.add.image(x, y, key).setOrigin(0, 0).setDepth(5);
//console.log("ELEMENT", el.x, el.y, "MAP OFFSET", offsetX, offsetY);
  }
});

// Start loading if needed
if (elements.length > 0) {
  this.load.start();
}

    // Camera bounds to map rect and zoom-to-fit with small padding
    this.cameras.main.setBounds(offsetX, offsetY, map.width, map.height);
    const viewW = this.scale.width;
    const viewH = this.scale.height;
    const padding = 8;
    const zoomX = (viewW - padding) / map.width;
    const zoomY = (viewH - padding) / map.height;
    this.cameras.main.setZoom(Math.min(zoomX, zoomY));
    this.cameras.main.centerOn(offsetX + map.width / 2, offsetY + map.height / 2);

    console.log("✅ Map rendered", map.width, map.height);

    // Debug overlay for collision cells (draw 16px squares where grid == 1)
    for (let ty = 0; ty < this.collisionGrid.length; ty++) {
      const row = this.collisionGrid[ty];
      for (let tx = 0; tx < row.length; tx++) {
        if (row[tx] === 1) {
          this.add
            .rectangle(
              offsetX + tx * this.collisionTileSize + this.collisionTileSize / 2,
              offsetY + ty * this.collisionTileSize + this.collisionTileSize / 2,
              this.collisionTileSize,
              this.collisionTileSize,
              0xff0000,
              0.4
            )
            .setDepth(999);
        }
      }
    }

    console.log("🟥 Debug walls drawn");

    // Optional: expose helpers so external movement code can use the same math (non-breaking).
    // Use these in your movement hook to avoid conversion mismatches.
    this.worldToGrid = (wx, wy) => {
      // Convert world pixels -> IntGrid indices (16px), using map offset
      const tx = Math.floor((wx - this.mapOffsetX) / this.collisionTileSize);
      const ty = Math.floor((wy - this.mapOffsetY) / this.collisionTileSize);
      return { tx, ty };
    };
    this.isWallAtWorld = (wx, wy) => {
      const { tx, ty } = this.worldToGrid(wx, wy);
      return this.isWallTile(tx, ty);
    };
  }

  // Game loop: create sprites on first sight, then smooth-move + animate (unchanged)
  update() {
    const playersRaw = this.getPlayers();
    const selfId = this.getSelfId();
    if (!playersRaw || !selfId) return;

    const players =
      playersRaw instanceof Map ? [...playersRaw.values()] : Object.values(playersRaw);

    // Create missing sprites
    for (const p of players) {
      if (!this.playerSprites.has(p.id)) {
        const worldX = p.x + this.mapOffsetX;
        const worldY = p.y + this.mapOffsetY;

        this.ensureAvatarLoaded(p.avatarKey);
        if (!this.textures.exists(`${p.avatarKey}:idle`)) continue;

        const sprite = this.add.sprite(worldX, worldY, `${p.avatarKey}:idle`);
        sprite.setDepth(10);
        sprite.setOrigin(0.5, 0.5);
        sprite.setScale(0.3);

        // logical movement target
        sprite.targetX = worldX;
        sprite.targetY = worldY;

        this.playerSprites.set(p.id, sprite);
        console.log("PLAYER", p.x, p.y, "WORLD", worldX, worldY);
      }
    }

    // Interpolate and animate
    for (const p of players) {
      const sprite = this.playerSprites.get(p.id);
      if (!sprite) continue;

      const worldX = p.x + this.mapOffsetX;
      const worldY = p.y + this.mapOffsetY;

      sprite.targetX = worldX;
      sprite.targetY = worldY;

      const speed = 0.25;
      const prevX = sprite.x;
      const prevY = sprite.y;

      sprite.x = Phaser.Math.Linear(sprite.x, sprite.targetX, speed);
      sprite.y = Phaser.Math.Linear(sprite.y, sprite.targetY, speed);

      const vx = sprite.x - prevX;
      const vy = sprite.y - prevY;
      const vel = Math.hypot(vx, vy);

      const arrived =
        Math.abs(sprite.targetX - sprite.x) < 0.8 &&
        Math.abs(sprite.targetY - sprite.y) < 0.8;

      const dirX = sprite.targetX - sprite.x;
      if (dirX < -0.5) sprite.setFlipX(true);
      else if (dirX > 0.5) sprite.setFlipX(false);

      if (!arrived && vel > 0.2) {
        if (
          !sprite.anims.currentAnim ||
          sprite.anims.currentAnim.key !== `walk:${p.avatarKey}`
        ) {
          sprite.play(`walk:${p.avatarKey}`, true);
        }
      } else {
        if (sprite.anims.isPlaying) {
          sprite.stop();
          sprite.setTexture(`${p.avatarKey}:idle`);
        }
      }
    }
    // Camera follow self left as-is (no behavioral change).
  }

  /**
   * IntGrid accessor:
   * - Accepts IntGrid indices (tx, ty).
   * - Outside-map indices are considered blocked (original behavior).
   * - Uses the normalized (cropped) grid to avoid phantom blocking.
   */
  isWallTile(tileX, tileY) {
    if (
      tileY < 0 ||
      tileY >= this.collisionGrid.length ||
      tileX < 0 ||
      tileX >= this.collisionGrid[0].length
    ) {
      return true;
    }
    return this.collisionGrid[tileY][tileX] === 1;
  }

  // Lazy-load avatar frames; create walk animation when ready (unchanged)
  ensureAvatarLoaded(avatarKey) {
    const base = `/avatars/${avatarKey}`;
    if (this.textures.exists(`${avatarKey}:idle`)) return;

    this.load.image(`${avatarKey}:idle`, `${base}/idle.png`);
    for (let i = 0; i < 8; i++) {
      this.load.image(`${avatarKey}:walk${i}`, `${base}/walk${i}.png`);
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.createWalkAnimation(avatarKey);
    });
    this.load.start();
  }

  createWalkAnimation(avatarKey) {
    if (this.anims.exists(`walk:${avatarKey}`)) return;
    const frames = [];
    for (let i = 0; i < 8; i++) frames.push({ key: `${avatarKey}:walk${i}` });
    this.anims.create({ key: `walk:${avatarKey}`, frames, frameRate: 12, repeat: -1 });
    console.log("🎞️ Animation created:", `walk:${avatarKey}`);
  }
}