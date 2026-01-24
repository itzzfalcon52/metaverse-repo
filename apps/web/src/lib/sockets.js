let socket = null;

export function connectSocket() {
  if (socket && socket.readyState === WebSocket.OPEN) return socket;

  const url = process.env.NEXT_PUBLIC_WS_URL;
  console.log("WS CONNECT →", url);

  socket = new WebSocket(url);

  socket.onopen = () => console.log("WS connected");
  socket.onclose = () => {
    console.log("WS closed");
    socket = null;
  };

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
