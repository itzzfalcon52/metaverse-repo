// Importing WebSocket library for handling WebSocket connections
import WebSocket from "ws";
// Importing RoomManager to manage users and rooms
import RoomManager from "./RoomManager.js";

// Importing database db for interacting with the database
import db from "@repo/db"
// Importing JSON Web Token library for verifying and decoding tokens
import jwt from "jsonwebtoken";
// Importing the JWT password/secret from the configuration file
import {JWT_PASSWORD} from "./config.js"
// Function to generate a random string of a given length
// Used to create unique IDs for users
function getRandomString(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}
const STEP = 32;
// User class represents a connected user in the WebSocket server
 class User {
    constructor(ws) {
        // Assigning a unique ID to the user
        this.id = getRandomString(10);

        // Initializing the user's position (x, y) to (0, 0)
        this.x = 0;
        this.y = 0;

        // Storing the WebSocket connection for this user
        this.ws = ws;
       this.avatarKey=null

        // Clean up on socket close
        this.ws.on("close", () => this.destroy());

        // Initializing WebSocket event handlers for this user
        this.initHandlers();
    }

    // Method to initialize WebSocket event handlers
    initHandlers() {
        // Listening for "message" events from the WebSocket connection
        this.ws.on("message", async (data) => {
            console.log(data); // Logging the raw message data

            // Parsing the incoming message as JSON
            const parsedData = JSON.parse(data.toString());
            console.log(parsedData); // Logging the parsed data

            // Handling different message types based on the "type" field
            switch (parsedData.type) {
                case "join":
                    console.log("join received");

                    // Extracting the space ID and token from the message payload
                    const spaceId = parsedData.payload.spaceId;
                    const token = parsedData.payload.token;

                    // Guard: token must be present and valid
                    if (!token || typeof token !== "string" || token.trim() === "") {
                        try { this.ws.close(); } catch {}
                        return;
                    }

                    // Verifying the token and extracting the user ID
                    let userId;
                    try {
                        userId = jwt.verify(token, JWT_PASSWORD).userId;
                    } catch (e) {
                        try { this.ws.close(); } catch {}
                        return;
                    }

                    // If the token is invalid or user ID is missing, close the connection
                    if (!userId) {
                        this.ws.close();
                        return;
                    }

                    // Assigning the user ID to this user instance
                    this.userId = userId;

                    // 🔥 FETCH USER FROM DB TO GET AVATAR
                    const dbUser = await db.user.findUnique({
                        where: { id: userId },
                        select: { avatarKey: true }
                    });

                    if (!dbUser) {
                       this.ws.close();
                        return;
                    }

                    // store on this instance
                    this.avatarKey = dbUser.avatarKey || "FemaleAdventurer"; // fallback


                    // Fetching the space from the database using the space ID
                    const space = await db.space.findFirst({
                        where: {
                            id: spaceId
                        }
                    });

                    // If the space does not exist, close the connection
                    if (!space) {
                        this.ws.close();
                        return;
                    }

                    // Assigning the space ID to this user instance
                    this.spaceId = spaceId;

                    // Adding the user to the room in RoomManager
                    RoomManager.getInstance().addUser(spaceId, this);

                    // Randomly assigning the user's spawn position within the space dimensions
                    this.x = Math.floor(Math.random() * (space.width / STEP)) * STEP;
                    this.y = Math.floor(Math.random() * (space.height / STEP)) * STEP;
          

                    // Sending a "space-joined" message to the user with their spawn position and other users in the room
                    this.send({
                        type: "space-joined",
                        payload: {
                            // include self identifiers so client can track me
                            self: { id: this.id, userId: this.userId, x: this.x, y: this.y, avatarKey: this.avatarKey },
                            spawn: {
                                x: this.x,
                                y: this.y
                            },
                            // include others with ids and positions if available
                            users: RoomManager.getInstance().rooms.get(spaceId)
                                ?.filter(x => x.id !== this.id)
                                ?.map((u) => ({ id: u.id, userId: u.userId, x: u.x, y: u.y , avatarKey: u.avatarKey})) ?? []
                        }
                    });

                    // Broadcasting a "user-joined" message to other users in the room
                    RoomManager.getInstance().broadcast({
                        type: "user-joined",
                        payload: {
                            id: this.id,
                            userId: this.userId,
                            x: this.x,
                            y: this.y,
                            avatarKey: this.avatarKey
                        }
                    }, this, this.spaceId);
                    break;

                // New case: handle chat messages sent by the user
                case "chat":
                    // Ensure the user has joined a space before chatting
                    if (!this.spaceId) {
                        // User hasn't joined any space; ignore the message
                        return;
                    }

                    // Extract the message text from payload, ensure it's a string
                    {
                      const rawMessage = parsedData?.payload?.message;
                      const text = typeof rawMessage === "string" ? rawMessage.trim() : "";

                      // Ignore empty messages
                      if (!text) {
                          return;
                      }

                      // Optional: cap the message length to prevent flooding (e.g., 500 chars)
                      const capped = text.slice(0, 500);

                      // Broadcast the chat message to all other users in the same room (exclude sender)
                      RoomManager.getInstance().broadcast({
                          type: "chat",
                          payload: {
                              userId: this.userId, // sender's authenticated user id
                              message: capped,     // sanitized chat message
                              ts: Date.now()       // timestamp for client-side ordering
                          }
                      }, this, this.spaceId);
                    }
                    break;

                case "move":
                    // Extracting the new position (x, y) from the message payload
                    const moveX = parsedData.payload.x;
                    const moveY = parsedData.payload.y;

                    // Calculating the displacement in x and y directions
                    const xDisplacement = Math.abs(this.x - moveX);
                    const yDisplacement = Math.abs(this.y - moveY);
         

                    console.log("MOVE TRY", this.x, this.y, "→", moveX, moveY);


                    // Allowing movement only if it's a single step in any direction
                    if ((xDisplacement == STEP && yDisplacement == 0) || (xDisplacement == 0 && yDisplacement == STEP)) {
                        // Updating the user's position
                        this.x = moveX;
                        this.y = moveY;

                        // Broadcasting the movement to other users in the room
                        RoomManager.getInstance().broadcast({
                            type: "movement",
                            payload: { id: this.id, userId: this.userId, x: this.x, y: this.y, avatarKey: this.avatarKey }
                          }, this, this.spaceId);
                          
                          // ALSO send to self
                          this.send({
                            type: "movement",
                            payload: { id: this.id, userId: this.userId, x: this.x, y: this.y, avatarKey: this.avatarKey }
                          });
                          
                        return;
                    }

                    // If the movement is invalid, send a "movement-rejected" message to the user
                    this.send({
                        type: "movement-rejected",
                        payload: {
                            x: this.x,
                            y: this.y,
                            avatarKey: this.avatarKey
                        }
                    });
                    console.log("MOVE REJECTED", this.x, this.y, "→", moveX, moveY);
            }
        });
    }

    // Method to handle user disconnection
    destroy() {
        if (!this.spaceId) return;
      
        RoomManager.getInstance().broadcast({
          type: "user-left",
          payload: {
            id: this.id,
            userId: this.userId
          }
        }, this, this.spaceId);
      
        RoomManager.getInstance().removeUser(this, this.spaceId);
      }
      

    // Method to send a message to the user via WebSocket
    send(payload) {
        this.ws.send(JSON.stringify(payload));
    }
}

// Exporting the User class for use in other modules
export default User;
// ...existing comments...

// Generalized Steps for Future Reference:
// 1. **User Initialization**:
//    - Assign a unique identifier to each user (e.g., `id`).
//    - Store the WebSocket connection for communication.
//    - Initialize event handlers for WebSocket messages.

// 2. **Message Handling**:
//    - Parse incoming messages as JSON.
//    - Use a `switch` or similar structure to handle different message types (e.g., `join`, `move`).
//    - Validate incoming data (e.g., verify tokens, check room existence).

// 3. **Room Management**:
//    - Use a room manager (e.g., `RoomManager`) to handle adding/removing users from rooms.
//    - Assign users to rooms based on their requests (e.g., `spaceId`).
//    - Broadcast messages to other users in the same room as needed.

// 4. **User Actions**:
//    - Implement specific actions for users (e.g., joining a room, moving within a room).
//    - Validate actions (e.g., ensure movement is within allowed bounds).

// 5. **Disconnection Handling**:
//    - Handle user disconnection gracefully (e.g., remove them from rooms).
//    - Notify other users in the room about the disconnection.

// 6. **Communication**:
//    - Use a `send` method to send messages to the user via WebSocket.
//    - Ensure all messages are properly formatted as JSON.

// 7. **Error Handling**:
//    - Close the WebSocket connection if invalid data is received (e.g., invalid token).
//    - Log errors or unexpected behavior for debugging.