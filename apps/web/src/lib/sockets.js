let socket = null;

export function connectSocket() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    return socket;
  }

  socket = new WebSocket(process.env.NEXT_PUBLIC_WS_URL);
  console.log("WS ENV =", process.env.NEXT_PUBLIC_WS_URL);

  socket.onopen = () => console.log("WS connected");
  socket.onclose = () => {
    console.log("WS closed");
    socket = null;
  };
  socket.onerror = (e) => console.error("WS error", e);

  return socket;
}

export function sendMessage(type, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn("⚠️ WS not ready, dropping message", type);
    return;
  }
  socket.send(JSON.stringify({ type, payload }));
}

export function sendJoinRequest(spaceId, token) {
  sendMessage("join", { spaceId, token });
}

export function sendMoveRequest(x, y) {
  sendMessage("move", { x, y });
}
