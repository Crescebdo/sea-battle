module.exports = { validateShipDecision };

const { SHIP_SETTING } = require("./constants");

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
