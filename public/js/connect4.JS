// Global variables
let socket
let gameCode = ""
let playerRole = ""
let currentPlayer = "Red"
let board = Array(6)
  .fill()
  .map(() => Array(7).fill(null))
let gameOver = false
let isHost = false
let username = ""
let reconnectAttempts = 0
const maxReconnectAttempts = 5
const scores = {
  Red: 0,
  Yellow: 0,
  draw: 0,
}

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
  console.log("Connect4 page loaded")

  // Get data from session storage
  gameCode = sessionStorage.getItem("gameCode")
  playerRole = sessionStorage.getItem("playerRole")
  isHost = sessionStorage.getItem("isHost") === "true"
  username = sessionStorage.getItem("username") || ""

  console.log("Session data:", { gameCode, playerRole, isHost, username })

  if (!gameCode || !playerRole || !username) {
    console.error("Missing game session data")
    document.getElementById("statusMessage").textContent = "Error: Game session not found"
    setTimeout(() => {
      window.location.href = "index.html"
    }, 3000)
    return
  }

  // Update player names
  updatePlayerNames()

  // Create the game board
  createBoard()

  // Connect to WebSocket server
  connectToServer()

  // Set up event listeners
  document.getElementById("columnSelector").addEventListener("click", handleColumnClick)
  document.getElementById("restartGame").addEventListener("click", requestRestart)

  // Update restart button text based on host status
  if (isHost) {
    document.getElementById("restartGame").textContent = "New Game"
  } else {
    document.getElementById("restartGame").textContent = "Ask Host to Restart"
  }
})

// Update player names in the UI
function updatePlayerNames() {
  if (playerRole === "Red") {
    document.getElementById("redPlayerName").textContent = `${username} (Red)`
    document.getElementById("yellowPlayerName").textContent = "Yellow Player"
  } else {
    document.getElementById("redPlayerName").textContent = "Red Player"
    document.getElementById("yellowPlayerName").textContent = `${username} (Yellow)`
  }
}

// Create the game board
function createBoard() {
  console.log("Creating Connect4 board")
  const boardElement = document.getElementById("board")
  boardElement.innerHTML = ""

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      const cell = document.createElement("div")
      cell.classList.add("connect4-cell")
      cell.dataset.row = row
      cell.dataset.col = col
      boardElement.appendChild(cell)
    }
  }

  console.log("Board created")
}

// Connect to the WebSocket server
function connectToServer() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const wsUrl = `${protocol}//${window.location.hostname}:8080/ws`

  console.log("Connecting to WebSocket server:", wsUrl)

  socket = new WebSocket(wsUrl)

  socket.onopen = () => {
    console.log("WebSocket connection established")
    reconnectAttempts = 0

    socket.send(
      JSON.stringify({
        type: "join",
        payload: JSON.stringify({ code: gameCode, username: username }),
        username: username,
      }),
    )

    const hostText = isHost ? " (Host)" : ""
    document.getElementById("statusMessage").textContent = `Welcome ${username}! You are ${playerRole}${hostText}`

    updateTurnIndicator()
  }

  socket.onclose = (event) => {
    console.log("WebSocket connection closed:", event)

    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++
      document.getElementById("statusMessage").textContent =
        `Connection lost. Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`

      setTimeout(() => {
        connectToServer()
      }, 2000 * reconnectAttempts)
    } else {
      document.getElementById("statusMessage").textContent =
        "Connection lost. Please refresh the page or return to menu."
    }
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

// Handle incoming WebSocket messages
function handleMessage(msg) {
  console.log("Processing message:", msg)

  switch (msg.type) {
    case "roomJoined":
      handleRoomJoined(JSON.parse(msg.payload))
      break
    case "gameState":
      handleGameState(JSON.parse(msg.payload))
      break
    case "connect4Move":
      handleMove(JSON.parse(msg.payload))
      break
    case "restart":
      resetGame()
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
      handleError(msg.payload)
      break
  }
}

// Handle error messages
function handleError(errorMessage) {
  console.error("Server error:", errorMessage)
  document.getElementById("statusMessage").textContent = `Error: ${errorMessage}`

  if (errorMessage.includes("Room") && errorMessage.includes("not found")) {
    setTimeout(() => {
      sessionStorage.removeItem("gameCode")
      sessionStorage.removeItem("playerRole")
      window.location.href = "lobby.html"
    }, 3000)
  }
}

// Handle player left message
function handlePlayerLeft(data) {
  if (data.isHost) {
    document.getElementById("statusMessage").textContent = `Host ${data.username} left the game`
  } else {
    document.getElementById("statusMessage").textContent = `${data.username} left the game`
  }
}

// Handle game state message
function handleGameState(state) {
  console.log("Received game state:", state)

  if (state.board) {
    // Update the board with the current state
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        if (state.board[row][col]) {
          board[row][col] = state.board[row][col]
          const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`)
          if (cell) {
            cell.classList.add(state.board[row][col].toLowerCase())
          }
        }
      }
    }

    currentPlayer = state.currentTurn
    gameOver = !state.gameActive

    updateTurnIndicator()
  }
}

// Handle room joined message
function handleRoomJoined(data) {
  console.log("Room joined:", data)
  gameCode = data.code
  playerRole = data.role
  isHost = data.isHost

  sessionStorage.setItem("gameCode", gameCode)
  sessionStorage.setItem("playerRole", playerRole)
  sessionStorage.setItem("isHost", isHost.toString())

  updatePlayerNames()

  socket.send(
    JSON.stringify({
      type: "getGameState",
      payload: JSON.stringify({ code: gameCode }),
    }),
  )
}

// Handle column click
function handleColumnClick(event) {
  if (!event.target.classList.contains("column-btn")) return

  const column = Number.parseInt(event.target.dataset.column)
  console.log("Column clicked:", column)

  // Check if it's the player's turn
  if (currentPlayer !== playerRole) {
    console.log("Not your turn")
    document.getElementById("statusMessage").textContent = "Not your turn!"
    return
  }

  if (gameOver) {
    console.log("Game is over")
    return
  }

  // Check if column is full
  if (board[0][column] !== null) {
    console.log("Column is full")
    return
  }

  console.log("Valid move, sending to server")

  // Send the move to the server
  socket.send(
    JSON.stringify({
      type: "connect4Move",
      payload: JSON.stringify({
        column: column,
      }),
    }),
  )
}

// Handle a move from the server
function handleMove(move) {
  console.log("Handling move:", move)

  const { row, column, player, username: moveUsername } = move

  // Update the board
  board[row][column] = player
  const cell = document.querySelector(`[data-row="${row}"][data-col="${column}"]`)
  if (cell) {
    cell.classList.add(player.toLowerCase())

    // Add animation
    cell.style.animation = "dropPiece 0.5s ease-out"
    setTimeout(() => {
      cell.style.animation = ""
    }, 500)
  }

  // Switch turns
  currentPlayer = currentPlayer === "Red" ? "Yellow" : "Red"
  updateTurnIndicator()
}

// Update the turn indicator
function updateTurnIndicator() {
  const indicator = document.getElementById("turnIndicator")
  const columnButtons = document.querySelectorAll(".column-btn")

  if (gameOver) {
    indicator.textContent = "Game Over!"
    columnButtons.forEach((btn) => (btn.disabled = true))
    return
  }

  if (currentPlayer === playerRole) {
    indicator.textContent = `Your turn (${playerRole})`
    indicator.className = `turn-${playerRole.toLowerCase()}`
    columnButtons.forEach((btn) => (btn.disabled = false))
  } else {
    const otherPlayer = currentPlayer === "Red" ? "Red" : "Yellow"
    indicator.textContent = `${otherPlayer} Player's Turn`
    indicator.className = `turn-${currentPlayer.toLowerCase()}`
    columnButtons.forEach((btn) => (btn.disabled = true))
  }
}

// Handle game end
function handleGameEnd(result) {
  console.log("Game ended:", result)
  gameOver = true

  const statusEl = document.getElementById("statusMessage")
  const columnButtons = document.querySelectorAll(".column-btn")
  columnButtons.forEach((btn) => (btn.disabled = true))

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

  document.getElementById("turnIndicator").textContent = "Game Over!"
}

// Request a game restart
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

// Reset the game
function resetGame() {
  console.log("Resetting game")
  board = Array(6)
    .fill()
    .map(() => Array(7).fill(null))
  gameOver = false
  currentPlayer = "Red"

  // Remove game end classes
  const statusEl = document.getElementById("statusMessage")
  statusEl.classList.remove("game-win", "game-lose", "game-draw")

  // Clear the board
  const cells = document.querySelectorAll(".connect4-cell")
  cells.forEach((cell) => {
    cell.classList.remove("red", "yellow")
  })

  // Enable column buttons
  const columnButtons = document.querySelectorAll(".column-btn")
  columnButtons.forEach((btn) => (btn.disabled = false))

  updateTurnIndicator()
}

// Go back to the lobby
function goBack() {
  window.location.href = "lobby.html"
}

// Get user stats from localStorage
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

// Save user stats to localStorage
function saveUserStats(stats) {
  localStorage.setItem("miniGamesStats", JSON.stringify(stats))
}

// Update stats after a game
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
