let socket = null;

export function connectSocket() {
  socket = new WebSocket("ws://localhost:3001");
  window.__ws = socket;


  socket.onopen = () => {
    console.log("WS connected");
  };

  socket.onclose = () => {
    console.log("WS disconnected");
    socket = null;
  };

  socket.onerror = (err) => {
    console.error("WS error", err);
  };

  return socket;
}

export function getSocket() {
  return socket;   // ❗ DO NOT THROW
}

export function sendMessage(type, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return; // silently ignore
  }

  socket.send(
    JSON.stringify({
      type,
      payload,
    })
  );
}

export function sendJoinRequest(spaceId, token) {
  sendMessage("join", { spaceId, token });
}

export function sendMoveRequest(x, y) {
  sendMessage("move", { x, y });
}
