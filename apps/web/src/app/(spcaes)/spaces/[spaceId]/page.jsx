"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import useWorldSocket from "@/hooks/use-world-socket";
import useMovement from "@/hooks/use-movement";
import PhaserWorld from "@/modules/world/components/PhaserWorld";
import axios from "axios";

export default function SpaceView() {
  const params = useParams();
  const spaceId = params?.spaceId;
  const [token, setToken] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("jwt");
    console.log("🔐 Loaded token from localStorage:", t);
    if (t) setToken(t);
}, []);


  
    
     
      

  // ---------- Connect world socket ----------
  useWorldSocket(spaceId,token);

  // ---------- Movement hook ----------
  useMovement();

  // ---------- UI State ----------
  const [chatOpen, setChatOpen] = useState(true);
  const [chatLog, setChatLog] = useState([]);
  const [input, setInput] = useState("");
  const [world, setWorld] = useState(null);
  const [loadingWorld, setLoadingWorld] = useState(true);

  // ---------- Fetch world (map + elements) ----------
  useEffect(() => {
    if (!spaceId) return;

    setLoadingWorld(true);

    axios
      .get(`http://localhost:3000/api/v1/space/${spaceId}/world`, {
        withCredentials: true,
      })
      .then((res) => {
        setWorld(res.data);
        setLoadingWorld(false);
      })
      .catch((err) => {
        console.error("Failed to load world:", err);
        setLoadingWorld(false);
      });
  }, [spaceId,token]);

  // ---------- Chat WS listener ----------
  useEffect(() => {
    const ws = typeof window !== "undefined" ? window.__ws : null;
    if (!ws) return;

    const onMessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "chat") {
          const { userId, message, ts } = msg.payload || {};
          setChatLog((prev) => [...prev, { userId, message, ts }]);
        }
      } catch {}
    };

    ws.addEventListener("message", onMessage);
    return () => ws.removeEventListener("message", onMessage);
  }, [spaceId,token]);

  // ---------- Send chat ----------
  const sendChat = () => {
    const ws = window?.__ws;
    const text = input.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({ type: "chat", payload: { message: text } }));
    setInput("");
  };

  // ---------- Render ----------
  return (
    <div className="fixed inset-0 bg-[#0b0f14] text-white overflow-hidden">
      <div className="flex h-full w-full">
        {/* ================== WORLD ================== */}
        <main className="flex-1 relative">
          {/* Top UI */}
          <div className="absolute top-3 left-3 z-20 flex gap-2">
            <Button
              variant="outline"
              className="border-gray-700 text-gray-300"
              onClick={() => setChatOpen((o) => !o)}
            >
              {chatOpen ? "Hide Chat" : "Show Chat"}
            </Button>
          </div>

          {/* World Renderer */}
          <div className="absolute inset-0">
            {loadingWorld && (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                Loading world...
              </div>
            )}

            {!loadingWorld && world && <PhaserWorld map={world} />}

            {!loadingWorld && !world && (
              <div className="w-full h-full flex items-center justify-center text-red-400">
                Failed to load world
              </div>
            )}
          </div>
        </main>

        {/* ================== CHAT ================== */}
        <aside
          className={cn(
            "w-[340px] bg-[#11161c] border-l border-gray-800 transition-transform duration-200 overflow-hidden z-30",
            chatOpen ? "translate-x-0" : "translate-x-[340px]"
          )}
        >
          <div className="h-full flex flex-col">
            <div className="px-4 py-3 border-b border-gray-800">
              <h2 className="text-lg font-semibold">Chat</h2>
            </div>

            <div className="flex-1 px-4 py-3 space-y-3 overflow-y-auto">
              {chatLog.map((c, i) => (
                <div key={i} className="text-sm">
                  <span className="text-cyan-400 mr-2">{c.userId}</span>
                  <span className="text-gray-300">{c.message}</span>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-gray-800 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 rounded-md bg-[#151a21] border border-gray-800 outline-none focus:border-cyan-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendChat();
                }}
              />
              <Button
                className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
                onClick={sendChat}
              >
                Send
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
