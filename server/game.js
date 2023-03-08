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
    attackHistory: [],
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
      actualItems: {},
      shipID: null,
      dizzy: false, // 眩晕状态
    })),
  };
}

function startGame(game) {
  initNotif({ game, title: "第一轮开始" });
  updateNoGo(game); //debug
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
  newWeather = WEATHER.filter((w) => w.name === "雷雨")[0];
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
  player.actualItems = undefined;
  return player;
}

function getShip(game, player) {
  if (
    !player.shipID ||
    !game.objects[player.shipID] ||
    game.objects[player.shipID].typeName != "boat"
  )
    return;
  return game.objects[player.shipID];
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

function updateNoGo(game) {
  const currNoGoNum = game.board.noGo.rows.length + game.board.noGo.cols.length;
  let notifStr = "";
  if (currNoGoNum < MAX_NOGO_NUM) {
    const [rowMin, rowMax] = getMinMaxExclude(1, 8, game.board.noGo.rows);
    const [colMin, colMax] = getMinMaxExclude(1, 8, game.board.noGo.cols);
    let noGoPatterns = [
      [
        { row: [rowMin, rowMin + 1] },
        { row: [rowMax - 1, rowMax] },
        { col: [colMin, colMin + 1] },
        { col: [colMax - 1, colMax] },
        { row: [rowMin, rowMin], col: [colMin, colMin] },
        { row: [rowMin, rowMin], col: [colMax, colMax] },
        { row: [rowMax, rowMax], col: [colMin, colMin] },
        { row: [rowMax, rowMax], col: [colMax, colMax] },
      ],
      [
        { row: [rowMin, rowMin] },
        { row: [rowMax, rowMax] },
        { col: [colMin, colMin] },
        { col: [colMax, colMax] },
      ],
      [{}],
    ];
    let noGoWeights = [0.8, 0.15, 0.05]; // 80% probability generate two no-go columns
    for (let i = noGoPatterns.length - 2; i >= 0; --i) {
      for (let j = noGoPatterns[i].length - 1; j >= 0; --j) {
        if (conflictWithBoat(game, noGoPatterns[i][j])) {
          noGoPatterns[i].splice(j, 1);
        }
      }
      if (noGoPatterns[i].length === 0) {
        noGoPatterns.splice(i, 1);
        noGoWeights.splice(i, 1);
      }
    }
    const newNoGoPattern = weightedRandom(noGoPatterns, noGoWeights);
    const newNoGo = weightedRandom(
      newNoGoPattern,
      Array(newNoGoPattern.length).fill(1)
    );

    const { row, col } = newNoGo;
    if (row) {
      for (let r = row[0]; r <= row[1]; ++r) {
        notifStr += (notifStr.length === 0 ? "" : "、") + `第${r}行`;
        game.board.noGo.rows.push(r);
      }
    }
    if (col) {
      for (let c = col[0]; c <= col[1]; ++c) {
        notifStr += (notifStr.length === 0 ? "" : "、") + `第${toLetter(c)}列`;
        game.board.noGo.cols.push(c);
      }
    }
  }
  if (notifStr.length > 0) {
    addNotif({ game, title: "禁区", msg: notifStr + "已被设为禁区。" });
  } else {
    addNotif({ game, title: "禁区", msg: "本轮没有新禁区。" });
  }
}

function conflictWithBoat(game, { row, col }) {
  if (row) {
    if (
      Object.values(game.objects).filter(
        (o) =>
          o.typeName === "boat" &&
          intersect(o.row, o.row + o.height - 1, row[0], row[1])
      ).length > 0
    )
      return true;
  }
  if (col) {
    if (
      Object.values(game.objects).filter(
        (o) =>
          o.typeName === "boat" &&
          intersect(o.col, o.col + o.width - 1, col[0], col[1])
      ).length > 0
    )
      return true;
  }
  return false;
}

// utils

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min) + min); // [min, max)
}

function shuffleArray(array) {
  return array.sort(() => 0.5 - Math.random());
}

function weightedRandom(items, weights) {
  if (items.length === 0) return null;
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
  if (!arr) return null;
  return arr[arr.length - 1];
}

function intersect(lo1, hi1, lo2, hi2) {
  if (hi1 < lo2) return false;
  if (hi2 < lo1) return false;
  return true;
}

function getMinMaxExclude(start, end, exclude) {
  let min, max;
  for (let i = start; i <= end; ++i) {
    if (exclude.includes(i)) continue;
    min = i;
    break;
  }
  for (let i = end; i >= start; --i) {
    if (exclude.includes(i)) continue;
    max = i;
    break;
  }
  return [min, max];
}

function getDiagDist(r1, c1, r2, c2) {
  return Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2));
}

function fetchGameAndPlayer(games, p) {
  const game = games[p.roomID];
  if (!game) return [null, null, "啊咧？当前房间号对应的游戏不存在……"];
  const playerIndex = game.players.findIndex((e) => e.pid === p.pid);
  if (playerIndex < 0) return [null, null, "啊咧？游戏中找不到当前玩家"];
  return [game, game.players[playerIndex], null];
}

function fetchPhase(game, phaseID) {
  if (!game.phases) return [null, "啊咧？当前游戏没有阶段"];
  if (lastElem(game.phases).phaseID != phaseID)
    return [null, "啊咧？无匹配阶段"];
  const phase = lastElem(game.phases);
  if (Date.now() > phase.startTime + phase.duration * 1000)
    return [null, "操作超时"];
  return [phase, null];
}

function fetchShip(game, player) {
  if (!player.shipID) return [null, "啊咧？当前玩家没有船只"];
  if (!game.objects[player.shipID]) return [null, "啊咧？找不到当前玩家的船只"];
  if (game.objects[player.shipID].typeName != "boat")
    return [null, "啊咧？当前玩家的船只类型异常"];
  return [game.objects[player.shipID], null];
}

// attack logic

function verifyAttack({ game, phase, player, type, mode, target }) {
  if (player.dizzy) return "眩晕状态下不可攻击";
  let err = verifyAttackInputParams({ type, mode, target });
  if (err) return err;
  err = verifyCurrentTurn({ phase, player });
  if (err) return err;
  let ship;
  [ship, err] = fetchShip(game, player);
  if (err) return err;
  err = verifyAttackNum({ ship, type });
  if (err) return err;
  err = verifyAttackDist({ ship, type, mode, target });
  if (err) return err;
  let str; // 攻击目标字符串化
  [str, err] = verifyAttackTarget({ game, ship, mode, target });
  if (err) return err;

  // 攻击生效
  const atkDamage = getAttackDamage({ game });
  const atkPositions = getAttackPositions({ mode, target });
  ship.attackHistory.push({ mode, str });
  proceedAttack({
    game,
    atkSource: ship,
    atkPattern: "boat",
    atkMethod: "normal",
    atkItem: player.items,
    atkDamage,
    atkPositions,
  }); // todo 攻击方式
}

function verifyAttackInputParams({ type, mode, target }) {
  if (!["cannon", "torpedo", "aircraft"].includes(type))
    return "未知的攻击方式";
  if (!target) return "没有攻击坐标";
  const { row, col } = { ...target };
  if (mode === "row") {
    if (isNaN(row)) return "攻击行数未知";
    target = { row };
  } else if (mode === "col") {
    if (isNaN(col)) return "攻击列数未知";
    target = { col };
  } else {
    if (isNaN(target.row) || isNaN(target.col)) return "攻击坐标无效";
    target = { row, col };
  }
}

function verifyCurrentTurn({ phase, player }) {
  // log(phase);
  // log(player);
  if (
    phase.type != "turn" ||
    !phase.turnOwner ||
    phase.turnOwner.pid != player.pid
  )
    return "不是当前玩家的回合";
}

function verifyAttackNum({ ship, type }) {
  if (!ship.attack || !ship.attack[type]) return "剩余攻击次数不足";
}

function verifyAttackDist({ ship, type, mode, target }) {
  let currDist;
  if (mode === "row") {
    currDist = Math.abs(ship.row - target.row);
  } else if (mode === "col") {
    currDist = Math.abs(ship.col - target.col);
  } else {
    currDist = getDiagDist(ship.row, ship.col, target.row, target.col);
  }
  if (!ship.attackDist || !ship.attackDist[type]) return "找不到攻击距离";
  if (currDist > ship.attackDist[type]) return "超出攻击距离";
}

function verifyAttackTarget({ game, ship, mode, target }) {
  const str = JSON.stringify(target);
  const sameMode = ship.attackHistory.filter((h) => h.mode === mode);
  const sameTarget = sameMode.filter((h) => h.str === str);
  if (sameTarget.length > 0) return [null, "本回合已攻击过该坐标"];
  if (
    (target.row && game.board.noGo.rows.includes(target.row)) ||
    (target.col && game.board.noGo.cols.includes(target.col))
  )
    return [null, "攻击坐标不应在禁区中"];
  return [str, null];
}

function proceedAttack({
  game,
  atkSource,
  atkPattern,
  atkMethod,
  atkItem,
  atkDamage,
  atkPositions,
}) {
  const atkList = getAttackedList({ game, atkPositions });
  
}

function getAttackDamage({ game }) {
  let res = 1;
  if (game.board.weather === "满月") res++;
  // todo 暴击
  return res;
}

function getAttackPositions({ game, mode, target }) {
  const { row, col } = target;
  let res = [];
  let [rowStart, rowEnd, colStart, colEnd] = [row, row, col, col];
  if (mode === "row") [colStart, colEnd] = [1, 8];
  else if (mode === "col") [rowStart, rowEnd] = [1, 8];
  else if (mode === "3by3") [rowEnd, colEnd] = [row + 2, col + 2];
  for (let r = rowStart; r <= rowEnd; r++)
    for (let c = colStart; c <= colEnd; c++) {
      if (r < 1 || r > 8 || c < 1 || c > 8) continue;
      if (game.board.noGo.rows.includes(r) || game.board.noGo.cols.includes(c))
        continue;
      res.push([r, c]);
    }
  return res;
}

function getAttackedList({ game, atkPositions }) {
  let res = [];
  for (const obj of game.objects)
    if (isHit(obj.row, obj.col, obj.width, obj.height, atkPositions))
      res.push(obj);
  const typeNameOrder = ["fish", "bomb", "boat"];
  res.sort((a, b) => {
    if (a.typeName != b.typeName)
      return (
        typeNameOrder.findIndex(a.typeName) -
        typeNameOrder.findIndex(b.typeName)
      );
    if (a.typeName === "fish") {
      if (a.row < b.row || (a.row === b.row && a.col < b.col)) return -1;
      else return 1;
    }
    if (a.typeName === "boat") {
      return (
        game.playeres.findIndex((p) => p.pid === a.pid) -
        game.playeres.findIndex((p) => p.pid === b.pid)
      );
    }
    return -1;
  });
}

function isHit(row, col, width, height, atkPositions) {
  for (const p of atkPositions)
    if (
      row <= p.row &&
      p.row < row + height &&
      col <= p.col &&
      p.col < col + width
    )
      return true;
}

/* eslint-disable */
function log(...objList) {
  for (const obj of objList) console.log(JSON.stringify(obj, null, 2));
}
/* eslint-enable */

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
  getShip,
  fetchGameAndPlayer,
  fetchPhase,
  verifyAttack,
  log,
};
