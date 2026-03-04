# txtx VS Code Extension

VS Code extension for running and managing **txtx** runbooks (`.tx`) with a sidebar workflow.

![txtx extension](images/extension.jpg)

## Features

- Syntax highlighting for `.tx` files
- Dedicated **txtx** Activity Bar view
- Runbook explorer with one-click run
- State file explorer with quick view/clear actions
- Integrated terminal execution for full `txtx` runtime logs
- Network/environment selector before run (`devnet`, `localnet`, etc.)
- Basic diagnostics support for `.tx` files

## Requirements

- VS Code `^1.85.0`
- `txtx` CLI installed and available in `PATH` (or set `txtx.cliPath`)
- A workspace containing `txtx.yml`

## Quick Start

1. Open your txtx project folder (must contain `txtx.yml`).
2. Open the **txtx** icon in the Activity Bar.
3. In **Runbooks**, click the run button on a runbook.
4. Select the target environment when prompted.
5. Follow full execution output in the integrated terminal.

## Configuration

Available settings:

- `txtx.cliPath` (string): path to `txtx` executable
- `txtx.showOutputOnRun` (boolean): auto-show extension output channel on run
- `txtx.defaultEnvironment` (string): default environment when prompt is disabled
- `txtx.promptEnvironmentOnRun` (boolean): show environment picker before running

## Development

```bash
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host.

## License

MIT
