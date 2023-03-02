const DEBUG = true;
// const API_SERVER = "https://api.crescb.com";
const API_SERVER = "http://localhost:3000";

// responses to server
const socket = io(API_SERVER, {
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelay: 1000,
  reconnectionAttempts: DEBUG ? 1 : 10,
  withCredentials: true,
});
socket.on("error", handleError);
socket.on("enterWaitingRoom", handleEnterWaitingRoom);
socket.on("chooseShip", handleChooseShip);
socket.on("shipInfo", handleShipInfo);

let canvas, ctx;
let gameActive = false;
let shipInfoCache = {};
let chosenShipNum = null;

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
const enterGameButton = document.getElementById("enterGameButton");

// choose ship screen
const chooseShipOverlay = document.getElementById("chooseShipOverlay");
const shipName = document.getElementById("shipName");
const shipSize = document.getElementById("shipSize");
const shipAttack = document.getElementById("shipAttack");
const shipSpeed = document.getElementById("shipSpeed");
const shipSkills = document.getElementById("shipSkills");
const shipNote = document.getElementById("shipNote");
const shipQuote = document.getElementById("shipQuote");
const decideShipButton = document.getElementById("decideShipButton");

// game screen
const gameScreen = document.getElementById("gameScreen");

// buttons
newGameBtn.addEventListener("click", newGame);
joinGameBtn.addEventListener("click", joinGame);
enterGameButton.addEventListener("click", enterGame);
decideShipButton.addEventListener("click", decideShip);

function handleError(msg, doReset) {
  if (doReset) reset();
  alert(msg);
}

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
    gameCodeDisplay.innerHTML = gameCode;
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

function handleChooseShip() {
  // show game screen
  waitingScreen.style.display = "none";
  gameScreen.style.display = "block";

  // choose ship
  chooseShipOverlay.style.display = "block";
}

function handleShipInfo(shipNum, shipInfo) {
  if (shipInfo.speed === null) {
    shipInfo.speed = Infinity; // Infinity is not serializable and would become null, so convert it back
  }
  shipInfoCache[shipNum] = shipInfo;
  displayShipInfo(shipNum, shipInfo);
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

function decideShip() {
  if (chosenShipNum === null) {
    alert("啊咧？尚未选择船只哦");
    return;
  }

  chooseShipOverlay.style.display = "none";
}

function reset() {
  initialScreen.style.display = "block";
  waitingScreen.style.display = "none";
  chooseShipOverlay.style.display = "none";
  gameScreen.style.display = "none";
}

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
  chosenShipNum = shipNum;
  let combinedName = name + " ";
  for (let i = 0; i < health; i++) combinedName += "🩸";
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
  decideShipButton.disabled = false;
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
