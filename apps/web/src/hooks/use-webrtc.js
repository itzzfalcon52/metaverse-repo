
import { useEffect,useRef,useState } from "react";
import { toast } from "sonner";

export default function useWebRTC(spaceId,token){
  const pcRef=useRef(null);
  const [nearUserId,setNearUserId]=useState(null);
  const [localStream,setLocalStream]=useState(null);
  const [remoteStream,setRemoteStream]=useState(new MediaStream());
  const [callActive,setCallActive]=useState(false);

  useEffect(()=>{
    const ws=typeof window !=='undefined' ? window.__ws : null;
    if(!spaceId || !token || !ws) return;
    const onMessage=async(event)=>{
        let msg;
        try{
            msg=JSON.parse(event.data);
        }catch(e){
            console.error("Failed to parse WS message",e);
            return;
        }
        if(msg.type==="proximity"){
            const {withUserId,close}= msg.payload || {};
            setNearUserId((prev) => (close ? withUserId : prev === withUserId ? null : prev));

        }
        if(msg.type==="rtc-offer"){
            const {fromUserId,sdp}= msg.payload || {};
            await ensurePeer(fromUserId);
            await ensureLocalMedia();

            localStream?.getTracks().forEach((track)=>{
                if(!pcRef.current.getSenders().find((s)=>s.track === track)){
                    pcRef.current.addTrack(track,localStream);
                }
            });

            await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer=await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            ws.send(JSON.stringify({type:"rtc-answer",payload:{toUserId:fromUserId,sdp:answer}}));
            setCallActive(true);
        }
        if(msg.type==="rtc-answer"){
            const {fromUserId,sdp}= msg.payload || {};
            if(!pcRef.current) return;
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        }
        if(msg.type==="rtc-ice"){
            const {fromUserId,candidate}= msg.payload || {};
            if(!pcRef.current) return;
            try{
                await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            }catch(e){
                console.error("Failed to add ICE candidate",e);
            }
        }
    }

    ws.addEventListener("message",onMessage);

    return()=>{
        ws.removeEventListener("message",onMessage);
    }
  },[spaceId,token,localStream,nearUserId]);

  async function ensureLocalMedia(){
    if(localStream) return;
    try{
        const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:true});
        setLocalStream(stream);
    }catch(e){
        console.error("Failed to get local media",e);
        toast.error("Failed to access microphone for voice chat.");
    }
  }

    async function ensurePeer(toUserId){

        if (pcRef.current) return pcRef.current;
        const pc = new RTCPeerConnection({ iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] });
        pc.ontrack = (e) => {
          e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
        };
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            window.__ws?.send(JSON.stringify({ type: "rtc-ice", payload: { toUserId, candidate: e.candidate } }));
          }
        };
        pcRef.current = pc;
        return pc;

        
    }

    async function startCall(){
        const ws=typeof window !=='undefined' ? window.__ws : null;
        if(!ws || ws.readyState !== WebSocket.OPEN) return;
        if (!nearUserId) {
            toast.warning("No nearby user to call");
            return;
          }

          await ensureLocalMedia();
          const pc = await ensurePeer(nearUserId);
          // Add local tracks
          localStream.getTracks().forEach((t) => {
            if (!pc.getSenders().find((s) => s.track === t)) {
              pc.addTrack(t, localStream);
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
            pcRef.current?.getSenders().forEach((s) => s.track?.stop());
            pcRef.current?.close();
          } catch {}
          localStream?.getTracks().forEach((t) => t.stop());
          pcRef.current = null;
          setLocalStream(null);
          setRemoteStream(new MediaStream());
        }

        return { nearUserId, localStream, remoteStream, callActive, startCall, endCall };
    
    
}