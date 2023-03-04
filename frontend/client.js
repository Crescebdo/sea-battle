/*global io */
const DEBUG = false;
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
socket.on("chooseShip", handleChooseShip);
socket.on("shipInfo", handleShipInfo);
socket.on("chosenShip", handleChosenShip); // still need to wait
socket.on("startGame", handleStartGame);

const playerCountChinese = ["", "单", "双", "三", "四", "五", "六", "七", "八"];
let timerStart;
let timerIntervalID;
let shipInfoCache = {};
let myShip = {}; // shipNum, width, height, name, row, col
let gameBoardInfo = {
  displayMode: "unknown",
  noGo: { rows: [], cols: [] },
  shipPos: [],
};

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
const statusTurnNumLine = document.getElementById("statusTurnNumLine");
const statusTurnNum = document.getElementById("statusTurnNum");
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
decideShipTypeButton.addEventListener("click", decideShipType);

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
for (let r = 1; r <= 8; r++) {
  for (let c = 1; c <= 8; c++) {
    gameGrids[r][c].addEventListener("click", () => clickGameGrid(r, c));
  }
}

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

function handleRestore({ stage, totalPlayerCount, roomID, ship }) {
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

function handleChooseShip({ totalPlayerCount, roomID }) {
  displayChooseShipScreen();
  updateStatusBar({ totalPlayerCount, roomID });
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

function handleStartGame(turnNum, weather, debug) {
  displayGameScreen();
  updateStatusBar({ turnNum, weather });
  startTimer();
  console.log(debug);
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
const showShipInfo = (shipNum) => {
  if (shipInfoCache[shipNum]) {
    displayShipInfo(shipNum, shipInfoCache[shipNum]);
  } else {
    socket.emit("getShipInfo", shipNum);
  }
};
/* eslint-enable */

function decideShipType() {
  if (isNaN(myShip.shipNum)) {
    handleError("啊咧？尚未选择船只哦", false);
    return;
  }
  if (!shipInfoCache[myShip.shipNum]) {
    handleError("啊咧？找不到该船只的信息……", false);
    return;
  }
  showConfirmModal({
    msg: `确认要选择${shipInfoCache[myShip.shipNum].name}吗？`,
    callback: () => {
      myShip.width = shipInfoCache[myShip.shipNum].width;
      myShip.height = shipInfoCache[myShip.shipNum].height;
      myShip.name = shipInfoCache[myShip.shipNum].name;

      choosePosShipName.innerHTML = myShip.name;
      choosePosShipSize.innerHTML = `${myShip.width}&times;${myShip.height}`;
      displayChoosePosScreen();
    },
  });
}

function clickGameGrid(row, col) {
  if (gameBoardInfo.displayMode === "move") {
    moveShip({ row, col });
    decidePosButton.disabled = false;
  }
}

function toggleShipDirection() {
  [myShip.width, myShip.height] = [myShip.height, myShip.width];
  drawGameBoard({ ...myShip, ...gameBoardInfo });
  moveShip(myShip);
  choosePosShipSize.innerHTML = `${myShip.width}&times;${myShip.height}`;
}

function decideShipPosition() {
  showConfirmModal({
    msg: `确认要将船放在此位置吗？<br/><small><span class="d-inline-block">方向（横向/竖向）确定后，</span
                  ><span class="d-inline-block"
                    >在游戏过程中将无法再更改。</span
                  ></small>`,
    callback: () => socket.emit("decideShip", myShip),
  });
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
  shipInfo.scrollTop = 0;
  myShip.shipNum = shipNum;
  let combinedName =
    '<span class="d-inline-block">' +
    name +
    '</span><span class="d-inline-block">';
  for (let i = 0; i < health; i++) combinedName += "🩸";
  combinedName += "</span>";
  shipName.innerHTML = combinedName;
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

function drawGameBoard({ width, height, noGo, displayMode }) {
  if (!width || !height || width < 0 || height < 0) {
    handleError("啊咧？船只尺寸不合法", false);
    return;
  }
  for (let r = 1; r <= 8; r++)
    for (let c = 1; c <= 8; c++) {
      if (noGo.rows.includes(r)) {
        gameGrids[r][c].disabled = true;
        gameGrids[r][c].classList.add("noGo");
      } else {
        gameGrids[r][c].classList.remove("noGo");
        if (displayMode === "move") {
          gameGrids[r][c].disabled = isGridDisabled(r, c, width, height, noGo);
          gameGrids[r][c].classList.remove("normalColor");
        } else if (displayMode === "none") {
          gameGrids[r][c].disabled = true;
          gameGrids[r][c].classList.add("normalColor");
        }
      }
    }
}

function moveShip({ row, col }) {
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
    isGridDisabled(row, col, myShip.height, myShip.width, gameBoardInfo.noGo);
  myShip.row = row;
  myShip.col = col;
}

function isGridDisabled(row, col, width, height, noGo) {
  if (
    noGo.rows.includes(row) ||
    noGo.rows.includes(row + height - 1) ||
    noGo.cols.includes(col) ||
    noGo.cols.includes(col + width) ||
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

// display functions

function closeAllExcept(activeScreen, hasStatusBar) {
  for (const screen of allScreens.filter((s) => s.id != activeScreen.id)) {
    screen.style.display = "none";
  }
  screenWithStatusBar.style.display = hasStatusBar ? "block" : "none";
  activeScreen.style.display = "block";
  if (!hasStatusBar) hideTimer();
}

function updateStatusBar({ turnNum, weather, totalPlayerCount, roomID }) {
  let doRefreshVH = false;
  if (turnNum && weather) {
    statusTurnNumLine.style.visibility = "visible";
    statusTurnNum.innerHTML = turnNum;
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
  timerIntervalID = setInterval(function () {
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
  gameBoardInfo.displayMode = "move";
  drawGameBoard({ ...myShip, ...gameBoardInfo });
}

function displayChooseShipScreen() {
  closeAllExcept(chooseShipScreen, true);
}

function displayGameScreen() {
  closeAllExcept(gameScreen, true);
  gameMyState.before(gameBoard);
  gameBoard.style.marginTop = "15px";
  gameBoardInfo.displayMode = "none";
  drawGameBoard({ ...myShip, ...gameBoardInfo });
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
  const headerHeight = statusBar.offsetHeight;
  shipPanelLeft.style.height =
    window.innerHeight - 15 - headerHeight - 15 - 56 + "px";
  shipPanelRight.style.height =
    window.innerHeight - 15 - headerHeight - 15 - 56 + "px";
  for (const subScreen of subScreenDVH) {
    subScreen.style.height = window.innerHeight - 15 - headerHeight - 15 + "px";
  }
}

// display modal
function showInfoModal({ title, msg }) {
  $("#infoModalTitle").html(title);
  $("#infoModalBody").html(msg);
  $("#infoModal").modal("show");
}

function showConfirmModal({ title, msg, callback }) {
  if (title) {
    $("#confirmModalTitle").html(title);
  } else {
    $("#confirmModalTitle").hide();
  }
  $("#confirmModalBody").html(msg);
  $("#confirmModalYesButton").unbind("click");
  $("#confirmModalYesButton").on("click", () => {
    callback();
  });
  $("#confirmModal").modal({ backdrop: "static", keyboard: false });
}
