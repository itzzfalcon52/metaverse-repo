"use client";

import React from "react";
import Link from "next/link";
import Navbar from "@/modules/home/components/Navbar";
import { useMaps } from "@/hooks/use-maps";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminMapsPage() {
  const { data: maps = [], isLoading, isError, error } = useMaps();

  return (
    <div className="min-h-screen bg-[#0b0f14] text-white">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold">
            Your <span className="text-cyan-400">Maps</span>
          </h1>

          <Link href="/admin/create-map">
            <Button className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold">
              + Create New Map
            </Button>
          </Link>
        </div>

        {isLoading && <div className="text-sm text-gray-400">Loading maps...</div>}

        {isError && (
          <div className="text-sm text-red-400">
            Failed to load maps{error?.message ? `: ${error.message}` : ""}
          </div>
        )}

        {!isLoading && !isError && maps.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">No maps found.</div>
            <Link href="/admin/create-map">
              <Button className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold">
                Create Your First Map
              </Button>
            </Link>
          </div>
        )}

        {!isLoading && !isError && maps.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {maps.map((m) => (
              <Card
                key={m.id}
                className="bg-[#151a21] border-gray-800 hover:border-cyan-500/40 transition overflow-hidden"
              >
                {/* Thumbnail section (60% visual height) */}
                <div className="relative aspect-[4/3] bg-[#0b0f14]">
                  {m.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.thumbnail}
                      alt={`${m.name} thumbnail`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                      No thumbnail
                    </div>
                  )}
                </div>

                {/* Details section (40%) */}
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg truncate text-white">{m.name}</CardTitle>
                  <div className="text-xs text-gray-400 truncate">{m.id}</div>
                </CardHeader>

                <CardContent className="pb-3">
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span>
                      {m.width} × {m.height}
                    </span>
                    <span className="text-cyan-400">{m.elementsCount ?? 0} elements</span>
                  </div>
                </CardContent>

                <CardFooter>
                  <Link href={`/admin/maps/${m.id}/edit`} className="w-full">
                    <Button
                      variant="outline"
                      className="w-full border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
                    >
                      Edit
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}