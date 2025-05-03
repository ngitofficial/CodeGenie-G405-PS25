window.addEventListener('DOMContentLoaded', () => {
  const vscode = acquireVsCodeApi();
  const input = document.getElementById('chatInput');
  const button = document.getElementById('sendButton');
  const chatContainer = document.getElementById('chat-container');

  function addMessage(sender, text) {
    const messageElement = document.createElement('div');
    messageElement.textContent = `${sender}: ${text}`;
    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // Function to send message
  function sendMessage() {
    const text = input.value;
    if (!text.trim()) return;
    
    addMessage('You', text);
    input.value = '';

    vscode.postMessage({
      type: 'sendPrompt',
      prompt: text
    });
  }

  // Send button click handler
  button.addEventListener('click', sendMessage);

  // Enter key handler
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent default enter behavior
      sendMessage();
    }
  });

  // Handle responses from the extension
  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
      case 'response':
        addMessage('Genie', message.text);
        break;
      case 'error':
        addMessage('Error', 'fetch failed');
        break;
    }
  });
});
