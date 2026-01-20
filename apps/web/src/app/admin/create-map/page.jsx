"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Navbar from "@/modules/home/components/Navbar";
import { createGame, destroyGame } from "@/modules/mapEditor/game-Logic/CreateGame";
import { useElements,useImportElements } from "@/hooks/use-elements";
import {useMaps,useCreateMap,useUpdateMapElements} from "@/hooks/use-maps";

function validatePlacements({ placements, mapData, tileSize }) {
  const errors = [];

  if (!mapData) {
    return { ok: false, errors: ["Map data missing (data.json not loaded)."] };
  }

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

    // snapped-to-grid check (relative to map offset)
    const relX = p.x - offsetX;
    const relY = p.y - offsetY;
    const snappedX = relX % tileSize === 0;
    const snappedY = relY % tileSize === 0;
    if (!snappedX || !snappedY) {
      errors.push(`Placement #${i + 1}: not snapped to ${tileSize}px grid`);
    }

    // bounds check (uses element width/height if present; defaults to 0)
    const w = Number.isFinite(p?.width) ? p.width : 0;
    const h = Number.isFinite(p?.height) ? p.height : 0;

    const inside =
      p.x >= offsetX &&
      p.y >= offsetY &&
      p.x + w <= offsetX + mapW &&
      p.y + h <= offsetY + mapH;

    if (!inside) {
      errors.push(`Placement #${i + 1}: outside map bounds`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export default function AdminMapEditorPage() {
  const router = useRouter();

  const [placements, setPlacements] = useState([]);
  const [saving, setSaving] = useState(false);
  const [mapName, setMapName] = useState("");

  const importMutation = useImportElements();
  const { data: elements = [], isLoading, isError } = useElements();

  const createMapMutation = useCreateMap();
  const updateMapElementsMutation = useUpdateMapElements();

  const mapKey = "map1";
  const tileSize = 32;

  // Optional: if you want a static thumbnail per base map
  const thumbnail = useMemo(() => `/${mapKey}/thumbnail.png`, [mapKey]);

  useEffect(() => {
    createGame({ mapKey, tileSize, onPlacementsChanged: setPlacements });
    return () => destroyGame();
  }, []);

  useEffect(() => {
    if (isError) toast.error("Failed to load elements");
  }, [isError]);

  const importFromPublic = () => {
    importMutation.mutate(
      { folder: "/elements", static: true },
      {
        onSuccess: (data) => toast.success(`Imported ${data?.count ?? 0} elements`),
        onError: (e) => toast.error(e?.response?.data?.message || "Import failed"),
      }
    );
  };

  const dragStart = (el) => {
    window.dispatchEvent(
      new CustomEvent("editor:dragstart", {
        detail: { elementId: el.id, imageUrl: el.imageUrl, width: el.width, height: el.height },
      })
    );
  };

  const dragEnd = () => window.dispatchEvent(new CustomEvent("editor:dragend"));

  const saveAndContinue = async () => {
    if (!mapName.trim()) return toast.error("Map name is required");
    if (!placements.length) return toast.error("Place at least one element before saving");

    setSaving(true);
    try {
      // 1) Load base map json (your format)
      const res = await fetch(`/${mapKey}/data.json`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load /${mapKey}/data.json`);
      const mapData = await res.json();
      console.log("Loaded mapData:", mapData);

      // 2) Validate placements against map bounds + grid
      const validation = validatePlacements({ placements, mapData, tileSize });
      if (!validation.ok) {
        // show first few errors to avoid spamming toasts
        const sample = validation.errors.slice(0, 3).join(" | ");
        toast.error(`Fix placements: ${sample}${validation.errors.length > 3 ? ` (+${validation.errors.length - 3} more)` : ""}`);
        return;
      }

      // 3) Create map in DB (Map model) using your upload endpoint
      const created = await createMapMutation.mutateAsync({
        name: mapName.trim(),
        width: mapData.width,
        height: mapData.height,
        tilemapJson: mapData, // stores the full JSON into Map.tilemapJson (Json column)
        thumbnail:`/${mapKey}/_composite.png`,
      });

      const mapId = created?.mapId;
      if (!mapId) throw new Error("Create map did not return mapId");

      // 4) Save placements in DB (MapElements) using your endpoint
      await updateMapElementsMutation.mutateAsync({ mapId, placements });

      toast.success("Map saved");
      router.push("/admin/maps");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || importMutation.isPending || createMapMutation.isPending || updateMapElementsMutation.isPending;

  return (
    <div className="min-h-screen bg-[#0b0f14] text-white">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-6">
        <aside className="w-[360px] bg-[#151a21] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">
              Elements <span className="text-cyan-400">Palette</span>
            </h2>

            <button
              onClick={importFromPublic}
              disabled={busy}
              className={`text-xs px-3 py-2 rounded-md border transition ${
                busy
                  ? "border-gray-700 text-gray-400 cursor-not-allowed"
                  : "border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
              }`}
            >
              {importMutation.isPending ? "Importing..." : "Import"}
            </button>
          </div>

          <label className="block text-sm text-gray-300 mb-2">Map Name</label>
          <input
            value={mapName}
            onChange={(e) => setMapName(e.target.value)}
            placeholder="e.g. Level 0"
            className="w-full mb-4 px-3 py-2 rounded-md bg-[#0b0f14] border border-gray-800 outline-none focus:border-cyan-500"
          />

          {isLoading ? (
            <div className="text-sm text-gray-400">Loading elements...</div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {elements.map((el) => (
                <div
                  key={el.id}
                  onMouseDown={() => dragStart(el)}
                  onMouseUp={dragEnd}
                  className="bg-[#0b0f14] border border-gray-800 hover:border-cyan-500/60 rounded-lg p-2 cursor-grab active:cursor-grabbing transition"
                >
                  <img src={el.imageUrl} alt="" className="w-full h-14 object-contain" draggable={false} />
                  <div className="mt-2 text-[10px] text-gray-400 truncate">
                    {el.width}×{el.height}
                  </div>
                </div>
              ))}
            </div>
          )}

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

        <main className="flex-1 bg-[#151a21] border border-gray-800 rounded-xl overflow-hidden flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <div className="font-semibold">
              Map Editor: <span className="text-cyan-400">{mapKey}</span>
            </div>
            <div className="text-xs text-gray-400">Grid {tileSize}px</div>
          </div>

          <div className="p-3 flex-1 min-h-0">
            <div id="game-container" className="w-full h-full rounded-lg border border-gray-800 overflow-hidden" />
          </div>
        </main>
      </div>
    </div>
  );
}