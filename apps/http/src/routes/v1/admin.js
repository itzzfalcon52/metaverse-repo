// JavaScript
// filepath: /Users/hussain/Desktop/web dev projects/metaverse-app/metaverse-repo/apps/http/src/routes/v1/admin.js
import express from 'express';
import { adminMiddleware } from "../../middlewares/admin.js";
import { userMiddleware } from "../../middlewares/user.js";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { AddElementSchema, CreateAvatarSchema, CreateElementSchema, CreateMapSchema, UpdateElementSchema } from "../../types/index.js";
import db from "@repo/db"

const router = express.Router();

router.get("/maps", adminMiddleware, async (req, res) => {
    try {
      const maps = await db.map.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          width: true,
          height: true,
          thumbnail: true,
          // optional: show number of elements placed on the map
          mapElements: { select: { id: true } },
        },
      });
  
      res.json({
        maps: maps.map((m) => ({
          id: m.id,
          name: m.name,
          width: m.width,
          height: m.height,
          thumbnail: m.thumbnail,
          elementsCount: m.mapElements.length,
        })),
      });
    } catch (e) {
      console.error("GET /admin/maps failed:", e);
      res.status(500).json({ message: "Failed to load maps" });
    }
  });

router.post("/element",adminMiddleware, async (req, res) => {
    const parsedData = CreateElementSchema.safeParse(req.body)
    if (!parsedData.success) {
        res.status(400).json({message: "Validation failed"})
        return
    }

    const element = await db.element.create({
        data: {
            width: parsedData.data.width,
            height: parsedData.data.height,
            static: parsedData.data.static,
            imageUrl: parsedData.data.imageUrl,
        }
    })

    res.json({
        id: element.id
    })
})

router.put("/element/:elementId",userMiddleware, (req, res) => {
    const parsedData = UpdateElementSchema.safeParse(req.body)
    if (!parsedData.success) {
        res.status(400).json({message: "Validation failed"})
        return
    }
    db.element.update({
        where: {
            id: req.params.elementId
        },
        data: {
            imageUrl: parsedData.data.imageUrl
        }
    })
    res.json({message: "Element updated"})
})

router.post("/map",adminMiddleware, async (req, res) => {
    const parsedData = CreateMapSchema.safeParse(req.body)
    if (!parsedData.success) {
        res.status(400).json({message: "Validation failed"})
        return
    }
    const map = await db.map.create({
        data: {
            name: parsedData.data.name,
            width: parseInt(parsedData.data.dimensions.split("x")[0]),
            height: parseInt(parsedData.data.dimensions.split("x")[1]),
            thumbnail: parsedData.data.thumbnail,
            mapElements: {
                create: parsedData.data.defaultElements.map(e => ({
                    elementId: e.elementId,
                    x: e.x,
                    y: e.y
                }))
            }
        }
    })

    res.json({
        id: map.id
    })
})

router.post("/maps/:mapId/elements", adminMiddleware, async (req, res) => {
    const { placements } = req.body;
    const { mapId } = req.params;
  
    if (!Array.isArray(placements)) {
      return res.status(400).json({ message: "Invalid placements data" });
    }
  
    // Delete existing placements for the map
    await db.mapElements.deleteMany({
      where: { mapId },
    });
  
    // Create new placements
    const createData = placements.map((p) => ({
      mapId,
      elementId: p.elementId,
      x: p.x,
      y: p.y,
    }));
  
    await db.mapElements.createMany({
      data: createData,
    });
  
    res.json({ message: "Placements updated successfully" });
  }
)

router.post("/map/upload", async (req, res) => {
    const { name, width, height, tilemapJson, thumbnail } = req.body;
  
    const map = await db.map.create({
      data: {
        name,
        width,
        height,
        tilemapJson,
        thumbnail
      }
    });
  
    res.json({ mapId: map.id });
  });

// --- IMPORT ELEMENTS ENDPOINT UPDATED TO SUPPORT SUBFOLDERS ---
// This endpoint now supports:
// - Importing a specific subfolder: /elements/livingRoom OR /elements/Library (by passing req.body.folder)
// - Importing both subfolders by default when no folder is provided
// - Recursing only one level: png files directly inside each subfolder (no deep recursion)
router.post("/elements/import", adminMiddleware, async (req, res) => {
  try {
    // The client may pass: { folder: "/elements/livingRoom" } or { folder: "/elements/Library" }
    // If not provided, we default to importing BOTH known subfolders.
    const { folder, static: isStatic = true } = req.body ?? {};

    // Resolve the /apps/web/public directory (Next.js public)
    const publicDir = path.join(process.cwd(), "..", "web", "public");

    // Helper: list PNG files inside a given public-relative folder (e.g., "/elements/livingRoom")
    const listPngsInFolder = async (publicRelativeFolder) => {
      const absFolder = path.join(publicDir, publicRelativeFolder);
      const entries = await fs.readdir(absFolder, { withFileTypes: true });
      // We only consider files at this level; ignore subdirectories to keep logic simple and predictable
      return entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".png"))
        .map((e) => ({
          fileName: e.name,
          // imageUrl must remain POSIX-styled to serve via Next static assets: "/elements/livingRoom/foo.png"
          imageUrl: path.posix.join(publicRelativeFolder, e.name),
          absFile: path.join(absFolder, e.name),
        }));
    };

    // Determine which folders to import:
    // - If `folder` is provided, import just that folder (must be "/elements/livingRoom" or "/elements/Library").
    // - If not, import both subfolders by default.
    const targetFolders = folder
      ? [folder]
      : ["/elements/livingRoom", "/elements/Library"];

    // Aggregate all PNG entries from selected folders
    const allPngs = [];
    for (const f of targetFolders) {
      try {
        const pngs = await listPngsInFolder(f);
        allPngs.push(...pngs);
      } catch (e) {
        // If a folder is missing, skip it but note the error
        console.warn(`Skipping missing folder: ${f}`, e?.message);
      }
    }

    // If we found no files, return an informative 400 response
    if (allPngs.length === 0) {
      return res.status(400).json({
        message: "No PNG files found. Ensure assets exist in /public/elements/livingRoom or /public/elements/Library.",
        foldersScanned: targetFolders,
      });
    }

    const results = [];
    for (const { imageUrl, absFile } of allPngs) {
      // Read image metadata with sharp to populate width/height
      const meta = await sharp(absFile).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;

      // Upsert by imageUrl (unique per asset path). If an element exists, update its size/static flag.
      const existing = await db.element.findFirst({ where: { imageUrl } });
      const element = existing
        ? await db.element.update({
            where: { id: existing.id },
            data: { width, height, static: isStatic },
          })
        : await db.element.create({
            data: { width, height, static: isStatic, imageUrl },
          });

      results.push({
        id: element.id,
        imageUrl: element.imageUrl,
        width: element.width,
        height: element.height,
      });
    }

    // Return summary
    res.json({
      success: true,
      count: results.length,
      elements: results,
      foldersImported: targetFolders,
    });
  } catch (e) {
    console.error("elements/import failed:", e);
    res.status(500).json({ message: "Failed to import elements" });
  }
});

export default router;