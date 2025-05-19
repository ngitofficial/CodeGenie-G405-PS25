import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext){
  let panel: vscode.WebviewPanel | undefined = undefined;
  context.subscriptions.push(
    vscode.commands.registerCommand('code-genie.openchat',() =>{
      if(panel){
        panel.reveal();
      }
      else{
        panel = vscode.window.createWebviewPanel(
          'codeGenieChat',
          'Code Genie Chat',
          vscode.ViewColumn.One,{
            enableScripts: true,
            localResourceRoots: [
              vscode.Uri.file(path.join(context.extensionPath, 'webview'))
            ]
          }
        );
        
        const htmlPath = path.join(context.extensionPath, 'webview', 'chat.html');
        const scriptPath = vscode.Uri.file(path.join(context.extensionPath, 'webview', 'chat.js'));
        const stylePath = vscode.Uri.file(path.join(context.extensionPath, 'webview', 'chat.css'));

        const scriptUri = panel.webview.asWebviewUri(scriptPath);
        const styleUri = panel.webview.asWebviewUri(stylePath);

        let html = fs.readFileSync(htmlPath, 'utf8');

        html = html.replace(`<script src="chat.js"></script>`, `<script src="${scriptUri}"></script>`);
        html = html.replace(`<link rel="stylesheet" href="chat.css">`, `<link rel="stylesheet" href="${styleUri}">`);

        panel.webview.html = html;
        
        panel.webview.onDidReceiveMessage(message => {
          if(message.type === 'userMessage'){
            const userText = message.text;
            const botReply = `You said: ${userText}`;

            panel?.webview.postMessage({type:'botResponse', text: botReply});
          }
        });

        panel.onDidDispose(() =>{
          panel = undefined;
        });
      }
    })
  );
}