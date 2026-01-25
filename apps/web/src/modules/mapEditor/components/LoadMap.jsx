import * as Phaser from "phaser";

/**
 * EditorScene:
 * - Renders a map from /{mapKey}/data.json (your custom JSON format)
 * - Loads & draws background PNG layer images listed in mapData.layers[]
 * - Draws a grid overlay
 * - Lets admin place "Element" sprites on the map using drag->preview->click
 * - Tracks placements in-memory and reports them back to React via callback
 */
export class EditorScene extends Phaser.Scene {
  constructor() {
    super({ key: "EditorScene" }); // register the scene with a unique key

    // Folder name inside /public that contains data.json + layer PNGs
    // Example: /public/map1/data.json and /public/map1/Floor.png
    this.mapKey = "map1";

    // Grid size used for snapping placements
    this.tileSize = 32;

    // All placed elements currently in the editor session
    // Each entry looks like: { elementId, x, y, width, height }
    this.placements = [];

    // "Ghost" = a semi-transparent preview of the element being placed
    this.ghost = null;

    // Currently selected element to place (comes from React sidebar)
    // Shape: { elementId, imageUrl, width, height }
    this.dragged = null;

    // React injects this callback so Phaser can notify React about placement changes
    this.onPlacementsChanged = null;
  }

  init(data) {
    // Initialize scene state from data passed by the game bootstrapper or React.
    // Fallback to constructor defaults if not provided.
    this.mapKey = data?.mapKey ?? this.mapKey;
    this.tileSize = data?.tileSize ?? this.tileSize;
    this.onPlacementsChanged = data?.onPlacementsChanged ?? null;
  }

  preload() {
    // Preload only the JSON that describes the map (layers, dimensions, offsets).
    // PNG layers are queued later in create(), after we read the JSON.
    this.load.json("mapData", `/${this.mapKey}/data.json`);
  }

  create() {
    // Read the previously loaded JSON from the cache.
    const map = this.cache.json.get("mapData");
    if (!map) throw new Error("mapData not found"); // fail fast if missing

    this.mapData = map; // store for later use

    // Wait for dynamic image layer loads to finish before drawing and enabling controls.
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.drawLayers();               // draw PNG layers at the configured offsets
      this.drawGrid();                 // draw placement grid overlay
      this.setupDnD();                 // wire up drag start/end and pointer move preview
      this.setupPlacementControls();   // wire up left-click place and right-click delete
      this.fitCameraToMap();           // zoom and center camera to fit the whole map
      this.setupResizeHandler();       // re-fit camera when the canvas size changes
    });

    // Queue each layer PNG for loading based on filenames listed in the map JSON.
    (this.mapData.layers || []).forEach((file) => {
      this.load.image(`layer:${file}`, `/${this.mapKey}/${file}`);
    });

    this.load.start(); // begin the asset loading process
  }

  drawLayers() {
    // Compute top-left offset for where the map should start.
    const offsetX = this.mapData.x ?? 0; //this defines where to start drawing the map by referring our data.json
    const offsetY = this.mapData.y ?? 0;

    // Add each PNG layer as an Image, anchored at the top-left corner.
    (this.mapData.layers || []).forEach((file) => {
      const key = `layer:${file}`;
      this.add.image(offsetX, offsetY, key).setOrigin(0, 0);
    });

    // Restrict camera and physics world bounds to the map area.
    this.cameras.main.setBounds(offsetX, offsetY, this.mapData.width, this.mapData.height);
    this.physics.world.setBounds(offsetX, offsetY, this.mapData.width, this.mapData.height);
  }

  drawGrid() {
    // Use the same offset to align the grid to the map origin.
    const offsetX = this.mapData.x ?? 0;
    const offsetY = this.mapData.y ?? 0;

    // Graphics for lightweight line drawing.
    const g = this.add.graphics();
    g.lineStyle(1, 0x00ffff, 0.08); // thin cyan lines, low alpha

    // Compute number of columns and rows for the grid.
    const cols = Math.floor(this.mapData.width / this.tileSize);
    const rows = Math.floor(this.mapData.height / this.tileSize);

    // Vertical lines
    for (let c = 0; c <= cols; c++) {
      const x = offsetX + c * this.tileSize;
      g.lineBetween(x, offsetY, x, offsetY + rows * this.tileSize);
    }

    // Horizontal lines
    for (let r = 0; r <= rows; r++) {
      const y = offsetY + r * this.tileSize;
      g.lineBetween(offsetX, y, offsetX + cols * this.tileSize, y);
    }
  }

  fitCameraToMap() {
    // Fit the camera zoom to show the entire map within the current canvas size.
    const cam = this.cameras.main;
    const offsetX = this.mapData.x ?? 0;
    const offsetY = this.mapData.y ?? 0;
    const mapW = this.mapData.width;
    const mapH = this.mapData.height;

    const viewW = this.scale.width;  // canvas width
    const viewH = this.scale.height; // canvas height

    const padding = 8; // small padding to avoid touching edges
    const zoomX = (viewW - padding) / mapW;
    const zoomY = (viewH - padding) / mapH;
    const zoom = Math.min(zoomX, zoomY); // choose the smaller to fully fit

    cam.setZoom(zoom); // apply zoom
    cam.centerOn(offsetX + mapW / 2, offsetY + mapH / 2); // center camera on map middle
  }

  setupResizeHandler() {
    // When the canvas resizes (e.g., window resize), recompute camera fit.
    this.scale.on("resize", () => {
      this.fitCameraToMap();
    });
  }

  setupDnD() {
    // Listen to app-wide custom events fired by React sidebar when dragging starts.
    window.addEventListener("editor:dragstart", (e) => {
      this.dragged = e.detail;                    // selected element payload
      this.ensureElementTextureLoaded(this.dragged); // load texture if not cached
      this.createOrUpdateGhost();                 // create or refresh the ghost preview sprite
    });

    // Reset state and hide ghost when dragging ends.
    window.addEventListener("editor:dragend", () => {
      this.dragged = null;
      if (this.ghost) this.ghost.setVisible(false);
    });

    // Update ghost position and tint as the pointer moves over the map.
    this.input.on("pointermove", (pointer) => {
      if (!this.dragged || !this.ghost) return;

      const snapped = this.snapToGrid(pointer.worldX, pointer.worldY); // snap to tile

      this.ghost.setPosition(snapped.x, snapped.y).setVisible(true);   // move ghost

      const ok = this.isInsideMap(snapped.x, snapped.y, this.dragged.width, this.dragged.height); // bounds check

      // Cyan if valid placement, red if invalid (outside map).
      this.ghost.setAlpha(ok ? 0.55 : 0.2);
      this.ghost.setTint(ok ? 0x00ffff : 0xff4444);
    });
  }

  /**
   * Placement logic:
   * - left click places the selected element (snapped to grid)
   * - right click on placed element removes it
   * - after any change, notify React via onPlacementsChanged
   */
  setupPlacementControls() {
    // GLOBAL click handler = ONLY for placing on empty map
    this.input.on("pointerdown", (pointer) => {
      // Only LEFT click should place
      if (!pointer.leftButtonDown()) return;

      // If nothing selected from sidebar, do nothing
      if (!this.dragged) return;

      const snapped = this.snapToGrid(pointer.worldX, pointer.worldY); // snap clicked position

      // Abort if placement would exceed map bounds.
      if (!this.isInsideMap(snapped.x, snapped.y, this.dragged.width, this.dragged.height)) return;

      // Use a texture key to render the sprite.
      const texKey = this.textureKeyFor(this.dragged);
      const sprite = this.add.image(snapped.x, snapped.y, texKey).setOrigin(0, 0); // draw sprite

      // Record placement details in memory for persistence later.
      const placement = {
        elementId: this.dragged.elementId,
        x: snapped.x,
        y: snapped.y,
        width: this.dragged.width,
        height: this.dragged.height,
      };
      this.placements.push(placement);

      // Make sprite clickable for deletion.
      sprite.setInteractive({ useHandCursor: true });

      // SPRITE-SPECIFIC handler = ONLY for deleting
      sprite.on("pointerdown", (p) => {
        if (!p.rightButtonDown()) return; // only act on right click

        // VERY IMPORTANT: stop this click from reaching the global handler
        p.event.stopPropagation();

        sprite.destroy(); // remove from scene

        // Remove matching placement record.
        this.placements = this.placements.filter(
          (pl) => !(pl.elementId === placement.elementId && pl.x === placement.x && pl.y === placement.y)
        );

        this.emitPlacements(); // notify React
      });

      this.emitPlacements(); // notify React after placement
    });

    // Prevent browser context menu on right click
    this.input.mouse?.disableContextMenu();
  }

  emitPlacements() {
    // Call the injected callback with a shallow copy to avoid external mutation.
    if (typeof this.onPlacementsChanged === "function") {
      this.onPlacementsChanged([...this.placements]);
    }
  }

  snapToGrid(worldX, worldY) {
    // Compute snapped top-left position based on tileSize and map offset.
    const offsetX = this.mapData.x ?? 0;
    const offsetY = this.mapData.y ?? 0;

    const x = Math.floor((worldX - offsetX) / this.tileSize) * this.tileSize + offsetX;
    const y = Math.floor((worldY - offsetY) / this.tileSize) * this.tileSize + offsetY;

    return { x, y }; // snapped coordinates aligned to grid
  }

  isInsideMap(x, y, w, h) {
    // Validate placement rectangle is fully within the map bounds.
    const offsetX = this.mapData.x ?? 0;
    const offsetY = this.mapData.y ?? 0;

    return (
      x >= offsetX &&
      y >= offsetY &&
      x + w <= offsetX + this.mapData.width &&
      y + h <= offsetY + this.mapData.height
    );
  }

  textureKeyFor(d) {
    // Stable texture key for the element, used by Phaser texture cache.
    return `element:${d.elementId}`;
  }

  ensureElementTextureLoaded(d) {
    // Lazily load the element image if it isn't already cached.
    const key = this.textureKeyFor(d);
    if (this.textures.exists(key)) return;

    this.load.image(key, d.imageUrl); // queue image
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.createOrUpdateGhost()); // update ghost when ready
    this.load.start(); // start loading
  }

  createOrUpdateGhost() {
    // Create a semi-transparent preview sprite, or retarget existing one to the new texture.
    if (!this.dragged) return;

    const key = this.textureKeyFor(this.dragged);
    if (!this.textures.exists(key)) return; // texture must be loaded

    if (!this.ghost) {
      // Create the ghost sprite above everything (high depth), initially hidden.
      this.ghost = this.add.image(0, 0, key).setOrigin(0, 0).setAlpha(0.55).setVisible(false);
      this.ghost.setDepth(10_000);
    } else {
      // Update texture and keep hidden until pointer moves.
      this.ghost.setTexture(key).setVisible(false);
    }
  }
}

/**
 * =========================================
 * Detailed Explanation: EditorScene Overview
 * =========================================
 *
 * Purpose:
 * - Provides a Phaser-based map editor scene embedded in a React app.
 * - Loads map metadata (data.json) and background layer PNGs, draws a grid,
 *   and lets admins place/remove element sprites aligned to a tile grid.
 *
 * Lifecycle:
 * - init(data): Receives configuration (mapKey, tileSize, onPlacementsChanged) from the host.
 * - preload(): Loads map JSON only. PNG layers are deferred to create() after JSON is parsed.
 * - create():
 *   - Reads mapData from cache; throws if missing.
 *   - Queues PNG layers listed in mapData.layers for loading.
 *   - Waits for loader COMPLETE, then draws layers, grid, wires controls, fits camera, and sets resize handler.
 *
 * Input & Interaction:
 * - React sidebar emits CustomEvents "editor:dragstart" and "editor:dragend".
 *   - dragstart stores selected element, ensures texture, and prepares a ghost preview.
 *   - dragend clears selection and hides the ghost.
 * - pointermove: Snaps pointer world coords to grid; moves/visualizes ghost.
 *   - Tint cyan when placement is valid; red when outside map bounds.
 * - pointerdown:
 *   - Global handler: Left-click places a sprite if an element is selected and bounds are valid.
 *   - Sprite-specific handler: Right-click deletes that sprite; stopPropagation prevents the global handler from firing.
 *
 * Data flow:
 * - placements[] keeps in-session placed records: { elementId, x, y, width, height }.
 * - emitPlacements() clones and passes placements to React via onPlacementsChanged for UI/state persistence.
 *
 * Rendering:
 * - drawLayers(): Adds background images with top-left origin at map offsets; sets camera/physics bounds.
 * - drawGrid(): Uses Graphics to draw lightweight grid lines according to tileSize.
 * - Ghost sprite: Semi-transparent preview aligned to grid; high depth to overlay layers.
 *
 * Camera:
 * - fitCameraToMap(): Computes zoom to fit map into current canvas, centers on map middle.
 * - setupResizeHandler(): Recomputes fit when canvas resizes.
 *
 * Assets:
 * - ensureElementTextureLoaded(): Lazy-loads the element image at selection time, caches in Phaser textures.
 * - textureKeyFor(): Provides consistent cache keys tied to elementId.
 *
 * Constraints & Validation:
 * - isInsideMap(): Ensures the placement rectangle is fully within map bounds based on offsets and dimensions.
 * - snapToGrid(): Converts world coordinates to nearest tile-aligned position respecting map origin.
 *
 * Notes:
 * - Using Graphics for the grid avoids heavy textures and keeps the editor responsive.
 * - Keeping placements in memory is sufficient for the editing session; React can persist to DB when confirmed.
 * - Depth ordering ensures the ghost preview is visible above layers/sprites.
 */

/**
 * ===========================
 * DETAILED EXPLANATION (READ)
 * ===========================
 *
 * This file defines a Phaser Scene called EditorScene.
 * A Scene is like a self-contained screen/state in Phaser: it has its own preload/create/update lifecycle.
 *
 * OVERALL FLOW:
 * 1) React mounts your page and calls createGame(...) (in your CreateGame.js).
 * 2) CreateGame starts this scene and passes { mapKey, tileSize, onPlacementsChanged } into init().
 * 3) preload() loads only the JSON descriptor file (data.json) for the selected map folder.
 * 4) create() reads that JSON from cache, then dynamically loads each PNG layer listed in JSON.
 * 5) Once those PNGs finish loading, we draw the map (layers), draw the grid overlay, then enable the editor controls.
 * 6) React sidebar does not directly talk to Phaser objects, so it uses window CustomEvents:
 *    - "editor:dragstart": user selected an element from the sidebar (now Phaser should preview it)
 *    - "editor:dragend": user stopped selecting/placing (hide preview)
 * 7) While an element is selected:
 *    - pointermove snaps the mouse world position to the grid and moves a "ghost" sprite there.
 *    - the ghost is tinted cyan if placement is valid, red if it would go outside the map.
 * 8) On left click:
 *    - we place a real sprite at the snapped position
 *    - we push a placement record into this.placements
 *    - we call emitPlacements() to notify React, so React can show counts / save to DB later.
 * 9) On right click on an already placed sprite:
 *    - we destroy the sprite
 *    - remove the corresponding entry from this.placements
 *    - notify React again via emitPlacements()
 *
 * WHY LAYERS ARE LOADED DYNAMICALLY:
 * - Your data.json only lists the layer filenames. We don't know them until we load the JSON.
 * - Phaser requires assets to be loaded before they can be rendered.
 * - So create() schedules the image loads and waits for Phaser.Loader.Events.COMPLETE.
 *
 * WHY THE GRID IS DRAWN WITH Graphics:
 * - The grid is just a visual helper for placement. It does not affect collisions/physics.
 * - Using a Graphics object means we can draw simple lines cheaply without textures.
 *
 * WHY WE STORE placements IN MEMORY:
 * - During editing, you just need a working "current session" list.
 * - When admin clicks "Confirm & Save" in React, React sends placements to your server.
 * - Your server stores them in Prisma MapElements (mapId, elementId, x, y).
 *
 * WHY TEXTURES ARE LOADED ON DEMAND FOR ELEMENTS:
 * - Elements come from DB and could be many.
 * - Loading all element PNGs up front is slower and may waste memory.
 * - Instead, when a user selects an element, ensureElementTextureLoaded() loads it once and caches it.
 *
 * IMPORTANT ASSUMPTIONS:
 * - Your PNG layer files exist at: /public/{mapKey}/{LayerName}.png
 * - Your JSON exists at: /public/{mapKey}/data.json
 * - Your element images exist at URLs like: /elements/some.png
 * - Arcade physics is enabled in the Phaser.Game config (so this.physics.world exists).
 */