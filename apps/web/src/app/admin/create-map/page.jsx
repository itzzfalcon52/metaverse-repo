// JSX
// filepath: /Users/hussain/Desktop/web dev projects/metaverse-app/metaverse-repo/apps/web/src/app/admin/create-map/page.jsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Navbar from "@/modules/home/components/Navbar";
import { createGame, destroyGame } from "@/modules/mapEditor/game-Logic/CreateGame";
import { useElements, useImportElements } from "@/hooks/use-elements";
import { useCreateMap, useUpdateMapElements } from "@/hooks/use-maps";
import { useRequireAuth } from "@/hooks/use-protected-auth";

/**
 * validatePlacements:
 * - Pure validation utility, unchanged logic.
 * - Confirms mapData exists, checks bounds, grid snapping, and element sizes against the map size and offset.
 */
function validatePlacements({ placements, mapData, tileSize }) {
  const errors = [];
  if (!mapData) return { ok: false, errors: ["Map data missing (data.json not loaded)."] };

  const offsetX = mapData.x ?? 0;
  const offsetY = mapData.y ?? 0;
  const mapW = mapData.width ?? 0;
  const mapH = mapData.height ?? 0;

  if (!Number.isFinite(mapW) || !Number.isFinite(mapH) || mapW <= 0 || mapH <= 0) {
    return { ok: false, errors: ["Invalid map width/height in data.json."] };
  }

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    if (!p?.elementId) errors.push(`Placement #${i + 1}: missing elementId`);
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) errors.push(`Placement #${i + 1}: invalid x/y`);

    const relX = p.x - offsetX;
    const relY = p.y - offsetY;
    const snappedX = relX % tileSize === 0;
    const snappedY = relY % tileSize === 0;
    if (!snappedX || !snappedY) errors.push(`Placement #${i + 1}: not snapped to ${tileSize}px grid`);

    const w = Number.isFinite(p?.width) ? p.width : 0;
    const h = Number.isFinite(p?.height) ? p.height : 0;
    const inside =
      p.x >= offsetX &&
      p.y >= offsetY &&
      p.x + w <= offsetX + mapW &&
      p.y + h <= offsetY + mapH;

    if (!inside) errors.push(`Placement #${i + 1}: outside map bounds`);
  }
  return { ok: errors.length === 0, errors };
}

export default function AdminMapEditorPage() {
  // Auth guard (unchanged)
  useRequireAuth();
  const router = useRouter();

  // Editor state (unchanged)
  const [placements, setPlacements] = useState([]);
  const [saving, setSaving] = useState(false);
  const [mapName, setMapName] = useState("");

  // Data hooks (unchanged)
  const importMutation = useImportElements();
  const { data: elements = [], isLoading, isError, refetch } = useElements();
  const createMapMutation = useCreateMap();
  const updateMapElementsMutation = useUpdateMapElements();

  // Static editor config (unchanged)
  const mapKey = "map1";
  const tileSize = 32;
  const thumbnail = useMemo(() => `/${mapKey}/thumbnail.png`, [mapKey]);

  // Boot Phaser editor (unchanged)
  useEffect(() => {
    createGame({ mapKey, tileSize, onPlacementsChanged: setPlacements });
    return () => destroyGame();
  }, []);

  // Elements load error toast (unchanged)
  useEffect(() => {
    if (isError) toast.error("Failed to load elements");
  }, [isError]);

  /**
   * Sidebar category toggle:
   * - livingRoom | Library
   * - Filters elements based on folder path inside public/elements.
   * - We also import per selected folder: /elements/livingRoom or /elements/Library.
   */
  const [category, setCategory] = useState("livingRoom");
  const deriveFolder = (el) => {
    if (el.folder) return el.folder; // prefer explicit folder field if present
    const url = el.imageUrl || "";
    if (url.includes("/elements/livingRoom/")) return "livingRoom";
    if (url.includes("/elements/Library/")) return "Library";
    return "unknown";
  };
  const filtered = elements.filter((el) => deriveFolder(el) === category);

  // Drag handlers for palette items (fix: define these)
  const dragStart = (el) => {
    window.dispatchEvent(
      new CustomEvent("editor:dragstart", {
        detail: {
          elementId: el.id,
          imageUrl: el.imageUrl,
          width: el.width,
          height: el.height,
        },
      })
    );
  };
  const dragEnd = () => {
    window.dispatchEvent(new CustomEvent("editor:dragend"));
  };

  // Import only the selected folder; refetch list after success; guard multiple clicks
  const importSelectedFolder = () => {
    if (importMutation.isPending) return;
    const folder = `/elements/${category}`;
    importMutation.mutate(
      { folder, static: true },
      {
        onSuccess: async (data) => {
          toast.success(`Imported ${data?.count ?? 0} ${category} elements`);
          // Refresh items so the sidebar reflects new imports
          try {
            await refetch();
          } catch {}
        },
        onError: (e) => toast.error(e?.response?.data?.message || "Import failed"),
      }
    );
  };

  // Save flow (unchanged)
  const saveAndContinue = async () => {
    if (!mapName.trim()) return toast.error("Map name is required");
    if (!placements.length) return toast.error("Place at least one element before saving");

    setSaving(true);
    try {
      const res = await fetch(`/${mapKey}/data.json`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load /${mapKey}/data.json`);
      const mapData = await res.json();

      const validation = validatePlacements({ placements, mapData, tileSize });
      if (!validation.ok) {
        const sample = validation.errors.slice(0, 3).join(" | ");
        toast.error(
          `Fix placements: ${sample}${validation.errors.length > 3 ? ` (+${validation.errors.length - 3} more)` : ""}`
        );
        return;
      }

      const created = await createMapMutation.mutateAsync({
        name: mapName.trim(),
        width: mapData.width,
        height: mapData.height,
        tilemapJson: mapData,
        thumbnail: `/${mapKey}/_composite.png`,
      });

      const mapId = created?.mapId;
      if (!mapId) throw new Error("Create map did not return mapId");

      await updateMapElementsMutation.mutateAsync({ mapId, placements });

      toast.success("Map saved");
      router.push("/admin/maps");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const busy =
    saving ||
    importMutation.isPending ||
    createMapMutation.isPending ||
    updateMapElementsMutation.isPending;

  return (
    // Root covers viewport; editor row fills remaining height to give Phaser full space
    <div className="min-h-screen bg-[#0b0f14] text-white">
      <Navbar />

      {/* Full-width container; editor row height = viewport minus navbar height */}
      <div className="w-full px-6 py-6">
        {/* Fill remaining viewport height (adjust 64px if your Navbar height differs) */}
        <div className="flex gap-6 h-[calc(100vh-64px-48px)]">
          {/* Sidebar: fixed width, scrollable, with category tabs */}
          <aside className="w-[360px] bg-[#151a21] border border-gray-800 rounded-xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                Elements <span className="text-cyan-400">Palette</span>
              </h2>
              <button
                onClick={importSelectedFolder}
                disabled={busy}
                className={`text-xs px-3 py-2 rounded-md border transition ${
                  busy
                    ? "border-gray-700 text-gray-400 cursor-not-allowed"
                    : "border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
                }`}
                title={`Import from /public/elements/${category}`}
              >
                {importMutation.isPending ? "Importing..." : `Import ${category}`}
              </button>
            </div>

            {/* Category toggle tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setCategory("livingRoom")}
                className={`px-3 py-2 rounded-md text-xs border transition ${
                  category === "livingRoom"
                    ? "border-cyan-500 text-cyan-400 bg-cyan-500/10"
                    : "border-gray-700 text-gray-400 hover:border-gray-500"
                }`}
              >
                Living Room
              </button>
              <button
                onClick={() => setCategory("Library")}
                className={`px-3 py-2 rounded-md text-xs border transition ${
                  category === "Library"
                    ? "border-cyan-500 text-cyan-400 bg-cyan-500/10"
                    : "border-gray-700 text-gray-400 hover:border-gray-500"
                }`}
              >
                Library
              </button>
            </div>

            {/* Map name input (unchanged) */}
            <label className="block text-sm text-gray-300 mb-2">Map Name</label>
            <input
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              placeholder="e.g. Level 0"
              className="w-full mb-4 px-3 py-2 rounded-md bg-[#0b0f14] border border-gray-800 outline-none focus:border-cyan-500"
            />

            {/* Elements list filtered by selected folder */}
            {isLoading ? (
              <div className="text-sm text-gray-400">Loading elements...</div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {filtered.map((el) => (
                  <div
                    key={el.id}
                    onMouseDown={() => dragStart(el)}
                    onMouseUp={dragEnd}
                    onMouseLeave={dragEnd}
                    className="bg-[#0b0f14] border border-gray-800 hover:border-cyan-500/60 rounded-lg p-2 cursor-grab active:cursor-grabbing transition"
                  >
                    <img
                      src={el.imageUrl}
                      alt=""
                      className="w-full h-14 object-contain"
                      draggable={false}
                    />
                    <div className="mt-2 text-[10px] text-gray-400 truncate">
                      {el.width}×{el.height}
                    </div>
                  </div>
                ))}
                {!isLoading && filtered.length === 0 && (
                  <div className="col-span-3 text-xs text-gray-500">
                    No elements in “{category}”. Click “Import {category}” to load from /public/elements/{category}.
                  </div>
                )}
              </div>
            )}

            {/* Save button (unchanged) */}
            <button
              onClick={saveAndContinue}
              disabled={busy}
              className={`mt-6 w-full py-3 rounded-lg font-semibold transition ${
                busy ? "bg-gray-700 cursor-not-allowed" : "bg-cyan-500 hover:bg-cyan-600"
              }`}
            >
              {busy ? "Saving..." : `Save & Continue (${placements.length})`}
            </button>
          </aside>

          {/* Editor: fills remaining width and full available height */}
          <main className="flex-1 bg-[#151a21] border border-gray-800 rounded-xl overflow-hidden flex flex-col h-full">
            {/* Header (unchanged) */}
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div className="font-semibold">
                Map Editor: <span className="text-cyan-400">{mapKey}</span>
              </div>
              <div className="text-xs text-gray-400">Grid {tileSize}px</div>
            </div>

            {/* Canvas area: fills remaining height; Phaser reads container size */}
            <div className="p-3 flex-1 min-h-0">
              <div
                id="game-container"
                className="w-full h-full rounded-lg border border-gray-800 overflow-hidden"
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}