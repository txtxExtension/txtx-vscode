import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { TxtxConfig } from "./types";

export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function loadTxtxConfig(workspaceRoot: string): TxtxConfig | undefined {
  const configPath = path.join(workspaceRoot, "txtx.yml");
  if (!fs.existsSync(configPath)) {
    return undefined;
  }
  try {
    const content = fs.readFileSync(configPath, "utf8");
    return yaml.load(content) as TxtxConfig;
  } catch {
    return undefined;
  }
}

export function getStatesDir(
  workspaceRoot: string,
  stateLocation = "states"
): string {
  return path.join(workspaceRoot, stateLocation);
}

export function statusIcon(status: string): string {
  switch (status) {
    case "running":
      return "$(sync~spin)";
    case "success":
      return "$(check)";
    case "error":
      return "$(error)";
    default:
      return "$(circle-outline)";
  }
}
