import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function useWebRTC(spaceId, token) {
  const pcRef = useRef(null);
  const peerUserIdRef = useRef(null); // who we're currently negotiating with (for ICE routing)

  const [nearUserId, setNearUserId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(new MediaStream());
  const [callActive, setCallActive] = useState(false);

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
        return;
      }

      if (msg.type === "rtc-offer") {
        const { fromUserId, sdp } = msg.payload || {};
        if (!fromUserId || !sdp) return;

        peerUserIdRef.current = fromUserId;
        const pc = await ensurePeer(fromUserId);

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

        ws.send(
          JSON.stringify({
            type: "rtc-answer",
            payload: { toUserId: fromUserId, sdp: answer },
          })
        );

        setCallActive(true);
        return;
      }

      if (msg.type === "rtc-answer") {
        const { sdp } = msg.payload || {};
        if (!pcRef.current || !sdp) return;
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        setCallActive(true);
        return;
      }

      if (msg.type === "rtc-ice") {
        const { candidate } = msg.payload || {};
        if (!pcRef.current || !candidate) return;
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Failed to add ICE candidate", e);
        }
      }
    };

    ws.addEventListener("message", onMessage);
    return () => ws.removeEventListener("message", onMessage);
  }, [spaceId, token]);

  async function ensureLocalMedia() {
    if (localStream) return localStream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getAudioTracks().forEach((t) => (t.enabled = micEnabled));
      stream.getVideoTracks().forEach((t) => (t.enabled = camEnabled));
      setLocalStream(stream);
      return stream;
    } catch (e) {
      console.error("Failed to get local media", e);
      toast.error("Failed to access camera/microphone.");
      return null;
    }
  }

  async function ensurePeer(toUserId) {
    if (pcRef.current) return pcRef.current;

    peerUserIdRef.current = toUserId;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });

    pc.ontrack = (e) => {
      const incoming = e.streams?.[0];
      if (incoming) setRemoteStream(incoming);
    };

    pc.onicecandidate = (e) => {
      const ws = typeof window !== "undefined" ? window.__ws : null;
      const peerId = peerUserIdRef.current;
      if (e.candidate && ws?.readyState === WebSocket.OPEN && peerId) {
        ws.send(JSON.stringify({ type: "rtc-ice", payload: { toUserId: peerId, candidate: e.candidate } }));
      }
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "failed" || st === "disconnected" || st === "closed") {
        // keep UI from showing "connected" forever
        setCallActive(false);
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

    peerUserIdRef.current = nearUserId;

    const stream = await ensureLocalMedia();
    if (!stream) return;

    const pc = await ensurePeer(nearUserId);

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
      localStream?.getTracks().forEach((t) => t.stop());
    } catch {}

    try {
      pcRef.current?.close();
    } catch {}

    pcRef.current = null;
    peerUserIdRef.current = null;

    setLocalStream(null);
    setRemoteStream(new MediaStream());
  }

  function toggleMic() {
    const next = !micEnabled;
    setMicEnabled(next);
    localStream?.getAudioTracks().forEach((t) => (t.enabled = next));
  }

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
    micEnabled,
    camEnabled,
    toggleMic,
    toggleCam,
  };
}