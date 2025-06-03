// Global variables
let socket
let gameCode = ""
let playerRole = ""
let isHost = false
let username = ""
let gameActive = false
let currentTurn = "P1"
let lines = []
let boxes = Array(3)
  .fill()
  .map(() => Array(3).fill(""))
let scores = { P1: 0, P2: 0 }
let reconnectAttempts = 0
const maxReconnectAttempts = 5

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
  console.log("Dots & Boxes game page loaded")

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

  // Create the dots grid
  createDotsGrid()

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

// Update player names in the UI
function updatePlayerNames() {
  if (playerRole === "P1") {
    document.getElementById("player1Name").textContent = `${username} (P1)`
    document.getElementById("player2Name").textContent = "Player 2"
  } else {
    document.getElementById("player1Name").textContent = "Player 1"
    document.getElementById("player2Name").textContent = `${username} (P2)`
  }
}

// Create the dots grid
function createDotsGrid() {
  const grid = document.getElementById("dotsGrid")
  grid.innerHTML = ""

  // Create 4x4 grid of dots
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const dot = document.createElement("div")
      dot.classList.add("dot")
      dot.dataset.row = row
      dot.dataset.col = col

      // Add click handlers for horizontal lines (except last column)
      if (col < 3) {
        const hLine = document.createElement("div")
        hLine.classList.add("line-placeholder", "horizontal")
        hLine.dataset.type = "horizontal"
        hLine.dataset.row = row
        hLine.dataset.col = col
        hLine.addEventListener("click", () => handleLineClick("horizontal", row, col))
        dot.appendChild(hLine)
      }

      // Add click handlers for vertical lines (except last row)
      if (row < 3) {
        const vLine = document.createElement("div")
        vLine.classList.add("line-placeholder", "vertical")
        vLine.dataset.type = "vertical"
        vLine.dataset.row = row
        vLine.dataset.col = col
        vLine.addEventListener("click", () => handleLineClick("vertical", row, col))
        dot.appendChild(vLine)
      }

      grid.appendChild(dot)
    }
  }
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

    gameActive = true
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
    case "dotsMove":
      handleDotsMove(JSON.parse(msg.payload))
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
}

// Handle player left message
function handlePlayerLeft(data) {
  if (data.isHost) {
    document.getElementById("statusMessage").textContent = `Host ${data.username} left the game`
  } else {
    document.getElementById("statusMessage").textContent = `${data.username} left the game`
  }
  gameActive = false
}

// Handle game state message
function handleGameState(state) {
  console.log("Received game state:", state)

  if (state.lines) {
    lines = state.lines
    updateLinesDisplay()
  }

  if (state.boxes) {
    boxes = state.boxes
    updateBoxesDisplay()
  }

  if (state.scores) {
    scores = state.scores
    updateScores()
  }

  if (state.currentTurn) {
    currentTurn = state.currentTurn
    updateTurnIndicator()
  }

  gameActive = state.gameActive
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

// Handle line click
function handleLineClick(type, row, col) {
  if (!gameActive) {
    alert("Game is not active!")
    return
  }

  if (currentTurn !== playerRole) {
    alert("It's not your turn!")
    return
  }

  // Check if line already exists
  const lineExists = lines.some((line) => line.type === type && line.row === row && line.col === col)

  if (lineExists) {
    return // Line already drawn
  }

  console.log("Drawing line:", type, row, col)

  // Send move to server
  socket.send(
    JSON.stringify({
      type: "dotsMove",
      payload: JSON.stringify({
        type: type,
        row: row,
        col: col,
      }),
    }),
  )
}

// Handle dots move from server
function handleDotsMove(move) {
  console.log("Handling dots move:", move)

  // Add the line
  lines.push(move)
  updateLinesDisplay()

  // Check for completed boxes
  checkCompletedBoxes()

  // Update turn (server will handle this)
  updateTurnIndicator()
}

// Update lines display
function updateLinesDisplay() {
  // Remove existing lines
  document.querySelectorAll(".line").forEach((line) => line.remove())

  // Add all lines
  lines.forEach((line) => {
    const lineElement = document.createElement("div")
    lineElement.classList.add("line", line.type, `player${line.player.slice(-1)}`)

    if (line.type === "horizontal") {
      lineElement.style.position = "absolute"
      lineElement.style.width = "40px"
      lineElement.style.height = "3px"
      lineElement.style.left = `${(line.col + 1) * 52 + 20}px`
      lineElement.style.top = `${line.row * 52 + 26}px`
    } else {
      lineElement.style.position = "absolute"
      lineElement.style.width = "3px"
      lineElement.style.height = "40px"
      lineElement.style.left = `${line.col * 52 + 26}px`
      lineElement.style.top = `${(line.row + 1) * 52 + 20}px`
    }

    document.getElementById("dotsGrid").appendChild(lineElement)
  })
}

// Check for completed boxes
function checkCompletedBoxes() {
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (boxes[row][col] === "") {
        // Check if all 4 sides of this box are drawn
        const topLine = lines.find((l) => l.type === "horizontal" && l.row === row && l.col === col)
        const bottomLine = lines.find((l) => l.type === "horizontal" && l.row === row + 1 && l.col === col)
        const leftLine = lines.find((l) => l.type === "vertical" && l.row === row && l.col === col)
        const rightLine = lines.find((l) => l.type === "vertical" && l.row === row && l.col === col + 1)

        if (topLine && bottomLine && leftLine && rightLine) {
          boxes[row][col] = currentTurn
          scores[currentTurn]++
        }
      }
    }
  }

  updateBoxesDisplay()
  updateScores()
}

// Update boxes display
function updateBoxesDisplay() {
  // Remove existing boxes
  document.querySelectorAll(".box").forEach((box) => box.remove())

  // Add completed boxes
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (boxes[row][col] !== "") {
        const boxElement = document.createElement("div")
        boxElement.classList.add("box", `player${boxes[row][col].slice(-1)}`)
        boxElement.textContent = boxes[row][col]

        boxElement.style.position = "absolute"
        boxElement.style.left = `${col * 52 + 32}px`
        boxElement.style.top = `${row * 52 + 32}px`

        document.getElementById("dotsGrid").appendChild(boxElement)
      }
    }
  }
}

// Update scores
function updateScores() {
  document.getElementById("scoreP1").textContent = scores.P1
  document.getElementById("scoreP2").textContent = scores.P2
}

// Update turn indicator
function updateTurnIndicator() {
  const indicator = document.getElementById("turnIndicator")

  if (!gameActive) {
    indicator.textContent = "Game Over!"
    return
  }

  if (currentTurn === playerRole) {
    indicator.textContent = "Your turn!"
    indicator.className = `turn-player${playerRole.slice(-1)}`
  } else {
    indicator.textContent = `Player ${currentTurn.slice(-1)}'s turn`
    indicator.className = `turn-player${currentTurn.slice(-1)}`
  }
}

// Handle game end
function handleGameEnd(result) {
  console.log("Game ended:", result)
  gameActive = false

  const statusEl = document.getElementById("statusMessage")

  if (result.winner === "draw") {
    statusEl.textContent = "It's a tie!"
    statusEl.classList.add("game-draw")
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
  }

  updateTurnIndicator()
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
  lines = []
  boxes = Array(3)
    .fill()
    .map(() => Array(3).fill(""))
  scores = { P1: 0, P2: 0 }
  currentTurn = "P1"
  gameActive = true

  // Remove game end classes
  const statusEl = document.getElementById("statusMessage")
  statusEl.classList.remove("game-win", "game-lose", "game-draw")
  statusEl.textContent = "New game started!"

  // Reset displays
  updateLinesDisplay()
  updateBoxesDisplay()
  updateScores()
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
