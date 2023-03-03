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
socket.on("enterWaitingRoom", handleEnterWaitingRoom);
socket.on("chooseShip", handleChooseShip);
socket.on("shipInfo", handleShipInfo);
socket.on("chosenShip", handleChosenShip); // still need to wait
socket.on("startGame", handleStartGame);

const numToChinese = ["", "单", "双", "三", "四", "五", "六", "七", "八"];
let canvas, ctx;
let gameActive = false;
let shipInfoCache = {};
let myShip = {}; // shipNum, width, height, name, row, col, noGo
let gameBoardInfo = { displayMode: "unknown", shipPos: [] };

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

// screen with status bar
const screenWithStatusBar = document.getElementById("screenWithStatusBar");
const statusTotalPlayerCount = document.getElementById(
  "statusTotalPlayerCount"
);
const statusRoomID = document.getElementById("statusRoomID");
const subScreenDVH = document.getElementsByClassName("subScreenDVH");

// choose ship screen
const chooseShipScreen = document.getElementById("chooseShipScreen");
const shipPanel = document.getElementById("shipPanel");
const shipPanelLeft = document.getElementById("shipPanelLeft");
const shipPanelRight = document.getElementById("shipPanelRight");
const chooseShipHeader = document.getElementById("chooseShipHeader");
const shipName = document.getElementById("shipName");
const shipSize = document.getElementById("shipSize");
const shipAttack = document.getElementById("shipAttack");
const shipSpeed = document.getElementById("shipSpeed");
const shipSkills = document.getElementById("shipSkills");
const shipNote = document.getElementById("shipNote");
const shipQuote = document.getElementById("shipQuote");
const decideShipTypeButton = document.getElementById("decideShipTypeButton");
decideShipTypeButton.addEventListener("click", decideShipType);

// choose ship position screen
const choosePosScreen = document.getElementById("choosePosScreen");
const choosePosHeader = document.getElementById("choosePosHeader");
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
const chosenShipWaitHeader = document.getElementById("chosenShipWaitHeader");
const chosenShipWaitInfo = document.getElementById("chosenShipWaitInfo");
const chosenShipWaitFooter = document.getElementById("chosenShipWaitFooter");
const currentChosen = document.getElementById("currentChosen");
const maxChosen = document.getElementById("maxChosen");

// game screen
const gameScreen = document.getElementById("gameScreen");
const gameBoard = document.getElementById("gameBoard");
const verticalLabels = document.getElementsByClassName("verticalLabel");
const horizontalLabels = document.getElementsByClassName("horizontalLabel");
const gameGrids = new Array(9);
for (let r = 1; r <= 8; r++) {
  gameGrids[r] = new Array(9);
  for (let c = 1; c <= 8; c++) {
    gameGrids[r][c] = document.getElementById(`${r}-${c}`);
  }
}
const gameMyState = document.getElementById("gameMyState");
for (let r = 1; r <= 8; r++) {
  for (let c = 1; c <= 8; c++) {
    gameGrids[r][c].addEventListener("click", () => clickGameGrid(r, c));
  }
}

// handlers

function handleError(msg, showInitialScreen) {
  if (showInitialScreen) displayInitialScreen();
  alert(msg);
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
  } else if (isRoomMaster === false) {
    enterGameButton.style.display = "none";
  }

  // update nickname list
  if (nicknameList) {
    let newList = document.createElement("ul");
    newList.classList.add("list-group");
    let isFirstPlayer = true;
    for (nickname of nicknameList) {
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

function handleChooseShip({ totalPlayerCount, roomID }) {
  displayChooseShipScreen();

  // update status bar
  if (numToChinese[totalPlayerCount]) {
    statusTotalPlayerCount.innerHTML = numToChinese[totalPlayerCount];
  }
  statusRoomID.innerHTML = roomID;
}

function handleShipInfo(shipNum, shipInfo) {
  if (shipInfo.speed === null) {
    shipInfo.speed = Infinity; // Infinity is not serializable and would become null, so convert it back
  }
  shipInfoCache[shipNum] = shipInfo;
  displayShipInfo(shipNum, shipInfo);
}

function handleChosenShip(readyPlayerCount, totalPlayerCount) {
  displayChosenShipScreen();
  currentChosen.innerHTML = readyPlayerCount;
  maxChosen.innerHTML = totalPlayerCount;
}

function handleStartGame(debug) {
  console.log(debug);
}

// button functions

function newGame() {
  const nickname = nicknameInput.value;
  if (!nickname || nickname.length === 0) {
    alert("昵称不可为空");
    return;
  }
  socket.emit("newWaitingRoom", nickname);
}

function joinGame() {
  const nickname = nicknameInput.value;
  if (!nickname || nickname.length === 0) {
    alert("昵称不可为空");
    return;
  }
  const roomID = roomIDInput.value;
  if (!roomID || roomID.length === 0) {
    alert("房间号不可为空");
    return;
  }
  socket.emit("joinWaitingRoom", { roomID, nickname });
}

function enterGame() {
  const confirmed = DEBUG || window.confirm("确认要开始游戏吗？");
  if (!confirmed) {
    return;
  }
  socket.emit("enterGame");
}

function showShipInfo(shipNum) {
  if (shipInfoCache[shipNum]) {
    displayShipInfo(shipNum, shipInfoCache[shipNum]);
  } else {
    socket.emit("getShipInfo", shipNum);
  }
}

function decideShipType() {
  if (!"shipNum" in myShip) {
    alert("啊咧？尚未选择船只哦");
    return;
  }
  if (!shipInfoCache[myShip.shipNum]) {
    alert("啊咧？找不到该船只的信息……");
    return;
  }
  myShip.width = shipInfoCache[myShip.shipNum].width;
  myShip.height = shipInfoCache[myShip.shipNum].height;
  myShip.name = shipInfoCache[myShip.shipNum].name;
  myShip.noGo = { rows: new Set(), cols: new Set() };
  displayChoosePosScreen();

  choosePosShipName.innerHTML = myShip.name;
  choosePosShipSize.innerHTML = `${myShip.width}×${myShip.height}`;

  gameBoardInfo.displayMode = "move";
  initGameBoard(myShip);
}

function clickGameGrid(row, col) {
  if (gameBoardInfo.displayMode === "move") {
    moveShip({ row, col, noGo: myShip.noGo });
    decidePosButton.disabled = false;
  }
}

function toggleShipDirection() {
  [myShip.width, myShip.height] = [myShip.height, myShip.width];
  initGameBoard(myShip);
  moveShip(myShip);
  choosePosShipSize.innerHTML = `${myShip.width}×${myShip.height}`;
}

function decideShipPosition() {
  socket.emit("decideShip", myShip);
}

// helper functions

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
  myShip.shipNum = shipNum;
  let combinedName =
    '<span class="d-inline-block">' +
    name +
    '</span><span class="d-inline-block">';
  for (let i = 0; i < health; i++) combinedName += "🩸";
  combinedName += "</span>";
  shipName.innerHTML = combinedName;
  shipSize.innerHTML = "体积：" + width + "×" + height;
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
  for (s of skills) {
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

function initGameBoard({ width, height, noGo }) {
  if (!width || !height || width < 0 || height < 0) {
    alert("啊咧？船只尺寸不合法");
    return;
  }
  for (let r = 1; r <= 8; r++)
    for (let c = 1; c <= 8; c++) {
      gameGrids[r][c].disabled = isGridDisabled(
        r,
        c,
        myShip.width,
        myShip.height,
        noGo
      );
    }
}

function moveShip({ row, col, noGo }) {
  for (const [r, c] of gameBoardInfo.shipPos) {
    gameGrids[r][c].innerText = "";
  }
  gameBoardInfo.shipPos = [];
  for (let r = row; r < row + myShip.height; r++)
    for (let c = col; c < col + myShip.width; c++) {
      gameBoardInfo.shipPos.push([r, c]);
      gameGrids[r][c].innerText = "🚢";
    }
  toggleShipDirectionButton.disabled =
    myShip.width === myShip.height ||
    isGridDisabled(row, col, myShip.height, myShip.width, noGo);
  myShip.row = row;
  myShip.col = col;
}

function isGridDisabled(row, col, width, height, noGo) {
  if (
    noGo.rows.has(row) ||
    noGo.rows.has(row + height - 1) ||
    noGo.cols.has(col) ||
    noGo.cols.has(col + width) ||
    row + height > 9 ||
    col + width > 9
  ) {
    return true;
  } else {
    return false;
  }
}

if (!DEBUG) {
  window.onload = function () {
    window.addEventListener("beforeunload", function (e) {
      e.preventDefault();
      e.returnValue = "";
      var confirmationMessage = "你确认要离开吗？这将退出游戏。";
      e.returnValue = confirmationMessage;
      return confirmationMessage;
    });
  };
}

// Hide loading when done

window.onload = function () {
  displayInitialScreen();
};

// Display screens

function displayInitialScreen() {
  loadingScreen.style.display = "none";
  waitingScreen.style.display = "none";
  ghostScreen.style.display = "none";
  screenWithStatusBar.style.display = "none";

  initialScreen.style.display = "block";
}

function displayWaitingScreen() {
  initialScreen.style.display = "none";
  waitingScreen.style.display = "block";
}

function displayGhostScreen() {
  initialScreen.style.display = "none";
  ghostScreen.style.display = "block";
}

function displayChosenShipScreen() {
  choosePosScreen.style.display = "none";
  gameMyState.before(gameBoard);
  gameBoard.style.marginTop = "15px";
  for (const lb of [...verticalLabels, ...horizontalLabels]) {
    lb.classList.remove("text-white");
  }
  screenWithStatusBar.style.display = "block";
  chosenShipScreen.style.display = "block";
}

function displayChoosePosScreen() {
  chooseShipScreen.style.display = "none";
  screenWithStatusBar.style.display = "block";
  choosePosScreen.style.display = "block";
  choosePosFooter.before(gameBoard);
  gameBoard.style.marginTop = "-15px";
  for (const lb of [...verticalLabels, ...horizontalLabels]) {
    lb.className += " text-white";
  }
}

function displayChooseShipScreen() {
  waitingScreen.style.display = "none";
  screenWithStatusBar.style.display = "block";
  chooseShipScreen.style.display = "block";
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
  mainContents.style.height = window.innerHeight + "px";
  shipPanelLeft.style.height = window.innerHeight - 15 - 24.2 - 15 - 56 + "px";
  shipPanelRight.style.height = window.innerHeight - 15 - 24.2 - 15 - 56 + "px";
  for (const subScreen of subScreenDVH) {
    subScreen.style.height = window.innerHeight - 15 - 24.2 - 15 + "px";
  }
}
