module.exports = {
  validateShipDecision,
  makeRoomID,
  linkShip,
  initGame,
  startGame,
  lastElem,
  startInTurn,
  getPhase,
  getPlayer,
};

const {
  SHIP_SETTING,
  MAX_NOGO_NUM,
  GAME_START_FISH_NUM,
  WEATHER,
  WEATHER_WEIGHT_NORMAL,
  WEATHER_WEIGHT_COLD,
  SHORT_WAIT_TIME,
  SHOP_TIME,
  TURN_TIME,
  INFO_TIME,
} = require("./constants");

function validateShipDecision(shipNum, width, height, row, col) {
  if (isNaN(shipNum) || shipNum < 0 || shipNum >= SHIP_SETTING.length) {
    return ["啊咧？所选船只不存在", false];
  }
  if (
    width != SHIP_SETTING[shipNum].width &&
    height != SHIP_SETTING[shipNum].height
  ) {
    if (
      height != SHIP_SETTING[shipNum].width &&
      width != SHIP_SETTING[shipNum].height
    ) {
      return ["啊咧？所选船只体积有误", false];
    }
  }
  if (
    !row ||
    !col ||
    row < 1 ||
    row + height > 9 ||
    col < 1 ||
    col + width > 9
  ) {
    return ["啊咧？所选船只位置有误", false];
  }
  return [null, null];
}

function makeID(length, onlyNumbers) {
  let result = "";
  let characters = onlyNumbers
    ? "0123456789"
    : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function makeRoomID(rooms) {
  let roomID = makeID(4, true);
  while (rooms[roomID]) roomID = makeID(4, true);
  return roomID;
}

function makeObjectID(objects) {
  let objectID = makeID(8, false);
  while (objects[objectID]) objectID = makeID(8, false);
  return objectID;
}

function makePhaseID(phases) {
  let phaseID = makeID(12, false);
  while (phases.filter((p) => p.phaseID === phaseID).length > 0)
    phaseID = makeID(12, false);
  return phaseID;
}

function linkShip(games, player, { shipNum, width, height, row, col }) {
  const game = games[player.roomID];
  const newShipID = makeObjectID(game.objects);
  game.objects[newShipID] = {
    pid: player.pid,
    typeName: "boat",
    typeNum: shipNum,
    shipName: SHIP_SETTING[shipNum].name,
    row,
    col,
    width,
    height,
    attack: {
      cannon: SHIP_SETTING[shipNum].cannon,
      torpedo: SHIP_SETTING[shipNum].torpedo,
      aircraft: SHIP_SETTING[shipNum].aircraft,
    },
    attackMax: {
      cannon: SHIP_SETTING[shipNum].cannon,
      torpedo: SHIP_SETTING[shipNum].torpedo,
      aircraft: SHIP_SETTING[shipNum].aircraft,
    },
    attackDist: {
      cannon: Infinity,
      torpedo: 1,
      aircraft: Infinity,
    },
    attackArea: {
      cannon: "normal", // normal, rowcol, 3by3
      torpedo: "normal",
      aircraft: "normal",
    },
    actualAircraftNum: SHIP_SETTING[shipNum].aircraft,
    aircraftDetect: SHIP_SETTING[shipNum].aircraft,
    aircraftDetectDist: Infinity,
    speed: SHIP_SETTING[shipNum].speed,
    speedMax: SHIP_SETTING[shipNum].speed,
    health: SHIP_SETTING[shipNum].health,
    skills: SHIP_SETTING[shipNum].skills.map((s) => s.skillName),
  };
  for (const p of game.players) {
    if (p.pid === player.pid) {
      p.shipID = newShipID;
      break;
    }
  }
}

function linkFish(game, row, col) {
  const objectID = makeObjectID(game.objects);
  game.objects[objectID] = {
    typeName: "fish",
    row,
    col,
    width: 1,
    height: 1,
    health: 1,
  };
}

function initGame(players, playerList) {
  return {
    objects: {},
    phases: [],
    board: {
      noGo: { rows: [], cols: [] },
      weather: "",
      roundNum: 1,
    },
    notif: { log: "", curr: "" },
    players: shuffleArray(playerList).map((pid, idx) => ({
      pid,
      startingIndex: idx,
      nickname: players[pid].nickname,
      moral: 0, // 起始节操为0
      items: {},
      shipID: null,
      dizzy: false, // 眩晕状态
    })),
  };
}

function startGame(game) {
  initNotif({ game, title: "第一轮开始" });
  updateNoGo(game);
  generateFish(game, GAME_START_FISH_NUM.min, GAME_START_FISH_NUM.max);
  initNewRound({ game, skipUpdateNoGo: true });
  game.phases.push({
    phaseID: makePhaseID(game.phases),
    type: "wait", // wait, shop, turn
    startTime: Date.now(),
    duration: SHORT_WAIT_TIME,
    modal: { title: "通报", msg: game.notif.curr, duration: INFO_TIME },
    hint: "第一轮开始",
    nextPhase: { intent: "inTurn", pid: game.players[0].pid },
    startGame: true,
    items: {},
  });
}

function startInTurn(game, pid) {
  const playerIndex = game.players.findIndex((p) => p.pid === pid);
  if (playerIndex < 0) return;
  const player = game.players[playerIndex];
  const nickname = game.players[playerIndex].nickname;
  if (game.board.roundNum === 1 && playerIndex === 0) {
    initNotif({ game, title: `${nickname}的回合` });
    addNotif({ game, msg: `${playerIndex + 1}号玩家${nickname}的回合开始。` });
    replenishAircraft(game, player);
  }
  updateAttackAndSpeed(game);
  game.phases.push({
    phaseID: makePhaseID(game.phases),
    type: "turn",
    turnOwner: { pid, nickname },
    startTime: Date.now(),
    duration: TURN_TIME,
    modal: game.notif.curr
      ? { title: "通报", msg: game.notif.curr, duration: INFO_TIME }
      : null,
    hint: `${nickname}的回合(${playerIndex + 1}/${game.players.length})`,
    nextPhase: { intent: "turnEnd", pid },
  });
}

function replenishAircraft(game, player) {
  const ship = game.objects[player.shipID];
  if (
    ship &&
    ship.attackMax.aircraft &&
    ship.actualAircraftNum < ship.attackMax.aircraft
  ) {
    ship.actualAircraftNum++;
  }
}

function initNewRound({ game, skipUpdateNoGo }) {
  if (!skipUpdateNoGo) updateNoGo(game);
  updateWeather(game);
  updateAttackAndSpeed(game);
}

function updateWeather(game) {
  let newWeather;
  if (game.board.weather === "寒潮") {
    newWeather = weightedRandom(WEATHER, WEATHER_WEIGHT_COLD);
  } else {
    newWeather = weightedRandom(WEATHER, WEATHER_WEIGHT_NORMAL);
  }
  // debug
  newWeather = WEATHER[1];
  game.board.weather = newWeather.name;
  addNotif({
    game,
    title: "天气",
    msg: `新天气为<span class="text-info">${newWeather.name}</span>：${newWeather.description}`,
  });
  updateInstantWeatherEffect(game, newWeather.name);
}

function updateInstantWeatherEffect(game, weather) {
  if (weather === "赤潮") {
    generateFish(game, 2, 3);
  } else if (weather === "星夜") {
    for (let p of game.players) {
      p.moral += 50;
    }
  } else if (weather === "极光" || weather === "满月") {
    for (let o of Object.values(game.objects)) {
      if (o.typeName === "boat") o.health += 1;
    }
  }
}

function updateNoGo(game) {
  const currNoGoNum = game.board.noGo.rows.length + game.board.noGo.cols.length;
  if (currNoGoNum >= MAX_NOGO_NUM) {
    return;
  }
  let possibleNoGos = [
    ...generatePossibleNoGos("row", game.board.noGo.rows),
    ...generatePossibleNoGos("col", game.board.noGo.cols),
  ];
  possibleNoGos = possibleNoGos.filter((e) => {
    if (e.type === "row") {
      return (
        Object.values(game.objects).filter(
          (o) =>
            o.typeName === "boat" && o.row <= e.num && e.num <= o.row + o.height
        ).length === 0
      );
    } else {
      return (
        Object.values(game.objects).filter(
          (o) =>
            o.typeName === "boat" && o.col <= e.num && e.num <= o.col + o.width
        ).length === 0
      );
    }
  });
  possibleNoGos = shuffleArray(possibleNoGos).slice(0, 2);
  possibleNoGos.sort((a, b) => {
    a.type < b.type || (a.type === b.type && a.num > b.num) ? 1 : -1;
  });
  let notifStr = "";
  for (const noGo of possibleNoGos) {
    if (noGo.type === "row") {
      notifStr += (notifStr.length === 0 ? "" : "、") + `第${noGo.num}行`;
      game.board.noGo.rows.push(noGo.num);
    } else if (noGo.type === "col") {
      notifStr +=
        (notifStr.length === 0 ? "" : "、") + `第${toLetter(noGo.num)}列`;
      game.board.noGo.cols.push(noGo.num);
    }
  }
  if (notifStr.length > 0) {
    addNotif({ game, title: "禁区", msg: notifStr + "已被设为禁区。" });
  }
}

function generatePossibleNoGos(type, currNoGos) {
  let possibleNoGos = Array.from(Array(9).keys())
    .slice(1)
    .filter((e) => !currNoGos.includes(e));
  if (possibleNoGos.length === 0) {
    return [];
  } else if (possibleNoGos.length === 1) {
    return [{ type, num: possibleNoGos[0] }];
  } else {
    return [
      { type, num: possibleNoGos[0] },
      { type, num: possibleNoGos[possibleNoGos.length - 1] },
    ];
  }
}

function updateAttackAndSpeed(game) {
  for (let player of game.players) {
    if (!player.shipID || !game.objects[player.shipID]) continue;
    let ship = game.objects[player.shipID];
    ship.attack.cannon = getCannonAtkNum(game, player, ship);
    ship.attack.torpedo = getTorpedoAtkNum(game, player, ship);
    ship.attack.aircraft = getAircraftAtkNum(game, player, ship);
    ship.aircraftDetect = ship.attack.aircraft;
    ship.attackDist = getAttackDist(game);
    ship.attackArea = getAttackArea(game, player);
    ship.aircraftDetectDist = getAircraftDetectDist(game);
    ship.speed = getSpeed(game, player, ship);
  }
}

function getCannonAtkNum(game, player, ship) {
  if (!ship.attackMax.cannon) return 0;
  if (player.dizzy) return 0;
  if (game.board.weather === "暴雨") return 1;
  if (game.board.roundNum === 1) return 1;
  let res = ship.attackMax.cannon;
  if (game.board.weather === "满月") res++;
  return res;
}

function getTorpedoAtkNum(game, player, ship) {
  if (!ship.attackMax.torpedo) return 0;
  if (player.dizzy) return 0;
  let res = ship.attackMax.torpedo;
  if (game.board.weather === "满月") res++;
  return res;
}

function getAircraftAtkNum(game, player, ship) {
  if (!ship.attackMax.aircraft) return 0;
  if (player.dizzy) return 0;
  if (game.board.weather === "暴雨") return 1;
  return ship.actualAircraftNum;
}

function getSpeed(game, player, ship) {
  if (
    game.board.weather === "冻结" &&
    ship.shipName != "潜水艇" &&
    ship.shipName != "破冰船" &&
    ship.shipName != "幽灵船"
  ) {
    return 0;
  }
  if (game.board.weather === "满月") return Infinity;
  let res = ship.speedMax;
  if (game.board.weather === "暴雨") res--;
  if (game.board.weather === "顺风") res++;
  if (player.items["发动机"]) res += 2;
  if (player.items["重型装甲"] && !player.items["重型装甲"].damaged) res -= 2;
  res = Math.max(res, 0);
  return res;
}

function getAttackDist(game) {
  return {
    cannon: game.board.weather === "浓雾" ? 1 : Infinity,
    torpedo: 1,
    aircraft: game.board.weather === "浓雾" ? 1 : Infinity,
  };
}

function getAttackArea(game, player) {
  if (player.items["雷雨弹"]) {
    return { cannon: "3by3", torpedo: "3by3", aircraft: "3by3" };
  } else if (player.items["辣椒弹"]) {
    return { cannon: "rowcol", torpedo: "rowcol", aircraft: "rowcol" };
  }
  let cannon, torpedo, aircraft;
  cannon = torpedo = aircraft = "normal";
  if (game.board.weather === "雷雨") cannon = "3by3";
  if (game.board.weather === "晴天") aircraft = "rowcol";
  return { cannon, torpedo, aircraft };
}

function getAircraftDetectDist(game) {
  return game.board.weather === "浓雾" ? 1 : Infinity;
}

// Hide sensitive info
function getPhase(game, pid) {
  if (!game.phases) return;
  let phase = { ...lastElem(game.phases) };
  phase.nextPhase = undefined;
  if (phase.turnOwner) {
    phase.isTurnOwner = pid === phase.turnOwner.pid;
    phase.turnOwner = undefined;
  }
  return phase;
}

function getPlayer(game, pid) {
  if (!game.players) return;
  const index = game.players.findIndex((p) => p.pid === pid);
  if (index < 0) return;
  let player = game.players[index];
  if (!player.shipID || !game.objects[player.shipID]) return;
  player = { ...player, ship: { ...game.objects[player.shipID] } };
  player.shipID = undefined;
  player.ship.pid = undefined;
  player.ship.actualAircraftNum = undefined;
  player.pid = undefined;
  return player;
}

// [min, max]
function generateFish(game, min, max) {
  const fishNum = getRandomInt(min, max + 1);
  for (let i = 0; i < fishNum; i++) {
    let [row, col] = [getRandomInt(1, 9), getRandomInt(1, 9)];
    while (
      game.board.noGo.rows.includes(row) ||
      game.board.noGo.cols.includes(col)
    ) {
      [row, col] = [getRandomInt(1, 9), getRandomInt(1, 9)];
    }
    linkFish(game, row, col);
  }
}

function addNotif({ game, title, msg }) {
  let str = "<p>";
  if (title) str += `【${title}】`;
  str += `${msg}</p>`;
  game.notif.curr += str;
  game.notif.log += str;
}

function initNotif({ game, title }) {
  game.notif.curr = `<h4>${title}</h4>`;
  game.notif.log += `<h4>${title}</h4>`;
}

// utils

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min) + min); // [min, max)
}

function shuffleArray(array) {
  return array.sort(() => 0.5 - Math.random());
}

function weightedRandom(items, weights) {
  const cumulativeWeights = [];
  for (let i = 0; i < weights.length; i += 1) {
    cumulativeWeights[i] = weights[i] + (cumulativeWeights[i - 1] || 0);
  }
  const maxCumulativeWeight = cumulativeWeights[cumulativeWeights.length - 1];
  const randomNumber = maxCumulativeWeight * Math.random();
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    if (cumulativeWeights[itemIndex] >= randomNumber) {
      return items[itemIndex];
    }
  }
}

function toLetter(num) {
  return String.fromCharCode("A".charCodeAt(0) + num - 1);
}

function lastElem(arr) {
  return arr[arr.length - 1];
}
