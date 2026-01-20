"use client";

import React from "react";
import Link from "next/link";
import Navbar from "@/modules/home/components/Navbar";
import { useSpaces } from "@/hooks/use-spaces";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SpacesPage() {
  const { data: spaces = [], isLoading, isError } = useSpaces();

  return (
    <div className="min-h-screen bg-[#0b0f14] text-white">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Your Spaces</h1>
          <Link href="/spaces/create">
            <Button className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold">+ Create Space</Button>
          </Link>
        </div>

        {isLoading && <div className="text-sm text-gray-400">Loading spaces...</div>}
        {isError && <div className="text-sm text-red-400">Failed to load spaces</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {spaces.map((s) => (
            <Card key={s.id} className="bg-[#151a21] border-gray-800 overflow-hidden">
              <div className="relative aspect-[4/3] bg-[#0b0f14]">
                {s.thumbnail ? (
                  <img src={s.thumbnail} alt={`${s.name} thumbnail`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">No thumbnail</div>
                )}
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-white truncate">{s.name}</CardTitle>
                <div className="text-xs text-gray-400">{s.dimensions}</div>
              </CardHeader>
              <CardContent />
              <CardFooter>
                <Link href={`/spaces/${s.id}/join`} className="w-full">
                  <Button variant="outline" className="w-full border-cyan-500 text-cyan-400 hover:bg-cyan-500/10">Join</Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}