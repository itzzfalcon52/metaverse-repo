// JSX
// filepath: /Users/hussain/Desktop/web dev projects/metaverse-app/metaverse-repo/apps/web/src/app/(spcaes)/spaces/[spaceId]/page.jsx
"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import useWorldSocket from "@/hooks/use-world-socket";
import useMovement from "@/hooks/use-movement";
import PhaserWorld from "@/modules/world/components/PhaserWorld";
import axios from "axios";
import { useRequireAuth } from "@/hooks/use-protected-auth";

/**
 * SpaceView renders a specific space by dynamic spaceId.
 * Existing logic is preserved. This update ensures the sender also sees their own chat messages.
 * Implementation uses optimistic UI: append the message locally on send, then reconcile when the server echo arrives.
 */
export default function SpaceView() {
  // Require authentication before entering the space
  useRequireAuth();

  // Read the dynamic route parameter /spaces/[spaceId]
  const params = useParams();
  const spaceId = params?.spaceId;

  // Store JWT from localStorage for WS auth
  const [token, setToken] = useState("");

  useEffect(() => {
    // Load token from localStorage (used for WS join)
    const t = localStorage.getItem("jwt");
    if (t) setToken(t);
  }, []);

  // Connect world socket and join the space (hook encapsulates socket lifecycle)
  useWorldSocket(spaceId, token);

  // Movement hook: handles keyboard input and sends movement events
  useMovement();

  // UI state for chat drawer visibility
  const [chatOpen, setChatOpen] = useState(false);
  // Local chat log; entries are { userId, message, ts, optimistic?, nonce? }
  const [chatLog, setChatLog] = useState([]);
  // Chat input state
  const [input, setInput] = useState("");
  // World data (map and elements) fetched via HTTP
  const [world, setWorld] = useState(null);
  // Loading state for world fetch
  const [loadingWorld, setLoadingWorld] = useState(true);

  // Fetch world data from HTTP backend
  useEffect(() => {
    if (!spaceId) return;

    setLoadingWorld(true);

    axios
      .get(`${process.env.NEXT_PUBLIC_HHTP_URL}/api/v1/space/${spaceId}/world`, {
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
  }, [spaceId, token]);

  /**
   * Chat WebSocket listener
   * - Listens for "chat" messages from the server and appends them to chatLog.
   * - Reconciles optimistic entries: if there is a matching optimistic message, replace it with the server echo to avoid duplicates.
   *   Matching heuristic: same message text and close timestamp proximity; optionally a nonce can be used if included in payload.
   */
  useEffect(() => {
    const ws = typeof window !== "undefined" ? window.__ws : null;
    if (!ws) return;

    const onMessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "chat") {
          const { userId, message, ts, nonce } = msg.payload || {};

          setChatLog((prev) => {
            // If server provided a nonce, reconcile using it
            if (nonce) {
              const idx = prev.findIndex((c) => c.optimistic && c.nonce === nonce);
              if (idx !== -1) {
                const next = prev.slice();
                next[idx] = { userId, message, ts };
                return next;
              }
            }

            // Without nonce, attempt a simple reconciliation: match on message text and optimistic flag
            const idx = prev.findIndex((c) => c.optimistic && c.message === message);
            if (idx !== -1) {
              const next = prev.slice();
              next[idx] = { userId, message, ts };
              return next;
            }

            // No optimistic match found; append as new server message
            return [...prev, { userId, message, ts }];
          });
        }
      } catch {
        // Swallow parse errors; non-chat messages may arrive
      }
    };

    ws.addEventListener("message", onMessage);
    return () => ws.removeEventListener("message", onMessage);
  }, [spaceId, token]);

  /**
   * Send chat
   * - Sends a chat message over WebSocket if open and input is non-empty.
   * - Immediately appends an optimistic entry to chatLog so the sender sees the message.
   * - Includes a client-generated nonce to allow the server echo to replace the optimistic entry.
   *   If the server does not echo nonce back, the listener falls back to a simple text match.
   */
  const sendChat = () => {
    const ws = window?.__ws;
    const text = input.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;

    // Create a nonce to pair optimistic entry with server echo
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Send to server; if backend supports nonce, include it in payload
    ws.send(JSON.stringify({ type: "chat", payload: { message: text, nonce } }));

    // Optimistically append so the sender sees it instantly
    // userId can be shown as "me" or the real user id if available in a global or store
    setChatLog((prev) => [
      ...prev,
      { userId: "me", message: text, ts: Date.now(), optimistic: true, nonce },
    ]);

    // Clear input box
    setInput("");
  };

  /**
   * Leave Space
   * - Notifies server with a "leave" message, closes the socket, clears globals, and redirects to home.
   * - Keeps existing logic intact, and ensures other users are notified by server via "user-left".
   */
  const leaveSpace = () => {
    try {
      const ws = typeof window !== "undefined" ? window.__ws : null;

      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        // Inform server of leaving so it can broadcast "user-left" to others
        try {
          ws.send(JSON.stringify({ type: "leave" }));
        } catch {}

        // Close the socket with normal closure
        ws.close(1000, "Client leaving space");
      }

      // Prevent further movement locally
      window.__canMove = false;
      // Clear global socket reference
      window.__ws = null;
    } catch (e) {
      console.warn("leaveSpace: error while closing socket:", e);
    } finally {
      // Hard redirect to home
      window.location.assign("/");
    }
  };

  // Render full-page layout with world canvas and a sliding chat pane
  return (
    <div className="fixed inset-0 bg-[#0b0f14] text-white overflow-hidden">
      {/* World root */}
      <main className="absolute inset-0">
        {/* Top-left controls overlay */}
        <div className="absolute top-3 left-3 z-30 flex gap-2">
          {/* Toggle Chat drawer */}
          <Button
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-[#0f141b] hover:text-white transition-colors"
            onClick={() => setChatOpen((o) => !o)}
          >
            {chatOpen ? "Hide Chat" : "Show Chat"}
          </Button>

          {/* Share current space URL */}
          <ShareButton spaceId={spaceId} />

          {/* Leave Space: closes socket and navigates to home */}
          <Button
            variant="outline"
            className="border-red-600/50 text-red-300 bg-[#0f141b] hover:bg-red-900/20 hover:text-red-200 transition-colors"
            onClick={leaveSpace}
            title="Leave this space"
          >
            <span className="mr-2">{"\u{1F6AA}"}</span>
            Leave Space
          </Button>
        </div>

        {/* Top-right space id overlay */}
        <div className="absolute top-3 right-3 z-30">
          <div className="px-3 py-2 rounded-md bg-[#0f141b] border border-gray-800 text-gray-300 text-sm shadow">
            Space ID: <span className="text-cyan-400">{spaceId}</span>
          </div>
        </div>

        {/* Phaser world fills entire screen */}
        <div className="absolute inset-0">
          {loadingWorld && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                <div className="text-gray-400">Loading world...</div>
              </div>
            </div>
          )}
          {!loadingWorld && world && <PhaserWorld map={world} />}
          {!loadingWorld && !world && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="px-4 py-2 rounded-md bg-[#1a2029] border border-red-600/40 text-red-300">
                Failed to load world
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Chat overlay drawer */}
      <aside
        className={cn(
          "absolute top-0 right-0 h-full w-[360px] bg-[#11161c] border-l border-gray-800 transition-transform duration-200 overflow-hidden z-40 shadow-xl",
          chatOpen ? "translate-x-0" : "translate-x-[360px]"
        )}
      >
        <div className="h-full flex flex-col">
          {/* Drawer header */}
          <div className="px-4 py-3 border-b border-gray-800 bg-[#0f141b]/60 backdrop-blur-sm">
            <h2 className="text-lg font-semibold tracking-wide">Chat</h2>
            <p className="text-xs text-gray-500">Talk with others in this space</p>
          </div>

          {/* Messages list */}
          <div className="flex-1 px-4 py-3 space-y-3 overflow-y-auto">
            {chatLog.length === 0 && (
              <div className="text-xs text-gray-500">No messages yet. Start the conversation.</div>
            )}
            {chatLog.map((c, i) => (
              <div
                key={i}
                className={cn(
                  "text-sm px-3 py-2 rounded-md border",
                  c.optimistic
                    ? "bg-[#0f141b] border-yellow-600/40 text-yellow-200"
                    : "bg-[#0f141b] border-gray-800/60 text-gray-300"
                )}
                title={c.optimistic ? "Pending delivery" : undefined}
              >
                <span className="text-cyan-400 mr-2 font-mono">{c.userId}</span>
                <span className="break-words">{c.message}</span>
              </div>
            ))}
          </div>

          {/* Composer */}
          <div className="p-3 border-t border-gray-800 bg-[#0f141b]/60 backdrop-blur-sm flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 rounded-md bg-[#151a21] border border-gray-800 outline-none focus:border-cyan-500 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") sendChat();
              }}
            />
            <Button className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold" onClick={sendChat}>
              Send
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

/**
 * ShareButton
 * - Extracted small component for clarity.
 * - Copies the direct URL to the space into clipboard and shows a simple state change.
 */
function ShareButton({ spaceId }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/spaces/${spaceId}` : "";

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.warn("Failed to copy invite URL:", e);
    }
  };

  return (
    <Button
      variant="outline"
      className={cn(
        "border-gray-700 transition-colors",
        copied
          ? "bg-green-600/20 text-green-300 hover:bg-green-600/30"
          : "bg-[#0f141b] text-gray-300 hover:bg-[#121821] hover:text-white"
      )}
      onClick={copyInvite}
      title={inviteUrl}
    >
      <span className="mr-2">Link</span>
      {copied ? "Copied" : "Share"}
    </Button>
  );
}