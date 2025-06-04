// Enhanced game.js with chat integration
// Global variables
let socket
let gameCode = ""
let playerRole = ""
let currentPlayer = "X" // X always starts first
let cells = Array(9).fill(null)
let gameOver = false
let isHost = false
let username = ""
let gameChat = null // Chat instance
const opponentUsername = ""
const scores = {
  X: 0,
  O: 0,
  draw: 0,
}

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
  console.log("Game page loaded")

  // Get data from session storage
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

  // Create the game board
  createBoard()

  // Connect to WebSocket server
  connectToServer()

  // Set up event listeners
  document.getElementById("restartGame").addEventListener("click", requestRestart)

  // Update restart button text based on host status
  if (isHost) {
    document.getElementById("restartGame").textContent = "New Game"
  } else {
    document.getElementById("restartGame").textContent = "Ask Host to Restart"
  }
})

// Create the game board
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

  // Add click event listener to the board
  board.addEventListener("click", handleCellClick)
  console.log("Board created with click listeners")
}

// Connect to the WebSocket server
function connectToServer() {
  // Use the current hostname to make it work on any device
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const wsUrl = `${protocol}//${window.location.hostname}:8080/ws`

  console.log("Connecting to WebSocket server:", wsUrl)

  socket = new WebSocket(wsUrl)

  socket.onopen = () => {
    console.log("WebSocket connection established")

    // Initialize chat after socket connection
    initializeChat()

    // Send a "join" message to reconnect to the game
    socket.send(
      JSON.stringify({
        type: "join",
        payload: JSON.stringify({ code: gameCode, username: username }),
        username: username,
      }),
    )

    // Initial status message will be updated when we receive game state
    const hostText = isHost ? " (Host)" : ""
    document.getElementById("statusMessage").textContent =
      `Welcome ${username}! You are Player ${playerRole}${hostText} - Connecting to game...`
  }

  socket.onclose = (event) => {
    console.log("WebSocket connection closed:", event)
    document.getElementById("statusMessage").textContent = "Disconnected from server"

    // Destroy chat on disconnect
    if (gameChat) {
      gameChat.destroy()
      gameChat = null
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

// Initialize chat
function initializeChat() {
  if (socket && username && playerRole) {
    gameChat = new GameChat(socket, username, playerRole)

    // Add welcome message
    setTimeout(() => {
      if (gameChat) {
        gameChat.addSystemMessage(`Welcome to the game! You can chat with your opponent here.`)
      }
    }, 1000)
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
      if (gameChat) {
        gameChat.addSystemMessage("Host has left the game. Returning to menu...")
      }
      setTimeout(() => {
        window.location.href = "index.html"
      }, 3000)
      break
    case "error":
      document.getElementById("statusMessage").textContent = `Error: ${msg.payload}`
      break
    case "lobbyUpdate":
      handleLobbyUpdate(JSON.parse(msg.payload))
      break
  }
}

// Handle lobby update (when second player joins)
function handleLobbyUpdate(data) {
  if (data.players && data.players.length === 2 && gameChat) {
    const otherPlayer = data.players.find((p) => p.username !== username)
    if (otherPlayer) {
      gameChat.addSystemMessage(`${otherPlayer.username} has joined the game!`)
    }
  }
}

// Handle player left message
function handlePlayerLeft(data) {
  if (data.isHost) {
    document.getElementById("statusMessage").textContent = `Host ${data.username} left the game`
  } else {
    document.getElementById("statusMessage").textContent = `${data.username} left the game`
  }

  if (gameChat) {
    gameChat.addSystemMessage(`${data.username} has left the game`)
  }
}

// Handle game state message
function handleGameState(state) {
  console.log("Received game state:", state)

  if (state.board) {
    // Update the board with the current state
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

    // Update current player
    currentPlayer = state.currentTurn
    gameOver = !state.gameActive

    // Update status message and turn indicator
    updateStatusMessage()
    updateTurnIndicator()
  }
}

// Handle room joined message
function handleRoomJoined(data) {
  console.log("Room joined:", data)
  gameCode = data.code
  playerRole = data.role
  isHost = data.isHost

  // Update session storage
  sessionStorage.setItem("gameCode", gameCode)
  sessionStorage.setItem("playerRole", playerRole)
  sessionStorage.setItem("isHost", isHost.toString())

  // Request current game state
  socket.send(
    JSON.stringify({
      type: "getGameState",
      payload: JSON.stringify({ code: gameCode }),
    }),
  )
}

// Handle cell click
function handleCellClick(event) {
  if (!event.target.classList.contains("cell")) return

  const index = Number.parseInt(event.target.dataset.index)
  console.log("Cell clicked:", index)

  // Check if the move is valid
  if (cells[index] || gameOver) {
    console.log("Invalid move: Cell occupied or game over")
    return
  }

  if (currentPlayer !== playerRole) {
    console.log("Not your turn")
    const hostText = isHost ? " (You go first as host)" : " (Host goes first)"
    document.getElementById("statusMessage").textContent = `Not your turn!${hostText}`
    // Flash the status message to draw attention
    const statusEl = document.getElementById("statusMessage")
    statusEl.classList.add("flash")
    setTimeout(() => statusEl.classList.remove("flash"), 1000)
    return
  }

  console.log("Valid move, sending to server")

  // Send the move to the server
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

// Handle a move (local or from server)
function handleMove(move, isRemote) {
  console.log("Handling move:", move, "Remote:", isRemote)

  const index = move.index
  const player = move.player
  const moveUsername = move.username || "Unknown"

  // Update the board
  cells[index] = player
  const cell = document.querySelector(`.cell[data-index="${index}"]`)
  if (cell) {
    cell.textContent = player
    cell.classList.add(player.toLowerCase())

    // Add animation for the new move
    cell.classList.add("new-move")
    setTimeout(() => cell.classList.remove("new-move"), 500)
  }

  // Switch turns
  currentPlayer = currentPlayer === "X" ? "O" : "X"

  // Update status message and turn indicator
  updateStatusMessage()
  updateTurnIndicator()

  // Add move notification to chat
  if (gameChat && isRemote && moveUsername !== username) {
    gameChat.addSystemMessage(`${moveUsername} played ${player} at position ${index + 1}`)
  }
}

// Update the status message based on current game state
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

// Update the visual turn indicator
function updateTurnIndicator() {
  // Add visual indicator to show whose turn it is
  document.querySelectorAll(".player-indicator").forEach((el) => {
    el.classList.remove("active")
  })

  const activePlayer = currentPlayer === "X" ? "X" : "O"
  const indicator = document.getElementById(`player${activePlayer}Indicator`)
  if (indicator) {
    indicator.classList.add("active")
  }

  // Update indicator text to show usernames and host status
  document.getElementById("playerXIndicator").textContent =
    `${username} (X)${isHost && playerRole === "X" ? " - Host" : ""}`
  document.getElementById("playerOIndicator").textContent =
    `Player O${!isHost && playerRole === "O" ? ` - ${username}` : ""}`
}

// Handle game end
function handleGameEnd(result) {
  console.log("Game ended:", result)
  gameOver = true

  const statusEl = document.getElementById("statusMessage")

  if (result.winner === "draw") {
    statusEl.textContent = "It's a draw!"
    statusEl.classList.add("game-draw")
    scores.draw++
    document.getElementById("scoreDraw").textContent = scores.draw

    // Add to chat
    if (gameChat) {
      gameChat.addSystemMessage("Game ended in a draw!")
    }

    // Update stats
    updateStats("draw")
  } else {
    const winnerUsername = result.winnerUsername || "Unknown"
    if (result.winner === playerRole) {
      statusEl.textContent = `You win, ${username}!`
      statusEl.classList.add("game-win")

      if (gameChat) {
        gameChat.addSystemMessage(`🎉 You won the game!`)
      }

      updateStats("win")
    } else {
      statusEl.textContent = `${winnerUsername} wins!`
      statusEl.classList.add("game-lose")

      if (gameChat) {
        gameChat.addSystemMessage(`${winnerUsername} won the game!`)
      }

      updateStats("lose")
    }
    scores[result.winner]++
    document.getElementById(`score${result.winner}`).textContent = scores[result.winner]
  }

  // Remove turn indicators
  document.querySelectorAll(".player-indicator").forEach((el) => {
    el.classList.remove("active")
  })
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
function resetGame(isRemote = false) {
  console.log("Resetting game")
  cells = Array(9).fill(null)
  gameOver = false
  currentPlayer = "X" // Host (X) always starts first

  // Remove game end classes
  const statusEl = document.getElementById("statusMessage")
  statusEl.classList.remove("game-win", "game-lose", "game-draw")

  // Clear the board
  const cellElements = document.querySelectorAll(".cell")
  cellElements.forEach((cell) => {
    cell.textContent = ""
    cell.classList.remove("x", "o", "new-move")
  })

  // Update status message and turn indicator
  updateStatusMessage()
  updateTurnIndicator()

  // Add restart notification to chat
  if (gameChat && isRemote) {
    gameChat.addSystemMessage("🔄 New game started!")
  }
}

// Go back to the lobby
function goBack() {
  if (gameChat) {
    gameChat.destroy()
  }
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
