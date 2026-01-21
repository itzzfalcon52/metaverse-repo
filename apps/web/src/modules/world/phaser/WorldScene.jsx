import * as Phaser from "phaser";

export class WorldScene extends Phaser.Scene {
  constructor() {
    super({ key: "WorldScene" });
    this.mapKey = "map1";
    this.playerSprites = new Map();
  }

  init(data) {
    this.mapKey = data.mapKey;
    this.getPlayers = data.getPlayers;
    this.getSelfId = data.getSelfId;
  }

  preload() {
    // Load map JSON
    this.load.json("mapData", `/${this.mapKey}/data.json`);
    this.load.text("collision", `/${this.mapKey}/IntGrid.csv`);

    // After JSON loads, load all layer images
    this.load.once("filecomplete-json-mapData", () => {
      const map = this.cache.json.get("mapData");
      if (!map) return;

      console.log("🗺️ Loading map layers:", map.layers);

      (map.layers || []).forEach((file) => {
        this.load.image(`layer:${file}`, `/${this.mapKey}/${file}`);
      });
    });
  }

  create() {
    window.__phaserScene = this;
  
    const map = this.cache.json.get("mapData");
    if (!map) {
      console.error("❌ mapData missing");
      return;
    }
  
    // Load collision grid
    const csv = this.cache.text.get("collision");
    this.collisionGrid = csv
  .trim()
  .split("\n")
  .map(row =>
    row
      .split(",")
      .filter(v => v !== "")   // 🔥 REMOVE EMPTY
      .map(n => Number(n))
  );
    this.tileSize = 32;

    console.log(
        "Grid size:",
        this.collisionGrid.length,
        this.collisionGrid[0].length
      );
      
  
    console.log("🧱 Collision grid loaded", this.collisionGrid);
  
    // ✅ SET MAP DATA + OFFSET FIRST
    this.mapData = map;
    this.mapOffsetX = this.mapData.x ?? 0;
    this.mapOffsetY = this.mapData.y ?? 0;
  
    const offsetX = this.mapOffsetX;
    const offsetY = this.mapOffsetY;
  
    console.log("🗺️ Map offset:", offsetX, offsetY);
  
    // Draw map layers
    (map.layers || []).forEach((file) => {
      const key = `layer:${file}`;
      this.add.image(offsetX, offsetY, key).setOrigin(0, 0).setDepth(0);
    });
  
    // Setup camera
    this.cameras.main.setBounds(offsetX, offsetY, map.width, map.height);
    this.cameras.main.centerOn(
      offsetX + map.width / 2,
      offsetY + map.height / 2
    );
  
    const zoomX = this.scale.width / map.width;
    const zoomY = this.scale.height / map.height;
    const zoom = Math.min(zoomX, zoomY);
    this.cameras.main.setZoom(zoom);
  
    console.log("✅ Map rendered", map.width, map.height);
  
    // ✅ NOW DRAW DEBUG WALLS
    for (let y = 0; y < this.collisionGrid.length; y++) {
      for (let x = 0; x < this.collisionGrid[0].length; x++) {
        if (this.collisionGrid[y][x] === 1) {
          this.add.rectangle(
            offsetX + x * 32 + 16,
            offsetY + y * 32 + 16,
            32,
            32,
            0xff0000,
            0.4
          ).setDepth(999);
        }
      }
    }
  
    console.log("🟥 Debug walls drawn");
  }
  

  update() {
    const playersRaw = this.getPlayers();
    const selfId = this.getSelfId();
    if (!playersRaw || !selfId) return;
  
    const players =
      playersRaw instanceof Map
        ? [...playersRaw.values()]
        : Object.values(playersRaw);
  
    // Create player boxes
    for (const p of players) {
      if (!this.playerSprites.has(p.id)) {
        const worldX = p.x + this.mapOffsetX;
        const worldY = p.y + this.mapOffsetY;
  
       // const rect = this.add.rectangle(worldX, worldY, 32, 32, 0xff0000);
       this.ensureAvatarLoaded(p.avatarKey);

       // If not yet loaded, skip this frame
      if (!this.textures.exists(`${p.avatarKey}:idle`)) continue;

      const sprite = this.add.sprite(worldX, worldY, `${p.avatarKey}:idle`);
      sprite.setDepth(10);
      sprite.setOrigin(0.5, 0.5);
       sprite.setScale(0.3);

      // 🔥 Add logical target position
      sprite.targetX = worldX;
      sprite.targetY = worldY;

     this.playerSprites.set(p.id, sprite);

        console.log("PLAYER", p.x, p.y, "WORLD", worldX, worldY);

       // rect.setDepth(10);
  
        //this.playerSprites.set(p.id, rect);
      }
    }
  
    // Update positions
    for (const p of players) {
        const sprite = this.playerSprites.get(p.id);
        if (!sprite) continue;
  
        const worldX = p.x + this.mapOffsetX;
        const worldY = p.y + this.mapOffsetY;
  
        // Update target each tick
        sprite.targetX = worldX;
        sprite.targetY = worldY;
  
        // Smooth move towards target
        const speed = 0.25; // interpolation factor
        const prevX = sprite.x;
        const prevY = sprite.y;
  
        sprite.x = Phaser.Math.Linear(sprite.x, sprite.targetX, speed);
        sprite.y = Phaser.Math.Linear(sprite.y, sprite.targetY, speed);
  
        // Compute velocity magnitude
        const vx = sprite.x - prevX;
        const vy = sprite.y - prevY;
        const vel = Math.hypot(vx, vy);
  
        // Dead-zone for arriving at target
        const arrived =
          Math.abs(sprite.targetX - sprite.x) < 0.8 &&
          Math.abs(sprite.targetY - sprite.y) < 0.8;
  
        // Flip based on desired direction (target delta), not velocity noise
        const dirX = sprite.targetX - sprite.x;
        if (dirX < -0.5) sprite.setFlipX(true);
        else if (dirX > 0.5) sprite.setFlipX(false);
  
        // Animation control
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
    // Camera follow self 
    
    
    
  }

  isWallTile(tileX, tileY) {
    // Outside grid = blocked
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

  ensureAvatarLoaded(avatarKey) {
    const base = `/avatars/${avatarKey}`;
  
    if (this.textures.exists(`${avatarKey}:idle`)) return;
  
    // Idle
    this.load.image(`${avatarKey}:idle`, `${base}/idle.png`);
  
    // Walk frames
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
    for (let i = 0; i < 8; i++) {
      frames.push({ key: `${avatarKey}:walk${i}` });
    }
  
    this.anims.create({
      key: `walk:${avatarKey}`,
      frames,
      frameRate: 12,
      repeat: -1,
    });
  
    console.log("🎞️ Animation created:", `walk:${avatarKey}`);
  }
  
  
  
  
  
  
}
