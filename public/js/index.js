let selectedGame = null
let currentUsername = null
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
document.addEventListener("DOMContentLoaded", () => {
  currentUsername = localStorage.getItem("miniGamesUsername")
  if (currentUsername) {
    showMainMenu()
  } else {
    showUsernameSection()
  }
  document.getElementById("setUsername").addEventListener("click", setUsername)
  document.getElementById("changeUsername").addEventListener("click", showUsernameSection)
  document.getElementById("createGame").addEventListener("click", createGame)
  document.getElementById("joinGame").addEventListener("click", joinGame)
  document.getElementById("usernameInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      setUsername()
    }
  })
  document.getElementById("gameCode").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      joinGame()
    }
  })
})
function showUsernameSection() {
  document.getElementById("usernameSection").style.display = "block"
  document.getElementById("mainMenu").style.display = "none"
  const input = document.getElementById("usernameInput")
  input.value = currentUsername || ""
  input.focus()
}
function showMainMenu() {
  document.getElementById("usernameSection").style.display = "none"
  document.getElementById("mainMenu").style.display = "block"
  document.getElementById("currentUsername").textContent = currentUsername
  document.querySelector(".menu").style.display = "grid"
  document.getElementById("gameOptions").style.display = "none"
}
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
  currentUsername = username
  localStorage.setItem("miniGamesUsername", username)
  showMainMenu()
}
function selectGame(gameType) {
  selectedGame = gameType
  document.querySelector(".menu").style.display = "none"
  document.getElementById("gameOptions").style.display = "block"
  const info = gameInfo[gameType]
  document.getElementById("selectedGameTitle").textContent = info.title
  document.getElementById("gameDescription").textContent = info.description
}
function backToMenu() {
  document.querySelector(".menu").style.display = "grid"
  document.getElementById("gameOptions").style.display = "none"
  selectedGame = null
}
function createGame() {
  if (!selectedGame) return
  sessionStorage.setItem("gameType", selectedGame)
  sessionStorage.setItem("isHost", "true")
  sessionStorage.setItem("username", currentUsername)
  window.location.href = "lobby.html"
}
function joinGame() {
  const code = document.getElementById("gameCode").value.trim().toUpperCase()
  if (!code) {
    alert("Please enter a game code!")
    return
  }
  sessionStorage.setItem("gameCode", code)
  sessionStorage.setItem("isHost", "false")
  sessionStorage.setItem("username", currentUsername)
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
}
