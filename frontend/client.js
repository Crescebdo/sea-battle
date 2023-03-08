/*global io */
const DEBUG = true;
// const API_SERVER = "https://api.crescb.com";
const API_SERVER = "http://localhost:3000";

// responses to server
const socket = io(API_SERVER, {
  reconnectionAttempts: DEBUG ? 1 : Infinity,
  withCredentials: true,
});
socket.on("error", handleError);
socket.on("chooseGhost", handleChooseGhost);
socket.on("restore", handleRestore);
socket.on("enterWaitingRoom", handleEnterWaitingRoom);
socket.on("shipSetting", (SHIP_SETTING, shipNum) => {
  shipSetting = convertInfinityForSetting(SHIP_SETTING);
  displayShipInfo(shipNum, shipSetting.shipNum);
});
socket.on("itemSetting", (ITEM_SETTING, itemNum) => {
  itemSetting = ITEM_SETTING;
  displayItemInfo(itemNum, itemSetting.itemNum);
});
socket.on("chooseShip", handleChooseShip);
socket.on("chosenShip", handleChosenShip); // still need to wait
socket.on("updateGame", handleUpdateGame);
socket.on("debug", (d) => console.log(d));

const playerCountChinese = ["", "单", "双", "三", "四", "五", "六", "七", "八"];
const attackChinese = { cannon: "主炮", torpedo: "鱼雷", aircraft: "飞机" };
let timerStart, timerIntervalID;
let shipSetting = [];
let itemSetting = [];
let myShip = {}; // shipNum, width, height, name, row, col
let chosenItem, chosenPrice, showShopScreen;
let extraItemInfo = {
  chosen: null,
  price: null,
  prevScreen: false,
  prevScroll: 0,
  needInit: true,
};
let gameBoardDisplay = {
  prevDisplayMode: "",
  noGo: { rows: [], cols: [] },
  shipPos: [], // all grids of previous ship
  gridDist: new Array(9).fill(-1).map(() => new Array(9).fill(-1)),
};
let currPhase = {};
let currBoard = {};
let currPlayer = {};
let gameLog = "";

let attackMode, fallbackAttackMode;

// VH resize
const mainContents = document.getElementById("main");

// loading screen
const loadingScreen = document.getElementById("loadingScreen");

// ghost screen
const ghostScreen = document.getElementById("ghostScreen");
const ghostList = document.getElementById("ghostList");

// initial screen
const initialScreen = document.getElementById("initialScreen");
const newGameBtn = document.getElementById("newGameButton");
const joinGameBtn = document.getElementById("joinGameButton");
const roomIDInput = document.getElementById("roomIDInput");
const nicknameInput = document.getElementById("nicknameInput");
newGameBtn.addEventListener("click", newGame);
joinGameBtn.addEventListener("click", joinGame);

// waiting screen
const waitingScreen = document.getElementById("waitingScreen");
const roomIDDisplay = document.getElementById("roomIDDisplay");
const currentPlayerNumDisplay = document.getElementById(
  "currentPlayerNumDisplay"
);
const maxPlayerNumDisplay = document.getElementById("maxPlayerNumDisplay");
const currentPlayerListWrap = document.getElementById("currentPlayerListWrap");
const enterGameButton = document.getElementById("enterGameButton");
enterGameButton.addEventListener("click", enterGame);

// status bar
const screenWithStatusBar = document.getElementById("screenWithStatusBar");
const statusBar = document.getElementById("statusBar");
const statusRoundNumLine = document.getElementById("statusRoundNumLine");
const statusRoundNum = document.getElementById("statusRoundNum");
const statusWeather = document.getElementById("statusWeather");
const statusRoomLine = document.getElementById("statusRoomLine");
const statusTotalPlayerCount = document.getElementById(
  "statusTotalPlayerCount"
);
const statusRoomID = document.getElementById("statusRoomID");
const statusTimerLine = document.getElementById("statusTimerLine");
const statusTimer = document.getElementById("statusTimer");
const subScreenDVH = document.getElementsByClassName("subScreenDVH");

// choose ship screen
const chooseShipScreen = document.getElementById("chooseShipScreen");
const shipPanelLeft = document.getElementById("shipPanelLeft");
const shipPanelRight = document.getElementById("shipPanelRight");
const shipName = document.getElementById("shipName");
const shipSize = document.getElementById("shipSize");
const shipAttack = document.getElementById("shipAttack");
const shipSpeed = document.getElementById("shipSpeed");
const shipSkills = document.getElementById("shipSkills");
const shipPassive = document.getElementById("shipPassive");
const shipNote = document.getElementById("shipNote");
const shipQuote = document.getElementById("shipQuote");
const shipInfo = document.getElementById("shipInfo");
const decideShipTypeButton = document.getElementById("decideShipTypeButton");
const itemInfo = document.getElementById("itemInfo");
const itemNewMoral = document.getElementById("itemNewMoral");
const itemName = document.getElementById("itemName");
const itemPrice = document.getElementById("itemPrice");
const itemDescription = document.getElementById("itemDescription");
const itemExtra = document.getElementById("itemExtra");
const itemFootnote = document.getElementById("itemFootnote");

// choose ship position screen
const choosePosScreen = document.getElementById("choosePosScreen");
const choosePosFooter = document.getElementById("choosePosFooter");
const choosePosShipName = document.getElementById("choosePosShipName");
const choosePosShipSize = document.getElementById("choosePosShipSize");
const toggleShipDirectionButton = document.getElementById(
  "toggleShipDirectionButton"
);
const decidePosButton = document.getElementById("decidePosButton");
toggleShipDirectionButton.addEventListener("click", toggleShipDirection);
decidePosButton.addEventListener("click", decideShipPosition);

// already chosen ship
const chosenShipScreen = document.getElementById("chosenShipScreen");
const currentChosen = document.getElementById("currentChosen");
const maxChosen = document.getElementById("maxChosen");

// game screen
const gameScreen = document.getElementById("gameScreen");
const gameBoard = document.getElementById("gameBoard");
const gameGrids = new Array(9);
for (let r = 1; r <= 8; r++) {
  gameGrids[r] = new Array(9);
  for (let c = 1; c <= 8; c++) {
    gameGrids[r][c] = document.getElementById(`${r}-${c}`);
  }
}
const gameMyState = document.getElementById("gameMyState");
const gameProgress = document.getElementById("gameProgress");
const gamePlayerIndex = document.getElementById("gamePlayerIndex");
const gameShipImg = document.getElementById("gameShipImg");
const gameShipCaption = document.getElementById("gameShipCaption");
const gameHealth = document.getElementById("gameHealth");
const gameMoral = document.getElementById("gameMoral");
const gameSpeedCurr = document.getElementById("gameSpeedCurr");
const gameSpeedMax = document.getElementById("gameSpeedMax");
const gameCannonLine = document.getElementById("gameCannonLine");
const gameCannonCurr = document.getElementById("gameCannonCurr");
const gameCannonMax = document.getElementById("gameCannonMax");
const gameTorpedoLine = document.getElementById("gameTorpedoLine");
const gameTorpedoCurr = document.getElementById("gameTorpedoCurr");
const gameTorpedoMax = document.getElementById("gameTorpedoMax");
const gameAircraftAtkLine = document.getElementById("gameAircraftAtkLine");
const gameAircraftAtkCurr = document.getElementById("gameAircraftAtkCurr");
const gameAircraftAtkMax = document.getElementById("gameAircraftAtkMax");
const gameAircraftDetLine = document.getElementById("gameAircraftDetLine");
const gameAircraftDetCurr = document.getElementById("gameAircraftDetCurr");
const gameAircraftDetMax = document.getElementById("gameAircraftDetMax");
for (let r = 1; r <= 8; r++) {
  for (let c = 1; c <= 8; c++) {
    gameGrids[r][c].addEventListener("click", () => clickGameGrid(r, c));
  }
}
const gameHint = document.getElementById("gameHint");
const myShipButton = document.getElementById("myShipButton");
const attackDropdown = document.getElementById("attackDropdown");
const moveButton = document.getElementById("moveButton");
const shopButton = document.getElementById("shopButton");
const skillDropdown = document.getElementById("skillDropdown");
const showLogButton = document.getElementById("showLogButton");
const helpButton = document.getElementById("helpButton");
const cannonAttack = document.getElementById("cannonAttack");
const torpedoAttack = document.getElementById("torpedoAttack");
const aircraftAttack = document.getElementById("aircraftAttack");
const aircraftDetect = document.getElementById("aircraftDetect");
showLogButton.addEventListener("click", onShowLog);
moveButton.addEventListener("click", (e) => onMoveButton(e));
shopButton.addEventListener("click", onShopButton);
cannonAttack.addEventListener("click", (e) => onAttackButton(e, "cannon"));
torpedoAttack.addEventListener("click", (e) => onAttackButton(e, "torpedo"));
aircraftAttack.addEventListener("click", (e) => onAttackButton(e, "aircraft"));
aircraftDetect.addEventListener("click", (e) => onDetectButton(e));

const allScreens = [
  loadingScreen,
  initialScreen,
  waitingScreen,
  ghostScreen,
  chosenShipScreen,
  choosePosScreen,
  chooseShipScreen,
  gameScreen,
];
const allGameButtons = [
  showLogButton,
  helpButton,
  myShipButton,
  attackDropdown,
  moveButton,
  shopButton,
  skillDropdown,
  cannonAttack,
  torpedoAttack,
  aircraftAttack,
  aircraftDetect,
];

// handlers

function handleError(msg, showInitialScreen) {
  if (showInitialScreen) displayInitialScreen();
  showInfoModal({ title: "出现异常", msg });
}

function handleChooseGhost({ roomID, nicknameList }) {
  displayGhostScreen();
  for (const nickname of nicknameList) {
    const newItem = document.createElement("button");
    newItem.classList.add(
      "list-group-item",
      "list-group-item-action",
      "list-group-item-info",
      "text-center"
    );
    newItem.type = "button";
    newItem.innerHTML = nickname;
    newItem.addEventListener("click", () =>
      socket.emit("chosenGhost", { roomID, nickname })
    );
    ghostList.appendChild(newItem);
  }
}

// todo
function handleRestore({
  stage,
  totalPlayerCount,
  roomID,
  ship,
  // SHIP_SETTING,
}) {
  if (stage === "chooseShip") {
    displayChooseShipScreen();
    updateStatusBar({ totalPlayerCount, roomID });
  } else if (stage === "chosenShip") {
    displayChosenShipScreen();
    updateStatusBar({ totalPlayerCount, roomID });
    socket.emit("decideShip", ship);
  } else if (stage === "inGame") {
    displayGameScreen();
  }
}

function handleEnterWaitingRoom({
  roomID,
  nicknameList,
  minPlayerNum,
  maxPlayerNum,
  isRoomMaster,
}) {
  displayWaitingScreen();

  // update room ID
  if (roomID) {
    roomIDDisplay.innerHTML = roomID;
  }

  // update current num of players
  if (nicknameList) {
    currentPlayerNumDisplay.innerHTML = nicknameList.length;
    // update whether you can start game based on minPlayerNum
    if (minPlayerNum && nicknameList.length < minPlayerNum) {
      enterGameButton.disabled = true;
      enterGameButton.innerHTML = "最少人数：" + minPlayerNum;
    } else {
      enterGameButton.disabled = false;
      enterGameButton.innerHTML = "开始游戏";
    }
  }

  if (maxPlayerNum) {
    // update max num of players
    maxPlayerNumDisplay.innerHTML = maxPlayerNum;
  }

  // update "start game" based on if is room master
  if (isRoomMaster) {
    enterGameButton.style.display = "inline-block";
  }

  // update nickname list
  if (nicknameList) {
    let newList = document.createElement("ul");
    newList.classList.add("list-group");
    let isFirstPlayer = true;
    for (const nickname of nicknameList) {
      let newItem = document.createElement("li");
      newItem.classList.add(
        "list-group-item",
        "list-group-item-info",
        "text-center"
      );
      newItem.innerHTML = (isFirstPlayer ? "[房主] " : "") + nickname;
      isFirstPlayer = false;
      newList.appendChild(newItem);
    }
    document.getElementById("currentPlayerList").remove();
    currentPlayerListWrap.appendChild(newList);
    newList.id = "currentPlayerList";
  }
}

function handleChooseShip({
  totalPlayerCount,
  roomID,
  SHIP_SETTING,
  ITEM_SETTING,
}) {
  shipSetting = convertInfinityForSetting(SHIP_SETTING);
  itemSetting = ITEM_SETTING;
  displayChooseShipScreen();
  updateStatusBar({ totalPlayerCount, roomID });
}

function handleChosenShip(readyPlayerCount, totalPlayerCount) {
  displayChosenShipScreen();
  currentChosen.innerHTML = readyPlayerCount;
  maxChosen.innerHTML = totalPlayerCount;
}

// JSON doesn't allow Infinity, need manual conversion
function convertInfinity(player) {
  if (!player) return;
  if (player.ship && player.ship.speed === null) player.ship.speed = Infinity;
  if (player.ship && player.ship.attackDist) {
    Object.keys(player.ship.attackDist).forEach((key) => {
      if (player.ship.attackDist[key] === null)
        player.ship.attackDist[key] = Infinity;
    });
  }
  if (player.ship && player.ship.aircraftDetectDist === null)
    player.ship.aircraftDetectDist = Infinity;
}

function convertInfinityForSetting(shipSetting) {
  for (let ship of shipSetting) {
    if (ship.speed === null) ship.speed = Infinity;
  }
  return shipSetting;
}

function handleUpdateGame({ phase, board, player }) {
  convertInfinity(player);

  displayGameScreen();
  if (phase && phase.startGame) {
    startTimer();
  }
  if (phase) currPhase = phase;
  if (board) currBoard = board;
  if (player) currPlayer = player;
  if (phase) {
    updateProgressBar(
      (phase.startTime + phase.duration * 1000 - Date.now()) / 1000
    );
    updateHint({ ...phase });
  }
  if (board) updateStatusBar({ ...board });
  if (phase && board && player) {
    updateGameBoard({ phase, board, player });
    updateButtons({ ...phase, ...board, ...player });
  }
  if (player) updateState({ ...player });
  if (phase && phase.modal) {
    showInfoModal({ ...phase.modal });
    gameLog += phase.modal.msg;
  }
}

// button functions

function newGame() {
  const nickname = nicknameInput.value;
  if (!nickname || nickname.length === 0) {
    handleError("昵称不可为空", false);
    return;
  }
  socket.emit("newWaitingRoom", nickname);
}

function joinGame() {
  const nickname = nicknameInput.value;
  if (!nickname || nickname.length === 0) {
    handleError("昵称不可为空", false);
    return;
  }
  const roomID = roomIDInput.value;
  if (!roomID || roomID.length === 0) {
    handleError("房间号不可为空", false);
    return;
  }
  socket.emit("joinWaitingRoom", { roomID, nickname });
}

function enterGame() {
  showConfirmModal({
    msg: "确认要开始游戏吗？",
    callback: () => socket.emit("enterGame"),
  });
}

/* eslint-disable */
function showShipInfo(shipNum) {
  if (shipSetting[shipNum]) {
    displayShipInfo(shipNum, shipSetting[shipNum]);
  } else {
    socket.emit("getShipSetting", shipNum);
  }
}

function showItemInfo(itemNum) {
  if (itemSetting[itemNum]) {
    displayItemInfo(itemNum, itemSetting[itemNum]);
  } else {
    socket.emit("getItemSetting", itemNum);
  }
}
/* eslint-enable */

function decideShipType() {
  if (isNaN(myShip.shipNum)) {
    handleError("啊咧？尚未选择船只哦", false);
    return;
  }
  if (!shipSetting[myShip.shipNum]) {
    handleError("啊咧？找不到该船只的信息……", false);
    return;
  }
  showConfirmModal({
    msg: `确认要选择${shipSetting[myShip.shipNum].name}吗？`,
    callback: () => {
      myShip.width = shipSetting[myShip.shipNum].width;
      myShip.height = shipSetting[myShip.shipNum].height;
      myShip.name = shipSetting[myShip.shipNum].name;

      choosePosShipName.innerHTML = myShip.name;
      choosePosShipSize.innerHTML = `${myShip.width}&times;${myShip.height}`;
      displayChoosePosScreen();
    },
  });
}

function decideItemType() {
  showConfirmModal({
    msg:
      `确认要购买${itemSetting[chosenItem].name}吗？` +
      linebreak() +
      `节操：${currPlayer.moral}→${currPlayer.moral - chosenPrice}`,
    callback: () => {
      console.log("购买：" + chosenItem);
      displayGameScreen();
    },
  });
}

function clickGameGrid(row, col) {
  if (gameBoardDisplay.prevDisplayMode === "move") {
    moveShip({ row, col });
    decidePosButton.disabled = false;
  } else if (gameBoardDisplay.prevDisplayMode === "attack") {
    const atkTarget = getAttackPositions(row, col);
    if (atkTarget) addHover(atkTarget);
  }
}

function getAttackPositions(row, col) {
  const atkMode = attackMode ?? fallbackAttackMode;
  let res = [];
  let [rowStart, rowEnd, colStart, colEnd] = [row, row, col, col];
  if (atkMode === "row") [colStart, colEnd] = [1, 8];
  else if (atkMode === "col") [rowStart, rowEnd] = [1, 8];
  else if (atkMode === "3by3") [rowEnd, colEnd] = [row + 2, col + 2];
  for (let r = rowStart; r <= rowEnd; r++)
    for (let c = colStart; c <= colEnd; c++) {
      if (r < 1 || r > 8 || c < 1 || c > 8) continue;
      if (currBoard.noGo.rows.includes(r) || currBoard.noGo.cols.includes(c))
        continue;
      res.push([r, c]);
    }
  return res;
}

function getAttackTarget(row, col) {
  [row, col] = [parseInt(row), parseInt(col)];
  const atkMode = attackMode ?? fallbackAttackMode;
  if (atkMode === "row") return { mode: "row", target: { row } };
  else if (atkMode === "col") return { mode: "col", target: { col } };
  else if (atkMode === "3by3") return { mode: "3by3", target: { row, col } };
  else return { mode: "normal", target: { row, col } };
}

function addHover(hoverList) {
  for (const [r, c] of hoverList) {
    gameGrids[r][c].classList.add("hover");
  }
}

function toggleShipDirection() {
  [myShip.width, myShip.height] = [myShip.height, myShip.width];
  drawGameBoard({ ...myShip, ...gameBoardDisplay, displayMode: "move" });
  moveShip({ ...myShip });
  choosePosShipSize.innerHTML = `${myShip.width}&times;${myShip.height}`;
}

function decideShipPosition() {
  showConfirmModal({
    msg: `确认要将船放在此位置吗？${linebreak()}<small>${suggestLineBreak(
      "方向（横向/竖向）确定后，",
      "在游戏过程中将无法再更改"
    )}</small>`,
    callback: () => socket.emit("decideShip", myShip),
  });
}

let scrollInfoModalToBottom = false;
function onShowLog() {
  scrollInfoModalToBottom = true;
  $("#infoModalBody").css("visibility", "hidden");
  showInfoModal({ title: "通报记录", msg: gameLog });
}

// display functions

function displayShipInfo(
  shipNum,
  {
    name,
    health,
    width,
    height,
    cannon,
    torpedo,
    aircraft,
    speed,
    skills,
    passive,
    note,
    quote,
  }
) {
  $("#shipInfo").show();
  shipInfo.scrollTop = 0;
  myShip.shipNum = shipNum;

  shipName.innerHTML = suggestLineBreak(name, "🩸".repeat(health));
  shipSize.innerHTML = "体积：" + width + "&times;" + height;
  let combinedAttack = "";
  if (cannon > 0) {
    combinedAttack += cannon + "门主炮";
  }
  if (torpedo > 0) {
    if (combinedAttack.length > 0) combinedAttack += "、";
    combinedAttack += torpedo + "座鱼雷发射器";
  }
  if (aircraft > 0) {
    if (combinedAttack.length > 0) combinedAttack += "、";
    combinedAttack += aircraft + "架飞机";
  }
  shipAttack.innerHTML = "攻击：" + combinedAttack;
  if (speed === Infinity) {
    shipSpeed.innerHTML = "航速：无限";
  } else {
    shipSpeed.innerHTML = "航速：" + speed + "格";
  }
  shipSkills.innerHTML = "";
  for (const s of skills) {
    const shipSkillName = document.createElement("h3");
    shipSkillName.innerHTML = "特性-" + s.skillName;
    shipSkills.appendChild(shipSkillName);
    const shipSkillDescription = document.createElement("p");
    shipSkillDescription.innerHTML = s.description;
    shipSkills.appendChild(shipSkillDescription);
  }
  shipPassive.innerHTML = "";
  if (passive) {
    const shipPassiveTitle = document.createElement("h3");
    shipPassiveTitle.innerHTML = "被动";
    shipPassive.appendChild(shipPassiveTitle);
    const shipPassiveDescription = document.createElement("p");
    shipPassiveDescription.innerHTML = passive;
    shipPassive.appendChild(shipPassiveDescription);
  }
  shipNote.innerHTML = note;
  if (quote) {
    shipQuote.innerHTML = quote;
    shipQuote.style.display = "block";
  } else {
    shipQuote.style.display = "none";
  }
  decideShipTypeButton.disabled = false;
}

// debug
function displayItemInfo(
  itemNum,
  { name, price, description, type, multiplePriceList }
) {
  $("#itemInfo").show();
  if (extraItemInfo.prevScreen) {
    extraItemInfo.prevScroll = itemInfo.scrollTop;
    console.log(extraItemInfo);
  }
  chosenItem = itemNum;

  itemName.innerHTML = name;
  itemPrice.innerHTML = price;
  itemDescription.innerHTML = description;
  if (!multiplePriceList) {
    extraItemInfo.prevScreen = false;
    chosenPrice = price;
    itemExtra.style.display = "none";
  } else {
    extraItemInfo.prevScreen = true;
    if (extraItemInfo.needInit) {
      extraItemInfo.needInit = false;
      $("#itemExtra").empty();
      for (const singlePriceList of multiplePriceList) {
        const title = document.createElement("h3");
        title.innerHTML = "节操" + singlePriceList.price;
        itemExtra.appendChild(title);
        const body = document.createElement("p");
        for (const item of singlePriceList.list) {
          if (currBoard.weather === "寒潮" && !item.cold) continue;
          const button = document.createElement("button");
          button.setAttribute("extraItemName", item.name);
          button.setAttribute("extraItemPrice", singlePriceList.price);
          button.classList.add("btn", "btn-primary", "extraItemButton");
          //if (singlePriceList.price > currPlayer.moral) button.disabled = true; //debug
          button.textContent = item.name;
          body.appendChild(button);
          const caption = document.createElement("span");
          caption.classList.add("shipTextMuted", "sm");
          caption.innerHTML = item.description;
          body.appendChild(caption);
          body.innerHTML += linebreak();
        }
        itemExtra.appendChild(body);
      }
      $(".extraItemButton").bind("click", (event) => {
        $(".extraItemButton").removeClass("hover");
        event.target.classList.add("hover");
        extraItemInfo.item = event.target.getAttribute("extraItemName");
        extraItemInfo.price = event.target.getAttribute("extraItemPrice");
        itemNewMoral.innerHTML = "→" + (currPlayer.moral - extraItemInfo.price);
        decideShipTypeButton.disabled = false;
      });
    }
    itemExtra.style.display = "block";
  }
  if (type === "equip") {
    itemFootnote.style.display = "block";
  } else {
    itemFootnote.style.display = "none";
  }
  if (!multiplePriceList) {
    itemNewMoral.innerHTML = "→" + (currPlayer.moral - chosenPrice);
    decideShipTypeButton.disabled = false;
  } else {
    if (extraItemInfo.item) {
      itemNewMoral.innerHTML = "→" + (currPlayer.moral - extraItemInfo.price);
      decideShipTypeButton.disabled = false;
    } else {
      itemNewMoral.innerHTML = "";
      decideShipTypeButton.disabled = true;
    }
  }

  if (multiplePriceList && extraItemInfo.prevScroll) {
    console.log(extraItemInfo.prevScroll);
    itemInfo.scrollTop = extraItemInfo.prevScroll;
  } else {
    itemInfo.scrollTop = 0;
  }
}

function updateGameBoard({ phase, board, player }) {
  gameBoardDisplay.noGo = board.noGo;
  moveShip({ row: player.ship.row, col: player.ship.col });
  if (phase.type === "wait") {
    drawGameBoard({ ...myShip, ...gameBoardDisplay, displayMode: "none" });
  } else if (phase.type === "turn") {
    drawGameBoard({ ...myShip, ...gameBoardDisplay, displayMode: "none" });
  }
}

// displayMode: none, move, attack
function drawGameBoard({
  width,
  height,
  noGo,
  gridDist,
  displayMode,
  distMax,
}) {
  if (!width || !height || width < 0 || height < 0) {
    handleError("啊咧？船只尺寸不合法", false);
    return;
  }
  gameBoardDisplay.prevDisplayMode = displayMode;
  for (let r = 1; r <= 8; r++)
    for (let c = 1; c <= 8; c++) {
      gameGrids[r][c].classList.remove("hover");
      if (noGo.rows.includes(r) || noGo.cols.includes(c)) {
        gameGrids[r][c].disabled = true;
        gameGrids[r][c].classList.add("noGo");
      } else {
        gameGrids[r][c].classList.remove("noGo");
        if (displayMode === "move") {
          if (
            isNaN(distMax) ||
            getManhattanDist(r, c, myShip.row, myShip.col) <= distMax
          ) {
            gameGrids[r][c].disabled = isGridDisabled(
              r,
              c,
              width,
              height,
              noGo
            );
            gameGrids[r][c].classList.remove("normalColor");
          } else {
            gameGrids[r][c].disabled = true;
            gameGrids[r][c].classList.remove("normalColor");
          }
        } else if (displayMode === "none") {
          gameGrids[r][c].disabled = true;
          gameGrids[r][c].classList.add("normalColor");
        } else if (displayMode === "attack") {
          if (gridDist[r][c] > distMax) {
            gameGrids[r][c].disabled = true;
            gameGrids[r][c].classList.remove("normalColor");
          } else {
            gameGrids[r][c].disabled = false;
            gameGrids[r][c].classList.remove("normalColor");
          }
        }
      }
    }
}

function moveShip({ row, col }) {
  for (const [r, c] of gameBoardDisplay.shipPos) {
    gameGrids[r][c].innerText = "";
  }
  gameBoardDisplay.shipPos = [];
  for (let r = row; r < row + myShip.height; r++)
    for (let c = col; c < col + myShip.width; c++) {
      gameBoardDisplay.shipPos.push([r, c]);
      gameGrids[r][c].innerText = "🚢";
    }
  calculateGridDist();
  toggleShipDirectionButton.disabled =
    myShip.width === myShip.height ||
    isGridDisabled(
      row,
      col,
      myShip.height,
      myShip.width,
      gameBoardDisplay.noGo
    );
  myShip.row = row;
  myShip.col = col;
}

function calculateGridDist() {
  for (let r = 1; r <= 8; r++)
    for (let c = 1; c <= 8; c++) {
      gameBoardDisplay.gridDist[r][c] = Math.min(
        ...gameBoardDisplay.shipPos.map(
          ([shipR, shipC]) => Math.max(Math.abs(shipR - r), Math.abs(shipC - c)) // allow diagonal movement
        )
      );
    }
}

function getManhattanDist(r1, c1, r2, c2) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2);
}

function isGridDisabled(row, col, width, height, noGo) {
  if (
    noGo.rows.includes(row) ||
    noGo.rows.includes(row + height - 1) ||
    noGo.cols.includes(col) ||
    noGo.cols.includes(col + width - 1) ||
    row + height > 9 ||
    col + width > 9
  ) {
    return true;
  } else {
    return false;
  }
}

function updateHint({ hint }) {
  if (hint) gameHint.innerHTML = hint;
}

function updateStatusBar({ roundNum, weather, totalPlayerCount, roomID }) {
  unhighlight(statusWeather);
  let doRefreshVH = false;
  if (roundNum && weather) {
    statusRoundNumLine.style.visibility = "visible";
    statusRoundNum.innerHTML = roundNum;
    statusWeather.innerHTML = weather;
    doRefreshVH = true;
  }
  if (totalPlayerCount && roomID) {
    statusRoomLine.style.visibility = "visible";
    if (playerCountChinese[totalPlayerCount]) {
      statusTotalPlayerCount.innerHTML = playerCountChinese[totalPlayerCount];
    }
    statusRoomID.innerHTML = roomID;
    doRefreshVH = true;
  }
  if (doRefreshVH) refreshVH();
}

function startTimer() {
  statusTimerLine.style.visibility = "visible";
  statusTimer.innerHTML = "00:00";
  timerStart = Date.now();
  timerIntervalID = setInterval(() => {
    let milsecSinceStart = Date.now() - timerStart;
    let secSinceStart = Math.floor(milsecSinceStart / 1000);
    const [seconds, minutes] = [
      secSinceStart % 60,
      Math.floor(secSinceStart / 60),
    ];
    statusTimer.innerHTML =
      minutes.toString().padStart(2, "0") +
      ":" +
      seconds.toString().padStart(2, "0");
  }, 1000);
}

function hideTimer() {
  statusTimerLine.style.visibility = "hidden";
  if (timerIntervalID) clearInterval(timerIntervalID);
  timerStart = timerIntervalID = null;
}

function updateState({ startingIndex, moral, ship }) {
  if (!isNaN(startingIndex)) {
    gamePlayerIndex.innerHTML = startingIndex + 1;
  }
  if (ship) {
    unhighlight(
      gameMoral,
      gameSpeedCurr,
      gameCannonCurr,
      gameTorpedoCurr,
      gameAircraftAtkCurr,
      gameAircraftDetCurr
    );
    gameShipImg.src = `asset/images/ships/${
      shipSetting[ship.typeNum].name
    }.jpg`;
    gameShipCaption.innerHTML = shipSetting[ship.typeNum].name;
    gameHealth.innerHTML = "🩸".repeat(ship.health);
    gameMoral.innerHTML = moral;
    gameSpeedCurr.innerHTML = ship.speed === Infinity ? "&infin;" : ship.speed;
    gameSpeedMax.innerHTML = ship.speedMax;
    if (shipSetting[ship.typeNum].cannon) {
      gameCannonCurr.innerHTML = ship.attack.cannon;
      gameCannonMax.innerHTML = ship.attackMax.cannon;
      gameCannonLine.style.display = "block";
    } else {
      gameCannonLine.style.display = "none";
    }
    if (shipSetting[ship.typeNum].torpedo) {
      gameTorpedoCurr.innerHTML = ship.attack.torpedo;
      gameTorpedoMax.innerHTML = ship.attackMax.torpedo;
      gameTorpedoLine.style.display = "block";
    } else {
      gameTorpedoLine.style.display = "none";
    }
    if (shipSetting[ship.typeNum].aircraft) {
      gameAircraftAtkCurr.innerHTML = ship.attack.aircraft;
      gameAircraftAtkMax.innerHTML = ship.attackMax.aircraft;
      gameAircraftAtkLine.style.display = "block";
      gameAircraftDetCurr.innerHTML = ship.aircraftDetect;
      gameAircraftDetMax.innerHTML = ship.attackMax.aircraft;
      gameAircraftDetLine.style.display = "block";
    } else {
      gameAircraftAtkLine.style.display = "none";
      gameAircraftDetLine.style.display = "none";
    }
  }
}

function updateButtons({ type, isTurnOwner, weather, ship, moral, dizzy }) {
  if (!ship.attackMax.cannon) {
    cannonAttack.style.display = "none";
  } else {
    cannonAttack.style.display = "block";
  }
  if (!ship.attackMax.torpedo) {
    torpedoAttack.style.display = "none";
  } else {
    torpedoAttack.style.display = "block";
  }
  if (!ship.attackMax.aircraft) {
    aircraftAttack.style.display = "none";
    aircraftDetect.style.display = "none";
  } else {
    aircraftAttack.style.display = "block";
    aircraftDetect.style.display = "block";
  }
  enable(showLogButton, helpButton, myShipButton);
  if (type === "wait") {
    disableAllButtonsExcept(showLogButton, helpButton, myShipButton);
    if (DEBUG)
      enable(
        attackDropdown,
        cannonAttack,
        torpedoAttack,
        aircraftAttack,
        aircraftDetect,
        moveButton,
        shopButton,
        skillDropdown
      );
  } else if (type === "turn") {
    if (isTurnOwner) {
      enableAllButtonsExcept();
      if (!ship.attack.cannon) disable(cannonAttack);
      if (!ship.attack.torpedo) disable(torpedoAttack);
      if (!ship.attack.aircraft) disable(aircraftAttack, aircraftDetect);
      if (!ship.speed) disable(moveButton);
      if (!moral || weather === "白雪") disable(shopButton);
      if (dizzy) {
        disable(attackDropdown, moveButton, shopButton, skillDropdown);
      }
    }
  }
}

// switch screen mode

let screenType = {};
$(document).on("hide.bs.dropdown", inactivateAllDropdownItems);

function getHint({ mode, type }) {
  if (mode === "attack") {
    return `请选择${attackChinese[type]}攻击目标`;
  } else if (mode === "detect") {
    return `请选择${attackChinese[type]}攻击目标`;
  } else if (mode === "move") {
    return `请选择移动目标`;
  }
  return "";
}

function getAttackDist() {
  if (screenType.type === "cannon") {
    return currPlayer.ship.attackDist.cannon;
  } else if (screenType.type === "torpedo") {
    return currPlayer.ship.attackDist.torpedo;
  } else if (screenType.type === "aircraft") {
    return currPlayer.ship.attackDist.aircraft;
  }
  return -1;
}

function getMoveDist() {
  return currPlayer.ship.speed;
}

function needHighlightWeather({ mode, type }) {
  if (mode === "attack") {
    if (type === "cannon")
      return ["浓雾", "雷雨", "暴雨", "满月"].includes(currBoard.weather);
    else if (type === "torpedo") return ["满月"].includes(currBoard.weather);
    else if (type === "aircraft")
      return ["浓雾", "晴天", "暴雨", "满月"].includes(currBoard.weather);
  } else if (mode === "detect") {
    return ["浓雾", "暴雨"].includes(currBoard.weather);
  } else if (mode === "move") {
    if (["暴雨", "顺风", "满月"].includes(currBoard.weather)) return true;
    return (
      currBoard.weather === "冻结" &&
      currPlayer.ship.shipName != "潜水艇" &&
      currPlayer.ship.shipName != "破冰船" &&
      currPlayer.ship.shipName != "幽灵船"
    );
  }
}

function enterScreenMode(mode, type) {
  disableAllButtonsExcept();
  updateHint({ hint: getHint({ mode, type }) });
  document.removeEventListener("click", captureAllClicks);
  document.addEventListener("click", captureAllClicks);
}

function needToChooseRowCol(type, attackArea) {
  if (attackMode) return false;
  return (
    (type === "cannon" && attackArea.cannon === "rowcol") ||
    (type === "torpedo" && attackArea.torpedo === "rowcol") ||
    (type === "aircraft" && attackArea.aircraft === "rowcol")
  );
}

function setScreenMode({ mode, type }) {
  screenType = { mode, type };
  if (mode === "attack") {
    disableAllButtonsExcept();
    if (needToChooseRowCol(type, currPlayer.ship.attackArea)) {
      document.removeEventListener("click", captureAllClicks);
      showConfirmModal({
        title: "选择攻击范围",
        msg: "请选择攻击范围（一行或一列）",
        callback: () => {
          attackMode = "col";
          setScreenMode({ mode, type });
        },
        showAtBottom: true,
        leftButtonText: "行",
        rightButtonText: "列",
        leftCallback: () => {
          attackMode = "row";
          setScreenMode({ mode, type });
        },
        triggerCallbackAfterHidden: true,
      });
      return;
    }
    drawGameBoard({
      ...myShip,
      ...gameBoardDisplay,
      displayMode: "attack",
      distMax: getAttackDist(type),
    });
    if (type === "cannon") {
      highlight(gameCannonCurr);
      fallbackAttackMode = currPlayer.ship.attackArea.cannon;
    } else if (type === "torpedo") {
      highlight(gameTorpedoCurr);
      fallbackAttackMode = currPlayer.ship.attackArea.torpedo;
    } else if (type === "aircraft") {
      highlight(gameAircraftAtkCurr);
      fallbackAttackMode = currPlayer.ship.attackArea.aircraft;
    }
    if (needHighlightWeather({ mode, type })) highlight(statusWeather);
    enterScreenMode(mode, type);
  } else if (mode === "detect") {
    drawGameBoard({
      ...myShip,
      ...gameBoardDisplay,
      displayMode: "attack",
      distMax: getAttackDist(type),
    });
    highlight(gameAircraftDetCurr);
    if (needHighlightWeather({ mode, type })) highlight(statusWeather);
    enterScreenMode(mode, type);
  } else if (mode === "move") {
    drawGameBoard({
      ...myShip,
      ...gameBoardDisplay,
      displayMode: "move",
      distMax: getMoveDist(),
    });
    highlight(gameSpeedCurr);
    if (needHighlightWeather({ mode, type })) highlight(statusWeather);
    enterScreenMode(mode, type);
  } else if (mode === "reset") {
    console.log("reset mode");
    updateStatusBar({ ...currBoard });
    updateHint({ ...currPhase });
    updateGameBoard({ phase: currPhase, board: currBoard, player: currPlayer });
    updateState({ ...currPlayer });
    updateButtons({ ...currPhase, ...currBoard, ...currPlayer });
    attackMode = fallbackAttackMode = null;
  }
}

function captureAllClicks(event) {
  if (event.target.classList.contains("gameGridButton")) {
    if (screenType.mode === "attack") {
      showConfirmModal({
        title: "发起攻击",
        msg: getAttackMessage({ type: screenType.type, id: event.target.id }),
        callback: () => {
          const [row, col] = event.target.id.split("-");
          if (!row || !col) return;
          socket.emit("makeAttack", {
            phaseID: currPhase.phaseID,
            type: screenType.type,
            ...getAttackTarget(row, col),
          });
          setScreenMode({ mode: "reset" });
        },
        showAtBottom: true,
      });
    } else if (screenType.mode === "detect") {
      let msg = suggestLineBreak(
        `确认要用飞机侦察[${toReadablePos(event.target.id)}]吗？`,
        currBoard.weather === "暴雨"
          ? toTextInfo("注意：当前天气为暴雨，侦察后将无法使用飞机攻击")
          : `（侦察后仍能攻击）`
      );
      showConfirmModal({
        title: "进行侦察",
        msg,
        callback: () => {
          console.log(`对${event.target.id}${screenType.mode}成功`);
          setScreenMode({ mode: "reset" });
        },
        showAtBottom: true,
      });
    } else if (screenType.mode === "move") {
      showConfirmModal({
        title: "进行移动",
        msg: getMoveMessage({ id: event.target.id }),
        callback: () => {
          console.log(`对${event.target.id}${screenType.mode}成功`);
          setScreenMode({ mode: "reset" });
        },
        showAtBottom: true,
      });
    }
  } else {
    setScreenMode({ mode: "reset" });
  }
  document.removeEventListener("click", captureAllClicks);
}

function getAttackMessage({ type, id }) {
  let targetText = toReadablePos(id, attackMode ?? fallbackAttackMode);
  if (type === "aircraft") {
    return `确认要消耗1架飞机攻击[${targetText}]吗？`;
  } else {
    return `确认要用${attackChinese[type]}攻击[${targetText}]吗？`;
  }
}

function getMoveMessage({ id }) {
  const ship = currPlayer.ship;
  console.log(ship.row, ship.col, myShip.row, myShip.col);
  const secondLine =
    ship.speed === Infinity
      ? "航速：&infin;"
      : `航速：${ship.speed}→${
          ship.speed -
          getManhattanDist(ship.row, ship.col, myShip.row, myShip.col)
        }`;
  return `确认要移动到[${toReadablePos(id)}]吗？` + linebreak() + secondLine;
}

function onAttackButton(event, type) {
  event.stopPropagation();
  event.target.classList.add("active");
  setScreenMode({ mode: "attack", type });
}

function onDetectButton(event) {
  event.stopPropagation();
  event.target.classList.add("active");
  setScreenMode({ mode: "detect", type: "aircraft" });
}

function onMoveButton(event) {
  event.stopPropagation();
  setScreenMode({ mode: "move" });
}

function onShopButton() {
  displayShopScreen({ ...currPhase, ...currPlayer });
}

function updateProgressBar(duration) {
  $("#gameProgressBar").stop();
  $("#gameProgressBar").attr("style", "width: 0%");
  if (duration) {
    $("#gameProgressBar").animate(
      { width: "100%" },
      { duration: duration * 1000, easing: "linear" }
    );
  }
}

function closeAllExcept(activeScreen, hasStatusBar) {
  for (const screen of allScreens.filter((s) => s.id != activeScreen.id)) {
    screen.style.display = "none";
  }
  screenWithStatusBar.style.display = hasStatusBar ? "block" : "none";
  activeScreen.style.display = "block";
  if (!hasStatusBar) hideTimer();
}

function displayInitialScreen() {
  closeAllExcept(initialScreen, false);
}

function displayWaitingScreen() {
  closeAllExcept(waitingScreen, false);
}

function displayGhostScreen() {
  closeAllExcept(ghostScreen, false);
}

function displayChosenShipScreen() {
  closeAllExcept(chosenShipScreen, true);
}

function displayChoosePosScreen() {
  closeAllExcept(choosePosScreen, true);
  choosePosFooter.before(gameBoard);
  gameBoard.style.marginTop = "-15px";
  drawGameBoard({ ...myShip, ...gameBoardDisplay, displayMode: "move" });
}

function displayChooseShipScreen() {
  closeAllExcept(chooseShipScreen, true);
  $("#chooseShipTitle").html("请选择你的船只");
  $("#shipPanelLeft .ship").show();
  $("#shipPanelLeft .item").hide();
  $("#shipPanelLeft").scrollTop(0);
  $("#cancelShopButton").hide();
  $("#shipInfo").hide();
  $("#itemInfo").hide();
  $("#itemMoralLine").hide();
  $("#decideShipTypeButton").prop("disabled", true);
  $("#decideShipTypeButton").unbind("click");
  $("#decideShipTypeButton").bind("click", decideShipType);
  showShopScreen = false;
}

function displayShopScreen({ type, moral }) {
  if (type === "turn" || DEBUG) type = "inTurn";
  closeAllExcept(chooseShipScreen, true);
  $("#shopAnchor").before(gameProgress);
  $("#chooseShipTitle").html("海战大逃杀商店");
  $("#shipPanelLeft .ship").hide();
  $("#shipPanelLeft .item").hide();
  $("#shipPanelLeft .item." + type).show();
  if (currPlayer.items["雷雨弹"]) $("#辣椒弹").hide();
  if (currPlayer.items["辣椒弹"]) $("#雷雨弹").hide();
  $("#shipPanelLeft").scrollTop(0);
  $("#cancelShopButton").show();
  $("#shipInfo").hide();
  $("#itemInfo").hide();
  $("#itemMoralLine").show();
  $("#itemCurrMoral").html(moral);
  $("#itemNewMoral").html("");
  $("#decideShipTypeButton").prop("disabled", true);
  $("#decideShipTypeButton").unbind("click");
  $("#decideShipTypeButton").bind("click", decideItemType);
  $("#cancelShopButton").unbind("click");
  $("#cancelShopButton").bind("click", () => displayGameScreen());
  extraItemInfo = {
    chosen: null,
    price: null,
    prevScreen: false,
    prevScroll: 0,
    needInit: true,
  };
  showShopScreen = true;
  refreshVH();
}

function displayGameScreen() {
  closeAllExcept(gameScreen, true);
  gameMyState.before(gameProgress);
  gameProgress.before(gameBoard);
  gameBoard.style.marginTop = "0px";
}

function toReadablePos(id, atkMode) {
  const pos = id.split("-");
  if (pos.length != 2) {
    return "未知坐标";
  }
  if (atkMode === "row") return `${pos[0]}行`;
  else if (atkMode === "col") return `${toLetter(parseInt(pos[1]))}列`;
  else if (atkMode === "3by3")
    return `${pos[0]}行${toLetter(parseInt(pos[1]))}列起的3*3范围`;
  else return `${pos[0]}行${toLetter(parseInt(pos[1]))}列`;
}

// helper functions

// take in multiple strings, suggest line break in between
function suggestLineBreak(...strs) {
  let res = "";
  for (const str of strs) {
    res += `<span class="d-inline-block">${str}</span>`;
  }
  return res;
}

function toTextInfo(str) {
  return `<span class="text-info">${str}</span>`;
}

function highlight(...components) {
  for (let component of components) component.classList.add("hi");
}

function unhighlight(...components) {
  for (let component of components) component.classList.remove("hi");
}

function linebreak() {
  return "<br/>";
}

function toLetter(num) {
  return String.fromCharCode("A".charCodeAt(0) + num - 1);
}

function enableAllButtonsExcept(...buttons) {
  for (const b of allGameButtons) {
    if (buttons && buttons.includes(b)) disable(b);
    else enable(b);
  }
}

function disableAllButtonsExcept(...buttons) {
  for (const b of allGameButtons) {
    if (buttons && buttons.includes(b)) enable(b);
    else disable(b);
  }
}

function enable(...buttons) {
  for (const b of buttons) {
    if (b.nodeName === "A") {
      b.classList.remove("disabled");
    } else {
      b.disabled = false;
    }
  }
}

function disable(...buttons) {
  for (const b of buttons) {
    if (b.nodeName === "A") {
      b.classList.add("disabled");
    } else {
      b.disabled = true;
    }
  }
}

function inactivateAllDropdownItems() {
  $(".dropdown-item").each((idx, elem) => {
    elem.classList.remove("active");
  });
}

// window-related

window.onload = function () {
  displayInitialScreen();
};

if (!DEBUG) {
  window.addEventListener("beforeunload", (event) => {
    event.returnValue = "你确定要离开吗？";
  });
}

// VH Resize functions

let windowHeight = window.innerHeight;
window.onresize = handleResize;
refreshVH();

function handleResize() {
  if (Math.abs(window.innerHeight - windowHeight) > 10) {
    windowHeight = window.innerHeight;
    refreshVH();
  }
}

function isMobile() {
  return window.innerWidth <= 768;
}

function refreshVH() {
  if (!isMobile()) {
    // only needed for mobile screen
    return;
  }
  gameProgress.style.height = window.innerHeight / 100;
  gameProgress.style.marginTop = window.innerHeight / 100;
  mainContents.style.height = window.innerHeight + "px";
  const headerHeight = statusBar.offsetHeight;
  const footerHeight =
    $("#chooseShipScreen").is(":visible") && showShopScreen
      ? (window.innerHeight / 100) * 2
      : 0;
  shipPanelLeft.style.height =
    window.innerHeight - 15 - headerHeight - 15 - 56 - footerHeight + "px";
  shipPanelRight.style.height =
    window.innerHeight - 15 - headerHeight - 15 - 56 - footerHeight + "px";
  for (const subScreen of subScreenDVH) {
    subScreen.style.height = window.innerHeight - 15 - headerHeight - 15 + "px";
  }
}

// display modal
let infoTimerItvID;
let infoModalHiddenCallback;
$("#infoModal").on("hidden.bs.modal", (e) => {
  if (e.currentTarget.id === "infoModal") {
    if (infoTimerItvID) {
      clearInterval(infoTimerItvID);
      infoTimerItvID = null;
    }
    if (infoModalHiddenCallback) {
      infoModalHiddenCallback();
      infoModalHiddenCallback = null;
    }
  }
});
$("#confirmModal").on("hidden.bs.modal", (e) => {
  if (e.currentTarget.id === "confirmModal") {
    if (screenType.mode && screenType.mode != "reset") {
      setScreenMode({ mode: "reset" });
    }
    if (infoModalHiddenCallback) {
      infoModalHiddenCallback();
      infoModalHiddenCallback = null;
    }
  }
});
$("#infoModal").on("shown.bs.modal", () => {
  if (scrollInfoModalToBottom) {
    $("#infoModalBody").scrollTop($("#infoModalBody").height() + 50);
    $("#infoModalBody").css("visibility", "visible");
    scrollInfoModalToBottom = false;
  }
});
function showInfoModal({ title, msg, duration }) {
  if ($("#infoModal").is(":visible")) {
    infoModalHiddenCallback = () => showInfoModal({ title, msg, duration });
    $("#infoModal").modal("hide");
    return;
  }
  if ($("#confirmModal").is(":visible")) {
    infoModalHiddenCallback = () => showInfoModal({ title, msg, duration });
    $("#confirmModal").modal("hide");
    return;
  }
  $("#infoModalTitle").html(title);
  $("#infoModalBody").html(msg);
  if (!duration) {
    $("#infoModalTimer").hide();
  } else {
    let countdown = duration;
    $("#infoModalTime").html(countdown);
    $("#infoModalTimer").show();
    infoTimerItvID = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        if ($("#infoModal").is(":visible")) {
          $("#infoModal").modal("hide");
        }
        return;
      }
      $("#infoModalTime").html(countdown);
    }, 1000);
  }
  $("#infoModal").modal("show");
}

let confirmModalHiddenCallback;
$("#confirmModal").on("hidden.bs.modal", (e) => {
  if (e.currentTarget.id === "confirmModal") {
    if (confirmModalHiddenCallback) {
      confirmModalHiddenCallback();
      confirmModalHiddenCallback = null;
    }
  }
});

function showConfirmModal({
  title,
  msg,
  callback,
  showAtBottom,
  leftButtonText,
  rightButtonText,
  leftCallback,
  triggerCallbackAfterHidden,
}) {
  if (DEBUG && !showAtBottom) {
    callback();
    return;
  }
  if (title) {
    $("#confirmModalTitle").html(title);
  } else {
    $("#confirmModalTitle").hide();
  }
  $("#confirmModalBody").html(msg);
  if (leftButtonText) {
    $("#confirmModalNoButton").html(leftButtonText);
  } else {
    $("#confirmModalNoButton").html("取消");
  }
  if (rightButtonText) {
    $("#confirmModalYesButton").html(rightButtonText);
  } else {
    $("#confirmModalYesButton").html("确定");
  }
  $("#confirmModalYesButton").unbind("click");
  $("#confirmModalYesButton").on("click", () => {
    if (triggerCallbackAfterHidden) confirmModalHiddenCallback = callback;
    else callback();
  });
  if (leftCallback) {
    $("#confirmModalNoButton").removeClass("btn-secondary");
    $("#confirmModalNoButton").addClass("btn-primary");
    $("#confirmModalNoButton").unbind("click");
    $("#confirmModalNoButton").on("click", () => {
      if (triggerCallbackAfterHidden) confirmModalHiddenCallback = leftCallback;
      else leftCallback();
    });
  } else {
    $("#confirmModalNoButton").unbind("click");
    $("#confirmModalNoButton").removeClass("btn-primary");
    $("#confirmModalNoButton").addClass("btn-secondary");
  }
  if (showAtBottom) {
    $("#confirmModalDialog").addClass("modalDialogEnd");
    $(".modal-backdrop.show").css("opacity", "0.2");
  } else {
    $("#confirmModalDialog").removeClass("modalDialogEnd");
    $(".modal-backdrop.show").css("opacity", "0.5");
  }
  $("#confirmModal").modal({ backdrop: "static", keyboard: false });
}
