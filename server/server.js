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
const { validateShipDecision } = require("./game");
const { MIN_PLAYER_NUM, MAX_PLAYER_NUM, SHIP_SETTING } = require("./constants");
const SHIP_COUNT = SHIP_SETTING.length;
const { makeRoomID, shuffleArray } = require("./utils");

// stage - "waiting", "chooseShip", "chosenShip", "inGame"

const pidLookup = {}; // lookup from client id to player id
const players = {}; // pid -> {pid, cid, nickname, roomID, stage, ship }
const rooms = {}; // roomID -> array of playerIDs (based on enter order)

io.on("connection", (client) => {
  let cid = client.id;
  client.on("newWaitingRoom", handleNewWaitingRoom);
  client.on("joinWaitingRoom", handleJoinWaitingRoom);
  client.on("enterGame", handleEnterGame); // game not active yet
  client.on("getShipInfo", handleGetShipInfo);
  client.on("decideShip", handleDecideShip);
  client.on("chosenGhost", handleChosenGhost);

  function handleNewWaitingRoom(nickname) {
    if (toPID(cid)) {
      client.emit("error", "啊咧？你已经在等待室里了……", false);
      return;
    }

    let roomID = makeRoomID(4);
    while (rooms[roomID]) {
      roomID = makeRoomID(4);
    }
    let pid = "P" + cid;
    const player = {
      pid,
      cid,
      nickname,
      roomID,
      stage: "waiting",
    }; // current player object
    players[pid] = player;
    rooms[roomID] = [pid];
    pidLookup[cid] = pid;

    client.join(roomID);
    client.emit("enterWaitingRoom", {
      roomID,
      nicknameList: rooms[roomID].map((pid) => players[pid].nickname),
      minPlayerNum: MIN_PLAYER_NUM,
      maxPlayerNum: MAX_PLAYER_NUM,
      isRoomMaster: rooms[roomID][0] === pid,
    });
  }

  function handleJoinWaitingRoom({ roomID, nickname }) {
    const room = io.sockets.adapter.rooms.get(roomID);
    let numClients = room ? room.size : 0;
    if (numClients === 0) {
      client.emit("error", "找不到该房间号……", true);
      return;
    } else {
      // handle ghost reconnect
      if (rooms[roomID]) {
        const ghosts = rooms[roomID].filter((pid) => players[pid].ghosted);
        if (ghosts.length > 0) {
          client.emit("chooseGhost", {
            roomID,
            nicknameList: ghosts.map((pid) => players[pid].nickname),
          });
          return;
        }
      }
      if (numClients >= MAX_PLAYER_NUM) {
        client.emit("error", "来晚了！该房间人数已满", true);
        return;
      }
    }

    let pid = "P" + cid;
    const player = {
      pid,
      cid,
      nickname,
      roomID,
      stage: "waiting",
    }; // current player object
    players[pid] = player;
    rooms[roomID].push(pid);
    pidLookup[cid] = pid;

    client.join(roomID);
    io.to(roomID).emit("enterWaitingRoom", {
      roomID,
      nicknameList: rooms[roomID].map((pid) => players[pid].nickname),
      minPlayerNum: MIN_PLAYER_NUM,
      maxPlayerNum: MAX_PLAYER_NUM,
    });
  }

  function handleGetShipInfo(shipNum) {
    if (isNaN(shipNum) || shipNum < 0 || shipNum >= SHIP_COUNT) {
      client.emit("error", "啊咧？找不到该船只信息……", false);
      return;
    }
    client.emit("shipInfo", shipNum, SHIP_SETTING[shipNum]);
  }

  function handleEnterGame() {
    const player = validateConncetionInRoom();
    if (!player) {
      return;
    }
    if (rooms[player.roomID].length < MIN_PLAYER_NUM) {
      client.emit("error", "啊咧？人数还不够哦", false);
      return;
    }
    if (rooms[player.roomID].length > MAX_PLAYER_NUM) {
      client.emit("error", "啊咧？当前房间人数已超过上限", true);
      return;
    }
    shuffleArray(rooms[player.roomID]); // action turn order
    for (const pid of rooms[player.roomID]) {
      players[pid].stage = "chooseShip";
    }
    io.to(player.roomID).emit("chooseShip", {
      totalPlayerCount: rooms[player.roomID].length,
      roomID: player.roomID,
    });
  }

  function handleDecideShip({ shipNum, width, height, row, col }) {
    const [msg, reset] = validateShipDecision(shipNum, width, height, row, col);
    if (msg) {
      client.emit("error", msg, reset);
    }
    const player = validateConncetionInRoom();
    if (!player) {
      return;
    }
    player.ship = { shipNum, width, height, row, col };

    updateReadyPlayerCount(player);
  }

  client.on("disconnecting", () => {
    // console.log("toPID", toPID(cid));
    if (!toPID(cid)) {
      return;
    }
    const player = players[toPID(cid)]; // current player
    // console.log("player", player, player.roomID);
    if (!player || !player.roomID) {
      return;
    }
    if (player.stage === "waiting") {
      if (!rooms[player.roomID]) {
        return;
      }
      rooms[player.roomID] = rooms[player.roomID].filter(
        (pid) => pid !== player.pid
      );
      if (rooms[player.roomID].length > 0) {
        client.to(player.roomID).emit("enterWaitingRoom", {
          minPlayerNum: MIN_PLAYER_NUM,
          nicknameList: rooms[player.roomID].map(
            (pid) => players[pid].nickname
          ),
        });
        io.to(players[rooms[player.roomID][0]].cid).emit("enterWaitingRoom", {
          isRoomMaster: true,
        });
      } else {
        delete rooms[player.roomID];
      }
      delete pidLookup[player.pid];
      delete players[player.pid];
    } else {
      player.ghosted = true;
      if (player.stage === "chosenShip") {
        updateReadyPlayerCount(player);
      }
    }
  });

  function handleChosenGhost({ roomID, nickname }) {
    if (!roomID || !rooms[roomID]) {
      client.emit("error", "啊咧？房间不存在", true);
      return;
    }
    const ghosts = rooms[roomID].filter((pid) => players[pid].ghosted);
    const ghostIndex = ghosts.findIndex(
      (pid) => players[pid].nickname === nickname
    );
    if (ghostIndex < 0) {
      client.emit("error", "啊咧？选择的昵称不存在", true);
      return;
    }
    const player = players[ghosts[ghostIndex]];
    if (!player) {
      client.emit("error", "啊咧？玩家不存在", true);
      return;
    }
    client.emit("restore", )
    console.log(+"重连");
  }

  function validateConncetionInRoom() {
    const pid = toPID(cid);
    if (!pid) {
      client.emit("error", "啊咧？玩家不存在", true);
      return;
    }
    const player = players[pid]; // current player
    if (!player || !player.roomID || !rooms[player.roomID]) {
      client.emit("error", "啊咧？你好像不在房间里……", true);
      return;
    }
    return player;
  }

  function updateReadyPlayerCount(player) {
    const readyPlayerCount = rooms[player.roomID].filter(
      (pid) => !players[pid].ghosted && players[pid].ship
    ).length;
    const totalPlayerCount = rooms[player.roomID].length;
    // if (readyPlayerCount === totalPlayerCount) {
    //   // if everyone has chosen ship and no one disconnected, start!
    //   for (const pid of rooms[player.roomID]) {
    //     players[pid].stage = "inGame";
    //   }
    //   io.to(player.roomID).emit("startGame", "good!");
    // } else {
    player.stage = "chosenShip";
    for (const pid of rooms[player.roomID].filter(
      (pid) => players[pid].stage === "chosenShip"
    )) {
      io.to(players[pid].cid).emit(
        "chosenShip",
        readyPlayerCount,
        totalPlayerCount
      );
    }
  }
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

function toPID(cid) {
  return pidLookup[cid];
}
