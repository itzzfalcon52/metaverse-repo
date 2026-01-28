import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function useWebRTC(spaceId, token) {
  const pcRef = useRef(null);
  const [nearUserId, setNearUserId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(new MediaStream());
  const [callActive, setCallActive] = useState(false);
  //  track local media state (mic/camera enable flags) so UI can toggle and we can apply to tracks
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);

  //  incoming call + flow control
  const [incomingCall, setIncomingCall] = useState(null); // { fromUserId }
  const [outgoingToUserId, setOutgoingToUserId] = useState(null); // who we are calling
  const [callPhase, setCallPhase] = useState("idle"); // "idle" | "ringing" | "connecting" | "connected"

  useEffect(() => {
    const ws = typeof window !== "undefined" ? window.__ws : null;
    if (!spaceId || !token || !ws) return;

    const onMessage = async (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        console.error("Failed to parse WS message", e);
        return;
      }

      if (msg.type === "proximity") {
        const { withUserId, close } = msg.payload || {};
        setNearUserId((prev) => (close ? withUserId : prev === withUserId ? null : prev));
      }

      //  caller -> callee ringing
      if (msg.type === "rtc-invite") {
        const { fromUserId } = msg.payload || {};
        if (!fromUserId) return;

        // If already in a call/connecting, auto-decline (simple busy behavior)
        if (callActive || callPhase === "connecting" || callPhase === "connected") {
          ws.send(JSON.stringify({ type: "rtc-invite-decline", payload: { toUserId: fromUserId, reason: "busy" } }));
          return;
        }

        setIncomingCall({ fromUserId });
        setCallPhase("ringing");
        return;
      }

      // NEW: callee declined
      if (msg.type === "rtc-invite-decline") {
        const { fromUserId, reason } = msg.payload || {};
        if (outgoingToUserId && fromUserId === outgoingToUserId) {
          setOutgoingToUserId(null);
          setCallPhase("idle");
          toast.warning(reason === "busy" ? "User is busy" : "Call declined");
        }
        return;
      }

      // NEW: callee accepted -> caller now sends SDP offer
      if (msg.type === "rtc-invite-accept") {
        const { fromUserId } = msg.payload || {};
        if (!fromUserId) return;

        // Only proceed if we were actually calling this user
        if (!outgoingToUserId || fromUserId !== outgoingToUserId) return;

        setCallPhase("connecting");

        const stream = await ensureLocalMedia();
        if (!stream) {
          // If we can't get media, end flow
          setOutgoingToUserId(null);
          setCallPhase("idle");
          return;
        }

        const pc = await ensurePeer(outgoingToUserId);

        // Add local tracks
        stream.getTracks().forEach((t) => {
          if (!pc.getSenders().find((s) => s.track === t)) {
            pc.addTrack(t, stream);
          }
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: "rtc-offer", payload: { toUserId: outgoingToUserId, sdp: offer } }));
        return;
      }

      // Existing signaling, but now it only happens after accept
      if (msg.type === "rtc-offer") {
        const { fromUserId, sdp } = msg.payload || {};
        const pc = await ensurePeer(fromUserId);

        // IMPORTANT:
        // - ensureLocalMedia() sets state asynchronously, so localStream might still be stale/null here.
        // - Use the returned stream to add tracks immediately (fixes "callee only sees their own video").
        const stream = await ensureLocalMedia();
        if (!stream) return;

        stream.getTracks().forEach((track) => {
          if (!pc.getSenders().find((s) => s.track === track)) {
            pc.addTrack(track, stream);
          }
        });

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: "rtc-answer", payload: { toUserId: fromUserId, sdp: answer } }));

        setCallActive(true);
        setCallPhase("connected");
        return;
      }

      if (msg.type === "rtc-answer") {
        const { sdp } = msg.payload || {};
        if (!pcRef.current) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));

        setCallActive(true);
        setCallPhase("connected");
        return;
      }

      if (msg.type === "rtc-ice") {
        const { candidate } = msg.payload || {};
        if (!pcRef.current) return;
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Failed to add ICE candidate", e);
        }
      }
    };

    ws.addEventListener("message", onMessage);

    return () => {
      ws.removeEventListener("message", onMessage);
    };
  }, [spaceId, token, callActive, callPhase, outgoingToUserId]);

  async function ensureLocalMedia() {
    // Return the stream so callers can reliably add tracks immediately.
    if (localStream) return localStream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      // NEW: apply current mic/cam enable flags to initial tracks so UI reflects state immediately
      stream.getAudioTracks().forEach((t) => (t.enabled = micEnabled));
      stream.getVideoTracks().forEach((t) => (t.enabled = camEnabled));
      setLocalStream(stream);
      return stream;
    } catch (e) {
      console.error("Failed to get local media", e);
      toast.error("Failed to access microphone for voice chat.");
      return null;
    }
  }

  async function ensurePeer(toUserId) {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] });
    pc.ontrack = (e) => {
      // NEW: when remote tracks arrive, replace remoteStream so <video> updates and avoids stale/frozen frames
      const incoming = e.streams[0];
      if (incoming) {
        setRemoteStream(incoming);
      }
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && window.__ws?.readyState === WebSocket.OPEN) {
        window.__ws?.send(JSON.stringify({ type: "rtc-ice", payload: { toUserId, candidate: e.candidate } }));
      }
    };
    pcRef.current = pc;
    return pc;
  }

  // CHANGED: startCall now only sends an invite (ring). Offer happens after accept.
  async function startCall() {
    const ws = typeof window !== "undefined" ? window.__ws : null;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!nearUserId) {
      toast.warning("No nearby user to call");
      return;
    }
    if (callActive || callPhase === "connecting" || callPhase === "connected") return;

    setOutgoingToUserId(nearUserId);
    setCallPhase("ringing");
    ws.send(JSON.stringify({ type: "rtc-invite", payload: { toUserId: nearUserId } }));
  }

  // NEW: accept incoming call => triggers caller to send offer
  async function acceptCall() {
    const ws = typeof window !== "undefined" ? window.__ws : null;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!incomingCall?.fromUserId) return;

    // On accept, request permissions now (so it’s a user gesture path)
    setCallPhase("connecting");
    const stream = await ensureLocalMedia();
    if (!stream) {
      setIncomingCall(null);
      setCallPhase("idle");
      return;
    }

    ws.send(JSON.stringify({ type: "rtc-invite-accept", payload: { toUserId: incomingCall.fromUserId } }));
    setIncomingCall(null);
  }

  //  decline incoming call
  function declineCall() {
    const ws = typeof window !== "undefined" ? window.__ws : null;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setIncomingCall(null);
      setCallPhase("idle");
      return;
    }
    if (!incomingCall?.fromUserId) return;

    ws.send(JSON.stringify({ type: "rtc-invite-decline", payload: { toUserId: incomingCall.fromUserId, reason: "declined" } }));
    setIncomingCall(null);
    setCallPhase("idle");
  }

  function endCall() {
    setCallActive(false);
    setIncomingCall(null);
    setOutgoingToUserId(null);
    setCallPhase("idle");

    try {
      // Stop and remove local tracks
      localStream?.getTracks().forEach((t) => t.stop());
      pcRef.current?.getSenders().forEach((s) => s.track && pcRef.current.removeTrack(s));
      // Close peer
      pcRef.current?.close();
    } catch {}
    // NEW: clear streams so <video> elements detach srcObject and don't show frozen last frame
    setLocalStream(null);
    setRemoteStream(new MediaStream());
    // Reset peer ref
    pcRef.current = null;
  }

  // NEW: mic toggle - flips state and applies to current audio tracks
  function toggleMic() {
    const next = !micEnabled;
    setMicEnabled(next);
    localStream?.getAudioTracks().forEach((t) => (t.enabled = next));
  }
  // NEW: camera toggle - flips state and applies to current video tracks
  function toggleCam() {
    const next = !camEnabled;
    setCamEnabled(next);
    localStream?.getVideoTracks().forEach((t) => (t.enabled = next));
  }

  return {
    nearUserId,
    localStream,
    remoteStream,
    callActive,
    startCall,
    endCall,
    // NEW: expose mic/cam flags and toggles to UI
    micEnabled,
    camEnabled,
    toggleMic,
    toggleCam,
    // NEW: accept/decline UI
    incomingCall,
    callPhase,
    acceptCall,
    declineCall,
  };
}