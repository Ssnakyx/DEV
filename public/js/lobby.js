// Global variables
let socket
let gameCode = ""
let playerRole = ""
let gameType = ""
let isHost = false
let username = ""

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
  console.log("Lobby page loaded")

  // Get data from session storage
  gameType = sessionStorage.getItem("gameType") || "tictactoe"
  isHost = sessionStorage.getItem("isHost") === "true"
  username = sessionStorage.getItem("username") || ""
  const storedCode = sessionStorage.getItem("gameCode")

  console.log("Session data:", { gameType, isHost, username, storedCode })

  // Check if we have a username
  if (!username) {
    alert("Username not found. Returning to main menu.")
    window.location.href = "index.html"
    return
  }

  // Update the game type title
  const gameTitle = getGameTitle(gameType)
  document.getElementById("gameTypeTitle").textContent = gameTitle + " Lobby"

  // Connect to WebSocket server
  connectToServer()

  // If we have a code stored (joining a game), use it
  if (storedCode && !isHost) {
    gameCode = storedCode
    document.getElementById("gameCode").textContent = gameCode
  }
})

// Get game title from game type
function getGameTitle(gameType) {
  const titles = {
    tictactoe: "Tic Tac Toe",
    rps: "Rock Paper Scissors",
    connect4: "Connect 4",
    guessnumber: "Number Guessing",
    wordguess: "Word Guessing",
    dots: "Dots & Boxes",
  }
  return titles[gameType] || "Unknown Game"
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
    document.getElementById("statusMessage").textContent = "Connected to server"

    // If we're creating a game, send create message
    if (isHost) {
      console.log("Creating new game:", gameType)
      socket.send(
        JSON.stringify({
          type: "create",
          gameType: gameType,
          username: username,
        }),
      )
    }
    // If we're joining a game, send join message
    else if (gameCode) {
      console.log("Joining game with code:", gameCode)
      socket.send(
        JSON.stringify({
          type: "join",
          payload: JSON.stringify({ code: gameCode, username: username }),
          username: username,
        }),
      )
    } else {
      // If we don't have a game code and we're not the host, there's an error
      document.getElementById("statusMessage").textContent = "Error: No game code provided"
    }
  }

  socket.onclose = () => {
    console.log("WebSocket connection closed")
    document.getElementById("statusMessage").textContent = "Disconnected from server"
  }

  socket.onerror = (error) => {
    console.error("WebSocket error:", error)
    document.getElementById("statusMessage").textContent = "Error connecting to server"
  }

  socket.onmessage = (event) => {
    console.log("Message received:", event.data)
    try {
      const message = JSON.parse(event.data)
      handleMessage(message)
    } catch (error) {
      console.error("Error parsing message:", error)
    }
  }
}

// Handle incoming WebSocket messages
function handleMessage(msg) {
  console.log("Processing message:", msg)

  switch (msg.type) {
    case "roomCreated":
      handleRoomCreated(JSON.parse(msg.payload))
      break
    case "roomJoined":
      handleRoomJoined(JSON.parse(msg.payload))
      break
    case "lobbyUpdate":
      handleLobbyUpdate(JSON.parse(msg.payload))
      break
    case "startGame":
      handleStartGame(JSON.parse(msg.payload))
      break
    case "error":
      handleError(msg.payload)
      break
  }
}

// Handle room created message
function handleRoomCreated(data) {
  console.log("Room created:", data)
  gameCode = data.code
  playerRole = data.role
  gameType = data.gameType
  isHost = data.isHost

  // Store in session storage
  sessionStorage.setItem("gameCode", gameCode)
  sessionStorage.setItem("playerRole", playerRole)
  sessionStorage.setItem("gameType", gameType)
  sessionStorage.setItem("isHost", isHost.toString())

  document.getElementById("gameCode").textContent = gameCode
  document.getElementById("statusMessage").textContent =
    `Welcome ${username}! You are ${playerRole} (Host) - You play first!`
}

// Handle room joined message
function handleRoomJoined(data) {
  console.log("Room joined:", data)
  gameCode = data.code
  playerRole = data.role
  gameType = data.gameType
  isHost = data.isHost

  // Store in session storage
  sessionStorage.setItem("gameCode", gameCode)
  sessionStorage.setItem("playerRole", playerRole)
  sessionStorage.setItem("gameType", gameType)
  sessionStorage.setItem("isHost", isHost.toString())

  document.getElementById("gameCode").textContent = gameCode
  document.getElementById("statusMessage").textContent =
    `Welcome ${username}! You are ${playerRole} - Host plays first!`
}

// Handle lobby update message
function handleLobbyUpdate(data) {
  console.log("Lobby update:", data)
  const playerList = document.getElementById("playerList")
  playerList.innerHTML = ""

  data.players.forEach((player) => {
    const li = document.createElement("li")
    li.innerHTML = `
      <div class="player-info">
        <span>${player.username}</span>
        <div>
          <span class="player-role">${player.role}</span>
          ${player.isHost ? '<span class="host-badge">HOST</span>' : ""}
        </div>
      </div>
    `
    playerList.appendChild(li)
  })

  // Update status message based on number of players
  if (data.players.length < 2) {
    document.getElementById("statusMessage").textContent = "Waiting for another player to join..."
  } else {
    const hostPlayer = data.players.find((p) => p.isHost)
    document.getElementById("statusMessage").textContent = `Room ready! Game will start automatically...`
  }
}

// Handle start game message
function handleStartGame(data) {
  console.log("Starting game:", data)

  // Ensure game data is in session storage
  sessionStorage.setItem("gameCode", gameCode)
  sessionStorage.setItem("playerRole", playerRole)
  sessionStorage.setItem("gameType", data.gameType)
  sessionStorage.setItem("isHost", data.isHost.toString())
  sessionStorage.setItem("username", username)

  console.log("Session storage before redirect:", {
    gameCode: sessionStorage.getItem("gameCode"),
    playerRole: sessionStorage.getItem("playerRole"),
    gameType: sessionStorage.getItem("gameType"),
    isHost: sessionStorage.getItem("isHost"),
    username: sessionStorage.getItem("username"),
  })

  // Small delay to ensure session storage is written
  setTimeout(() => {
    // Redirect to the appropriate game page
    const gamePages = {
      tictactoe: "game.html",
      rps: "rps.html",
      connect4: "connect4.html",
      guessnumber: "guessnumber.html",
      wordguess: "wordguess.html",
      dots: "dots.html",
    }

    const targetPage = gamePages[data.gameType]
    if (targetPage) {
      window.location.href = targetPage
    } else {
      console.error("Unknown game type:", data.gameType)
      document.getElementById("statusMessage").textContent = "Error: Unknown game type"
    }
  }, 100)
}

// Handle error message
function handleError(message) {
  console.error("Error:", message)
  document.getElementById("statusMessage").textContent = `Error: ${message}`
}

// Go back to the main menu
function goBack() {
  window.location.href = "index.html"
}
