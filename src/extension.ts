import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

let inlineDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let panel: vscode.WebviewPanel | undefined = undefined;
let inlineSuggestionsEnabled: boolean = false;

export function activate(context: vscode.ExtensionContext) {
  console.log('Code Genie extension activated');

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  function updateStatusBar() {
    statusBarItem.text = inlineSuggestionsEnabled
      ? '$(check) Genie Suggestions: On'
      : '$(x) Genie Suggestions: Off';
    statusBarItem.tooltip = 'Click to toggle Code Genie inline suggestions';
  }
  updateStatusBar();
  statusBarItem.command = 'code-genie.toggleInlineSuggestions';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand('code-genie.toggleInlineSuggestions', () => {
      inlineSuggestionsEnabled = !inlineSuggestionsEnabled;
      updateStatusBar();
      vscode.window.showInformationMessage(
        `Inline suggestions ${inlineSuggestionsEnabled ? 'enabled' : 'disabled'}.`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('code-genie.openchat', () => {
      if (panel) {
        panel.dispose();
        panel = undefined;
      } else {
        panel = vscode.window.createWebviewPanel(
          'codeGenieChat',
          'Code Genie Chat',
          vscode.ViewColumn.Two,
          {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'webview'))]
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
          if (message.type === 'toggleInlineSuggestions') {
            inlineSuggestionsEnabled = message.enabled;
            updateStatusBar();
            vscode.window.showInformationMessage(
              `Inline suggestions ${inlineSuggestionsEnabled ? 'enabled' : 'disabled'}.`
            );
          }
        });

        panel.onDidDispose(() => {
          panel = undefined;
        });
      }
    })
  );

  context.subscriptions.push(
    vscode.languages.registerInlineCompletionItemProvider(
      [
        { scheme: 'file', language: 'python' },
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'java' },
        { scheme: 'file', language: 'csharp' }
      ],
      {
        async provideInlineCompletionItems(document, position, context, token) {
          console.log('Genie inline provider called for language:', document.languageId);
          if (!inlineSuggestionsEnabled) return { items: [] };

          if (inlineDebounceTimer) clearTimeout(inlineDebounceTimer);
          return new Promise<vscode.InlineCompletionList>(resolve => {
            inlineDebounceTimer = setTimeout(async () => {
              const linePrefix = document.lineAt(position).text.substr(0, position.character);
              const fileContent = document.getText();
              console.log('Line prefix:', linePrefix);
              console.log('File content:', fileContent);
              try {
                const response = await fetch('http://127.0.0.1:5000/autocomplete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ prompt: fileContent, linePrefix })
                });
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const suggestions = (await response.json()) as string[];
                console.log('Suggestions received:', suggestions);
                if (suggestions.length === 0) {
                  resolve({ items: [] });
                  return;
                }
                const ghostText = suggestions[0];
                const inlineItem = new vscode.InlineCompletionItem(
                  ghostText,
                  new vscode.Range(position, position)
                );
                resolve({ items: [inlineItem] });
              } catch (err) {
                console.error('Error fetching suggestions:', err);
                resolve({ items: [] });
              } finally {
                inlineDebounceTimer = null;
              }
            }, 500);
          });
        }
      }
    )
  );

  vscode.workspace.getConfiguration().update('editor.inlineSuggest.enabled', true, true);
}