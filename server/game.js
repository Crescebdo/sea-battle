module.exports = {
  validateShipDecision,
  makeRoomID,
  linkShip,
  initGame,
  startGame,
};

const {
  SHIP_SETTING,
  MAX_NOGO_NUM,
  GAME_START_FISH_NUM,
  WEATHER,
  WEATHER_WEIGHT_NORMAL,
  WEATHER_WEIGHT_COLD,
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

function linkShip(games, player, { shipNum, width, height, row, col }) {
  const objectID = makeObjectID(games[player.roomID].objects);
  games[player.roomID].objects[objectID] = {
    oid: objectID,
    pid: player.pid,
    typeName: "boat",
    typeNum: shipNum,
    row,
    col,
    width,
    height,
    attack: {
      cannon: SHIP_SETTING[shipNum].cannon,
      torpedo: SHIP_SETTING[shipNum].torpedo,
      aircraft: SHIP_SETTING[shipNum].aircraft,
    },
    speed: SHIP_SETTING[shipNum].speed,
    health: SHIP_SETTING[shipNum].health,
    skills: SHIP_SETTING[shipNum].skills.map((s) => s.skillName),
  };
  return objectID;
}

function linkFish(game, row, col) {
  const objectID = makeObjectID(game.objects);
  game.objects[objectID] = {
    oid: objectID,
    typeName: "fish",
    row,
    col,
    width: 1,
    height: 1,
    health: 1,
  };
  return objectID;
}

function initGame(playerList) {
  return {
    objects: {},
    phases: [],
    board: {
      noGo: { rows: [], cols: [] },
      weather: "",
      roundNum: 1,
      turnNum: 0,
    },
    notifs: { past: [], curr: [] },
    players: shuffleArray(playerList).map((pid) => ({ pid, moral: 0 })), // 起始节操为0
  };
}

function startGame(game) {
  updateNoGo(game);
  generateFish(game, GAME_START_FISH_NUM.min, GAME_START_FISH_NUM.max + 1);
  startNewTurn({ game, skipUpdateNoGo: true });
}

function startNewTurn({ game, skipUpdateNoGo }) {
  if (!skipUpdateNoGo) updateNoGo(game);
  updateWeather(game);
}

function updateWeather(game) {
  let newWeather = "";
  if (game.board.weather === "cold") {
    newWeather = weightedRandom(WEATHER, WEATHER_WEIGHT_COLD);
  } else {
    newWeather = weightedRandom(WEATHER, WEATHER_WEIGHT_NORMAL);
  }
  game.board.weather = newWeather;
  addNotif(game, "新天气", `${newWeather}。`);
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
  shuffleArray(possibleNoGos);
  let notifStr = "";
  for (const noGo of possibleNoGos.slice(0, 2)) {
    if (noGo.type === "row") {
      notifStr += (notifStr.length === 0 ? "" : "、") + `第${noGo.num}行`;
      game.board.noGo.rows.push(noGo.num);
    } else if (noGo.type === "col") {
      notifStr += (notifStr.length === 0 ? "" : "、") + `第${noGo.num}列`;
      game.board.noGo.cols.push(noGo.num);
    }
  }
  if (notifStr.length > 0) {
    addNotif(game, "新禁区", notifStr + "已被设为禁区。");
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

function generateFish(game, min, max) {
  const fishNum = getRandomInt(min, max);
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

function addNotif(game, title, msg) {
  game.notifs.curr.push({ title, msg });
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
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
