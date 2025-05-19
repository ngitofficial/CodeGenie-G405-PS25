window.addEventListener('DOMContentLoaded', () => {
  const vscode = acquireVsCodeApi();
  const chatContainer = document.getElementById('chat-container');
  const input = document.getElementById('chatInput');
  const button = document.getElementById('sendButton');

  function addMessage(sender, text, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    messageDiv.textContent = `${sender}: ${text}`;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  button.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) return;
    
    addMessage('You', text, true);
    
    vscode.postMessage({
      type: 'sendPrompt',
      prompt: text
    });
    
    input.value = '';
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      button.click();
    }
  });

  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
      case 'response':
        addMessage('Genie', message.text);
        break;
      case 'error':
        addMessage('Error', message.text);
        break;
    }
  });
});
