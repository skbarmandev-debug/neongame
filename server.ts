import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";

interface LobbyPlayer {
  id: number; // 1 to 6
  uid: string;
  name: string;
  color: string;
  isReady: boolean;
  isBot: boolean;
}

interface RoomState {
  roomId: string;
  seed: number;
  winConditionKills: number;
  timeLimitSeconds: number;
  friendlyFire: boolean;
  gameStarted: boolean;
  players: Record<string, LobbyPlayer>; // key is uid
}

const PLAYER_COLORS = [
  "#00e5ff", // P1: Neon Cyan
  "#ff4081", // P2: Neon Pink
  "#69ff47", // P3: Neon Green
  "#ffd740", // P4: Neon Yellow
  "#e040fb", // P5: Neon Magenta
  "#ff6e40", // P6: Neon Orange
];

const rooms: Record<string, RoomState> = {};
const activeClients = new Map<WebSocket, { roomId: string; uid: string }>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", roomsActive: Object.keys(rooms).length });
  });

  // Get current status of a room
  app.get("/api/room/:roomId", (req, res) => {
    const { roomId } = req.params;
    const room = rooms[roomId.toUpperCase()];
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json({
      roomId: room.roomId,
      playerCount: Object.keys(room.players).length,
      gameStarted: room.gameStarted,
      players: Object.values(room.players).map(p => ({ id: p.id, name: p.name, color: p.color }))
    });
  });

  // Create standard HTTP server
  const server = http.createServer(app);

  // Mount WebSocket Server
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  // Broadcast helper
  const broadcastToRoom = (roomId: string, message: any, excludeWs?: WebSocket) => {
    const formattedId = roomId.toUpperCase();
    wss.clients.forEach((client) => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        const clientInfo = activeClients.get(client);
        if (clientInfo && clientInfo.roomId === formattedId) {
          client.send(JSON.stringify(message));
        }
      }
    });
  };

  wss.on("connection", (ws: WebSocket) => {
    console.log("New raw client connected");

    ws.on("message", (rawMessage: string) => {
      try {
        const payload = JSON.parse(rawMessage);
        const { type } = payload;

        switch (type) {
          case "join_room": {
            const { roomId, uid, name } = payload;
            const cleanRoomId = roomId.toUpperCase();
            
            // Check if room exists, otherwise create it
            if (!rooms[cleanRoomId]) {
              rooms[cleanRoomId] = {
                roomId: cleanRoomId,
                seed: Math.floor(Math.random() * 9000) + 1000,
                winConditionKills: 10,
                timeLimitSeconds: 180,
                friendlyFire: false,
                gameStarted: false,
                players: {},
              };
            }

            const room = rooms[cleanRoomId];

            // If game is already active, players can spectate or rejoin if they were already inside
            const existing = room.players[uid];
            if (Object.keys(room.players).length >= 6 && !existing) {
              ws.send(JSON.stringify({ type: "join_rejected", reason: "Room is full (max 6 players)" }));
              return;
            }

            // Assign numerical ID from 1 to 6 (preferring existing or first available)
            let assignedId = existing ? existing.id : 1;
            if (!existing) {
              const usedIds = Object.values(room.players).map(p => p.id);
              for (let i = 1; i <= 6; i++) {
                if (!usedIds.includes(i)) {
                  assignedId = i;
                  break;
                }
              }
            }

            const assignedColor = PLAYER_COLORS[assignedId - 1];

            const player: LobbyPlayer = {
              id: assignedId,
              uid,
              name: name || `Player ${assignedId}`,
              color: assignedColor,
              isReady: existing ? existing.isReady : false,
              isBot: false,
            };

            room.players[uid] = player;
            activeClients.set(ws, { roomId: cleanRoomId, uid });

            // Notify client of setup success
            ws.send(JSON.stringify({
              type: "join_accepted",
              player,
              settings: {
                seed: room.seed,
                friendlyFire: room.friendlyFire,
                winConditionKills: room.winConditionKills,
                timeLimitSeconds: room.timeLimitSeconds,
              }
            }));

            // Broadcast update to all in the room
            broadcastToRoom(cleanRoomId, {
              type: "room_players_update",
              players: Object.values(room.players),
              hostId: Object.values(room.players).sort((a, b) => a.id - b.id)[0]?.id || 1
            });
            break;
          }

          case "update_settings": {
            const clientInfo = activeClients.get(ws);
            if (!clientInfo) return;
            const room = rooms[clientInfo.roomId];
            if (!room) return;

            const { seed, friendlyFire, winConditionKills, timeLimitSeconds } = payload;
            room.seed = seed;
            room.friendlyFire = friendlyFire;
            room.winConditionKills = winConditionKills;
            room.timeLimitSeconds = timeLimitSeconds;

            broadcastToRoom(clientInfo.roomId, {
              type: "settings_updated",
              settings: { seed, friendlyFire, winConditionKills, timeLimitSeconds }
            });
            break;
          }

          case "toggle_ready": {
            const clientInfo = activeClients.get(ws);
            if (!clientInfo) return;
            const room = rooms[clientInfo.roomId];
            if (!room) return;

            const { isReady } = payload;
            if (room.players[clientInfo.uid]) {
              room.players[clientInfo.uid].isReady = isReady;
            }

            broadcastToRoom(clientInfo.roomId, {
              type: "room_players_update",
              players: Object.values(room.players),
              hostId: Object.values(room.players).sort((a, b) => a.id - b.id)[0]?.id || 1
            });
            break;
          }

          case "start_game": {
            const clientInfo = activeClients.get(ws);
            if (!clientInfo) return;
            const room = rooms[clientInfo.roomId];
            if (!room) return;

            room.gameStarted = true;
            broadcastToRoom(clientInfo.roomId, {
              type: "game_started",
              players: Object.values(room.players)
            });
            break;
          }

          case "client_update": {
            const clientInfo = activeClients.get(ws);
            if (!clientInfo) return;
            // Broadcast client status/position updates to all other clients in the room
            broadcastToRoom(clientInfo.roomId, {
              type: "server_player_update",
              playerState: payload.playerState
            }, ws);
            break;
          }

          case "shoot_bullet": {
            const clientInfo = activeClients.get(ws);
            if (!clientInfo) return;
            // Relay bullet info to all other clients in the room
            broadcastToRoom(clientInfo.roomId, {
              type: "server_spawn_bullet",
              bullet: payload.bullet
            }, ws);
            break;
          }

          case "bullet_hit": {
            const clientInfo = activeClients.get(ws);
            if (!clientInfo) return;
            // Relay bullet hit mechanics
            broadcastToRoom(clientInfo.roomId, {
              type: "server_bullet_hit",
              hit: payload.hit
            });
            break;
          }

          case "grab_pickup": {
            const clientInfo = activeClients.get(ws);
            if (!clientInfo) return;
            // Coordinated grab to avoid multiple player duplications
            broadcastToRoom(clientInfo.roomId, {
              type: "server_grab_pickup",
              pickupId: payload.pickupId,
              grabberId: payload.grabberId
            });
            break;
          }

          case "player_kill": {
            const clientInfo = activeClients.get(ws);
            if (!clientInfo) return;
            broadcastToRoom(clientInfo.roomId, {
              type: "server_player_kill",
              victimId: payload.victimId,
              killerId: payload.killerId,
              weapon: payload.weapon
            });
            break;
          }

          case "combat_announcement": {
            const clientInfo = activeClients.get(ws);
            if (!clientInfo) return;
            broadcastToRoom(clientInfo.roomId, {
              type: "server_announcement",
              text: payload.text,
              subtext: payload.subtext
            }, ws);
            break;
          }

          case "add_bot": {
            const clientInfo = activeClients.get(ws);
            if (!clientInfo) return;
            const room = rooms[clientInfo.roomId];
            if (!room) return;

            const currentCount = Object.keys(room.players).length;
            if (currentCount >= 6) return;

            let botId = 1;
            const usedIds = Object.values(room.players).map(p => p.id);
            for (let i = 1; i <= 6; i++) {
              if (!usedIds.includes(i)) {
                botId = i;
                break;
              }
            }

            const botUid = `bot_${botId}_${Math.random().toString(36).substring(2, 7)}`;
            const botPlayer: LobbyPlayer = {
              id: botId,
              uid: botUid,
              name: payload.name || `Bot ${botId}`,
              color: PLAYER_COLORS[botId - 1],
              isReady: true,
              isBot: true
            };

            room.players[botUid] = botPlayer;
            broadcastToRoom(clientInfo.roomId, {
              type: "room_players_update",
              players: Object.values(room.players),
              hostId: Object.values(room.players).sort((a, b) => a.id - b.id)[0]?.id || 1
            });
            break;
          }

          case "remove_player": {
            const clientInfo = activeClients.get(ws);
            if (!clientInfo) return;
            const room = rooms[clientInfo.roomId];
            if (!room) return;

            const { uidToRemove } = payload;
            if (room.players[uidToRemove]) {
              delete room.players[uidToRemove];
            }

            broadcastToRoom(clientInfo.roomId, {
              type: "room_players_update",
              players: Object.values(room.players),
              hostId: Object.values(room.players).sort((a, b) => a.id - b.id)[0]?.id || 1
            });
            break;
          }
        }
      } catch (err) {
        console.error("Error parsing/handling WebSocket message", err);
      }
    });

    ws.on("close", () => {
      const clientInfo = activeClients.get(ws);
      if (clientInfo) {
        const { roomId, uid } = clientInfo;
        activeClients.delete(ws);
        console.log(`Client ${uid} disconnected from room ${roomId}`);

        const room = rooms[roomId];
        if (room) {
          // Keep persistent coordinates/rejoin options, but if lobby is active or empty, clean up
          const leavingPlayer = room.players[uid];
          
          if (!room.gameStarted) {
            // In lobby: delete them directly
            delete room.players[uid];
          } else {
            // In game: mark them as inactive/disconnected or bot controller takeover or delete
            delete room.players[uid];
          }

          if (Object.keys(room.players).length === 0) {
            delete rooms[roomId];
            console.log(`Deleted room ${roomId} - empty`);
          } else {
            // Re-broadcast list updates
            broadcastToRoom(roomId, {
              type: "room_players_update",
              players: Object.values(room.players),
              hostId: Object.values(room.players).sort((a, b) => a.id - b.id)[0]?.id || 1
            });
          }
        }
      }
    });
  });

  // Serve static files / dev middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
