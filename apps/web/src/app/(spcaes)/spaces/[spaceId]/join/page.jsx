"use client";
import React from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import Navbar from "@/modules/home/components/Navbar";

export default function ConfirmJoinPage() {
  const router = useRouter();
  const params = useParams();
  const spaceId = params?.spaceId;

  return (
    <div className="min-h-screen bg-[#0b0f14] text-white">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Join Space</h1>
        <p className="text-gray-300 mb-8">You are about to join this virtual space. Continue?</p>
        <div className="flex gap-4 justify-center">
          <Button variant="outline" className="border-gray-700 text-gray-300" onClick={() => router.push("/spaces")}>
            Cancel
          </Button>
          <Button
            className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
            onClick={() => router.push(`/spaces/${spaceId}`)}
          >
            Join
          </Button>
        </div>
      </div>
    </div>
  );
}