import * as vscode from "vscode";

import { values } from "./extension";

export class Provider implements vscode.TextDocumentContentProvider {
  _onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  _onDidChange = this._onDidChangeEmitter.event;

  get onDidChangeEmitter() {
    return this._onDidChangeEmitter;
  }

  get onDidChange() {
    return this._onDidChangeEmitter.event;
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return values.get(uri.path);
  }
}
