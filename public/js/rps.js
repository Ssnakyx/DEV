// Enhanced rps.js with chat integration
// Global variables
let socket
let gameCode = ""
let playerRole = ""
let currentRound = 1
let isHost = false
let username = ""
let gameActive = false
let myChoice = null
let gameChat = null // Chat instance
let reconnectAttempts = 0
const maxReconnectAttempts = 5
const scores = {
  P1: 0,
  P2: 0,
  draw: 0,
}

// Choice emojis mapping
const choiceEmojis = {
  rock: "🪨",
  paper: "📄",
  scissors: "✂️",
}

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
  console.log("RPS game page loaded")

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

  // Update player indicators with usernames
  updatePlayerIndicators()

  // Connect to WebSocket server
  connectToServer()

  // Set up event listeners
  document.getElementById("choicesContainer").addEventListener("click", handleChoiceClick)
  document.getElementById("newRound").addEventListener("click", startNewRound)
})

// Update player indicators with usernames and roles
function updatePlayerIndicators() {
  const p1Indicator = document.getElementById("player1Indicator")
  const p2Indicator = document.getElementById("player2Indicator")

  if (playerRole === "P1") {
    p1Indicator.textContent = `${username} (P1) - Host`
    p2Indicator.textContent = "Player 2"
  } else {
    p1Indicator.textContent = "Player 1 (Host)"
    p2Indicator.textContent = `${username} (P2)`
  }

  // Update score labels
  document.getElementById("p1ScoreLabel").textContent = playerRole === "P1" ? username : "Player 1"
  document.getElementById("p2ScoreLabel").textContent = playerRole === "P2" ? username : "Player 2"
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

    const hostText = isHost ? " (Host)" : ""
    document.getElementById("statusMessage").textContent =
      `Welcome ${username}! You are ${playerRole}${hostText} - Make your choice!`

    gameActive = true
  }

  socket.onclose = (event) => {
    console.log("WebSocket connection closed:", event)

    // Destroy chat on disconnect
    if (gameChat) {
      gameChat.destroy()
      gameChat = null
    }

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

// Initialize chat
function initializeChat() {
  if (socket && username && playerRole) {
    // Assuming GameChat is defined elsewhere or imported
    gameChat = new GameChat(socket, username, playerRole)

    // Add welcome message
    setTimeout(() => {
      if (gameChat) {
        gameChat.addSystemMessage(`Welcome to Rock Paper Scissors! Choose your weapon wisely.`)
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
    case "rpsResult":
      handleRPSResult(JSON.parse(msg.payload))
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
      handleError(msg.payload)
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
      gameChat.addSystemMessage(`${otherPlayer.username} has joined the battle!`)
    }
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

  if (gameChat) {
    gameChat.addSystemMessage(`${data.username} has left the game`)
  }

  gameActive = false
}

// Handle game state message
function handleGameState(state) {
  console.log("Received game state:", state)

  if (state.round) {
    currentRound = state.round
    document.getElementById("roundNumber").textContent = `Round ${currentRound}`
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

  updatePlayerIndicators()
}

// Handle choice click
function handleChoiceClick(event) {
  if (!event.target.classList.contains("choice")) return
  if (!gameActive) return
  if (myChoice !== null) return // Already made a choice

  const choice = event.target.dataset.choice
  console.log("Choice made:", choice)

  myChoice = choice

  // Visual feedback
  document.querySelectorAll(".choice").forEach((el) => {
    el.classList.remove("selected")
    el.classList.add("disabled")
  })

  event.target.classList.add("selected", "choice-made")
  event.target.classList.remove("disabled")

  // Send choice to server
  socket.send(
    JSON.stringify({
      type: "rpsChoice",
      payload: JSON.stringify({ choice: choice }),
    }),
  )

  // Update status
  document.getElementById("statusMessage").textContent = `You chose ${choice}!`
  document.getElementById("waitingMessage").style.display = "block"

  // Add choice notification to chat
  if (gameChat) {
    gameChat.addSystemMessage(`You chose ${choice}! Waiting for opponent...`)
  }
}

// Handle RPS result
function handleRPSResult(result) {
  console.log("RPS result:", result)

  // Hide waiting message
  document.getElementById("waitingMessage").style.display = "none"

  // Show result display
  const resultDisplay = document.getElementById("resultDisplay")
  resultDisplay.style.display = "block"

  // Update choices display
  document.getElementById("player1Choice").textContent = choiceEmojis[result.p1]
  document.getElementById("player2Choice").textContent = choiceEmojis[result.p2]

  // Update player names in result
  document.getElementById("player1Name").textContent = playerRole === "P1" ? username : "Player 1"
  document.getElementById("player2Name").textContent = playerRole === "P2" ? username : "Player 2"

  // Determine result text and update scores
  const resultText = document.getElementById("resultText")
  if (result.winner === "draw") {
    resultText.textContent = "It's a draw!"
    resultText.className = "result-text draw"
    scores.draw++
    document.getElementById("scoreDraw").textContent = scores.draw

    if (gameChat) {
      gameChat.addSystemMessage(`Round ${currentRound}: Draw! Both chose ${result.p1}`)
    }
  } else if (result.winner === playerRole) {
    resultText.textContent = "You win this round!"
    resultText.className = "result-text win"
    scores[playerRole]++
    document.getElementById(`score${playerRole}`).textContent = scores[playerRole]

    if (gameChat) {
      gameChat.addSystemMessage(
        `🎉 Round ${currentRound}: You won! ${myChoice} beats ${result.winner === "P1" ? result.p2 : result.p1}`,
      )
    }

    updateStats("win")
  } else {
    resultText.textContent = "You lose this round!"
    resultText.className = "result-text lose"
    const opponentRole = playerRole === "P1" ? "P2" : "P1"
    scores[opponentRole]++
    document.getElementById(`score${opponentRole}`).textContent = scores[opponentRole]

    if (gameChat) {
      const opponentChoice = result.winner === "P1" ? result.p1 : result.p2
      gameChat.addSystemMessage(`Round ${currentRound}: You lost. ${opponentChoice} beats ${myChoice}`)
    }

    updateStats("lose")
  }

  // Update round number
  currentRound = result.round
  document.getElementById("roundNumber").textContent = `Round ${currentRound}`

  // Show next round button
  document.getElementById("newRound").style.display = "inline-block"

  // Update status
  document.getElementById("statusMessage").textContent = "Round complete! Click 'Next Round' to continue."
}

// Start new round
function startNewRound() {
  // Reset choice state
  myChoice = null
  gameActive = true

  // Reset UI
  document.querySelectorAll(".choice").forEach((el) => {
    el.classList.remove("selected", "disabled", "choice-made")
  })

  document.getElementById("resultDisplay").style.display = "none"
  document.getElementById("waitingMessage").style.display = "none"
  document.getElementById("newRound").style.display = "none"

  // Update status
  document.getElementById("statusMessage").textContent = "Make your choice for the next round!"

  // Add new round notification to chat
  if (gameChat) {
    gameChat.addSystemMessage(`🔄 Round ${currentRound} starting! Choose your weapon!`)
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

// Update stats after a round
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
