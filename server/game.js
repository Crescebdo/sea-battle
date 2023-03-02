module.exports = {
  initGameState,
};

function initGameState(clients) {
  // shuffle
  return clients.sort((a, b) => 0.5 - Math.random());
}
