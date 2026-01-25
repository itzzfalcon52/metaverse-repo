import { create } from "zustand"; // Import Zustand's `create` function to create a state store



export const useCreateWorldStore = create((set) => ({
  selfId: null,

  // IMPORTANT: players is a Map
  players: new Map(),

  setSelfId: (id) => set(() => ({ selfId: id })),

  addPlayer(player) {
    set((state) => {
      const newPlayers = new Map(state.players); //we do this to create a copy of the map and not iterate over orgignal
      newPlayers.set(player.id, player);
      return { players: newPlayers };
    });
  },

  removePlayer(id) {
    set((state) => {
      const newPlayers = new Map(state.players);
      newPlayers.delete(id);
      return { players: newPlayers };
    });
  },

  movePlayer(id, x, y) {
    set((state) => {
      const newPlayers = new Map(state.players);
      const p = newPlayers.get(id);
      if (p) {
        newPlayers.set(id, { ...p, x, y });
      }
      return { players: newPlayers };
    });
  },
}));


/*function getJwtFromCookie() {
    // reads "jwt=..." from document.cookie
    if (typeof document === "undefined") return "";
    const m = document.cookie.match(/(?:^|;\s*)jwt=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }

// Create a Zustand store for managing the state of the "world"
export const useCreateWorldStore = create((set) => ({
    // State: The ID of the current user (player) in the world
    selfId: null, // Initially set to `null` because no player is identified yet (this is the id given by websocket connection and not the userid)

    // State: A map to store all players in the world
    // The `Map` object allows storing players as key-value pairs, where the key is the player's ID
    players: new Map(),

    // Action: Set the current user's ID
    // This function updates the `selfId` state with the provided `id`
    setSelfId: (id) => set(() => ({ selfId: id })),

    // Action: Add a new player to the `players` map
    // This function takes a `player` object as input and adds it to the `players` map
    addPlayer(player) {
        set((state) => {
            // Create a new `Map` by copying the existing `players` map
            const newPlayers = new Map(state.players);

            // Add the new player to the `newPlayers` map
            newPlayers.set(player.id, player);

            // Return the updated `players` map as the new state
            return { players: newPlayers };
        });
    },

    // Action: Remove a player from the `players` map
    // This function takes the `id` of the player to be removed as input
    removePlayer(id) {
        set((state) => {
            // Create a new `Map` by copying the existing `players` map
            const newPlayers = new Map(state.players);

            // Remove the player with the specified `id` from the `newPlayers` map
            newPlayers.delete(id);

            // Return the updated `players` map as the new state
            return { players: newPlayers };
        });
    },

    // Action: Move a player to a new position in the `players` map
    // This function takes the `id` of the player and the new `x` and `y` coordinates as input
    movePlayer(id, x, y) {
        set((state) => {
            // Create a new `Map` by copying the existing `players` map
            const newPlayers = new Map(state.players);

            // Retrieve the player with the specified `id` from the `newPlayers` map
            const player = newPlayers.get(id);

            // If the player exists, update their position by creating a new object
            if (player) {
                newPlayers.set(id, { ...player, x, y }); // Spread the existing player data and update `x` and `y`
            }

            // Return the updated `players` map as the new state
            return { players: newPlayers };
        });
    },
}));
*/