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
  if(sender === 'bot'){

    messageElem.innerHTML = marked.parse(text);
  }
  else{
    messageElem.textContent = text;
  }
  responseArea.appendChild(messageElem);
  responseArea.scrollTop = responseArea.scrollHeight;
}

async function sendMessage(message) {
  let context = '';
  if (window.contextFiles && window.contextFiles.length > 0) {
    window.contextFiles.forEach(file => {
      if (file.enabled) {
        context += `\n\nContext from file "${file.name}":\n${file.content}\n\n`;
      }
    });
  }
  let promptWithContext = context + message;

  addMessage(message, 'user');
  if (currentChatIndex === -1 || !chats[currentChatIndex]) {
    addMessage('Please select or create a chat first.', 'bot');
    return;
  }
  const chatId = chats[currentChatIndex].chat_id;
  const botMessageElem = document.createElement('div');
  botMessageElem.classList.add('chat-message', 'bot-message');
  responseArea.appendChild(botMessageElem);
  responseArea.scrollTop = responseArea.scrollHeight;

  try {
    let response = await fetch(`http://localhost:5000/chatsource/${chatId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptWithContext }),
    });
    if (response.status === 404) {
      botMessageElem.textContent = 'Chat not found. Please create a new chat.';
      return;
    }
    if (!response.ok) throw new Error('Network response was not ok');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let botText = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      botText += decoder.decode(value, { stream: true });
      botMessageElem.innerHTML = marked.parse(botText);
      responseArea.scrollTop = responseArea.scrollHeight;
    }
    await fetch(`http://localhost:5000/chatsource/${chatId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: message, assistant: botText })
    });
  } catch (error) {
    botMessageElem.textContent = 'Error: ' + error.message;
  }

}

function renderChatList() {
  chatList.innerHTML = "";
  chats.forEach((chat, i) => {
    const li = document.createElement("li");
    const chatTitle = document.createElement('span');
    chatTitle.textContent = chat.title || `Chat ${chat.chat_id}`;
    li.appendChild(chatTitle);
    if (i === currentChatIndex) { li.classList.add("selected"); }
    
    li.addEventListener('click', () => {
      currentChatIndex = i;
      loadChatHistory();
      updateSidebarSelection();
    });

    const renameBtn = document.createElement('button');
    renameBtn.textContent='✏';
    renameBtn.style.marginLeft = '10px';
    renameBtn.onclick = async(e) =>{
      e.stopPropagation();
      const input = document.createElement("input");
      input.type = "text";
      input.value = chat.title || `Chat ${chat.chat_id}`;
      input.classList.add("rename-input");
      input.style.flex = "1";
      input.style.marginLeft = "4px"; 
      li.replaceChild(input, chatTitle);
      input.focus();

      const save =async () => {
        const newTitle = input.value.trim();
        if(newTitle && newTitle !== chat.title){
          const response = await fetch(`http://localhost:5000/chatsource/${chat.chat_id}`,{
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle }), 
          });
          if(response.ok){
            chat.title = newTitle;
          }
          else{
            addMessage("Failed to update chat title", "bot");
          }
        }
        renderChatList();
        updateSidebarSelection();
      };
      input.addEventListener("blur", save);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {input.blur();}
        if (e.key === "Escape"){ renderChatList();}
      });
    };
    li.appendChild(renameBtn);
    chatList.appendChild(li);

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
    if (chats.length === 0) {o
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
      method: 'POST',
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

document.getElementById('attach-file-btn').addEventListener('click', () => {
  vscode.postMessage({ type: 'selectFile' });
});

window.addEventListener('message', event => {
  const message = event.data;
  if (message.type === 'fileContent') {
    if (!window.contextFiles) window.contextFiles = [];
    if (!window.contextFiles.some(f => f.name === message.name && f.content === message.content)) {
      window.contextFiles.push({ name: message.name, content: message.content, enabled: true });
      saveContextFiles();
      updateContextFilesUI();
    }
  }
});


function updateContextFilesUI() {
  const contextDiv = document.getElementById('context-files');
  contextDiv.innerHTML = '';
  if (window.contextFiles && window.contextFiles.length > 0) {
    window.contextFiles.forEach((file, idx) => {
      const fileElem = document.createElement('span');
      fileElem.className = 'context-file';
      fileElem.textContent = file.name;

      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = file.enabled;
      toggle.onchange = () => { file.enabled = toggle.checked; };
      fileElem.appendChild(toggle);

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✖';
      removeBtn.className = 'remove-context-file';
      removeBtn.onclick = () => {
        window.contextFiles.splice(idx, 1);
        updateContextFilesUI();
        saveContextFiles();
      };
      fileElem.appendChild(removeBtn);

      contextDiv.appendChild(fileElem);
    });
  }
}

function saveContextFiles() {
  vscode.setState({ contextFiles: window.contextFiles });
}

function loadContextFiles() {
  const state = vscode.getState();
  window.contextFiles = (state && state.contextFiles) ? state.contextFiles : [];
  updateContextFilesUI();
}
