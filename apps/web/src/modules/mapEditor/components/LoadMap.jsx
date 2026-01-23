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
    super({ key: "EditorScene" });

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

  /**
   * Phaser calls init() when the scene starts.
   * We use it to accept data from the game bootstrap (CreateGame).
   */
  init(data) {
    this.mapKey = data?.mapKey ?? this.mapKey;
    this.tileSize = data?.tileSize ?? this.tileSize;
    this.onPlacementsChanged = data?.onPlacementsChanged ?? null;
  }

  /**
   * preload() is where Phaser loads initial assets.
   * Here we only load the JSON descriptor first.
   * Layer images are loaded dynamically in create() after we know the filenames.
   */
  preload() {
    // Loads JSON into Phaser cache under the key "mapData"
    this.load.json("mapData", `/${this.mapKey}/data.json`);
  }

  /**
   * create() runs once when preload finished.
   * We:
   * - read JSON from cache
   * - queue image loads for each layer
   * - wait for those images to load
   * - then draw layers + grid + activate editor interactions
   */
  create() {
    // Retrieve JSON loaded in preload()
    const map = this.cache.json.get("mapData");
    if (!map) throw new Error("mapData not found");

    // Keep a reference for other methods (grid snapping, bounds, etc.)
    this.mapData = map;

    /**
     * We load the layer PNGs after reading the JSON.
     * Phaser loads assets asynchronously. We need to wait until they all load,
     * then we can safely use them via their texture keys.
     */
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.drawLayers(); // render the background map images
      this.drawGrid(); // overlay visible grid
      this.setupDnD(); // connect React events -> Phaser selection/ghost
      this.setupPlacementControls(); // click to place, right click to remove
      this.fitCameraToMap();   
      this.setupResizeHandler(); // handle container resize
    });

    // For each layer filename in JSON, queue an image file load
    (map.layers || []).forEach((file) => {
      // Store each layer texture in cache with key: "layer:Floor.png"
      this.load.image(`layer:${file}`, `/${this.mapKey}/${file}`);
    });

    // Start the queued loads (since we're doing this in create(), not preload())
    this.load.start();
  }

  /**
   * Draw each layer PNG at the map's offset.
   * Your JSON can contain negative x/y (offset), so we respect that.
   */
  drawLayers() {
    const offsetX = this.mapData.x ?? 0;
    const offsetY = this.mapData.y ?? 0;

    // Add each layer image to the scene, stacked in the listed order
    (this.mapData.layers || []).forEach((file) => {
      const key = `layer:${file}`;
      // origin(0,0) = (x,y) is top-left corner of the image
      this.add.image(offsetX, offsetY, key).setOrigin(0, 0);
    });

    // Set camera and physics bounds to the map rectangle
    // so camera/collisions don't operate outside the map area
    this.cameras.main.setBounds(offsetX, offsetY, this.mapData.width, this.mapData.height);
    this.physics.world.setBounds(offsetX, offsetY, this.mapData.width, this.mapData.height);

    // Start camera centered on the map
    //this.cameras.main.centerOn(offsetX + this.mapData.width / 2, offsetY + this.mapData.height / 2);
  }

  /**
   * Draw a grid overlay so admin can visually place elements on cells.
   * This is just a Graphics overlay; it doesn't affect physics.
   */
  drawGrid() {
    const offsetX = this.mapData.x ?? 0;
    const offsetY = this.mapData.y ?? 0;

    const g = this.add.graphics();
    // light cyan grid with low alpha
    g.lineStyle(1, 0x00ffff, 0.08);

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
    const cam = this.cameras.main;
    const offsetX = this.mapData.x ?? 0;
    const offsetY = this.mapData.y ?? 0;
    const mapW = this.mapData.width;
    const mapH = this.mapData.height;
  
    const viewW = this.scale.width;
    const viewH = this.scale.height;
  
    const padding = 8;
    const zoomX = (viewW - padding) / mapW;
    const zoomY = (viewH - padding) / mapH;
    const zoom = Math.min(zoomX, zoomY);
  
    cam.setZoom(zoom);
    cam.centerOn(offsetX + mapW / 2, offsetY + mapH / 2);
  }

  setupResizeHandler() {
    this.scale.on("resize", () => {
      this.fitCameraToMap();
    });
  }
  

  /**
   * "DnD" here means: React tells Phaser "the user selected this element"
   * and Phaser then shows a ghost preview following the mouse.
   *
   * React triggers:
   * window.dispatchEvent(new CustomEvent("editor:dragstart", { detail: elementData }))
   */
  setupDnD() {
    // React -> Phaser: start placing a particular element
    window.addEventListener("editor:dragstart", (e) => {
      // Store the current element selection
      this.dragged = e.detail; // { elementId, imageUrl, width, height }

      // Ensure Phaser has loaded the element's image into texture cache
      this.ensureElementTextureLoaded(this.dragged);

      // Create or update the ghost sprite to preview placement
      this.createOrUpdateGhost();
    });

    // React -> Phaser: stop placing anything
    window.addEventListener("editor:dragend", () => {
      this.dragged = null;
      if (this.ghost) this.ghost.setVisible(false);
    });

    // Mouse move inside Phaser canvas: update ghost position/snapping/validity
    this.input.on("pointermove", (pointer) => {
      if (!this.dragged || !this.ghost) return;

      // Snap pointer (world) coords to grid
      const snapped = this.snapToGrid(pointer.worldX, pointer.worldY);

      // Move ghost to snapped location
      this.ghost.setPosition(snapped.x, snapped.y).setVisible(true);

      // Validate whether placement is within map bounds
      const ok = this.isInsideMap(snapped.x, snapped.y, this.dragged.width, this.dragged.height);

      // Give user feedback: cyan when ok, red when invalid
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
    this.input.on("pointerdown", (pointer) => {
      // If nothing selected from sidebar, do nothing
      if (!this.dragged) return;

      const snapped = this.snapToGrid(pointer.worldX, pointer.worldY);

      // Reject placements that would extend outside map bounds
      if (!this.isInsideMap(snapped.x, snapped.y, this.dragged.width, this.dragged.height)) return;

      // Place a real sprite (not ghost)
      const texKey = this.textureKeyFor(this.dragged);
      const sprite = this.add.image(snapped.x, snapped.y, texKey).setOrigin(0, 0);

      // Record placement (React uses this list to save to DB later)
      const placement = {
        elementId: this.dragged.elementId,
        x: snapped.x,
        y: snapped.y,
        width: this.dragged.width,
        height: this.dragged.height,
      };
      this.placements.push(placement);

      // Make sprite clickable
      sprite.setInteractive({ useHandCursor: true });

      // Right-click => remove this placed sprite and remove from placements array
      sprite.on("pointerdown", (p) => {
        if (p.rightButtonDown()) {
          sprite.destroy();
          this.placements = this.placements.filter(
            (pl) => !(pl.elementId === placement.elementId && pl.x === placement.x && pl.y === placement.y)
          );
          this.emitPlacements();
        }
      });

      // Notify React that placements changed
      this.emitPlacements();
    });

    // Prevent browser context menu on right click (so right click works inside canvas)
    this.input.mouse?.disableContextMenu();
  }

  /**
   * Call the React callback with a copy of the placements.
   * Copy is used so React sees a new array reference.
   */
  emitPlacements() {
    if (typeof this.onPlacementsChanged === "function") {
      this.onPlacementsChanged([...this.placements]);
    }
  }

  /**
   * Convert world coordinates to "top-left of nearest grid cell".
   * Offset-based because maps can start at negative x/y.
   */
  snapToGrid(worldX, worldY) {
    const offsetX = this.mapData.x ?? 0;
    const offsetY = this.mapData.y ?? 0;

    const x = Math.floor((worldX - offsetX) / this.tileSize) * this.tileSize + offsetX;
    const y = Math.floor((worldY - offsetY) / this.tileSize) * this.tileSize + offsetY;

    return { x, y };
  }

  /**
   * Validate placement is fully inside the map rectangle.
   * Uses element width/height because large elements could overflow map bounds.
   */
  isInsideMap(x, y, w, h) {
    const offsetX = this.mapData.x ?? 0;
    const offsetY = this.mapData.y ?? 0;

    return (
      x >= offsetX &&
      y >= offsetY &&
      x + w <= offsetX + this.mapData.width &&
      y + h <= offsetY + this.mapData.height
    );
  }

  /**
   * Create a stable Phaser texture key for a given element.
   * This avoids reloading the same image multiple times.
   */
  textureKeyFor(d) {
    return `element:${d.elementId}`;
  }

  /**
   * Loads the element image into Phaser's texture cache (if not already loaded).
   * - this.load.image(key, url) schedules the load
   * - this.load.start() begins the async load
   * - on complete, we update the ghost
   */
  ensureElementTextureLoaded(d) {
    const key = this.textureKeyFor(d);
    if (this.textures.exists(key)) return; // already loaded, nothing to do

    // imageUrl is a public URL like "/elements/tree.png"
    this.load.image(key, d.imageUrl);

    // When this load finishes, make sure ghost uses the new texture
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.createOrUpdateGhost());

    // Start load immediately (because this isn't in preload())
    this.load.start();
  }

  /**
   * Create a ghost preview sprite if missing; otherwise swap its texture.
   * Ghost is:
   * - invisible until we move mouse
   * - semi-transparent
   * - tinted based on valid/invalid placement
   */
  createOrUpdateGhost() {
    if (!this.dragged) return;

    const key = this.textureKeyFor(this.dragged);
    if (!this.textures.exists(key)) return; // can't create ghost until texture is loaded

    if (!this.ghost) {
      this.ghost = this.add.image(0, 0, key).setOrigin(0, 0).setAlpha(0.55).setVisible(false);
      this.ghost.setDepth(10_000); // keep ghost above map layers and above placed sprites
    } else {
      this.ghost.setTexture(key).setVisible(false);
    }
  }
}

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