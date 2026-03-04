import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getWorkspaceRoot, getStatesDir } from "./utils";

export class StateItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly fileName: string
  ) {
    super(fileName, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "stateFile";
    this.tooltip = filePath;
    this.iconPath = new vscode.ThemeIcon("database");
    this.command = {
      command: "txtx.viewState",
      title: "View State",
      arguments: [this],
    };
    // parse label: deploy-counter.devnet.tx-state.json.lock → "deploy-counter (devnet)"
    const match = fileName.match(/^(.+?)\.([^.]+)\.tx-state/);
    if (match) {
      this.label = match[1];
      this.description = match[2];
    }
  }
}

export class StateProvider implements vscode.TreeDataProvider<StateItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: StateItem): vscode.TreeItem {
    return element;
  }

  getChildren(): StateItem[] {
    const root = getWorkspaceRoot();
    if (!root) {
      return [];
    }
    const statesDir = getStatesDir(root);
    if (!fs.existsSync(statesDir)) {
      return [];
    }

    return fs
      .readdirSync(statesDir)
      .filter((f) => f.endsWith(".tx-state.json.lock"))
      .map((f) => new StateItem(path.join(statesDir, f), f));
  }
}
