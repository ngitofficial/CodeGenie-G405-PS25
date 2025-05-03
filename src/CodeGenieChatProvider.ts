// CodeGenieChatProvider.ts
import * as vscode from 'vscode';

export class CodeGenieChatProvider implements vscode.TreeDataProvider<any> {
  private _onDidChangeTreeData: vscode.EventEmitter<any | undefined> = new vscode.EventEmitter<any | undefined>();
  readonly onDidChangeTreeData: vscode.Event<any | undefined> = this._onDidChangeTreeData.event;

  constructor() {
    console.log('CodeGenieChatProvider initialized');
  }

  getChildren(element?: any): vscode.ProviderResult<any[]> {
    console.log('getChildren called with element:', element);
    if (!element) {
      return [{ label: 'Welcome to Code Genie' }];
    }
    return [];
  }

  getTreeItem(element: any): vscode.TreeItem {
    console.log('getTreeItem called with element:', element);
    return new vscode.TreeItem(element.label);
  }

  refresh(): void {
    console.log('Tree view refreshed');
    this._onDidChangeTreeData.fire(undefined);
  }
}
