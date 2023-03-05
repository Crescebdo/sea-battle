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
  shipSetting = SHIP_SETTING;
  displayShipInfo(shipNum, shipSetting.shipNum);
});
socket.on("chooseShip", handleChooseShip);
socket.on("chosenShip", handleChosenShip); // still need to wait
socket.on("updateGame", handleUpdateGame);
socket.on("debug", (d) => console.log(d));

const playerCountChinese = ["", "单", "双", "三", "四", "五", "六", "七", "八"];
let timerStart;
let timerIntervalID;
let shipSetting = [];
let myShip = {}; // shipNum, width, height, name, row, col
let gameBoardDisplay = {
  displayMode: "unknown",
  noGo: { rows: [], cols: [] },
  shipPos: [], // all grids of previous ship
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
const gameAircraftLine = document.getElementById("gameAircraftLine");
const gameAircraftCurr = document.getElementById("gameAircraftCurr");
const gameAircraftMax = document.getElementById("gameAircraftMax");
const gameStateMidDummy = document.getElementById("gameStateMidDummy");
for (let r = 1; r <= 8; r++) {
  for (let c = 1; c <= 8; c++) {
    gameGrids[r][c].addEventListener("click", () => clickGameGrid(r, c));
  }
}
const gameHint = document.getElementById("gameHint");
const gameProgressBar = document.getElementById("gameProgressBar");

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

// todo
function handleRestore({
  stage,
  totalPlayerCount,
  roomID,
  ship,
  SHIP_SETTING,
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

function handleChooseShip({ totalPlayerCount, roomID, SHIP_SETTING }) {
  shipSetting = SHIP_SETTING;
  displayChooseShipScreen();
  updateStatusBar({ totalPlayerCount, roomID });
}

function handleChosenShip(readyPlayerCount, totalPlayerCount) {
  displayChosenShipScreen();
  currentChosen.innerHTML = readyPlayerCount;
  maxChosen.innerHTML = totalPlayerCount;
}

function handleUpdateGame({ phase, board, player }) {
  console.log(phase, board);
  if (phase.startGame) {
    displayGameScreen();
    startTimer();
  }
  updateProgressBar(phase.duration);
  updateStatusBar({ ...board });
  updateHint({ ...phase });
  updateGameBoard({ phase, board });
  console.log(player);
  updateState({ ...player });
  if (phase.modal) {
    showInfoModal({ ...phase.modal });
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
const showShipInfo = (shipNum) => {
  if (shipSetting[shipNum]) {
    displayShipInfo(shipNum, shipSetting[shipNum]);
  } else {
    socket.emit("getShipSetting", shipNum);
  }
};
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

function clickGameGrid(row, col) {
  if (gameBoardDisplay.displayMode === "move") {
    moveShip({ row, col });
    decidePosButton.disabled = false;
  }
}

function toggleShipDirection() {
  [myShip.width, myShip.height] = [myShip.height, myShip.width];
  drawGameBoard({ ...myShip, ...gameBoardDisplay });
  moveShip(myShip);
  choosePosShipSize.innerHTML = `${myShip.width}&times;${myShip.height}`;
}

function decideShipPosition() {
  showConfirmModal({
    msg: `确认要将船放在此位置吗？<br/><small><span class="d-inline-block">方向（横向/竖向）确定后，</span
                  ><span class="d-inline-block"
                    >在游戏过程中将无法再更改</span
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

function updateGameBoard({ phase, board }) {
  if (phase.type === "wait") {
    gameBoardDisplay.displayMode = "none";
    gameBoardDisplay.noGo = board.noGo;
    drawGameBoard({ ...myShip, ...gameBoardDisplay });
  }
}

function drawGameBoard({ width, height, noGo, displayMode }) {
  if (!width || !height || width < 0 || height < 0) {
    handleError("啊咧？船只尺寸不合法", false);
    return;
  }
  for (let r = 1; r <= 8; r++)
    for (let c = 1; c <= 8; c++) {
      if (noGo.rows.includes(r) || noGo.cols.includes(c)) {
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
  for (const [r, c] of gameBoardDisplay.shipPos) {
    gameGrids[r][c].innerText = "";
  }
  gameBoardDisplay.shipPos = [];
  for (let r = row; r < row + myShip.height; r++)
    for (let c = col; c < col + myShip.width; c++) {
      gameBoardDisplay.shipPos.push([r, c]);
      gameGrids[r][c].innerText = "🚢";
    }
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

function updateHint({ hint }) {
  if (hint) gameHint.innerHTML = hint;
}

if (!DEBUG) {
  window.addEventListener("beforeunload", (event) => {
    event.returnValue = "你确定要离开吗？";
  });
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

function updateStatusBar({ roundNum, weather, totalPlayerCount, roomID }) {
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
    gameShipImg.src = `asset/images/ships/${
      shipSetting[ship.typeNum].name
    }.jpg`;
    gameShipCaption.innerHTML = shipSetting[ship.typeNum].name;
    gameHealth.innerHTML = "🩸".repeat(ship.health);
    gameMoral.innerHTML = moral;
    gameSpeedCurr.innerHTML = ship.speed;
    gameSpeedMax.innerHTML = shipSetting[ship.typeNum].speed;
    let rightRowCount = 0;
    if (shipSetting[ship.typeNum].cannon) {
      gameCannonCurr.innerHTML = ship.attack.cannon;
      gameCannonMax.innerHTML = shipSetting[ship.typeNum].cannon;
      gameCannonLine.style.display = "block";
      rightRowCount++;
    } else {
      gameCannonLine.style.display = "none";
    }
    if (shipSetting[ship.typeNum].torpedo) {
      gameTorpedoCurr.innerHTML = ship.attack.torpedo;
      gameTorpedoMax.innerHTML = shipSetting[ship.typeNum].torpedo;
      gameTorpedoLine.style.display = "block";
      rightRowCount++;
    } else {
      gameTorpedoLine.style.display = "none";
    }
    if (shipSetting[ship.typeNum].aircraft) {
      gameAircraftCurr.innerHTML = ship.attack.aircraft;
      gameAircraftMax.innerHTML = shipSetting[ship.typeNum].aircraft;
      gameAircraftLine.style.display = "block";
      rightRowCount++;
    } else {
      gameAircraftLine.style.display = "none";
    }
    if (rightRowCount === 3) {
      gameStateMidDummy.style.visibility = "hidden";
      gameStateMidDummy.style.display = "block";
    } else {
      gameStateMidDummy.style.display = "none";
    }
  }
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
  gameBoardDisplay.displayMode = "move";
  drawGameBoard({ ...myShip, ...gameBoardDisplay });
}

function displayChooseShipScreen() {
  closeAllExcept(chooseShipScreen, true);
}

function displayGameScreen() {
  closeAllExcept(gameScreen, true);
  gameProgress.before(gameBoard);
  gameBoard.style.marginTop = "0px";
  gameBoardDisplay.displayMode = "none";
  drawGameBoard({ ...myShip, ...gameBoardDisplay });
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
let infoTimerItvID;
let reoepnCallback;
$("#infoModal").on("hidden.bs.modal", (e) => {
  if (e.currentTarget.id === "infoModal") {
    if (infoTimerItvID) {
      clearInterval(infoTimerItvID);
      infoTimerItvID = null;
    }
    if (reoepnCallback) {
      reoepnCallback();
      reoepnCallback = null;
    }
  }
});
function showInfoModal({ title, msg, duration }) {
  if ($("#infoModal").is(":visible")) {
    reoepnCallback = () => showInfoModal({ title, msg, duration });
    $("#infoModal").modal("hide");
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

function showConfirmModal({ title, msg, callback }) {
  if (DEBUG) {
    callback();
    return;
  }
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
