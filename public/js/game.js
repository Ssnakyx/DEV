let socket
let gameCode = ""
let playerRole = ""
let currentPlayer = "X"
let cells = Array(9).fill(null)
let gameOver = false
let isHost = false
let username = ""
const opponentUsername = ""
const scores = {
  X: 0,
  O: 0,
  draw: 0,
}
document.addEventListener("DOMContentLoaded", () => {
  console.log("Game page loaded")
  gameCode = sessionStorage.getItem("gameCode")
  playerRole = sessionStorage.getItem("playerRole")
  isHost = sessionStorage.getItem("isHost") === "true"
  username = sessionStorage.getItem("username") || ""
  console.log("Session data:", { gameCode, playerRole, isHost, username })
  if (!gameCode || !playerRole || !username) {
    console.error("Missing game session data")
    document.getElementById("statusMessage").textContent = "Error: Game session not found"
    return
  }
  createBoard()
  connectToServer()
  document.getElementById("restartGame").addEventListener("click", requestRestart)
  if (isHost) {
    document.getElementById("restartGame").textContent = "New Game"
  } else {
    document.getElementById("restartGame").textContent = "Ask Host to Restart"
  }
})
function createBoard() {
  console.log("Creating game board")
  const board = document.getElementById("board")
  board.innerHTML = ""
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("div")
    cell.classList.add("cell")
    cell.dataset.index = i
    board.appendChild(cell)
  }
  board.addEventListener("click", handleCellClick)
  console.log("Board created with click listeners")
}
function connectToServer() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const wsUrl = `${protocol}//${window.location.hostname}:8080/ws`
  console.log("Connecting to WebSocket server:", wsUrl)
  socket = new WebSocket(wsUrl)
  socket.onopen = () => {
    console.log("WebSocket connection established")
    socket.send(
      JSON.stringify({
        type: "join",
        payload: JSON.stringify({ code: gameCode, username: username }),
        username: username,
      }),
    )
    const hostText = isHost ? " (Host)" : ""
    document.getElementById("statusMessage").textContent =
      `Welcome ${username}! You are Player ${playerRole}${hostText} - Connecting to game...`
  }
  socket.onclose = (event) => {
    console.log("WebSocket connection closed:", event)
    document.getElementById("statusMessage").textContent = "Disconnected from server"
  }
  socket.onerror = (error) => {
    console.error("WebSocket error:", error)
    document.getElementById("statusMessage").textContent = "Error connecting to server"
  }
  socket.onmessage = (event) => {
    console.log("Message received:", event.data)
    try {
      const msg = JSON.parse(event.data)
      handleMessage(msg)
    } catch (error) {
      console.error("Error parsing message:", error)
    }
  }
}
function handleMessage(msg) {
  console.log("Processing message:", msg)
  switch (msg.type) {
    case "roomJoined":
      handleRoomJoined(JSON.parse(msg.payload))
      break
    case "gameState":
      handleGameState(JSON.parse(msg.payload))
      break
    case "move":
      handleMove(JSON.parse(msg.payload), true)
      break
    case "restart":
      resetGame(true)
      break
    case "gameEnd":
      handleGameEnd(JSON.parse(msg.payload))
      break
    case "playerLeft":
      handlePlayerLeft(JSON.parse(msg.payload))
      break
    case "hostLeft":
      document.getElementById("statusMessage").textContent = "Host left the game - returning to menu"
      setTimeout(() => {
        window.location.href = "index.html"
      }, 3000)
      break
    case "error":
      document.getElementById("statusMessage").textContent = `Error: ${msg.payload}`
      break
  }
}
function handlePlayerLeft(data) {
  if (data.isHost) {
    document.getElementById("statusMessage").textContent = `Host ${data.username} left the game`
  } else {
    document.getElementById("statusMessage").textContent = `${data.username} left the game`
  }
}
function handleGameState(state) {
  console.log("Received game state:", state)
  if (state.board) {
    for (let i = 0; i < 9; i++) {
      if (state.board[i]) {
        cells[i] = state.board[i]
        const cell = document.querySelector(`.cell[data-index="${i}"]`)
        if (cell) {
          cell.textContent = state.board[i]
          cell.classList.add(state.board[i].toLowerCase())
        }
      }
    }
    currentPlayer = state.currentTurn
    gameOver = !state.gameActive
    updateStatusMessage()
    updateTurnIndicator()
  }
}
function handleRoomJoined(data) {
  console.log("Room joined:", data)
  gameCode = data.code
  playerRole = data.role
  isHost = data.isHost
  sessionStorage.setItem("gameCode", gameCode)
  sessionStorage.setItem("playerRole", playerRole)
  sessionStorage.setItem("isHost", isHost.toString())
  socket.send(
    JSON.stringify({
      type: "getGameState",
      payload: JSON.stringify({ code: gameCode }),
    }),
  )
}
function handleCellClick(event) {
  if (!event.target.classList.contains("cell")) return
  const index = Number.parseInt(event.target.dataset.index)
  console.log("Cell clicked:", index)
  if (cells[index] || gameOver) {
    console.log("Invalid move: Cell occupied or game over")
    return
  }
  if (currentPlayer !== playerRole) {
    console.log("Not your turn")
    const hostText = isHost ? " (You go first as host)" : " (Host goes first)"
    document.getElementById("statusMessage").textContent = `Not your turn!${hostText}`
    const statusEl = document.getElementById("statusMessage")
    statusEl.classList.add("flash")
    setTimeout(() => statusEl.classList.remove("flash"), 1000)
    return
  }
  console.log("Valid move, sending to server")
  socket.send(
    JSON.stringify({
      type: "move",
      payload: JSON.stringify({
        index: index,
        player: playerRole,
      }),
    }),
  )
}
function handleMove(move, isRemote) {
  console.log("Handling move:", move, "Remote:", isRemote)
  const index = move.index
  const player = move.player
  const moveUsername = move.username || "Unknown"
  cells[index] = player
  const cell = document.querySelector(`.cell[data-index="${index}"]`)
  if (cell) {
    cell.textContent = player
    cell.classList.add(player.toLowerCase())
    cell.classList.add("new-move")
    setTimeout(() => cell.classList.remove("new-move"), 500)
  }
  currentPlayer = currentPlayer === "X" ? "O" : "X"
  updateStatusMessage()
  updateTurnIndicator()
}
function updateStatusMessage() {
  const statusEl = document.getElementById("statusMessage")
  if (gameOver) {
    statusEl.textContent = "Game Over!"
    return
  }
  const hostText = isHost ? " (Host)" : ""
  if (currentPlayer === playerRole) {
    statusEl.textContent = `${username}, it's your turn!${hostText}`
    statusEl.classList.add("your-turn")
    statusEl.classList.remove("waiting")
  } else {
    const waitingFor = currentPlayer === "X" ? "Host (X)" : "Player O"
    statusEl.textContent = `Waiting for ${waitingFor}...`
    statusEl.classList.add("waiting")
    statusEl.classList.remove("your-turn")
  }
}
function updateTurnIndicator() {
  document.querySelectorAll(".player-indicator").forEach((el) => {
    el.classList.remove("active")
  })
  const activePlayer = currentPlayer === "X" ? "X" : "O"
  const indicator = document.getElementById(`player${activePlayer}Indicator`)
  if (indicator) {
    indicator.classList.add("active")
  }
  document.getElementById("playerXIndicator").textContent =
    `${username} (X)${isHost && playerRole === "X" ? " - Host" : ""}`
  document.getElementById("playerOIndicator").textContent =
    `Player O${!isHost && playerRole === "O" ? ` - ${username}` : ""}`
}
function handleGameEnd(result) {
  console.log("Game ended:", result)
  gameOver = true
  const statusEl = document.getElementById("statusMessage")
  if (result.winner === "draw") {
    statusEl.textContent = "It's a draw!"
    statusEl.classList.add("game-draw")
    scores.draw++
    document.getElementById("scoreDraw").textContent = scores.draw
    updateStats("draw")
  } else {
    const winnerUsername = result.winnerUsername || "Unknown"
    if (result.winner === playerRole) {
      statusEl.textContent = `You win, ${username}!`
      statusEl.classList.add("game-win")
      updateStats("win")
    } else {
      statusEl.textContent = `${winnerUsername} wins!`
      statusEl.classList.add("game-lose")
      updateStats("lose")
    }
    scores[result.winner]++
    document.getElementById(`score${result.winner}`).textContent = scores[result.winner]
  }
  document.querySelectorAll(".player-indicator").forEach((el) => {
    el.classList.remove("active")
  })
}
function requestRestart() {
  if (!isHost) {
    alert("Only the host can restart the game!")
    return
  }
  socket.send(
    JSON.stringify({
      type: "restart",
      payload: "",
    }),
  )
}
function resetGame(isRemote = false) {
  console.log("Resetting game")
  cells = Array(9).fill(null)
  gameOver = false
  currentPlayer = "X"
  const statusEl = document.getElementById("statusMessage")
  statusEl.classList.remove("game-win", "game-lose", "game-draw")
  const cellElements = document.querySelectorAll(".cell")
  cellElements.forEach((cell) => {
    cell.textContent = ""
    cell.classList.remove("x", "o", "new-move")
  })
  updateStatusMessage()
  updateTurnIndicator()
}
function goBack() {
  window.location.href = "lobby.html"
}
function getUserStats() {
  const stats = localStorage.getItem("miniGamesStats")
  if (stats) {
    return JSON.parse(stats)
  }
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    gamesDraw: 0,
  }
}
function saveUserStats(stats) {
  localStorage.setItem("miniGamesStats", JSON.stringify(stats))
}
function updateStats(result) {
  const stats = getUserStats()
  stats.gamesPlayed++
  if (result === "win") {
    stats.gamesWon++
  } else if (result === "lose") {
    stats.gamesLost++
  } else if (result === "draw") {
    stats.gamesDraw++
  }
  saveUserStats(stats)
  console.log("Stats updated:", stats)
}
