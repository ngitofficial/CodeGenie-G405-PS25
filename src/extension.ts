import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('code-genie.openChat', () => {
      const panel = vscode.window.createWebviewPanel(
        'codeGenieChat', // Identifies the type of the webview. Used internally
        'Code Genie Chat', // Title of the panel displayed to the user
        vscode.ViewColumn.One, // Editor column to show the new webview panel in
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview'))
          ]
        }
      );

      panel.webview.html = getWebviewContent(context, panel.webview);

      // Handle messages from the webview
      panel.webview.onDidReceiveMessage(async message => {
        switch (message.type) {
          case 'sendPrompt':
            try {
              const response = await fetch('http://localhost:5000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: message.prompt })
              });

              if (!response.ok) {
                throw new Error('fetch failed');
              }

              const result = await response.json();

              panel.webview.postMessage({
                type: 'response',
                text: result.reply
              });
            } catch (err) {
              panel.webview.postMessage({
                type: 'error',
                text: 'fetch failed'
              });
            }
            break;
        }
      });
    })
  );
}

function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  const htmlPath = path.join(context.extensionPath, 'src', 'webview', 'chat.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  const mediaPath = vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview'));
  const mediaUri = webview.asWebviewUri(mediaPath);
  html = html.replace(/{{media}}/g, mediaUri.toString());
  return html;
}
