import * as vscode from "vscode";
import * as fs from "fs";

// 基础语法检查：检测未闭合的块、缺少 value 的 output/variable 等
export class TxDiagnosticProvider {
  private collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection("txtx");
  }

  validate(document: vscode.TextDocument) {
    if (document.languageId !== "txtx") {
      return;
    }
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split("\n");

    let braceDepth = 0;
    const braceStack: number[] = []; // line numbers of open braces

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // count braces (skip strings)
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (ch === '"') {
          // skip string content
          c++;
          while (c < line.length && line[c] !== '"') {
            if (line[c] === "\\") {
              c++;
            }
            c++;
          }
        } else if (ch === "{") {
          braceDepth++;
          braceStack.push(i);
        } else if (ch === "}") {
          braceDepth--;
          braceStack.pop();
          if (braceDepth < 0) {
            diagnostics.push(
              new vscode.Diagnostic(
                new vscode.Range(i, c, i, c + 1),
                "Unexpected closing brace",
                vscode.DiagnosticSeverity.Error
              )
            );
            braceDepth = 0;
          }
        }
      }

      // check assignment without value: "key =" at end of line
      const assignNoValue = line.match(/^\s*\w+\s*=\s*$/);
      if (assignNoValue) {
        diagnostics.push(
          new vscode.Diagnostic(
            new vscode.Range(i, 0, i, line.length),
            "Assignment is missing a value",
            vscode.DiagnosticSeverity.Warning
          )
        );
      }
    }

    // unclosed braces
    for (const openLine of braceStack) {
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(openLine, 0, openLine, lines[openLine].length),
          "Unclosed block — missing closing brace",
          vscode.DiagnosticSeverity.Error
        )
      );
    }

    this.collection.set(document.uri, diagnostics);
  }

  validateWalletPaths(document: vscode.TextDocument, workspaceRoot: string) {
    if (document.languageId !== "txtx") {
      return;
    }
    const diagnostics = [...(this.collection.get(document.uri) ?? [])];
    const text = document.getText();
    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/keypair_json\s*=\s*"([^"]+)"/);
      if (match) {
        const walletPath = require("path").join(workspaceRoot, match[1]);
        if (!fs.existsSync(walletPath)) {
          const col = lines[i].indexOf(match[1]);
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range(i, col, i, col + match[1].length),
              `Wallet file not found: ${match[1]}`,
              vscode.DiagnosticSeverity.Warning
            )
          );
        }
      }
    }

    this.collection.set(document.uri, diagnostics);
  }

  clear(document: vscode.TextDocument) {
    this.collection.delete(document.uri);
  }

  dispose() {
    this.collection.dispose();
  }
}
