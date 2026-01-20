// ...existing code...
import { useEffect, useState } from "react";
import { sendMoveRequest } from "@/lib/sockets";
import { useCreateWorldStore } from "@/stores/useWorldStore";

const STEP = 8; // keep within server MAX_STEP

const useMovement = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isMoving, setIsMoving] = useState(false);

  const selfId = useCreateWorldStore((s) => s.selfId);
  const movePlayer = useCreateWorldStore((s) => s.movePlayer);

  useEffect(() => {
    const handleKeyDown = (event) => {
      let dx = 0, dy = 0;
      switch (event.key) {
        case "ArrowUp": dy = -STEP; break;
        case "ArrowDown": dy = STEP; break;
        case "ArrowLeft": dx = -STEP; break;
        case "ArrowRight": dx = STEP; break;
        default: return;
      }

      const newX = position.x + dx;
      const newY = position.y + dy;

      sendMoveRequest(newX, newY);

      if (selfId) movePlayer(selfId, newX, newY);
      setPosition({ x: newX, y: newY });
      setIsMoving(true);
    };

    const handleKeyUp = () => setIsMoving(false);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [position, selfId, movePlayer]);

  return { position, isMoving };
};

export default useMovement;