// Maintain a single WebSocket instance for the app. `null` means no active connection.
// This module caches the socket to avoid creating multiple connections.
let socket = null;

export function connectSocket() {
  // If a socket exists and is already open, reuse it instead of creating a new one.
  if (socket && socket.readyState === WebSocket.OPEN) {
    return socket;
  }

  // Create a new WebSocket using the public URL from environment variables.
  // Ensure NEXT_PUBLIC_WS_URL is defined in your environment (.env) and exposed to the client.
  socket = new WebSocket(process.env.NEXT_PUBLIC_WS_URL);
  console.log("WS ENV =", process.env.NEXT_PUBLIC_WS_URL);

  // Called once the TCP/WebSocket handshake completes and the connection is ready to send/receive.
  socket.onopen = () => console.log("WS connected");

  // Called when the server or client closes the connection.
  // Reset the cached socket to allow reconnects on the next `connectSocket()` call.
  socket.onclose = () => {
    console.log("WS closed");
    socket = null;
  };

  // Called on transport or protocol errors. This does not necessarily close the socket.
  socket.onerror = (e) => console.error("WS error", e);

  // Return the (possibly newly created) WebSocket instance.
  return socket;
}

export function sendMessage(type, payload) {
  // Guard: only send when the socket exists and is OPEN.
  // If connecting (CONNECTING) or closed (CLOSING/CLOSED), drop the message to avoid exceptions.
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn("⚠️ WS not ready, dropping message", type);
    return;
  }
  // Serialize a simple action envelope with `type` and `payload`.
  // The server should understand and route based on `type`.
  socket.send(JSON.stringify({ type, payload }));
}

export function sendJoinRequest(spaceId, token) {
  // Convenience wrapper to request joining a space/room.
  // `token` can be used by the server for auth.
  sendMessage("join", { spaceId, token });
}

export function sendMoveRequest(x, y) {
  // Convenience wrapper to send movement/position updates.
  // `x`/`y` represent coordinates in the current space.
  sendMessage("move", { x, y });
}