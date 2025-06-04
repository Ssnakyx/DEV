let socket
let gameCode = ""
let playerRole = ""
let currentRound = 1
let isHost = false
let username = ""
let gameActive = false
let myChoice = null
let reconnectAttempts = 0
const maxReconnectAttempts = 5
const scores = {
  P1: 0,
  P2: 0,
  draw: 0,
}
const choiceEmojis = {
  rock: "🪨",
  paper: "📄",
  scissors: "✂️",
}
document.addEventListener("DOMContentLoaded", () => {
  console.log("RPS game page loaded")
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
  updatePlayerIndicators()
  connectToServer()
  document.getElementById("choicesContainer").addEventListener("click", handleChoiceClick)
  document.getElementById("newRound").addEventListener("click", startNewRound)
})
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
  document.getElementById("p1ScoreLabel").textContent = playerRole === "P1" ? username : "Player 1"
  document.getElementById("p2ScoreLabel").textContent = playerRole === "P2" ? username : "Player 2"
}
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
      `Welcome ${username}! You are ${playerRole}${hostText} - Make your choice!`
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
      setTimeout(() => {
        window.location.href = "index.html"
      }, 3000)
      break
    case "error":
      handleError(msg.payload)
      break
  }
}
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
function handlePlayerLeft(data) {
  if (data.isHost) {
    document.getElementById("statusMessage").textContent = `Host ${data.username} left the game`
  } else {
    document.getElementById("statusMessage").textContent = `${data.username} left the game`
  }
  gameActive = false
}
function handleGameState(state) {
  console.log("Received game state:", state)
  if (state.round) {
    currentRound = state.round
    document.getElementById("roundNumber").textContent = `Round ${currentRound}`
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
  updatePlayerIndicators()
}
function handleChoiceClick(event) {
  if (!event.target.classList.contains("choice")) return
  if (!gameActive) return
  if (myChoice !== null) return
  const choice = event.target.dataset.choice
  console.log("Choice made:", choice)
  myChoice = choice
  document.querySelectorAll(".choice").forEach((el) => {
    el.classList.remove("selected")
    el.classList.add("disabled")
  })
  event.target.classList.add("selected", "choice-made")
  event.target.classList.remove("disabled")
  socket.send(
    JSON.stringify({
      type: "rpsChoice",
      payload: JSON.stringify({ choice: choice }),
    }),
  )
  document.getElementById("statusMessage").textContent = `You chose ${choice}!`
  document.getElementById("waitingMessage").style.display = "block"
}
function handleRPSResult(result) {
  console.log("RPS result:", result)
  document.getElementById("waitingMessage").style.display = "none"
  const resultDisplay = document.getElementById("resultDisplay")
  resultDisplay.style.display = "block"
  document.getElementById("player1Choice").textContent = choiceEmojis[result.p1]
  document.getElementById("player2Choice").textContent = choiceEmojis[result.p2]
  document.getElementById("player1Name").textContent = playerRole === "P1" ? username : "Player 1"
  document.getElementById("player2Name").textContent = playerRole === "P2" ? username : "Player 2"
  const resultText = document.getElementById("resultText")
  if (result.winner === "draw") {
    resultText.textContent = "It's a draw!"
    resultText.className = "result-text draw"
    scores.draw++
    document.getElementById("scoreDraw").textContent = scores.draw
  } else if (result.winner === playerRole) {
    resultText.textContent = "You win this round!"
    resultText.className = "result-text win"
    scores[playerRole]++
    document.getElementById(`score${playerRole}`).textContent = scores[playerRole]
    updateStats("win")
  } else {
    resultText.textContent = "You lose this round!"
    resultText.className = "result-text lose"
    const opponentRole = playerRole === "P1" ? "P2" : "P1"
    scores[opponentRole]++
    document.getElementById(`score${opponentRole}`).textContent = scores[opponentRole]
    updateStats("lose")
  }
  currentRound = result.round
  document.getElementById("roundNumber").textContent = `Round ${currentRound}`
  document.getElementById("newRound").style.display = "inline-block"
  document.getElementById("statusMessage").textContent = "Round complete! Click 'Next Round' to continue."
}
function startNewRound() {
  myChoice = null
  gameActive = true
  document.querySelectorAll(".choice").forEach((el) => {
    el.classList.remove("selected", "disabled", "choice-made")
  })
  document.getElementById("resultDisplay").style.display = "none"
  document.getElementById("waitingMessage").style.display = "none"
  document.getElementById("newRound").style.display = "none"
  document.getElementById("statusMessage").textContent = "Make your choice for the next round!"
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
