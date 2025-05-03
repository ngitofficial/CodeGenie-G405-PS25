import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

class CodeGenieSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codeGenieChat';

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView, 
    _context: vscode.WebviewViewResolveContext, 
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'webview'))]
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async message => {
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
            
            webviewView.webview.postMessage({
              type: 'response',
              text: result.reply
            });
          } catch (err) {
            // Simplified error handling
            webviewView.webview.postMessage({
              type: 'error',
              text: 'fetch failed'
            });
          }
          break;
      }
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const htmlPath = path.join(this.context.extensionPath, 'src', 'webview', 'chat.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const mediaPath = vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'webview'));
    const mediaUri = webview.asWebviewUri(mediaPath);
    html = html.replace(/{{media}}/g, mediaUri.toString());
    return html;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Code Genie extension activated!');

  const sidebarProvider = new CodeGenieSidebarProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CodeGenieSidebarProvider.viewType,
      sidebarProvider
    )
  );

  const disposable = vscode.commands.registerCommand('code-genie.openChat', () => {
    console.log('code-genie.openChat command executed');
    vscode.commands.executeCommand('workbench.view.extension.codeGenieContainer');
  });
  context.subscriptions.push(disposable);
}
