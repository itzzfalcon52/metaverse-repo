import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function useWebRTC(spaceId, token) {
  const pcRef = useRef(null);
  const [nearUserId, setNearUserId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(new MediaStream());
  const [callActive, setCallActive] = useState(false);
  // NEW: track local media state (mic/camera enable flags) so UI can toggle and we can apply to tracks
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);

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
      }
      if (msg.type === "rtc-answer") {
        const { fromUserId, sdp } = msg.payload || {};
        if (!pcRef.current) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      }
      if (msg.type === "rtc-ice") {
        const { fromUserId, candidate } = msg.payload || {};
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
  }, [spaceId, token]); // NEW: stabilize deps to avoid re-registering listener on local state changes

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

  async function startCall() {
    const ws = typeof window !== "undefined" ? window.__ws : null;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!nearUserId) {
      toast.warning("No nearby user to call");
      return;
    }

    // IMPORTANT:
    // - ensureLocalMedia() sets state asynchronously, so localStream might still be stale/null here.
    // - Use the returned stream to add tracks immediately.
    const stream = await ensureLocalMedia();
    if (!stream) return;

    const pc = await ensurePeer(nearUserId);

    // Add local tracks
    stream.getTracks().forEach((t) => {
      if (!pc.getSenders().find((s) => s.track === t)) {
        pc.addTrack(t, stream);
      }
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "rtc-offer", payload: { toUserId: nearUserId, sdp: offer } }));
    setCallActive(true);
  }

  function endCall() {
    setCallActive(false);
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
  };
}