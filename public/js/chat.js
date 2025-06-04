// Chat functionality for multiplayer games
class GameChat {
    constructor(socket, username, playerRole) {
      this.socket = socket
      this.username = username
      this.playerRole = playerRole
      this.isMinimized = false
      this.unreadCount = 0
      this.init()
    }
  
    init() {
      this.createChatUI()
      this.setupEventListeners()
      this.setupSocketListeners()
    }
  
    createChatUI() {
      // Create chat container
      const chatContainer = document.createElement("div")
      chatContainer.id = "chatContainer"
      chatContainer.className = "chat-container"
      chatContainer.innerHTML = `
        <div class="chat-header" id="chatHeader">
          <span class="chat-title">
            💬 Chat
            <span id="chatUnreadBadge" class="chat-unread-badge" style="display: none;">0</span>
          </span>
          <button id="chatToggle" class="chat-toggle-btn">−</button>
        </div>
        <div class="chat-body" id="chatBody">
          <div class="chat-messages" id="chatMessages"></div>
          <div class="chat-input-container">
            <input 
              type="text" 
              id="chatInput" 
              class="chat-input" 
              placeholder="Type a message..." 
              maxlength="500"
            />
            <button id="chatSend" class="chat-send-btn">Send</button>
          </div>
        </div>
      `
  
      // Add chat styles
      this.addChatStyles()
  
      // Append to body
      document.body.appendChild(chatContainer)
    }
  
    addChatStyles() {
      const style = document.createElement("style")
      style.textContent = `
        .chat-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 300px;
          max-height: 400px;
          background: #2c2c2c;
          border: 2px solid #444;
          border-radius: 10px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          z-index: 1000;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          transition: all 0.3s ease;
        }
  
        .chat-header {
          background: #444;
          padding: 10px 15px;
          border-radius: 8px 8px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          user-select: none;
        }
  
        .chat-title {
          color: #fff;
          font-weight: bold;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 5px;
        }
  
        .chat-unread-badge {
          background: #ff4444;
          color: white;
          border-radius: 50%;
          padding: 2px 6px;
          font-size: 11px;
          min-width: 16px;
          text-align: center;
          animation: pulse 1s infinite;
        }
  
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
  
        .chat-toggle-btn {
          background: none;
          border: none;
          color: #fff;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
  
        .chat-toggle-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
  
        .chat-body {
          display: flex;
          flex-direction: column;
          height: 300px;
          transition: all 0.3s ease;
          overflow: hidden;
        }
  
        .chat-body.minimized {
          height: 0;
        }
  
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          background: #1e1e1e;
          max-height: 250px;
        }
  
        .chat-messages::-webkit-scrollbar {
          width: 6px;
        }
  
        .chat-messages::-webkit-scrollbar-track {
          background: #333;
        }
  
        .chat-messages::-webkit-scrollbar-thumb {
          background: #666;
          border-radius: 3px;
        }
  
        .chat-message {
          margin-bottom: 8px;
          padding: 6px 8px;
          border-radius: 6px;
          font-size: 13px;
          line-height: 1.4;
          word-wrap: break-word;
        }
  
        .chat-message.own {
          background: #0066cc;
          color: white;
          margin-left: 20px;
          text-align: right;
        }
  
        .chat-message.other {
          background: #333;
          color: #fff;
          margin-right: 20px;
        }
  
        .chat-message.system {
          background: #444;
          color: #ccc;
          text-align: center;
          font-style: italic;
          margin: 0;
        }
  
        .chat-message-header {
          font-size: 11px;
          opacity: 0.8;
          margin-bottom: 2px;
        }
  
        .chat-message-content {
          font-size: 13px;
        }
  
        .chat-input-container {
          display: flex;
          padding: 10px;
          background: #2c2c2c;
          border-top: 1px solid #444;
          border-radius: 0 0 8px 8px;
        }
  
        .chat-input {
          flex: 1;
          padding: 8px 10px;
          border: 1px solid #555;
          border-radius: 4px;
          background: #1e1e1e;
          color: #fff;
          font-size: 13px;
          outline: none;
        }
  
        .chat-input:focus {
          border-color: #0066cc;
        }
  
        .chat-send-btn {
          margin-left: 8px;
          padding: 8px 12px;
          background: #0066cc;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          transition: background 0.2s;
        }
  
        .chat-send-btn:hover {
          background: #0052a3;
        }
  
        .chat-send-btn:disabled {
          background: #666;
          cursor: not-allowed;
        }
  
        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .chat-container {
            width: 280px;
            bottom: 10px;
            right: 10px;
          }
        }
  
        @media (max-width: 480px) {
          .chat-container {
            width: calc(100vw - 20px);
            right: 10px;
            left: 10px;
          }
        }
      `
      document.head.appendChild(style)
    }
  
    setupEventListeners() {
      const chatHeader = document.getElementById("chatHeader")
      const chatToggle = document.getElementById("chatToggle")
      const chatInput = document.getElementById("chatInput")
      const chatSend = document.getElementById("chatSend")
  
      // Toggle chat on header click
      chatHeader.addEventListener("click", () => {
        this.toggleChat()
      })
  
      // Send message on button click
      chatSend.addEventListener("click", () => {
        this.sendMessage()
      })
  
      // Send message on Enter key
      chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          this.sendMessage()
        }
      })
  
      // Clear unread count when chat is opened
      chatInput.addEventListener("focus", () => {
        this.clearUnreadCount()
      })
    }
  
    setupSocketListeners() {
      // Listen for chat messages
      this.socket.addEventListener("message", (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === "chatMessage") {
            const chatData = JSON.parse(msg.payload)
            this.displayMessage(chatData)
          }
        } catch (error) {
          console.error("Error parsing chat message:", error)
        }
      })
    }
  
    toggleChat() {
      const chatBody = document.getElementById("chatBody")
      const chatToggle = document.getElementById("chatToggle")
  
      this.isMinimized = !this.isMinimized
  
      if (this.isMinimized) {
        chatBody.classList.add("minimized")
        chatToggle.textContent = "+"
      } else {
        chatBody.classList.remove("minimized")
        chatToggle.textContent = "−"
        this.clearUnreadCount()
        this.scrollToBottom()
      }
    }
  
    sendMessage() {
      const chatInput = document.getElementById("chatInput")
      const message = chatInput.value.trim()
  
      if (!message || message.length === 0) {
        return
      }
  
      if (message.length > 500) {
        alert("Message is too long! Maximum 500 characters.")
        return
      }
  
      // Send message to server
      this.socket.send(
        JSON.stringify({
          type: "chat",
          payload: JSON.stringify({ message: message }),
        }),
      )
  
      // Clear input
      chatInput.value = ""
    }
  
    displayMessage(chatData) {
      const chatMessages = document.getElementById("chatMessages")
      const messageDiv = document.createElement("div")
  
      const isOwnMessage = chatData.username === this.username
      const messageClass = isOwnMessage ? "own" : "other"
  
      messageDiv.className = `chat-message ${messageClass}`
  
      const timestamp = new Date(chatData.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
  
      if (isOwnMessage) {
        messageDiv.innerHTML = `
          <div class="chat-message-header">You • ${timestamp}</div>
          <div class="chat-message-content">${this.escapeHtml(chatData.message)}</div>
        `
      } else {
        messageDiv.innerHTML = `
          <div class="chat-message-header">${this.escapeHtml(chatData.username)} (${chatData.role}) • ${timestamp}</div>
          <div class="chat-message-content">${this.escapeHtml(chatData.message)}</div>
        `
      }
  
      chatMessages.appendChild(messageDiv)
      this.scrollToBottom()
  
      // Update unread count if chat is minimized
      if (this.isMinimized && !isOwnMessage) {
        this.incrementUnreadCount()
      }
  
      // Add notification sound (optional)
      if (!isOwnMessage) {
        this.playNotificationSound()
      }
    }
  
    scrollToBottom() {
      const chatMessages = document.getElementById("chatMessages")
      chatMessages.scrollTop = chatMessages.scrollHeight
    }
  
    incrementUnreadCount() {
      this.unreadCount++
      const badge = document.getElementById("chatUnreadBadge")
      badge.textContent = this.unreadCount
      badge.style.display = "inline-block"
    }
  
    clearUnreadCount() {
      this.unreadCount = 0
      const badge = document.getElementById("chatUnreadBadge")
      badge.style.display = "none"
    }
  
    escapeHtml(text) {
      const div = document.createElement("div")
      div.textContent = text
      return div.innerHTML
    }
  
    playNotificationSound() {
      // Create a subtle notification sound
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()
  
        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)
  
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
  
        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.1)
      } catch (error) {
        // Ignore audio errors
      }
    }
  
    // Method to add system messages
    addSystemMessage(message) {
      const chatMessages = document.getElementById("chatMessages")
      const messageDiv = document.createElement("div")
      messageDiv.className = "chat-message system"
      messageDiv.innerHTML = `<div class="chat-message-content">${this.escapeHtml(message)}</div>`
      chatMessages.appendChild(messageDiv)
      this.scrollToBottom()
    }
  
    // Method to destroy chat (cleanup)
    destroy() {
      const chatContainer = document.getElementById("chatContainer")
      if (chatContainer) {
        chatContainer.remove()
      }
    }
  }
  
  // Export for use in other files
  window.GameChat = GameChat
  