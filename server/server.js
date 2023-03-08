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
const {
  log,
  validateShipDecision,
  makeRoomID,
  linkShip,
  startGame,
  initGame,
  lastElem,
  startInTurn,
  getPhase,
  getPlayer,
  fetchGameAndPlayer,
  fetchPhase,
  verifyAttack,
} = require("./game");
const {
  MIN_PLAYER_NUM,
  MAX_PLAYER_NUM,
  SHIP_SETTING,
  ITEM_SETTING,
} = require("./constants");

// stage - "waiting", "chooseShip", "chosenShip", "inGame"

const sockets = {};
const pidLookup = {}; // lookup from client id to player id
const players = {}; // pid -> {pid, cid, nickname, roomID, stage, ghosted }
const rooms = {}; // roomID -> array of playerIDs (based on enter order)
const games = {}; // roomID -> {objects, phases}

io.on("connection", (client) => {
  let cid = client.id;
  sockets[cid] = client;
  client.on("newWaitingRoom", handleNewWaitingRoom);
  client.on("joinWaitingRoom", handleJoinWaitingRoom);
  client.on("enterGame", handleEnterGame); // game not active yet
  client.on("getShipSetting", (shipNum) =>
    client.emit("shipSetting", SHIP_SETTING, shipNum)
  );
  client.on("getItemSetting", (itemNum) => {
    client.emit("itemSetting", ITEM_SETTING, itemNum);
  });
  client.on("decideShip", handleDecideShip);
  client.on("chosenGhost", handleChosenGhost);
  client.on("makeAttack", handleMakeAttack);

  function handleNewWaitingRoom(nickname) {
    if (toPID(cid)) {
      client.emit("error", "啊咧？你已经在等待室里了……", false);
      return;
    }

    let roomID = makeRoomID(rooms);
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
      isRoomMaster: true,
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
    gameLog(player.roomID, `${cid} 进入等待室`);
  }

  function handleEnterGame() {
    const player = validateConncetionInRoom();
    if (!player) {
      return;
    }
    if (rooms[player.roomID][0] != player.pid) {
      client.emit("error", "啊咧？只有房主能开始游戏", false);
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
    games[player.roomID] = initGame(players, rooms[player.roomID]);
    for (const pid of rooms[player.roomID]) {
      players[pid].stage = "chooseShip";
    }
    io.to(player.roomID).emit("chooseShip", {
      totalPlayerCount: rooms[player.roomID].length,
      roomID: player.roomID,
      SHIP_SETTING,
      ITEM_SETTING,
    });
    gameLog(player.roomID, `${cid} 开始游戏`);
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
    linkShip(games, player, { shipNum, width, height, row, col });
    player.stage = "chosenShip";

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
      delete pidLookup[cid];
      if (
        !rooms[player.roomID] ||
        rooms[player.roomID].filter((pid) => !players[pid].ghosted).length === 0
      ) {
        // All ghosted, delete rooom
        for (const pid of rooms[player.roomID]) {
          delete pidLookup[pid];
          delete players[pid];
        }
        delete rooms[player.roomID];
      } else if (player.stage === "chosenShip") {
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
    player.ghosted = false;
    player.cid = cid;
    pidLookup[cid] = player.pid;
    client.emit("restore", {
      ...player,
      totalPlayerCount: rooms[roomID].length,
      SHIP_SETTING,
    });
    updateReadyPlayerCount(player);
    console.log(player.nickname + " 重连成功");
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
      (pid) => !players[pid].ghosted && players[pid].stage === "chosenShip"
    ).length;
    const totalPlayerCount = rooms[player.roomID].length;
    if (readyPlayerCount >= totalPlayerCount) {
      for (const pid of rooms[player.roomID]) {
        players[pid].stage = "inGame";
      }
      startGame(games[player.roomID]);
      emitPhase(player.roomID);
    } else {
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
  }

  function handleMakeAttack({ phaseID, type, mode, target }) {
    const p = validateConncetionInRoom();
    if (!p) return;
    let game, player, phase, err;
    [game, player, err] = fetchGameAndPlayer(games, p);
    if (err) {
      client.emit("error", err, false);
      return;
    }
    [phase, err] = fetchPhase(game, phaseID);
    if (err) {
      client.emit("error", err, false);
      return;
    }
    err = verifyAttack({game, phase, player, type, mode, target});
    if (err) {
      client.emit("error", err, false);
      return;
    }
    gameLog(
      player.roomID,
      `${player.pid}使用${type}对${JSON.stringify(target)}攻击成功`
    );
  }

  async function waitAndFire(roomID) {
    if (
      !games[roomID] ||
      !games[roomID].phases ||
      !lastElem(games[roomID].phases).duration
    ) {
      io.to(roomID).emit("error", "啊咧？找不到当前阶段", false);
      return;
    }
    let phase = lastElem(games[roomID].phases);
    const duration = phase.duration;
    gameLog(roomID, `${phase.type} ${phase.hint} 开始，持续${duration}秒`);
    await new Promise((resolve) => setTimeout(resolve, duration * 1000));
    if (
      !games[roomID] ||
      !games[roomID].phases ||
      !lastElem(games[roomID].phases).nextPhase
    ) {
      io.to(roomID).emit("error", "啊咧？找不到当前阶段", false);
      return;
    }
    if (lastElem(games[roomID].phases) != phase) {
      gameLog(
        roomID,
        `异常出现新阶段：${lastElem(games[roomID].phases).type} ${
          lastElem(games[roomID].phases).hint
        }`
      );
      return;
    }
    const nextPhase = phase.nextPhase;
    if (nextPhase.intent === "inTurn") {
      startInTurn(games[roomID], nextPhase.pid);
      emitPhase(roomID);
    } else {
      gameLog(roomID, `${phase.type} ${phase.hint} 后没有下一阶段，游戏结束`);
      return;
    }
  }

  function emitPhase(roomID) {
    const game = games[roomID];
    if (!game) {
      io.to(roomID).emit("error", "啊咧？无法找到游戏房间", true);
      return;
    }
    const board = game.board;
    for (const { pid } of games[roomID].players) {
      const [phase, player] = [getPhase(game, pid), getPlayer(game, pid)];
      if (!phase || !board || !player) {
        io.to(roomID).emit("error", "啊咧？获取游戏信息失败", true);
        return;
      }
      if (phase.done) {
        gameLog(roomID, `当前阶段 ${phase.type} ${phase.hint} 已完成`);
        return;
      }
      const targetCID = toCID(pid);
      if (!targetCID || !sockets[targetCID]) {
        gameLog(roomID, `未能发送至 ${targetCID}`);
        return;
      }
      sockets[targetCID].emit("updateGame", { phase, board, player });
    }
    gameLog(
      roomID,
      `开始 ${lastElem(game.phases).type} ${lastElem(game.phases).hint}`
    );
    game.phases[game.phases.length - 1].done = true;
    waitAndFire(roomID);
  }
});

io.listen(3000);

function toPID(cid) {
  return pidLookup[cid];
}

function toCID(pid) {
  return Object.keys(pidLookup).find((key) => pidLookup[key] === pid);
}

function gameLog(roomID, msg) {
  console.log(`${new Date().toUTCString()} [${roomID}] ${msg}`);
}
