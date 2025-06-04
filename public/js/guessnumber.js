let socket
let gameCode = ""
let playerRole = ""
let isHost = false
let username = ""
let gameActive = false
let currentTurn = "P1"
let guessedLetters = []
let wrongGuesses = 0
const maxWrongGuesses = 6
let currentWord = []
let reconnectAttempts = 0
const maxReconnectAttempts = 5
const scores = {
  P1: 0,
  P2: 0,
}
const hangmanStages = [
  "",
  "  +---+\n      |\n      |\n      |\n      |\n      |\n=========",
  "  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========",
  "  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========",
]
document.addEventListener("DOMContentLoaded", () => {
  console.log("Word Guessing game page loaded")
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
  updatePlayerNames()
  connectToServer()
  document.getElementById("submitLetter").addEventListener("click", submitLetter)
  document.getElementById("restartGame").addEventListener("click", requestRestart)
  document.getElementById("letterInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      submitLetter()
    }
  })
  document.getElementById("letterInput").addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase()
  })
  if (isHost) {
    document.getElementById("restartGame").textContent = "New Game"
  } else {
    document.getElementById("restartGame").textContent = "Ask Host to Restart"
  }
})
function updatePlayerNames() {
  if (playerRole === "P1") {
    document.getElementById("player1Name").textContent = `${username} (P1)`
    document.getElementById("player2Name").textContent = "Player 2"
  } else {
    document.getElementById("player1Name").textContent = "Player 1"
    document.getElementById("player2Name").textContent = `${username} (P2)`
  }
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
    document.getElementById("statusMessage").textContent = `Welcome ${username}! You are ${playerRole}${hostText}`
    gameActive = true
    updateTurnInfo()
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
    case "letterGuessResult":
      handleLetterResult(JSON.parse(msg.payload))
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
  if (state.guessedWord) {
    currentWord = state.guessedWord
    updateWordDisplay()
  }
  if (state.guessedLetters) {
    guessedLetters = state.guessedLetters
    updateLettersGrid()
  }
  if (state.wrongGuesses !== undefined) {
    wrongGuesses = state.wrongGuesses
    updateWrongCount()
    updateHangman()
  }
  if (state.currentTurn) {
    currentTurn = state.currentTurn
    updateTurnInfo()
  }
  gameActive = state.gameActive
}
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
function submitLetter() {
  if (!gameActive) {
    alert("Game is not active!")
    return
  }
  if (currentTurn !== playerRole) {
    alert("It's not your turn!")
    return
  }
  const input = document.getElementById("letterInput")
  const letter = input.value.trim().toUpperCase()
  if (!letter || letter.length !== 1) {
    alert("Please enter a single letter!")
    input.focus()
    return
  }
  if (!/^[A-Z]$/.test(letter)) {
    alert("Please enter a valid letter!")
    input.focus()
    return
  }
  if (guessedLetters.includes(letter)) {
    alert("You already guessed that letter!")
    input.focus()
    return
  }
  console.log("Submitting letter:", letter)
  socket.send(
    JSON.stringify({
      type: "letterGuess",
      payload: JSON.stringify({ letter: letter }),
    }),
  )
  input.value = ""
}
function handleLetterResult(result) {
  console.log("Letter result:", result)
  const {
    letter,
    found,
    guessedWord,
    guessedLetters: newGuessedLetters,
    wrongGuesses: newWrongGuesses,
    gameActive: stillActive,
    currentTurn: newTurn,
    word,
  } = result
  currentWord = guessedWord
  guessedLetters = newGuessedLetters
  wrongGuesses = newWrongGuesses
  currentTurn = newTurn
  gameActive = stillActive
  updateWordDisplay()
  updateLettersGrid()
  updateWrongCount()
  updateHangman()
  updateTurnInfo()
  const statusEl = document.getElementById("statusMessage")
  if (!stillActive) {
    const wordComplete = !currentWord.includes("_")
    if (wordComplete) {
      statusEl.textContent = `🎉 Word guessed! The word was "${word}"!`
      statusEl.classList.add("game-win")
      updateStats("win")
    } else {
      statusEl.textContent = `💀 Game over! The word was "${word}"`
      statusEl.classList.add("game-lose")
      updateStats("lose")
    }
    const totalGames = scores.P1 + scores.P2 + 1
    document.getElementById("totalGames").textContent = totalGames
  } else {
    if (found) {
      statusEl.textContent = `Good guess! "${letter}" is in the word.`
    } else {
      statusEl.textContent = `Sorry, "${letter}" is not in the word.`
    }
  }
}
function updateWordDisplay() {
  const wordEl = document.getElementById("wordDisplay")
  wordEl.textContent = currentWord.join(" ")
}
function updateLettersGrid() {
  const gridEl = document.getElementById("lettersGrid")
  gridEl.innerHTML = ""
  guessedLetters.forEach((letter) => {
    const tile = document.createElement("div")
    tile.classList.add("letter-tile")
    tile.textContent = letter
    if (currentWord.includes(letter)) {
      tile.classList.add("correct")
    } else {
      tile.classList.add("wrong")
    }
    gridEl.appendChild(tile)
  })
}
function updateWrongCount() {
  const countEl = document.getElementById("wrongCount")
  countEl.textContent = `Wrong guesses: ${wrongGuesses}/${maxWrongGuesses}`
}
function updateHangman() {
  const hangmanEl = document.getElementById("hangmanDisplay")
  hangmanEl.textContent = hangmanStages[wrongGuesses] || ""
}
function updateTurnInfo() {
  const turnEl = document.getElementById("turnInfo")
  if (!gameActive) {
    turnEl.textContent = "Game Over"
    return
  }
  if (currentTurn === playerRole) {
    turnEl.textContent = "Your turn!"
    turnEl.style.color = "#00c853"
  } else {
    turnEl.textContent = "Opponent's turn"
    turnEl.style.color = "#ff9100"
  }
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
function resetGame() {
  console.log("Resetting game")
  currentWord = []
  guessedLetters = []
  wrongGuesses = 0
  currentTurn = "P1"
  gameActive = true
  const statusEl = document.getElementById("statusMessage")
  statusEl.classList.remove("game-win", "game-lose", "game-draw")
  statusEl.textContent = "New game started!"
  document.getElementById("letterInput").value = ""
  updateWordDisplay()
  updateLettersGrid()
  updateWrongCount()
  updateHangman()
  updateTurnInfo()
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
