package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

const (
	GameTypeTicTacToe   = "tictactoe"
	GameTypeRPS         = "rps"
	GameTypeConnect4    = "connect4"
	GameTypeGuessNumber = "guessnumber"
	GameTypeWordGuess   = "wordguess"
	GameTypeDots        = "dots"
)

type Player struct {
	Conn     *websocket.Conn
	Username string
	Role     string
}
type GameRoom struct {
	Code      string
	GameType  string
	Players   map[*websocket.Conn]*Player
	GameState interface{}
	Host      *websocket.Conn
	CreatedAt time.Time
	mu        sync.Mutex
}
type Message struct {
	Type     string `json:"type"`
	Payload  string `json:"payload"`
	GameType string `json:"gameType,omitempty"`
	Code     string `json:"code,omitempty"`
	Username string `json:"username,omitempty"`
}
type ChatMessage struct {
	Username  string    `json:"username"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	Role      string    `json:"role"`
}
type TicTacToeState struct {
	Board       [9]string
	CurrentTurn string
	GameActive  bool
}
type RPSState struct {
	Choices map[string]string
	Round   int
}
type Connect4State struct {
	Board       [6][7]string
	CurrentTurn string
	GameActive  bool
}
type GuessNumberState struct {
	TargetNumber int
	Guesses      map[string][]int
	MaxGuesses   int
	GameActive   bool
	Winner       string
}
type WordGuessState struct {
	Word            string
	GuessedWord     []string
	GuessedLetters  []string
	WrongGuesses    int
	MaxWrongGuesses int
	GameActive      bool
	CurrentTurn     string
}
type DotsState struct {
	Grid        [4][4]bool
	Lines       []Line
	Boxes       [3][3]string
	CurrentTurn string
	GameActive  bool
	Scores      map[string]int
}
type Line struct {
	StartX, StartY, EndX, EndY int
	Player                     string
}

var (
	rooms     = make(map[string]*GameRoom)
	roomsMu   sync.Mutex
	broadcast = make(chan Message)
)
var wordList = []string{
	"JAVASCRIPT", "COMPUTER", "PROGRAMMING", "WEBSITE", "INTERNET", "KEYBOARD",
	"MONITOR", "SOFTWARE", "HARDWARE", "DATABASE", "NETWORK", "SECURITY",
	"ALGORITHM", "FUNCTION", "VARIABLE", "OBJECT", "ARRAY", "STRING",
	"BOOLEAN", "INTEGER", "FRAMEWORK", "LIBRARY", "BROWSER", "SERVER",
}

func init() {
	rand.Seed(time.Now().UnixNano())
}
func main() {
	http.Handle("/", http.FileServer(http.Dir("./public")))
	http.HandleFunc("/ws", handleConnections)
	go handleMessages()
	go roomCleanupRoutine()
	fmt.Println("Server running on http://localhost:8080")
	log.Println("Access via local network at http://(Your IP):8080")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("Error starting server:", err)
	}
}
func roomCleanupRoutine() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			roomsMu.Lock()
			now := time.Now()
			for code, room := range rooms {
				room.mu.Lock()
				if len(room.Players) == 0 && now.Sub(room.CreatedAt) > 5*time.Minute {
					delete(rooms, code)
					log.Printf("Cleaned up empty room: %s", code)
				}
				room.mu.Unlock()
			}
			roomsMu.Unlock()
		}
	}
}
func handleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error upgrading connection: %v", err)
		return
	}
	log.Printf("New client connected from %s", ws.RemoteAddr())
	ws.SetReadDeadline(time.Now().Add(60 * time.Second))
	ws.SetPongHandler(func(string) error {
		ws.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				if err := ws.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(10*time.Second)); err != nil {
					log.Printf("Ping error: %v", err)
					return
				}
			}
		}
	}()
	for {
		var msg Message
		err := ws.ReadJSON(&msg)
		if err != nil {
			handleDisconnect(ws)
			log.Printf("Client disconnected: %v", err)
			break
		}
		log.Printf("Received message: %+v", msg)
		switch msg.Type {
		case "create":
			handleCreateRoom(ws, msg)
		case "join":
			handleJoinRoom(ws, msg)
		case "move":
			handleGameMove(ws, msg)
		case "restart":
			handleGameRestart(ws, msg)
		case "rpsChoice":
			handleRPSChoice(ws, msg)
		case "getGameState":
			handleGetGameState(ws, msg)
		case "connect4Move":
			handleConnect4Move(ws, msg)
		case "numberGuess":
			handleNumberGuess(ws, msg)
		case "letterGuess":
			handleLetterGuess(ws, msg)
		case "dotsMove":
			handleDotsMove(ws, msg)
		case "chat":
			handleChatMessage(ws, msg)
		}
	}
}

func handleChatMessage(ws *websocket.Conn, msg Message) {
	roomCode := findPlayerRoom(ws)
	if roomCode == "" {
		return
	}
	roomsMu.Lock()
	room := rooms[roomCode]
	roomsMu.Unlock()
	if room == nil {
		return
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	player := room.Players[ws]
	if player == nil {
		return
	}
	var chatPayload struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal([]byte(msg.Payload), &chatPayload); err != nil {
		log.Printf("Error parsing chat message: %v", err)
		return
	}
	if len(chatPayload.Message) == 0 || len(chatPayload.Message) > 500 {
		return
	}

	chatMsg := ChatMessage{
		Username:  player.Username,
		Message:   chatPayload.Message,
		Timestamp: time.Now(),
		Role:      player.Role,
	}
	chatMsgJSON, err := json.Marshal(chatMsg)
	if err != nil {
		log.Printf("Error marshaling chat message: %v", err)
		return
	}

	broadcastMsg := Message{
		Type:    "chatMessage",
		Payload: string(chatMsgJSON),
	}
	for client := range room.Players {
		if err := client.WriteJSON(broadcastMsg); err != nil {
			log.Printf("Error sending chat message to client: %v", err)
		}
	}
	log.Printf("Chat message from %s in room %s: %s", player.Username, roomCode, chatPayload.Message)
}
func generateRoomCode() string {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	code := make([]byte, 6)
	for i := range code {
		code[i] = charset[rand.Intn(len(charset))]
	}
	return string(code)
}
func handleCreateRoom(ws *websocket.Conn, msg Message) {
	roomsMu.Lock()
	defer roomsMu.Unlock()
	code := generateRoomCode()
	for rooms[code] != nil {
		code = generateRoomCode()
	}
	gameType := msg.GameType
	if gameType == "" {
		gameType = GameTypeTicTacToe
	}
	room := &GameRoom{
		Code:      code,
		GameType:  gameType,
		Players:   make(map[*websocket.Conn]*Player),
		Host:      ws,
		CreatedAt: time.Now(),
	}
	switch gameType {
	case GameTypeTicTacToe:
		room.GameState = TicTacToeState{
			Board:       [9]string{},
			CurrentTurn: "X",
			GameActive:  true,
		}
		room.Players[ws] = &Player{Conn: ws, Username: msg.Username, Role: "X"}
	case GameTypeRPS:
		room.GameState = RPSState{
			Choices: make(map[string]string),
			Round:   1,
		}
		room.Players[ws] = &Player{Conn: ws, Username: msg.Username, Role: "P1"}
	case GameTypeConnect4:
		room.GameState = Connect4State{
			Board:       [6][7]string{},
			CurrentTurn: "Red",
			GameActive:  true,
		}
		room.Players[ws] = &Player{Conn: ws, Username: msg.Username, Role: "Red"}
	case GameTypeGuessNumber:
		room.GameState = GuessNumberState{
			TargetNumber: rand.Intn(100) + 1,
			Guesses:      make(map[string][]int),
			MaxGuesses:   10,
			GameActive:   true,
		}
		room.Players[ws] = &Player{Conn: ws, Username: msg.Username, Role: "P1"}
	case GameTypeWordGuess:
		word := wordList[rand.Intn(len(wordList))]
		guessedWord := make([]string, len(word))
		for i := range guessedWord {
			guessedWord[i] = "_"
		}
		room.GameState = WordGuessState{
			Word:            word,
			GuessedWord:     guessedWord,
			GuessedLetters:  []string{},
			WrongGuesses:    0,
			MaxWrongGuesses: 6,
			GameActive:      true,
			CurrentTurn:     "P1",
		}
		room.Players[ws] = &Player{Conn: ws, Username: msg.Username, Role: "P1"}
	case GameTypeDots:
		room.GameState = DotsState{
			Grid:        [4][4]bool{},
			Lines:       []Line{},
			Boxes:       [3][3]string{},
			CurrentTurn: "P1",
			GameActive:  true,
			Scores:      map[string]int{"P1": 0, "P2": 0},
		}
		room.Players[ws] = &Player{Conn: ws, Username: msg.Username, Role: "P1"}
	}
	rooms[code] = room
	log.Printf("Room created: %s, GameType: %s, Host: %s (%s)", code, gameType, msg.Username, room.Players[ws].Role)
	response := Message{
		Type: "roomCreated",
		Payload: fmt.Sprintf(`{"code":"%s","role":"%s","gameType":"%s","isHost":true,"username":"%s"}`,
			code, room.Players[ws].Role, gameType, msg.Username),
	}
	ws.WriteJSON(response)
	updateLobby(room)
}
func handleJoinRoom(ws *websocket.Conn, msg Message) {
	var payload struct {
		Code     string `json:"code"`
		Username string `json:"username"`
	}
	json.Unmarshal([]byte(msg.Payload), &payload)
	code := payload.Code
	username := payload.Username
	if username == "" {
		username = msg.Username
	}
	log.Printf("User %s attempting to join room: %s", username, code)
	roomsMu.Lock()
	room, exists := rooms[code]
	roomsMu.Unlock()
	if !exists {
		log.Printf("Room %s not found", code)
		ws.WriteJSON(Message{
			Type:    "error",
			Payload: fmt.Sprintf("Room %s not found. The room may have been closed or expired.", code),
		})
		return
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	for conn, player := range room.Players {
		if player.Username == username {
			log.Printf("Player %s reconnecting to room %s as %s", player.Username, code, player.Role)
			delete(room.Players, conn)
			room.Players[ws] = player
			player.Conn = ws
			if conn == room.Host {
				room.Host = ws
			}
			isHost := (ws == room.Host)
			ws.WriteJSON(Message{
				Type: "roomJoined",
				Payload: fmt.Sprintf(`{"code":"%s","role":"%s","gameType":"%s","isHost":%t,"username":"%s"}`,
					code, player.Role, room.GameType, isHost, player.Username),
			})
			sendGameState(ws, room)
			updateLobby(room)
			return
		}
	}
	if len(room.Players) >= 2 {
		log.Printf("Room %s is full", code)
		ws.WriteJSON(Message{Type: "error", Payload: "Room is full"})
		return
	}
	var role string
	switch room.GameType {
	case GameTypeTicTacToe:
		role = "O"
	case GameTypeRPS:
		role = "P2"
	case GameTypeConnect4:
		role = "Yellow"
	case GameTypeGuessNumber, GameTypeWordGuess, GameTypeDots:
		role = "P2"
	}
	room.Players[ws] = &Player{
		Conn:     ws,
		Username: username,
		Role:     role,
	}
	log.Printf("Player %s joined room %s as %s", username, code, role)
	response := Message{
		Type: "roomJoined",
		Payload: fmt.Sprintf(`{"code":"%s","role":"%s","gameType":"%s","isHost":false,"username":"%s"}`,
			code, role, room.GameType, username),
	}
	ws.WriteJSON(response)
	sendGameState(ws, room)
	updateLobby(room)
	if len(room.Players) == 2 {
		startGame(room)
	}
}
func sendGameState(ws *websocket.Conn, room *GameRoom) {
	switch room.GameType {
	case GameTypeTicTacToe:
		state := room.GameState.(TicTacToeState)
		boardJSON, _ := json.Marshal(state.Board)
		gameStateMsg := Message{
			Type: "gameState",
			Payload: fmt.Sprintf(`{"board":%s,"currentTurn":"%s","gameActive":%t}`,
				boardJSON, state.CurrentTurn, state.GameActive),
		}
		ws.WriteJSON(gameStateMsg)
	case GameTypeRPS:
		state := room.GameState.(RPSState)
		choicesJSON, _ := json.Marshal(state.Choices)
		gameStateMsg := Message{
			Type: "gameState",
			Payload: fmt.Sprintf(`{"choices":%s,"round":%d}`,
				choicesJSON, state.Round),
		}
		ws.WriteJSON(gameStateMsg)
	case GameTypeConnect4:
		state := room.GameState.(Connect4State)
		boardJSON, _ := json.Marshal(state.Board)
		gameStateMsg := Message{
			Type: "gameState",
			Payload: fmt.Sprintf(`{"board":%s,"currentTurn":"%s","gameActive":%t}`,
				boardJSON, state.CurrentTurn, state.GameActive),
		}
		ws.WriteJSON(gameStateMsg)
	case GameTypeGuessNumber:
		state := room.GameState.(GuessNumberState)
		guessesJSON, _ := json.Marshal(state.Guesses)
		gameStateMsg := Message{
			Type: "gameState",
			Payload: fmt.Sprintf(`{"guesses":%s,"maxGuesses":%d,"gameActive":%t,"winner":"%s"}`,
				guessesJSON, state.MaxGuesses, state.GameActive, state.Winner),
		}
		ws.WriteJSON(gameStateMsg)
	case GameTypeWordGuess:
		state := room.GameState.(WordGuessState)
		guessedWordJSON, _ := json.Marshal(state.GuessedWord)
		guessedLettersJSON, _ := json.Marshal(state.GuessedLetters)
		gameStateMsg := Message{
			Type: "gameState",
			Payload: fmt.Sprintf(`{"guessedWord":%s,"guessedLetters":%s,"wrongGuesses":%d,"maxWrongGuesses":%d,"gameActive":%t,"currentTurn":"%s"}`,
				guessedWordJSON, guessedLettersJSON, state.WrongGuesses, state.MaxWrongGuesses, state.GameActive, state.CurrentTurn),
		}
		ws.WriteJSON(gameStateMsg)
	case GameTypeDots:
		state := room.GameState.(DotsState)
		linesJSON, _ := json.Marshal(state.Lines)
		boxesJSON, _ := json.Marshal(state.Boxes)
		scoresJSON, _ := json.Marshal(state.Scores)
		gameStateMsg := Message{
			Type: "gameState",
			Payload: fmt.Sprintf(`{"lines":%s,"boxes":%s,"scores":%s,"currentTurn":"%s","gameActive":%t}`,
				linesJSON, boxesJSON, scoresJSON, state.CurrentTurn, state.GameActive),
		}
		ws.WriteJSON(gameStateMsg)
	}
}
func handleGetGameState(ws *websocket.Conn, msg Message) {
	var payload struct {
		Code string `json:"code"`
	}
	json.Unmarshal([]byte(msg.Payload), &payload)
	roomsMu.Lock()
	room, exists := rooms[payload.Code]
	roomsMu.Unlock()
	if !exists {
		ws.WriteJSON(Message{Type: "error", Payload: "Room not found"})
		return
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	_, isInRoom := room.Players[ws]
	if !isInRoom {
		ws.WriteJSON(Message{Type: "error", Payload: "You are not in this room"})
		return
	}
	sendGameState(ws, room)
}
func updateLobby(room *GameRoom) {
	type PlayerInfo struct {
		Username string `json:"username"`
		Role     string `json:"role"`
		IsHost   bool   `json:"isHost"`
	}
	players := make([]PlayerInfo, 0, len(room.Players))
	for conn, player := range room.Players {
		isHost := (conn == room.Host)
		players = append(players, PlayerInfo{
			Username: player.Username,
			Role:     player.Role,
			IsHost:   isHost,
		})
	}
	playersJSON, _ := json.Marshal(players)
	for client, player := range room.Players {
		isHost := (client == room.Host)
		client.WriteJSON(Message{
			Type: "lobbyUpdate",
			Payload: fmt.Sprintf(`{"code":"%s","players":%s,"gameType":"%s","isHost":%t,"username":"%s"}`,
				room.Code, playersJSON, room.GameType, isHost, player.Username),
		})
	}
}
func startGame(room *GameRoom) {
	for client, player := range room.Players {
		isHost := (client == room.Host)
		client.WriteJSON(Message{
			Type: "startGame",
			Payload: fmt.Sprintf(`{"code":"%s","gameType":"%s","isHost":%t,"username":"%s"}`,
				room.Code, room.GameType, isHost, player.Username),
		})
	}
}
func handleConnect4Move(ws *websocket.Conn, msg Message) {
	roomCode := findPlayerRoom(ws)
	if roomCode == "" {
		return
	}
	roomsMu.Lock()
	room := rooms[roomCode]
	roomsMu.Unlock()
	if room == nil {
		return
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	state, ok := room.GameState.(Connect4State)
	if !ok || !state.GameActive {
		return
	}
	var move struct {
		Column int `json:"column"`
	}
	json.Unmarshal([]byte(msg.Payload), &move)
	player := room.Players[ws]
	if player == nil || player.Role != state.CurrentTurn {
		return
	}
	row := -1
	for r := 5; r >= 0; r-- {
		if state.Board[r][move.Column] == "" {
			row = r
			break
		}
	}
	if row == -1 {
		return
	}
	state.Board[row][move.Column] = player.Role
	if state.CurrentTurn == "Red" {
		state.CurrentTurn = "Yellow"
	} else {
		state.CurrentTurn = "Red"
	}
	room.GameState = state
	moveMsg := Message{
		Type: "connect4Move",
		Payload: fmt.Sprintf(`{"row":%d,"column":%d,"player":"%s","username":"%s"}`,
			row, move.Column, player.Role, player.Username),
	}
	for client := range room.Players {
		client.WriteJSON(moveMsg)
	}
	checkConnect4GameEnd(room, row, move.Column)
}
func checkConnect4GameEnd(room *GameRoom, row, col int) {
	state := room.GameState.(Connect4State)
	player := state.Board[row][col]
	directions := [][2]int{{0, 1}, {1, 0}, {1, 1}, {1, -1}}
	for _, dir := range directions {
		count := 1
		r, c := row+dir[0], col+dir[1]
		for r >= 0 && r < 6 && c >= 0 && c < 7 && state.Board[r][c] == player {
			count++
			r, c = r+dir[0], c+dir[1]
		}
		r, c = row-dir[0], col-dir[1]
		for r >= 0 && r < 6 && c >= 0 && c < 7 && state.Board[r][c] == player {
			count++
			r, c = r-dir[0], c-dir[1]
		}
		if count >= 4 {
			state.GameActive = false
			room.GameState = state
			var winnerUsername string
			for _, p := range room.Players {
				if p.Role == player {
					winnerUsername = p.Username
					break
				}
			}
			for client := range room.Players {
				client.WriteJSON(Message{
					Type:    "gameEnd",
					Payload: fmt.Sprintf(`{"winner":"%s","winnerUsername":"%s"}`, player, winnerUsername),
				})
			}
			return
		}
	}
	full := true
	for c := 0; c < 7; c++ {
		if state.Board[0][c] == "" {
			full = false
			break
		}
	}
	if full {
		state.GameActive = false
		room.GameState = state
		for client := range room.Players {
			client.WriteJSON(Message{
				Type:    "gameEnd",
				Payload: `{"winner":"draw"}`,
			})
		}
	}
}
func handleNumberGuess(ws *websocket.Conn, msg Message) {
	roomCode := findPlayerRoom(ws)
	if roomCode == "" {
		return
	}
	roomsMu.Lock()
	room := rooms[roomCode]
	roomsMu.Unlock()
	if room == nil {
		return
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	state, ok := room.GameState.(GuessNumberState)
	if !ok || !state.GameActive {
		return
	}
	var guess struct {
		Number int `json:"number"`
	}
	json.Unmarshal([]byte(msg.Payload), &guess)
	player := room.Players[ws]
	if player == nil {
		return
	}
	if state.Guesses[player.Role] == nil {
		state.Guesses[player.Role] = []int{}
	}
	state.Guesses[player.Role] = append(state.Guesses[player.Role], guess.Number)
	var result string
	if guess.Number == state.TargetNumber {
		result = "correct"
		state.Winner = player.Role
		state.GameActive = false
	} else if guess.Number < state.TargetNumber {
		result = "higher"
	} else {
		result = "lower"
	}
	if len(state.Guesses[player.Role]) >= state.MaxGuesses && state.GameActive {
		state.GameActive = false
		otherRole := "P1"
		if player.Role == "P1" {
			otherRole = "P2"
		}
		if state.Winner == "" {
			state.Winner = otherRole
		}
	}
	room.GameState = state
	resultMsg := Message{
		Type: "numberGuessResult",
		Payload: fmt.Sprintf(`{"player":"%s","username":"%s","guess":%d,"result":"%s","target":%d,"gameActive":%t,"winner":"%s"}`,
			player.Role, player.Username, guess.Number, result, state.TargetNumber, state.GameActive, state.Winner),
	}
	for client := range room.Players {
		client.WriteJSON(resultMsg)
	}
}
func handleLetterGuess(ws *websocket.Conn, msg Message) {
	roomCode := findPlayerRoom(ws)
	if roomCode == "" {
		return
	}
	roomsMu.Lock()
	room := rooms[roomCode]
	roomsMu.Unlock()
	if room == nil {
		return
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	state, ok := room.GameState.(WordGuessState)
	if !ok || !state.GameActive {
		return
	}
	var guess struct {
		Letter string `json:"letter"`
	}
	json.Unmarshal([]byte(msg.Payload), &guess)
	player := room.Players[ws]
	if player == nil || player.Role != state.CurrentTurn {
		return
	}
	letter := guess.Letter
	for _, l := range state.GuessedLetters {
		if l == letter {
			return
		}
	}
	state.GuessedLetters = append(state.GuessedLetters, letter)
	found := false
	for i, char := range state.Word {
		if string(char) == letter {
			state.GuessedWord[i] = letter
			found = true
		}
	}
	if !found {
		state.WrongGuesses++
	}
	wordComplete := true
	for _, char := range state.GuessedWord {
		if char == "_" {
			wordComplete = false
			break
		}
	}
	if wordComplete {
		state.GameActive = false
	} else if state.WrongGuesses >= state.MaxWrongGuesses {
		state.GameActive = false
	} else {
		if state.CurrentTurn == "P1" {
			state.CurrentTurn = "P2"
		} else {
			state.CurrentTurn = "P1"
		}
	}
	room.GameState = state
	guessedWordJSON, _ := json.Marshal(state.GuessedWord)
	guessedLettersJSON, _ := json.Marshal(state.GuessedLetters)
	resultMsg := Message{
		Type: "letterGuessResult",
		Payload: fmt.Sprintf(`{"letter":"%s","found":%t,"guessedWord":%s,"guessedLetters":%s,"wrongGuesses":%d,"gameActive":%t,"currentTurn":"%s","word":"%s"}`,
			letter, found, guessedWordJSON, guessedLettersJSON, state.WrongGuesses, state.GameActive, state.CurrentTurn, state.Word),
	}
	for client := range room.Players {
		client.WriteJSON(resultMsg)
	}
}
func handleGameMove(ws *websocket.Conn, msg Message) {
	roomCode := findPlayerRoom(ws)
	if roomCode == "" {
		return
	}
	roomsMu.Lock()
	room := rooms[roomCode]
	roomsMu.Unlock()
	if room == nil {
		return
	}
	if room.GameType == GameTypeTicTacToe {
		handleTicTacToeMove(room, ws, msg)
	}
}
func handleTicTacToeMove(room *GameRoom, ws *websocket.Conn, msg Message) {
	room.mu.Lock()
	defer room.mu.Unlock()
	state, ok := room.GameState.(TicTacToeState)
	if !ok || !state.GameActive {
		return
	}
	var move struct {
		Index  int    `json:"index"`
		Player string `json:"player"`
	}
	json.Unmarshal([]byte(msg.Payload), &move)
	player := room.Players[ws]
	if player == nil || player.Role != state.CurrentTurn {
		return
	}
	if move.Index < 0 || move.Index >= 9 || state.Board[move.Index] != "" {
		return
	}
	state.Board[move.Index] = player.Role
	if state.CurrentTurn == "X" {
		state.CurrentTurn = "O"
	} else {
		state.CurrentTurn = "X"
	}
	room.GameState = state
	moveMsg := Message{
		Type:    "move",
		Payload: fmt.Sprintf(`{"index":%d,"player":"%s","username":"%s"}`, move.Index, player.Role, player.Username),
	}
	for client := range room.Players {
		client.WriteJSON(moveMsg)
	}
	checkTicTacToeGameEnd(room)
}
func checkTicTacToeGameEnd(room *GameRoom) {
	state := room.GameState.(TicTacToeState)
	winningCombos := [][3]int{
		{0, 1, 2}, {3, 4, 5}, {6, 7, 8},
		{0, 3, 6}, {1, 4, 7}, {2, 5, 8},
		{0, 4, 8}, {2, 4, 6},
	}
	for _, combo := range winningCombos {
		a, b, c := combo[0], combo[1], combo[2]
		if state.Board[a] != "" && state.Board[a] == state.Board[b] && state.Board[a] == state.Board[c] {
			state.GameActive = false
			room.GameState = state
			var winnerUsername string
			for _, player := range room.Players {
				if player.Role == state.Board[a] {
					winnerUsername = player.Username
					break
				}
			}
			for client := range room.Players {
				client.WriteJSON(Message{
					Type:    "gameEnd",
					Payload: fmt.Sprintf(`{"winner":"%s","winnerUsername":"%s"}`, state.Board[a], winnerUsername),
				})
			}
			return
		}
	}
	isDraw := true
	for _, cell := range state.Board {
		if cell == "" {
			isDraw = false
			break
		}
	}
	if isDraw {
		state.GameActive = false
		room.GameState = state
		for client := range room.Players {
			client.WriteJSON(Message{
				Type:    "gameEnd",
				Payload: `{"winner":"draw"}`,
			})
		}
	}
}
func handleGameRestart(ws *websocket.Conn, msg Message) {
	roomCode := findPlayerRoom(ws)
	if roomCode == "" {
		return
	}
	roomsMu.Lock()
	room := rooms[roomCode]
	roomsMu.Unlock()
	if room == nil {
		return
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	if ws != room.Host {
		ws.WriteJSON(Message{
			Type:    "error",
			Payload: "Only the host can restart the game",
		})
		return
	}
	switch room.GameType {
	case GameTypeTicTacToe:
		room.GameState = TicTacToeState{
			Board:       [9]string{},
			CurrentTurn: "X",
			GameActive:  true,
		}
	case GameTypeRPS:
		state := room.GameState.(RPSState)
		state.Choices = make(map[string]string)
		state.Round++
		room.GameState = state
	case GameTypeConnect4:
		room.GameState = Connect4State{
			Board:       [6][7]string{},
			CurrentTurn: "Red",
			GameActive:  true,
		}
	case GameTypeGuessNumber:
		room.GameState = GuessNumberState{
			TargetNumber: rand.Intn(100) + 1,
			Guesses:      make(map[string][]int),
			MaxGuesses:   10,
			GameActive:   true,
		}
	case GameTypeWordGuess:
		word := wordList[rand.Intn(len(wordList))]
		guessedWord := make([]string, len(word))
		for i := range guessedWord {
			guessedWord[i] = "_"
		}
		room.GameState = WordGuessState{
			Word:            word,
			GuessedWord:     guessedWord,
			GuessedLetters:  []string{},
			WrongGuesses:    0,
			MaxWrongGuesses: 6,
			GameActive:      true,
			CurrentTurn:     "P1",
		}
	case GameTypeDots:
		room.GameState = DotsState{
			Grid:        [4][4]bool{},
			Lines:       []Line{},
			Boxes:       [3][3]string{},
			CurrentTurn: "P1",
			GameActive:  true,
			Scores:      map[string]int{"P1": 0, "P2": 0},
		}
	}
	for client := range room.Players {
		client.WriteJSON(Message{
			Type:    "restart",
			Payload: "",
		})
	}
}
func handleRPSChoice(ws *websocket.Conn, msg Message) {
	roomCode := findPlayerRoom(ws)
	if roomCode == "" {
		return
	}
	roomsMu.Lock()
	room := rooms[roomCode]
	roomsMu.Unlock()
	if room == nil {
		return
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	state, ok := room.GameState.(RPSState)
	if !ok {
		return
	}
	var choice struct {
		Choice string `json:"choice"`
	}
	json.Unmarshal([]byte(msg.Payload), &choice)
	player := room.Players[ws]
	if player == nil {
		return
	}
	state.Choices[player.Role] = choice.Choice
	room.GameState = state
	if len(state.Choices) == 2 {
		p1Choice := state.Choices["P1"]
		p2Choice := state.Choices["P2"]
		var result string
		if p1Choice == p2Choice {
			result = "draw"
		} else if (p1Choice == "rock" && p2Choice == "scissors") ||
			(p1Choice == "paper" && p2Choice == "rock") ||
			(p1Choice == "scissors" && p2Choice == "paper") {
			result = "P1"
		} else {
			result = "P2"
		}
		resultMsg := Message{
			Type: "rpsResult",
			Payload: fmt.Sprintf(`{"p1":"%s","p2":"%s","winner":"%s","round":%d}`,
				p1Choice, p2Choice, result, state.Round),
		}
		for client := range room.Players {
			client.WriteJSON(resultMsg)
		}
		state.Choices = make(map[string]string)
		state.Round++
		room.GameState = state
	}
}
func handleDotsMove(ws *websocket.Conn, msg Message) {
}
func findPlayerRoom(ws *websocket.Conn) string {
	roomsMu.Lock()
	defer roomsMu.Unlock()
	for code, room := range rooms {
		room.mu.Lock()
		_, exists := room.Players[ws]
		room.mu.Unlock()
		if exists {
			return code
		}
	}
	return ""
}
func handleDisconnect(ws *websocket.Conn) {
	roomCode := findPlayerRoom(ws)
	if roomCode == "" {
		return
	}
	roomsMu.Lock()
	defer roomsMu.Unlock()
	room := rooms[roomCode]
	if room == nil {
		return
	}
	room.mu.Lock()
	defer room.mu.Unlock()
	player, exists := room.Players[ws]
	if !exists {
		return
	}
	isHost := (ws == room.Host)
	for client := range room.Players {
		if client != ws {
			client.WriteJSON(Message{
				Type:    "playerLeft",
				Payload: fmt.Sprintf(`{"player":"%s","username":"%s","isHost":%t}`, player.Role, player.Username, isHost),
			})
		}
	}
	go func() {
		time.Sleep(10 * time.Second)
		roomsMu.Lock()
		defer roomsMu.Unlock()
		room, exists := rooms[roomCode]
		if !exists {
			return
		}
		room.mu.Lock()
		defer room.mu.Unlock()
		currentPlayer, stillExists := room.Players[ws]
		if stillExists && currentPlayer == player {
			delete(room.Players, ws)
			if isHost {
				delete(rooms, roomCode)
				for client := range room.Players {
					client.WriteJSON(Message{
						Type:    "hostLeft",
						Payload: fmt.Sprintf("Host %s has left the game", player.Username),
					})
				}
			} else if len(room.Players) == 0 {
				delete(rooms, roomCode)
			}
		}
	}()
}
func handleMessages() {
	for {
		<-broadcast
	}
}
