import * as vscode from "vscode";
import * as path from "path";
import { RunbookConfig, RunbookStatus } from "./types";
import { loadTxtxConfig, getWorkspaceRoot, statusIcon } from "./utils";

export class RunbookItem extends vscode.TreeItem {
  constructor(
    public readonly runbook: RunbookConfig,
    public status: RunbookStatus = "idle"
  ) {
    super(runbook.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "runbook";
    this.description = runbook.description ?? "";
    this.tooltip = `${runbook.name}\n${runbook.description ?? ""}\n${
      runbook.location
    }`;
    this.updateIcon();
  }

  updateIcon() {
    this.iconPath = new vscode.ThemeIcon(
      this.status === "running"
        ? "sync~spin"
        : this.status === "success"
        ? "check"
        : this.status === "error"
        ? "error"
        : "circle-outline"
    );
  }
}

export class RunbookProvider implements vscode.TreeDataProvider<RunbookItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    RunbookItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private items: RunbookItem[] = [];

  constructor() {
    this.load();
  }

  load() {
    const root = getWorkspaceRoot();
    if (!root) {
      return;
    }
    const config = loadTxtxConfig(root);
    if (!config) {
      return;
    }
    // preserve existing status when reloading
    const prevStatus = new Map(this.items.map((i) => [i.runbook.id, i.status]));
    this.items = config.runbooks.map((rb) => {
      const item = new RunbookItem(rb, prevStatus.get(rb.id) ?? "idle");
      return item;
    });
  }

  refresh() {
    this.load();
    this._onDidChangeTreeData.fire();
  }

  setStatus(id: string, status: RunbookStatus) {
    const item = this.items.find((i) => i.runbook.id === id);
    if (item) {
      item.status = status;
      item.updateIcon();
      this._onDidChangeTreeData.fire(item);
    }
  }

  getTreeItem(element: RunbookItem): vscode.TreeItem {
    return element;
  }

  getChildren(): RunbookItem[] {
    return this.items;
  }

  getRunbookById(id: string): RunbookItem | undefined {
    return this.items.find((i) => i.runbook.id === id);
  }
}
