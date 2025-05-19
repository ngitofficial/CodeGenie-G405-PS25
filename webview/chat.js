const vscode = acquireVsCodeApi();

const input = document.getElementById("input-txt-box");
const sendButton = document.getElementById("send-button");
const responseArea = document.getElementById("response-area");
const chatList = document.getElementById("chat-list");
const toggleSidebarBtn = document.getElementById("toggle-sidebar-btn");
const sidebar = document.getElementById("sidebar");
const addChat = document.getElementById("new-chat-btn");

let chats = [];
let currentChatIndex = -1;

async function fetchChatList() {
  try {
    const response = await fetch('http://localhost:5000/list-all-chats');
    if (!response.ok) throw new Error('Failed to fetch chat list');
    const allChats = await response.json();
    chats = allChats;
    renderChatList();
    updateSidebarSelection();
  } catch (error) {
    chats = [];
    renderChatList();
    addMessage('No chats found. Click "+" to start a new chat.', 'bot');
  }
}

async function loadChatHistory() {
  responseArea.innerHTML = "";
  if (currentChatIndex === -1 || !chats[currentChatIndex]) return;
  const chatId = chats[currentChatIndex].chat_id;
  try {
    const response = await fetch(`http://localhost:5000/conversation-history/${chatId}`);
    if (response.status === 404) {
      addMessage('No history found for this chat.', 'bot');
      return;
    }
    if (!response.ok) throw new Error('Failed to fetch chat history');
    const messages = await response.json();
    if (Array.isArray(messages)) {
      for (const message of messages) {
        addMessage(message.user, 'user');
        addMessage(message.assistant, 'bot');
      }
    } else {
      addMessage('No history found for this chat.', 'bot');
    }
  } catch (error) {
    addMessage('Error loading chat history: ' + error.message, 'bot');
  }
  responseArea.scrollTop = responseArea.scrollHeight;
}

function addMessage(text, sender = 'user') {
  const messageElem = document.createElement('div');
  messageElem.classList.add('chat-message');
  messageElem.classList.add(sender === 'user' ? 'user-message' : 'bot-message');
  messageElem.textContent = text;
  responseArea.appendChild(messageElem);
  responseArea.scrollTop = responseArea.scrollHeight;
}

async function sendMessage(message) {
  addMessage(message, 'user');
  if (currentChatIndex === -1 || !chats[currentChatIndex]) {
    addMessage('Please select or create a chat first.', 'bot');
    return;
  }
  const chatId = chats[currentChatIndex].chat_id;
  try {
    let response = await fetch(`http://localhost:5000/chatsource/${chatId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: message }), // <-- always send the prompt
    });
    if (response.status === 404) {
      addMessage('Chat not found. Please create a new chat.', 'bot');
      return;
    }
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    addMessage(data.reply, 'bot');
    await loadChatHistory();
  } catch (error) {
    addMessage('Error: ' + error.message, 'bot');
  }
}

function renderChatList() {
  chatList.innerHTML = "";
  chats.forEach((chat, i) => {
    const li = document.createElement("li");
    li.textContent = chat.title || `Chat ${chat.chat_id}`;
    if (i === currentChatIndex) { li.classList.add("selected"); }
    li.addEventListener('click', () => {
      currentChatIndex = i;
      loadChatHistory();
      updateSidebarSelection();
    });
    // Add delete button
    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.style.marginLeft = '10px';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      await deleteChat(chat.chat_id, i);
    };
    li.appendChild(delBtn);
    chatList.appendChild(li);
  });
}

async function deleteChat(chatId, index) {
  try {
    const response = await fetch(`http://localhost:5000/chatsource/${chatId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete chat');
    await fetchChatList();
    // Select previous chat or none
    if (chats.length === 0) {
      currentChatIndex = -1;
      responseArea.innerHTML = "";
    } else {
      currentChatIndex = Math.max(0, index - 1);
      await loadChatHistory();
    }
    updateSidebarSelection();
  } catch (error) {
    addMessage('Error deleting chat: ' + error.message, 'bot');
  }
}

function updateSidebarSelection() {
  Array.from(chatList.children).forEach((li, i) => {
    li.classList.toggle("selected", i === currentChatIndex);
  });
}

sendButton.addEventListener("click", () => {
  const message = input.value.trim();
  if (message) {
    sendMessage(message);
    input.value = '';
  }
});

input.addEventListener('keydown', function (event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendButton.click();
  }
});

toggleSidebarBtn.addEventListener("click", () => {
  sidebar.classList.toggle("sidebar-hidden");
});

window.onload = async () => {
  await fetchChatList();
  if (chats.length > 0) {
    currentChatIndex = 0;
    await loadChatHistory();
  } else {
    currentChatIndex = -1;
    responseArea.innerHTML = "";
  }
  renderChatList();
  updateSidebarSelection();
};

addChat.addEventListener('click', async () => {
  const chatId = Date.now();
  try {
    const response = await fetch(`http://localhost:5000/chatsource/${chatId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: "" }),
    });
    if (!response.ok) throw new Error('Failed to create new chat');
    await fetchChatList();
    currentChatIndex = chats.findIndex(chat => chat.chat_id === chatId);
    renderChatList();
    await loadChatHistory();
    updateSidebarSelection();
  } catch (error) {
    addMessage('Error creating new chat: ' + error.message, 'bot');
  }
});