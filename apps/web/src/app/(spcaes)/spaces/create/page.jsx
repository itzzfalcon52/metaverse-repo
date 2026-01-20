"use client";

import React, { useState } from "react";
import Navbar from "@/modules/home/components/Navbar";
import { useMaps } from "@/hooks/use-maps";
import { useCreateSpace } from "@/hooks/use-spaces";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function CreateSpacePage() {
  const router = useRouter();
  const { data: maps = [], isLoading } = useMaps();
  const createSpace = useCreateSpace();
  const [name, setName] = useState("");
  const [mapId, setMapId] = useState("");

  const submit = async () => {
    if (!name.trim()) return toast.error("Name is required");
    if (!mapId) return toast.error("Select a base map");
    try {
      const res = await createSpace.mutateAsync({ name: name.trim(), mapId,thumbnail:maps.find(m=>m.id===mapId)?.thumbnail });
      toast.success("Space created");
      router.push(`/spaces/${res.spaceId}/edit`);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to create space");
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f14] text-white">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <h1 className="text-2xl font-bold">Create Space</h1>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Space name"
          className="w-full px-3 py-2 rounded-md bg-[#151a21] border border-gray-800 outline-none focus:border-cyan-500"
        />

        <div className="text-sm text-gray-300">Select a base map</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {maps.map((m) => {
            const selected = mapId === m.id;
            return (
              <Card
                key={m.id}
                onClick={() => setMapId(m.id)}
                className={`cursor-pointer bg-[#151a21] overflow-hidden transition ${
                  selected ? "border-cyan-500" : "border-gray-800 hover:border-cyan-500/40"
                }`}
              >
                {/* Thumbnail (60%) */}
                <div className="relative aspect-[4/3] bg-[#0b0f14]">
                  {m.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbnail} alt={`${m.name} thumbnail`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                      No thumbnail
                    </div>
                  )}
                  {selected && (
                    <div className="absolute inset-0 ring-2 ring-cyan-500/70 pointer-events-none" />
                  )}
                </div>

                {/* Details (40%) */}
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg truncate text-white">{m.name}</CardTitle>
                  <div className="text-xs text-gray-400 truncate">{m.id}</div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="text-sm text-gray-300">
                    {m.width} × {m.height}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    className={`w-full ${selected ? "border-cyan-500 text-cyan-400" : "border-gray-700 text-gray-300"}`}
                    onClick={() => setMapId(m.id)}
                  >
                    {selected ? "Selected" : "Select"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button
            onClick={submit}
            className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
            disabled={isLoading}
          >
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}