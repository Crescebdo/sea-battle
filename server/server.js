const httpServer = require("http").createServer();
const io = require("socket.io")(httpServer, {
  cors: {
    origin: [
      "https://crescb.com",
      "https://www.crescb.com",
      "http://127.0.0.1:8080",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  allowEIO3: true,
});
const { initGameState } = require("./game");
const { MIN_PLAYER_NUM, MAX_PLAYER_NUM, SHIP_SETTING } = require("./constants");
const SHIP_COUNT = SHIP_SETTING.length;
const { makeid } = require("./utils");

const gameState = {};
const clientToRoom = {};
const roomToClient = {}; // value: [{id, nickname}, ...]

io.on("connection", (client) => {
  client.on("newWaitingRoom", handleNewWaitingRoom);
  client.on("joinWaitingRoom", handleJoinWaitingRoom);
  client.on("enterGame", handleEnterGame); // game not active yet
  client.on("getShipInfo", handleGetShipInfo);

  function handleNewWaitingRoom(nickname) {
    if (clientToRoom[client.id]) {
      client.emit("error", "啊咧？你已经在等待室里了……", false);
      return;
    }
    let gameCode = makeid(4);
    clientToRoom[client.id] = gameCode;
    roomToClient[gameCode] = [{ id: client.id, nickname: nickname }];

    client.join(gameCode);
    client.emit("enterWaitingRoom", {
      gameCode: gameCode,
      nicknameList: roomToClient[gameCode].map((c) => c.nickname),
      minPlayerNum: MIN_PLAYER_NUM,
      maxPlayerNum: MAX_PLAYER_NUM,
      isRoomMaster: roomToClient[gameCode][0].id === client.id,
    });
  }

  function handleJoinWaitingRoom({ gameCode, nickname }) {
    const room = io.sockets.adapter.rooms.get(gameCode);
    let numClients = room ? room.size : 0;
    if (numClients === 0) {
      client.emit("error", "找不到该房间号……", true);
      return;
    } else if (numClients >= MAX_PLAYER_NUM) {
      client.emit("error", "来晚了！该房间人数已满", true);
      return;
    }

    clientToRoom[client.id] = gameCode;
    roomToClient[gameCode].push({ id: client.id, nickname: nickname });

    client.join(gameCode);
    io.to(gameCode).emit("enterWaitingRoom", {
      gameCode: gameCode,
      nicknameList: roomToClient[gameCode].map((c) => c.nickname),
      minPlayerNum: MIN_PLAYER_NUM,
      maxPlayerNum: MAX_PLAYER_NUM,
    });
  }

  function handleGetShipInfo(shipNum) {
    if (shipNum < 0 || shipNum >= SHIP_COUNT) {
      client.emit("error", "啊咧？找不到该船只信息……", false);
      return;
    }
    client.emit("shipInfo", shipNum, SHIP_SETTING[shipNum]);
  }

  function handleEnterGame() {
    // console.log(clientToRoom, client.id);
    // console.log(clientToRoom.has(client.id));
    if (!clientToRoom[client.id]) {
      client.emit("error", "啊咧？你不在任何房间里，所以不能开始游戏……", true);
      return;
    }
    let room = clientToRoom[client.id];
    if (!roomToClient[room]) {
      client.emit("error", "啊咧？当前房间不存在，所以不能开始游戏……", true);
      return;
    }
    let clients = roomToClient[room];
    if (clients.length < MIN_PLAYER_NUM) {
      client.emit("error", "啊咧？人数还不够哦", false);
      return;
    }
    if (clients.length > MAX_PLAYER_NUM) {
      client.emit("error", "啊咧？当前房间人数已超过上限", true);
      return;
    }
    gameState[room] = initGameState(clients);
    io.to(room).emit("chooseShip");
  }

  client.on("disconnecting", () => {
    const rooms = client.rooms;
    for (r of rooms) {
      if (r === client.id) {
        continue;
      }
      if (roomToClient[r]) {
        roomToClient[r] = roomToClient[r].filter((c) => c.id !== client.id);
        client.to(r).emit("enterWaitingRoom", {
          minPlayerNum: MIN_PLAYER_NUM,
          nicknameList: roomToClient[r].map((c) => c.nickname),
        });

        // if room is not empty, update game master
        if (roomToClient[r].length !== 0) {
          io.to(roomToClient[r][0].id).emit("enterWaitingRoom", {
            isRoomMaster: true,
          });
        } else {
          delete roomToClient[r];
        }
      }
    }
    delete clientToRoom[client.id];
  });
});

// function startGameInterval(roomName) {
//   const intervalId = setInterval(() => {
//     const winner = gameLoop(state[roomName]);

//     if (!winner) {
//       emitGameState(roomName, state[roomName]);
//     } else {
//       emitGameOver(roomName, winner);
//       state[roomName] = null;
//       clearInterval(intervalId);
//     }
//   }, 1000 / FRAME_RATE);
// }

io.listen(3000);
