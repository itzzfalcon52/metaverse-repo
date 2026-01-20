"use client";
import React, { useEffect, useState } from "react";
import useWorldSocket from "@/hooks/use-world-socket";
import useMovement from "@/hooks/use-movement";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SpaceClient({ spaceId, token }) {
  useWorldSocket(spaceId, token);
  const { position } = useMovement();

  const [chatOpen, setChatOpen] = useState(true);
  const [chatLog, setChatLog] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    const ws = window.__ws;
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
  }, [spaceId, token]);

  const sendChat = () => {
    const ws = window.__ws;
    const text = input.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "chat", payload: { message: text } }));
    setInput("");
  };

  return (
    <div className="min-h-screen bg-[#0b0f14] text-white">
      <div className="flex h-screen">
        <main className={cn("flex-1 relative")}>
          <div className="absolute top-3 left-3 z-10 flex gap-2">
            <Button variant="outline" className="border-gray-700 text-gray-300" onClick={() => setChatOpen((o) => !o)}>
              {chatOpen ? "Hide Chat" : "Show Chat"}
            </Button>
          </div>
          <div className="w-full h-full bg-[#151a21]">
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              Map rendering... Position: {position.x},{position.y}
            </div>
          </div>
        </main>

        <aside
          className={cn(
            "w-[340px] bg-[#11161c] border-l border-gray-800 transition-all duration-200 overflow-hidden",
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
              />
              <Button className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold" onClick={sendChat}>
                Send
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}