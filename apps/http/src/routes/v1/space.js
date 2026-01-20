

import express from "express";
import db from "@repo/db";
import { userMiddleware } from "../../middlewares/user.js";
import {
  AddElementSchema,
  CreateSpaceSchema,
  DeleteElementSchema,
} from "../../types/index.js";

const router = express.Router();

/* =========================================================
   GET SPACE WORLD (MAP + ELEMENTS)
   ========================================================= */
   router.get("/:spaceId/world",userMiddleware, async (req, res) => {
    try {
      const space = await db.space.findUnique({
        where: { id: req.params.spaceId },
        include: {
          elements: {
            include: { element: true },
          },
        },
      });
  
      if (!space) {
        return res.status(404).json({ message: "Space not found" });
      }
  
      // IMPORTANT: space must know which map it came from
      const map = await db.map.findUnique({
        where: { id: space.mapId },
      });
  
      if (!map) {
        return res.status(404).json({ message: "Map not found" });
      }
  
      return res.json({
        width: space.width,
        height: space.height,
        tilemapJson: map.tilemapJson,
        elements: space.elements.map((e) => ({
          id: e.id,
          x: e.x,
          y: e.y,
          width: e.element.width,
          height: e.element.height,
          imageUrl: e.element.imageUrl,
          static: e.element.static,
        })),
      });
    } catch (err) {
      console.error("GET WORLD ERROR:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

/* =========================================================
   CREATE SPACE
   ========================================================= */
router.post("/", userMiddleware, async (req, res) => {

    // Step 1: Validate request body using Zod
    // This ensures:
    // - name exists
    // - dimensions look like "100x200"
    // - mapId (if present) is a string
  try {
    const parsedData = CreateSpaceSchema.safeParse(req.body);
     // If user sends invalid data, reject early
    if (!parsedData.success) {
      return res.status(400).json({ message: "Validation failed" });
    }

    const userId = req.user?.id ?? req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    
    //  Clone from map
    
    const map = await db.map.findFirst({
      where: { id: parsedData.data.mapId },
      include: { mapElements: true },
    });

    if (!map) {
      return res.status(400).json({ message: "Map not found" });
    }
       // Step 4: Create space + copy all template elements
    // Use transaction so:
    // - Either everything succeeds
    // - Or everything fails (no half-created space)

    const space = await db.$transaction(async (tx) => {
      const space = await tx.space.create({
        data: {
          name: parsedData.data.name,
          width: map.width,
          height: map.height,
          mapId: map.id,  
          //creatorId: userId,
          creator: { connect: { id: userId } }, // ✅
        },
      });

      if (map.mapElements.length > 0) {
        await tx.spaceElements.createMany({
          data: map.mapElements.map((e) => ({
            spaceId: space.id,
            elementId: e.elementId,
            x: e.x,
            y: e.y,
          })),
        });
      }

      return space;
    });

    return res.json({ spaceId: space.id });
  } catch (err) {
    console.error("SPACE CREATE ERROR:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* =========================================================
   DELETE ELEMENT FROM SPACE
   ========================================================= */
router.delete("/element", userMiddleware, async (req, res) => {
  try {
    const parsedData = DeleteElementSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ message: "Validation failed" });
    }

    const spaceElement = await db.spaceElements.findFirst({
      where: { id: parsedData.data.id },
      include: { space: true },
    });
    const userId = req.user?.id ?? req.userId;

    if (!spaceElement || spaceElement.space.creatorId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await db.spaceElements.delete({
      where: { id: parsedData.data.id },
    });

    return res.json({ message: "Element deleted" });
  } catch (err) {
    console.error("DELETE ELEMENT ERROR:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* =========================================================
   DELETE SPACE
   ========================================================= */
router.delete("/:spaceId", userMiddleware, async (req, res) => {
  try {
    const space = await db.space.findUnique({
      where: { id: req.params.spaceId },
      select: { creatorId: true },
    });

    const userId = req.user?.id ?? req.userId;

    if (!space) {
      return res.status(400).json({ message: "Space not found" });
    }

    if (space.creatorId !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await db.space.delete({
      where: { id: req.params.spaceId },
    });

    return res.json({ message: "Space deleted" });
  } catch (err) {
    console.error("DELETE SPACE ERROR:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* =========================================================
   LIST USER SPACES
   ========================================================= */
router.get("/all", userMiddleware, async (req, res) => {
  try {

    const userId = req.user?.id ?? req.userId;
    const spaces = await db.space.findMany({
      where: { creatorId: userId },
    });

    return res.json({
      spaces: spaces.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail,
       
      })),
    });
  } catch (err) {
    console.error("LIST SPACES ERROR:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* =========================================================
   ADD ELEMENT TO SPACE
   ========================================================= */
router.post("/element", userMiddleware, async (req, res) => {
  try {
    const parsedData = AddElementSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ message: "Validation failed" });
    }
    const userId = req.user?.id ?? req.userId;

    const space = await db.space.findFirst({
      where: {
        id: req.body.spaceId,
        creatorId: userId,
      },
      select: {
        width: true,
        height: true,
      },
    });

    if (!space) {
      return res.status(400).json({ message: "Space not found" });
    }

    if (
      req.body.x < 0 ||
      req.body.y < 0 ||
      req.body.x > space.width ||
      req.body.y > space.height
    ) {
      return res
        .status(400)
        .json({ message: "Point is outside of the boundary" });
    }

    await db.spaceElements.create({
      data: {
        spaceId: req.body.spaceId,
        elementId: req.body.elementId,
        x: req.body.x,
        y: req.body.y,
      },
    });

    return res.json({ message: "Element added" });
  } catch (err) {
    console.error("ADD ELEMENT ERROR:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* =========================================================
   GET SPACE DETAILS
   ========================================================= */
router.get("/:spaceId", async (req, res) => {
  try {
    const userId = req.user?.id ?? req.userId;
    const space = await db.space.findUnique({
      where: { id: req.params.spaceId },
      include: {
        elements: {
          include: {
            element: true,
          },
        },
      },
    });

    if (!space) {
      return res.status(400).json({ message: "Space not found" });
    }

    return res.json({
      dimensions: `${space.width}x${space.height}`,
      elements: space.elements.map((e) => ({
        id: e.id,
        element: {
          id: e.element.id,
          imageUrl: e.element.imageUrl,
          width: e.element.width,
          height: e.element.height,
          static: e.element.static,
        },
        x: e.x,
        y: e.y,
      })),
    });
  } catch (err) {
    console.error("GET SPACE ERROR:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});



export default router;
