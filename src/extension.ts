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
          vscode.ViewColumn.Two,{
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
        
        panel.webview.onDidReceiveMessage(async message => {
          if (message.type === 'selectFile') {
            const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 100);
            const picks = files.map(uri => ({
              label: uri.fsPath.split(/[\\/]/).pop()!,
              description: uri.fsPath,
              uri
            }));
            const picked = await vscode.window.showQuickPick(picks, {
              placeHolder: 'Select a file to attach as context'
            });
            if (picked) {
              const fileContent = (await vscode.workspace.openTextDocument(picked.uri)).getText();
              panel.webview.postMessage({ type: 'fileContent', name: picked.label, content: fileContent });
            }
          }
          else if(message.type === 'userMessage'){
            const userText = message.text;
            const botReply = `You said: ${userText}`;

            panel?.webview.postMessage({type:'botResponse', text: botReply});
          }
        });
        panel.onDidDispose(() =>{
          panel = undefined;
        });

        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
          const fileName = path.basename(activeEditor.document.fileName);
          const fileContent = activeEditor.document.getText();
          panel.webview.postMessage({ type: 'fileContent', name: fileName, content: fileContent });
        }
      }
    })
  );
}