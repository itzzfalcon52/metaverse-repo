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
// WebRTC hook: manages proximity detection (via WS), RTCPeerConnection lifecycle, and media streams
import useWebRTC from "@/hooks/use-webrtc";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageSquare,
  Link2,
  LogOut,
  Phone,
  PhoneOff,
} from "lucide-react";

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
  // UI state for video call drawer visibility (NEW)
  const [videoOpen, setVideoOpen] = useState(false);
  // Local chat log; entries are { userId, message, ts, optimistic?, nonce? }
  const [chatLog, setChatLog] = useState([]);
  // Chat input state
  const [input, setInput] = useState("");
  // World data (map and elements) fetched via HTTP
  const [world, setWorld] = useState(null);
  // Loading state for world fetch
  const [loadingWorld, setLoadingWorld] = useState(true);

  // NEW: handshake state
  // - Top-left "Call" initializes an intent to call the nearby user.
  // - Both users must press "Start Call" (sidebar) to actually start the WebRTC connection.
  const [callInit, setCallInit] = useState(false);
  const [callPeerUserId, setCallPeerUserId] = useState(null);

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

        // NEW: call-intent handshake messages
        // - "call-init": other user clicked top-left Call. This user must also click Start Call in sidebar.
        // - "call-cancel": other user canceled the init.
        if (msg.type === "call-init") {
          const { fromUserId } = msg.payload || {};
          if (fromUserId) {
            setCallInit(true);
            setCallPeerUserId(fromUserId);
            // Auto-open video panel so user sees Start Call
            setVideoOpen(true);
          }
        }
        if (msg.type === "call-cancel") {
          const { fromUserId } = msg.payload || {};
          if (fromUserId && fromUserId === callPeerUserId) {
            setCallInit(false);
            setCallPeerUserId(null);
          }
        }

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
  }, [spaceId, token, callPeerUserId]);

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

  // ===========================
  // WebRTC integration (NEW)
  // ===========================
  // useWebRTC:
  // - Subscribes to WS "proximity" events to know when a nearby peer is within threshold.
  // - Manages RTCPeerConnection, offer/answer exchange, and ICE relay via WS ("rtc-offer", "rtc-answer", "rtc-ice").
  // - Exposes local and remote MediaStreams for UI <video> elements.
  // - startCall/endCall helpers to initiate and tear down the call.
  // - NEW: exposes micEnabled/camEnabled flags and toggle handlers for local media control.
  const {
    nearUserId,
    localStream,
    remoteStream,
    callActive,
    startCall,
    endCall,
    micEnabled,
    camEnabled,
    toggleMic,
    toggleCam,
  } = useWebRTC(spaceId, token);

  // NEW: clear call init state if peer goes away or call ends
  useEffect(() => {
    if (!nearUserId) {
      setCallInit(false);
      setCallPeerUserId(null);
      return;
    }
    if (callPeerUserId && nearUserId !== callPeerUserId) {
      setCallInit(false);
      setCallPeerUserId(null);
    }
  }, [nearUserId, callPeerUserId]);

  useEffect(() => {
    if (!callActive) return;
    // Once connected, clear init so UI doesn't keep showing "Start Call" gating.
    setCallInit(false);
    setCallPeerUserId(null);
  }, [callActive]);

  // NEW: Top-left "Call" (init) handler
  const initCall = () => {
    const ws = typeof window !== "undefined" ? window.__ws : null;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!nearUserId) return;

    setCallInit(true);
    setCallPeerUserId(nearUserId);
    setVideoOpen(true);

    // Notify the peer that we want to call; this does NOT start WebRTC.
    ws.send(JSON.stringify({ type: "call-init", payload: { toUserId: nearUserId } }));
  };

  // NEW: allow canceling the init (optional UX)
  const cancelInitCall = () => {
    const ws = typeof window !== "undefined" ? window.__ws : null;
    if (ws && ws.readyState === WebSocket.OPEN && callPeerUserId) {
      ws.send(JSON.stringify({ type: "call-cancel", payload: { toUserId: callPeerUserId } }));
    }
    setCallInit(false);
    setCallPeerUserId(null);
  };

  // NEW: Sidebar Start Call gating:
  // Only allow starting WebRTC if:
  // - callInit is true, and
  // - the peer we initialized with is still the nearby user
  const canStartSidebarCall = !!nearUserId && !!callInit && nearUserId === callPeerUserId && !callActive;

  // Render full-page layout with world canvas and a sliding chat pane
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#0a0e13] via-[#0b0f14] to-[#0d1117] text-white overflow-hidden">
      {/* World root */}
      <main className="absolute inset-0">
        {/* Top-left controls overlay */}
        <div className="absolute top-4 left-4 z-30 flex gap-3">
          {/* Toggle Chat drawer */}
          <Button
            variant="outline"
            className="border-gray-700/60 bg-[#0f141b]/90 backdrop-blur-sm text-gray-200 hover:bg-[#151b24] hover:text-white hover:border-cyan-500/50 transition-all duration-200 shadow-lg"
            onClick={() => setChatOpen((o) => !o)}
          >
            <MessageSquare size={16} className="mr-2" />
            {chatOpen ? "Hide Chat" : "Show Chat"}
          </Button>

          {/* Toggle Video Call drawer (NEW) */}
          <Button
            variant="outline"
            className="border-gray-700/60 bg-[#0f141b]/90 backdrop-blur-sm text-gray-200 hover:bg-[#151b24] hover:text-white hover:border-cyan-500/50 transition-all duration-200 shadow-lg"
            onClick={() => setVideoOpen((o) => !o)}
          >
            <Video size={16} className="mr-2" />
            {videoOpen ? "Hide Video" : "Show Video"}
          </Button>

          {/* NEW: Top-left Call init button (only shows when user is nearby and not in a call) */}
          {nearUserId && !callActive && !callInit && (
            <Button
              className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-black font-semibold shadow-lg shadow-cyan-500/30 transition-all duration-200"
              onClick={initCall}
              title="Initialize a call with the nearby user (both must press Start Call)"
            >
              <Phone size={16} className="mr-2" />
              Call
            </Button>
          )}

          {/* NEW: Optional cancel init button if already initialized */}
          {callInit && !callActive && (
            <Button
              variant="outline"
              className="border-red-600/50 text-red-300 bg-[#0f141b]/90 hover:bg-red-900/30 hover:border-red-500/70 transition-all duration-200 shadow-lg"
              onClick={cancelInitCall}
              title="Cancel call initialization"
            >
              <PhoneOff size={16} className="mr-2" />
              Cancel Call
            </Button>
          )}

          {/* Share current space URL */}
          <ShareButton spaceId={spaceId} />

          {/* Leave Space: closes socket and navigates to home */}
          <Button
            variant="outline"
            className="border-red-600/50 text-red-300 bg-[#0f141b]/90 backdrop-blur-sm hover:bg-red-900/30 hover:text-red-200 hover:border-red-500/70 transition-all duration-200 shadow-lg"
            onClick={leaveSpace}
            title="Leave this space"
          >
            <LogOut size={16} className="mr-2" />
            Leave Space
          </Button>

          {/* WebRTC: show Call/End buttons based on proximity and call state */}
          {/* When nearUserId is set (from WS "proximity"), allow initiating a call.
              Buttons are lightweight controls; detailed video UI is on the right panel. */}
        </div>

        {/* Top-right space id overlay */}
        <div className="absolute top-4 right-4 z-30">
          <div className="px-4 py-2.5 rounded-lg bg-[#0f141b]/90 backdrop-blur-sm border border-gray-700/60 text-gray-200 text-sm shadow-lg">
            <span className="text-gray-400 text-xs uppercase tracking-wider mr-2">Space ID:</span>
            <span className="text-cyan-400 font-mono font-semibold">{spaceId}</span>
          </div>
        </div>

        {/* Phaser world fills entire screen */}
        <div className="absolute inset-0">
          {loadingWorld && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="h-10 w-10 rounded-full border-3 border-cyan-400 border-t-transparent animate-spin shadow-lg shadow-cyan-400/30" />
                <div className="text-gray-300 text-base font-medium">Loading world...</div>
              </div>
            </div>
          )}
          {!loadingWorld && world && <PhaserWorld map={world} />}
          {!loadingWorld && !world && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="px-6 py-3 rounded-lg bg-[#1a2029]/90 backdrop-blur-sm border border-red-600/50 text-red-300 shadow-lg">
                Failed to load world
              </div>
            </div>
          )}
        </div>

        {/* Right-side Video Call panel (toggleable, NEW)
            - Fixed panel that sits above the world canvas.
            - Binds <video> elements to localStream and remoteStream provided by useWebRTC.
            - Shows status based on proximity and call activity.
            - NEW: adds mic/camera toggle buttons beneath local video.
            - NEW: slides in/out based on videoOpen state */}
        <aside
          className={cn(
            "absolute top-0 right-0 h-full w-[420px] bg-[#0a0e13]/95 backdrop-blur-md border-l border-gray-700/50 transition-transform duration-300 ease-in-out overflow-hidden z-40 shadow-2xl flex flex-col",
            videoOpen ? "translate-x-0" : "translate-x-[420px]"
          )}
        >
          <div className="px-5 py-4 border-b border-gray-700/50 bg-gradient-to-r from-[#0f141b] to-[#12171f]">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight">Video Call</h2>
              <span
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full font-medium",
                  callActive
                    ? "bg-green-500/20 text-green-300 border border-green-500/30"
                    : nearUserId
                    ? callInit
                      ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                      : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "bg-gray-700/20 text-gray-400 border border-gray-700/30"
                )}
              >
                {callActive
                  ? "● Connected"
                  : nearUserId
                  ? callInit
                    ? "● Ready (press Start Call)"
                    : "● Nearby user"
                  : "No nearby user"}
              </span>
            </div>
          </div>

          <div className="flex-1 p-4 grid grid-cols-1 gap-4">
            {/* Local video: muted to avoid audio feedback; bound dynamically to localStream */}
            <div className="relative group">
              <video
                autoPlay
                muted
                playsInline
                className="w-full h-[38%] bg-black/90 rounded-xl border border-gray-700/50 object-cover shadow-xl transition-all duration-200 group-hover:border-cyan-500/50"
                ref={(el) => {
                  // Attach the MediaStream only when available to avoid null assignment
                  if (el) el.srcObject = localStream || null;
                }}
              />
              {!localStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                  <span className="text-gray-400 text-sm">No local video</span>
                </div>
              )}
              {/* NEW: Local media controls (mic/cam) */}
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex-1 border-gray-700/60 backdrop-blur-sm transition-all duration-200 shadow-md",
                    micEnabled
                      ? "bg-[#0f141b]/90 text-gray-200 hover:bg-cyan-500/20 hover:border-cyan-500/50 hover:text-cyan-300"
                      : "bg-red-900/30 text-red-300 border-red-600/50 hover:bg-red-900/50"
                  )}
                  onClick={toggleMic}
                  title={micEnabled ? "Mute microphone" : "Unmute microphone"}
                  disabled={!callActive}
                >
                  {micEnabled ? <Mic size={16} className="mr-1.5" /> : <MicOff size={16} className="mr-1.5" />}
                  <span className="text-xs">{micEnabled ? "Mic On" : "Mic Off"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex-1 border-gray-700/60 backdrop-blur-sm transition-all duration-200 shadow-md",
                    camEnabled
                      ? "bg-[#0f141b]/90 text-gray-200 hover:bg-cyan-500/20 hover:border-cyan-500/50 hover:text-cyan-300"
                      : "bg-red-900/30 text-red-300 border-red-600/50 hover:bg-red-900/50"
                  )}
                  onClick={toggleCam}
                  title={camEnabled ? "Turn off camera" : "Turn on camera"}
                  disabled={!callActive}
                >
                  {camEnabled ? <Video size={16} className="mr-1.5" /> : <VideoOff size={16} className="mr-1.5" />}
                  <span className="text-xs">{camEnabled ? "Cam On" : "Cam Off"}</span>
                </Button>
              </div>
            </div>

            {/* Remote video: renders the incoming peer stream */}
            <div className="relative group">
              <video
                autoPlay
                playsInline
                className="w-full h-[58%] bg-black/90 rounded-xl border border-gray-700/50 object-cover shadow-xl transition-all duration-200 group-hover:border-cyan-500/50"
                ref={(el) => {
                  if (el) el.srcObject = remoteStream || null;
                }}
              />
              {(!remoteStream || remoteStream.getTracks().length === 0) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                  <span className="text-gray-400 text-sm">Waiting for peer...</span>
                </div>
              )}
              {/* NEW: Remote controls placeholder (non-interactive, indicates peer status if later exposed) */}
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-gray-700/40 bg-[#0f141b]/60 text-gray-500 cursor-not-allowed opacity-60"
                  disabled
                >
                  <Mic size={16} className="mr-1.5" />
                  <span className="text-xs">Peer Mic</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-gray-700/40 bg-[#0f141b]/60 text-gray-500 cursor-not-allowed opacity-60"
                  disabled
                >
                  <Video size={16} className="mr-1.5" />
                  <span className="text-xs">Peer Cam</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-700/50 bg-gradient-to-r from-[#0f141b] to-[#12171f] flex gap-3">
            {/* Sidebar Start Call must be clicked by BOTH users:
                - It's enabled only after top-left Call was initialized (either by you or peer via WS "call-init").
                - It starts the actual WebRTC offer/answer exchange via startCall(). */}
            <Button
              className="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-black font-semibold shadow-lg shadow-cyan-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={startCall}
              disabled={!canStartSidebarCall}
              title={
                canStartSidebarCall
                  ? "Start the call (both users must press Start Call)"
                  : nearUserId
                  ? "Click Call (top-left) to initialize, then both users press Start Call"
                  : "No nearby user"
              }
            >
              <Phone size={16} className="mr-2" />
              Start Call
            </Button>

            {/* End Call button lives only in sidebar as requested */}
            <Button
              variant="outline"
              className="flex-1 border-red-600/50 text-red-300 bg-[#0f141b]/90 hover:bg-red-900/30 hover:border-red-500/70 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              onClick={endCall}
              disabled={!callActive}
              title="End the current call"
            >
              <PhoneOff size={16} className="mr-2" />
              End
            </Button>
          </div>
        </aside>
      </main>

      {/* Chat overlay drawer */}
      <aside
        className={cn(
          "absolute top-0 right-0 h-full w-[360px] bg-[#0a0e13]/95 backdrop-blur-md border-l border-gray-700/50 transition-transform duration-300 ease-in-out overflow-hidden z-40 shadow-2xl",
          chatOpen ? "translate-x-0" : "translate-x-[360px]"
        )}
      >
        <div className="h-full flex flex-col">
          {/* Drawer header */}
          <div className="px-5 py-4 border-b border-gray-700/50 bg-gradient-to-r from-[#0f141b] to-[#12171f]">
            <h2 className="text-lg font-bold tracking-tight">Chat</h2>
            <p className="text-xs text-gray-400 mt-0.5">Talk with others in this space</p>
          </div>

          {/* Messages list */}
          <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto custom-scrollbar">
            {chatLog.length === 0 && (
              <div className="text-xs text-gray-500 text-center py-8">
                No messages yet. Start the conversation.
              </div>
            )}
            {chatLog.map((c, i) => (
              <div
                key={i}
                className={cn(
                  "text-sm px-4 py-2.5 rounded-lg border transition-all duration-150 hover:scale-[1.02]",
                  c.optimistic
                    ? "bg-yellow-500/10 border-yellow-600/40 text-yellow-200 shadow-sm"
                    : "bg-[#0f141b]/80 border-gray-700/50 text-gray-200 shadow-md"
                )}
                title={c.optimistic ? "Pending delivery" : undefined}
              >
                <span className="text-cyan-400 mr-2 font-mono text-xs font-semibold">{c.userId}</span>
                <span className="break-words">{c.message}</span>
              </div>
            ))}
          </div>

          {/* Composer */}
          <div className="p-4 border-t border-gray-700/50 bg-gradient-to-r from-[#0f141b] to-[#12171f] flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#151a21]/90 border border-gray-700/60 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-sm transition-all duration-200 shadow-inner"
              onKeyDown={(e) => {
                if (e.key === "Enter") sendChat();
              }}
            />
            <Button
              className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-black font-semibold shadow-lg shadow-cyan-500/30 transition-all duration-200"
              onClick={sendChat}
            >
              Send
            </Button>
          </div>
        </div>
      </aside>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.5);
        }
      `}</style>
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
        "border-gray-700/60 backdrop-blur-sm transition-all duration-200 shadow-lg",
        copied
          ? "bg-green-500/20 text-green-300 border-green-500/50 hover:bg-green-500/30"
          : "bg-[#0f141b]/90 text-gray-200 hover:bg-[#151b24] hover:text-white hover:border-cyan-500/50"
      )}
      onClick={copyInvite}
      title={inviteUrl}
    >
      <Link2 size={16} className="mr-2" />
      {copied ? "Copied!" : "Share"}
    </Button>
  );
}