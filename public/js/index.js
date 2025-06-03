// Global variables
let selectedGame = null
let currentUsername = null

// Game information
const gameInfo = {
  tictactoe: {
    title: "Tic Tac Toe",
    description: "The classic 3x3 grid game. Get three in a row to win! Simple rules, endless fun.",
  },
  rps: {
    title: "Rock Paper Scissors",
    description: "The timeless hand game. Rock crushes scissors, scissors cuts paper, paper covers rock!",
  },
  connect4: {
    title: "Connect 4",
    description: "Drop your colored pieces and try to connect four in a row - horizontally, vertically, or diagonally!",
  },
  guessnumber: {
    title: "Number Guessing",
    description: "Race to guess the secret number between 1-100. Use clues to narrow down your guesses!",
  },
  wordguess: {
    title: "Word Guessing",
    description: "Take turns guessing letters to reveal the hidden word. Don't let the hangman complete!",
  },
  dots: {
    title: "Dots & Boxes",
    description: "Draw lines between dots to form boxes. Complete a box to score a point and take another turn!",
  },
}

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
  // Check if user has a saved username
  currentUsername = localStorage.getItem("miniGamesUsername")

  if (currentUsername) {
    showMainMenu()
  } else {
    showUsernameSection()
  }

  // Set up event listeners
  document.getElementById("setUsername").addEventListener("click", setUsername)
  document.getElementById("changeUsername").addEventListener("click", showUsernameSection)
  document.getElementById("createGame").addEventListener("click", createGame)
  document.getElementById("joinGame").addEventListener("click", joinGame)

  // Allow Enter key to set username
  document.getElementById("usernameInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      setUsername()
    }
  })

  // Allow Enter key to join game
  document.getElementById("gameCode").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      joinGame()
    }
  })
})

// Show username section
function showUsernameSection() {
  document.getElementById("usernameSection").style.display = "block"
  document.getElementById("mainMenu").style.display = "none"

  // Clear and focus the input
  const input = document.getElementById("usernameInput")
  input.value = currentUsername || ""
  input.focus()
}

// Show main menu
function showMainMenu() {
  document.getElementById("usernameSection").style.display = "none"
  document.getElementById("mainMenu").style.display = "block"
  document.getElementById("currentUsername").textContent = currentUsername

  // Hide game options when returning to main menu
  document.querySelector(".menu").style.display = "grid"
  document.getElementById("gameOptions").style.display = "none"
}

// Set username
function setUsername() {
  const input = document.getElementById("usernameInput")
  const username = input.value.trim()

  if (!username) {
    alert("Please enter a username!")
    input.focus()
    return
  }

  if (username.length < 2) {
    alert("Username must be at least 2 characters long!")
    input.focus()
    return
  }

  if (username.length > 20) {
    alert("Username must be 20 characters or less!")
    input.focus()
    return
  }

  // Save username to localStorage
  currentUsername = username
  localStorage.setItem("miniGamesUsername", username)

  // Show main menu
  showMainMenu()
}

// Select a game
function selectGame(gameType) {
  selectedGame = gameType

  // Update UI
  document.querySelector(".menu").style.display = "none"
  document.getElementById("gameOptions").style.display = "block"

  // Set the game title and description
  const info = gameInfo[gameType]
  document.getElementById("selectedGameTitle").textContent = info.title
  document.getElementById("gameDescription").textContent = info.description
}

// Go back to the main menu
function backToMenu() {
  document.querySelector(".menu").style.display = "grid"
  document.getElementById("gameOptions").style.display = "none"
  selectedGame = null
}

// Create a new game
function createGame() {
  if (!selectedGame) return

  // Store the selected game and user info in session storage
  sessionStorage.setItem("gameType", selectedGame)
  sessionStorage.setItem("isHost", "true")
  sessionStorage.setItem("username", currentUsername)

  // Redirect to the lobby page
  window.location.href = "lobby.html"
}

// Join an existing game
function joinGame() {
  const code = document.getElementById("gameCode").value.trim().toUpperCase()

  if (!code) {
    alert("Please enter a game code!")
    return
  }

  // Store the game code and user info in session storage
  sessionStorage.setItem("gameCode", code)
  sessionStorage.setItem("isHost", "false")
  sessionStorage.setItem("username", currentUsername)

  // Redirect to the lobby page
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
}
