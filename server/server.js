const httpServer = require("http").createServer();
const io = require("socket.io")(httpServer, {
  cors: {
    origin: "http://127.0.0.1:8080",
    credentials: true,
  },
  allowEIO3: true,
});
const { initGame, gameLoop, getUpdatedVelocity } = require("./game");
const { FRAME_RATE } = require("./constants");
const { makeid } = require("./utils");

const state = {};
const clientRooms = {};

io.on("connection", (client) => {
  client.on("newGame", handleNewGame);
  client.on("joinGame", handleJoinGame);

  function handleJoinGame(roomName) {
    const room = io.sockets.adapter.rooms.get(roomName);
    let numClients = room ? room.size : 0;
    if (numClients === 0) {
      client.emit("unknownCode");
      return;
    } else if (numClients >= MAX_PLAYERS) {
      client.emit("tooManyPlayers");
      return;
    }
    clientRooms[client.id] = roomName;
    client.join(roomName);
    client.number = numClients + 1;
    client.emit("enterRoomSuccessful", 2);
  }

  function handleNewGame() {
    let roomName = makeid(5);
    clientRooms[client.id] = roomName;
    client.emit("gameCode", roomName);

    state[roomName] = initGame();

    client.join(roomName);
    client.number = 1;
    client.emit("init", 1);
  }


});

function startGameInterval(roomName) {
  const intervalId = setInterval(() => {
    const winner = gameLoop(state[roomName]);

    if (!winner) {
      emitGameState(roomName, state[roomName]);
    } else {
      emitGameOver(roomName, winner);
      state[roomName] = null;
      clearInterval(intervalId);
    }
  }, 1000 / FRAME_RATE);
}

function emitGameState(room, gameState) {
  // Send this event to everyone in the room.
  io.sockets.in(room).emit("gameState", JSON.stringify(gameState));
}

function emitGameOver(room, winner) {
  io.sockets.in(room).emit("gameOver", JSON.stringify({ winner }));
}

io.listen(3000);
