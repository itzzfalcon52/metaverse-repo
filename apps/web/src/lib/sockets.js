let socket = null;

export function connectSocket() {
  socket = new WebSocket("ws://localhost:3001");

  socket.onopen = () => console.log("WS connected");
  socket.onclose = () => (socket = null);

  return socket;
}

export function sendMessage(type, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type, payload }));
}

export function sendJoinRequest(spaceId, token) {
  sendMessage("join", { spaceId, token });
}

export function sendMoveRequest(x, y) {
  sendMessage("move", { x, y });
}
