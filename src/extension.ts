import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { RunbookProvider, RunbookItem } from "./runbookProvider";
import { StateProvider, StateItem } from "./stateProvider";
import { TxDiagnosticProvider } from "./diagnosticProvider";
import { getWorkspaceRoot, loadTxtxConfig } from "./utils";

export function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = getWorkspaceRoot();

  // --- Providers ---
  const runbookProvider = new RunbookProvider();
  const stateProvider = new StateProvider();
  const diagnosticProvider = new TxDiagnosticProvider();

  // --- Tree Views ---
  vscode.window.createTreeView("txtxRunbooks", {
    treeDataProvider: runbookProvider,
    showCollapseAll: false,
  });
  vscode.window.createTreeView("txtxStates", {
    treeDataProvider: stateProvider,
    showCollapseAll: false,
  });

  // --- Output Channel ---
  const outputChannel = vscode.window.createOutputChannel("txtx");

  // --- Commands ---

  // Run runbook
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "txtx.runRunbook",
      async (item: RunbookItem) => {
        if (!workspaceRoot) {
          vscode.window.showErrorMessage("No workspace folder found.");
          return;
        }

        const runbookId = item.runbook.id;
        const config = vscode.workspace.getConfiguration("txtx");
        const cliPathSetting = config.get<string>("cliPath", "txtx");
        const cliPath = resolveCliPath(cliPathSetting);
        const showOutputOnRun = config.get<boolean>("showOutputOnRun", true);
        const promptEnvironmentOnRun = config.get<boolean>(
          "promptEnvironmentOnRun",
          true
        );
        const defaultEnvironment = config.get<string>(
          "defaultEnvironment",
          "devnet"
        );

        const selectedEnvironment = promptEnvironmentOnRun
          ? await pickEnvironment(workspaceRoot, defaultEnvironment)
          : defaultEnvironment.trim();
        if (!selectedEnvironment) {
          runbookProvider.setStatus(runbookId, "idle");
          outputChannel.appendLine("ℹ Run cancelled: no environment selected.");
          return;
        }

        const args: string[] = ["run", runbookId, "--unsupervised"];
        if (selectedEnvironment.trim().length > 0) {
          args.push("--env", selectedEnvironment);
        }

        runbookProvider.setStatus(runbookId, "running");
        if (showOutputOnRun) {
          outputChannel.show(true);
        }
        outputChannel.appendLine(`\n▶ Running runbook: ${item.runbook.name}`);
        outputChannel.appendLine(`  Location: ${item.runbook.location}`);
        outputChannel.appendLine(`  Environment: ${selectedEnvironment}`);
        const commandLine = [cliPath, ...args]
          .map((part) => shellEscape(part))
          .join(" ");
        outputChannel.appendLine(`  Command: ${commandLine}`);
        outputChannel.appendLine(`  Time: ${new Date().toLocaleString()}`);
        outputChannel.appendLine(
          "  Running in integrated terminal for full txtx output."
        );
        outputChannel.appendLine("─".repeat(60));

        const task = new vscode.Task(
          { type: "shell" },
          vscode.TaskScope.Workspace,
          `Run ${runbookId}`,
          "txtx",
          new vscode.ShellExecution(commandLine, {
            cwd: workspaceRoot,
          })
        );
        task.presentationOptions = {
          reveal: vscode.TaskRevealKind.Always,
          panel: vscode.TaskPanelKind.Dedicated,
          focus: true,
          clear: false,
        };

        let handledByProcessEvent = false;
        const taskExecution = await vscode.tasks.executeTask(task);

        const endProcessDisposable = vscode.tasks.onDidEndTaskProcess((e) => {
          if (e.execution !== taskExecution) {
            return;
          }
          handledByProcessEvent = true;
          const success = e.exitCode === 0;
          runbookProvider.setStatus(runbookId, success ? "success" : "error");
          outputChannel.appendLine("─".repeat(60));
          outputChannel.appendLine(
            success
              ? `✓ Runbook "${item.runbook.name}" completed successfully.`
              : `✗ Runbook "${item.runbook.name}" failed (exit code ${
                  e.exitCode ?? "unknown"
                }).`
          );
          stateProvider.refresh();
          endProcessDisposable.dispose();
          endTaskDisposable.dispose();
        });

        const endTaskDisposable = vscode.tasks.onDidEndTask((e) => {
          if (e.execution !== taskExecution) {
            return;
          }
          if (!handledByProcessEvent) {
            runbookProvider.setStatus(runbookId, "idle");
            outputChannel.appendLine("─".repeat(60));
            outputChannel.appendLine(
              `ℹ Runbook "${item.runbook.name}" terminal session ended. Check terminal output for details.`
            );
            stateProvider.refresh();
          }
          endProcessDisposable.dispose();
          endTaskDisposable.dispose();
        });
      }
    )
  );

  // Refresh runbooks
  context.subscriptions.push(
    vscode.commands.registerCommand("txtx.refreshRunbooks", () => {
      runbookProvider.refresh();
    })
  );

  // Refresh states
  context.subscriptions.push(
    vscode.commands.registerCommand("txtx.refreshStates", () => {
      stateProvider.refresh();
    })
  );

  // View state file
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "txtx.viewState",
      async (item: StateItem) => {
        const doc = await vscode.workspace.openTextDocument(item.filePath);
        await vscode.window.showTextDocument(doc, { preview: true });
      }
    )
  );

  // Clear state file
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "txtx.clearState",
      async (item: StateItem) => {
        const confirm = await vscode.window.showWarningMessage(
          `Clear state for "${item.label} (${item.description})"?`,
          { modal: true },
          "Clear"
        );
        if (confirm === "Clear") {
          fs.unlinkSync(item.filePath);
          stateProvider.refresh();
          vscode.window.showInformationMessage(
            `State cleared: ${item.fileName}`
          );
        }
      }
    )
  );

  // --- Diagnostics ---
  const validateDoc = (doc: vscode.TextDocument) => {
    diagnosticProvider.validate(doc);
    if (workspaceRoot) {
      diagnosticProvider.validateWalletPaths(doc, workspaceRoot);
    }
  };

  // validate on open and change
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(validateDoc),
    vscode.workspace.onDidChangeTextDocument((e) => validateDoc(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) =>
      diagnosticProvider.clear(doc)
    )
  );

  // validate already-open .tx files
  vscode.workspace.textDocuments.forEach(validateDoc);

  // watch txtx.yml for changes → refresh runbooks
  if (workspaceRoot) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, "txtx.yml")
    );
    watcher.onDidChange(() => runbookProvider.refresh());
    context.subscriptions.push(watcher);

    // watch states/ directory
    const stateWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(path.join(workspaceRoot, "states"), "*.lock")
    );
    stateWatcher.onDidCreate(() => stateProvider.refresh());
    stateWatcher.onDidDelete(() => stateProvider.refresh());
    context.subscriptions.push(stateWatcher);
  }

  context.subscriptions.push(diagnosticProvider);
}

export function deactivate() {}

const resolveCliPath = (rawCliPath: string): string => {
  if (rawCliPath.startsWith("~/")) {
    return path.join(os.homedir(), rawCliPath.slice(2));
  }
  return rawCliPath;
};

const shellEscape = (value: string): string => {
  if (value.length === 0) {
    return "''";
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
};

const pickEnvironment = async (
  workspaceRoot: string,
  defaultEnvironment: string
): Promise<string | undefined> => {
  const config = loadTxtxConfig(workspaceRoot);
  const envNames = config ? Object.keys(config.environments ?? {}) : [];

  if (envNames.length === 0) {
    const fallback = defaultEnvironment.trim();
    return fallback.length > 0 ? fallback : undefined;
  }

  const normalizedDefault = defaultEnvironment.trim();
  const defaultChoice = envNames.includes(normalizedDefault)
    ? normalizedDefault
    : envNames[0];

  const quickPickItems = envNames.map((name) => ({
    label: name,
    description: name === defaultChoice ? "default" : undefined,
  }));

  const picked = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder: "Select network environment for txtx run",
    canPickMany: false,
    ignoreFocusOut: true,
  });

  return picked?.label;
};
