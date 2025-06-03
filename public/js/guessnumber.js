// Global variables
let socket
let gameCode = ""
let playerRole = ""
let isHost = false
let username = ""
let gameActive = false
let myGuesses = []
let maxGuesses = 10
let reconnectAttempts = 0
const maxReconnectAttempts = 5
const scores = {
  P1: 0,
  P2: 0,
}

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
  console.log("Number Guessing game page loaded")

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

  // Connect to WebSocket server
  connectToServer()

  // Set up event listeners
  document.getElementById("submitGuess").addEventListener("click", submitGuess)
  document.getElementById("restartGame").addEventListener("click", requestRestart)

  // Allow Enter key to submit guess
  document.getElementById("guessInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      submitGuess()
    }
  })

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
    document.getElementById("statusMessage").textContent =
      `Welcome ${username}! You are ${playerRole}${hostText} - Start guessing!`

    gameActive = true
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
    case "numberGuessResult":
      handleGuessResult(JSON.parse(msg.payload))
      break
    case "restart":
      resetGame()
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
  gameActive = false
}

// Handle game state message
function handleGameState(state) {
  console.log("Received game state:", state)

  if (state.guesses) {
    myGuesses = state.guesses[playerRole] || []
    updateGuessHistory()
    updateRemainingGuesses()
  }

  if (state.maxGuesses) {
    maxGuesses = state.maxGuesses
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

// Submit a guess
function submitGuess() {
  if (!gameActive) {
    alert("Game is not active!")
    return
  }

  const input = document.getElementById("guessInput")
  const guess = Number.parseInt(input.value)

  if (isNaN(guess) || guess < 1 || guess > 100) {
    alert("Please enter a number between 1 and 100!")
    input.focus()
    return
  }

  if (myGuesses.includes(guess)) {
    alert("You already guessed that number!")
    input.focus()
    return
  }

  if (myGuesses.length >= maxGuesses) {
    alert("You've used all your guesses!")
    return
  }

  console.log("Submitting guess:", guess)

  // Send guess to server
  socket.send(
    JSON.stringify({
      type: "numberGuess",
      payload: JSON.stringify({ number: guess }),
    }),
  )

  // Clear input
  input.value = ""
}

// Handle guess result
function handleGuessResult(result) {
  console.log("Guess result:", result)

  const {
    player,
    username: guesserUsername,
    guess,
    result: guessResult,
    target,
    gameActive: stillActive,
    winner,
  } = result

  // If this is my guess, add it to my history
  if (player === playerRole) {
    myGuesses.push(guess)
    updateGuessHistory()
    updateRemainingGuesses()
  }

  // Update status message
  const statusEl = document.getElementById("statusMessage")

  if (guessResult === "correct") {
    if (player === playerRole) {
      statusEl.textContent = `🎉 Congratulations! You guessed it! The number was ${target}!`
      statusEl.classList.add("game-win")
      updateStats("win")
    } else {
      statusEl.textContent = `${guesserUsername} guessed the number ${target}! Better luck next time!`
      statusEl.classList.add("game-lose")
      updateStats("lose")
    }

    // Update scores
    scores[winner]++
    document.getElementById(`score${winner}`).textContent = scores[winner]

    gameActive = false
  } else if (!stillActive) {
    // Game ended without a winner
    statusEl.textContent = `Game over! The number was ${target}. No one guessed it!`
    statusEl.classList.add("game-draw")
    updateStats("draw")
    gameActive = false
  } else {
    // Game continues
    if (player === playerRole) {
      if (guessResult === "higher") {
        statusEl.textContent = `Your guess ${guess} is too low! Try higher.`
      } else {
        statusEl.textContent = `Your guess ${guess} is too high! Try lower.`
      }
    } else {
      statusEl.textContent = `${guesserUsername} guessed ${guess} (${guessResult}). Your turn!`
    }
  }

  // Update total games
  if (!stillActive) {
    const totalGames = scores.P1 + scores.P2
    document.getElementById("totalGames").textContent = totalGames
  }
}

// Update guess history display
function updateGuessHistory() {
  const historyEl = document.getElementById("guessHistory")

  if (myGuesses.length === 0) {
    historyEl.innerHTML = "<p>Your guesses will appear here...</p>"
    return
  }

  historyEl.innerHTML = ""

  myGuesses.forEach((guess, index) => {
    const guessItem = document.createElement("div")
    guessItem.classList.add("guess-item")

    guessItem.innerHTML = `
      <span class="guess-number">#${index + 1}: ${guess}</span>
      <span class="guess-hint">Waiting for result...</span>
    `

    historyEl.appendChild(guessItem)
  })
}

// Update remaining guesses display
function updateRemainingGuesses() {
  const remaining = maxGuesses - myGuesses.length
  const remainingEl = document.getElementById("remainingGuesses")

  if (remaining > 0) {
    remainingEl.textContent = `${remaining} guesses remaining`
    remainingEl.style.color = remaining <= 3 ? "#f44336" : "#ff9100"
  } else {
    remainingEl.textContent = "No guesses remaining!"
    remainingEl.style.color = "#f44336"
  }
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
  myGuesses = []
  gameActive = true

  // Remove game end classes
  const statusEl = document.getElementById("statusMessage")
  statusEl.classList.remove("game-win", "game-lose", "game-draw")
  statusEl.textContent = "New game started! Start guessing!"

  // Clear input
  document.getElementById("guessInput").value = ""

  // Reset displays
  updateGuessHistory()
  updateRemainingGuesses()
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
