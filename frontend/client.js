const DEBUG = true;
const API_SERVER = "https://api.crescb.com";
// const API_SERVER = "http://localhost:3000";

// responses to server
const socket = io(API_SERVER, {
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelay: 1000,
  reconnectionAttempts: DEBUG ? 1 : 10,
  withCredentials: true,
});
socket.on("enterWaitingRoom", handleEnterWaitingRoom);
socket.on("unknownCode", handleUnknownCode);
socket.on("tooManyPlayers", handleTooManyPlayers);
socket.on("alreadyInWaitingRoom", handleAlreadyInWaitingRoom);
socket.on("shipInfo", handleShipInfo);

let canvas, ctx;
let playerNumber;
let gameActive = false;
let shipInfoCache = new Map();

// loading screen
const loadingScreen = document.getElementById("loadingScreen");

// init screen
const initialScreen = document.getElementById("initialScreen");
const newGameBtn = document.getElementById("newGameButton");
const joinGameBtn = document.getElementById("joinGameButton");
const gameCodeInput = document.getElementById("gameCodeInput");
const nicknameInput = document.getElementById("nicknameInput");

// waiting screen
const waitingScreen = document.getElementById("waitingScreen");
const gameCodeDisplay = document.getElementById("gameCodeDisplay");
const currentPlayerNumDisplay = document.getElementById(
  "currentPlayerNumDisplay"
);
const maxPlayerNumDisplay = document.getElementById("maxPlayerNumDisplay");
const currentPlayerListWrap = document.getElementById("currentPlayerListWrap");
const startGameButton = document.getElementById("startGameButton");

// choose ship screen
const chooseShipOverlay = document.getElementById("chooseShipOverlay");
const shipName = document.getElementById("shipName");
const shipSize = document.getElementById("shipSize");
const shipAttack = document.getElementById("shipAttack");
const shipSpeed = document.getElementById("shipSpeed");
const shipSkills = document.getElementById("shipSkills");
const chooseShipButton = document.getElementById("chooseShipButton");

// game screen
const gameScreen = document.getElementById("gameScreen");

// buttons
newGameBtn.addEventListener("click", newGame);
joinGameBtn.addEventListener("click", joinGame);
startGameButton.addEventListener("click", startGame);
chooseShipButton.addEventListener("click", chooseShip);

function handleEnterWaitingRoom({
  gameCode,
  nicknameList,
  minPlayerNum,
  maxPlayerNum,
  isRoomMaster,
}) {
  // show wait screen
  initialScreen.style.display = "none";
  waitingScreen.style.display = "block";

  // update game code
  if (gameCode) {
    gameCodeDisplay.innerText = gameCode;
  }

  // update current num of players
  if (nicknameList) {
    currentPlayerNumDisplay.innerText = nicknameList.length;
    // update whether you can start game based on minPlayerNum
    if (minPlayerNum && nicknameList.length < minPlayerNum) {
      startGameButton.disabled = true;
      startGameButton.innerHTML = "最少人数：" + minPlayerNum;
    } else {
      startGameButton.disabled = false;
      startGameButton.innerHTML = "开始游戏";
    }
  }

  if (maxPlayerNum) {
    // update max num of players
    maxPlayerNumDisplay.innerText = maxPlayerNum;
  }

  // update "start game" based on if is room master
  if (isRoomMaster) {
    startGameButton.style.display = "inline-block";
  } else if (isRoomMaster === false) {
    startGameButton.style.display = "none";
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

function handleUnknownCode() {
  reset();
  alert("不存在该房间号");
}

function handleTooManyPlayers() {
  reset();
  alert("该房间已开始游戏");
}

function handleAlreadyInWaitingRoom() {
  alert("你已在等待室中");
}

function handleShipInfo(shipNum, shipInfo) {
  if (!shipInfo) {
    alert("啊咧？获取船只信息失败……");
    return;
  }
  if (!shipInfo.speed) {
    shipInfo.speed = Infinity; // somehow, socket.io doesn't seem to be able to send Infinity
  }
  shipInfoCache[shipNum] = shipInfo;
  displayShipInfo(shipInfo);
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
  const gameCode = gameCodeInput.value;
  if (!gameCode || gameCode.length === 0) {
    alert("房间号不可为空");
    return;
  }
  socket.emit("joinWaitingRoom", { gameCode, nickname });
}

function startGame() {
  const confirmed = DEBUG || window.confirm("确认要开始游戏吗？");
  if (!confirmed) {
    return;
  }

  // show game screen
  waitingScreen.style.display = "none";
  gameScreen.style.display = "block";

  // choose ship
  chooseShipOverlay.style.display = "block";
}

function showShipInfo(shipNum) {
  if (shipInfoCache.has(shipNum)) {
    displayShipInfo(shipInfoCache[shipNum]);
  } else {
    socket.emit("getShipInfo", shipNum);
  }
}

function chooseShip() {}

function reset() {
  playerNumber = null;
  initialScreen.style.display = "block";
  gameScreen.style.display = "none";
}

function displayShipInfo({
  name,
  health,
  width,
  height,
  cannon,
  torpedo,
  aircraft,
  speed,
  skills,
}) {
  let combinedName = name + " ";
  for (let i = 0; i < health; i++) combinedName += "🩸";
  shipName.innerHTML = combinedName;
  shipSize.innerHTML = "体积：" + width + "×" + height;
  let combinedAttack = "攻击：";
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
  shipAttack.innerHTML = combinedAttack;
  if (speed === Infinity) {
    shipSpeed.innerHTML = "航速：无限";
  } else {
    shipSpeed.innerHTML = "航速：" + speed + "格";
  }
  shipSkills.innerHTML = "";
  for (s of skills) {
    const shipSkillName = document.createElement("h3");
    shipSkillName.innerHTML = s.skillName;
    shipSkills.appendChild(shipSkillName);
    const shipSkillDescription = document.createElement("p");
    shipSkillDescription.innerHTML = s.description;
    shipSkills.appendChild(shipSkillDescription);
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

window.onload = function () {
  loadingScreen.style.display = "none";
  initialScreen.style.display = "block";
};
