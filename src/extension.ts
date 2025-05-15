import * as vscode from "vscode";
import { ComandoProvider } from "./ComandoProvider";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  const comandoProvider = new ComandoProvider(context);
  vscode.window.registerTreeDataProvider("comandosView", comandoProvider);
  vscode.commands.registerCommand("myCommands.refreshView", () => {
    vscode.window.showInformationMessage(
      "Atualizando a visualização de comandos"
    );
    comandoProvider.refresh();
  });

  vscode.commands.registerCommand("myCommands.addCommand", async () => {
    const label = await vscode.window.showInputBox({
      prompt: "Command name",
    });
    if (!label) return;
    const command = await vscode.window.showInputBox({
      prompt: "Command to execute",
    });
    if (!command) return;
    comandoProvider.adicionarComando({ label, command });
  });

  vscode.commands.registerCommand("myCommands.runCommand", (item) => {
    const terminal = vscode.window.createTerminal("Comando");
    terminal.show();
    terminal.sendText(item.commandStr);
    vscode.window.showInformationMessage(`Executando: ${item.label}`);
  });

  vscode.commands.registerCommand("myCommands.editCommand", async (item) => {
    const newLabel = await vscode.window.showInputBox({
      prompt: "New command name",
      value: item.label,
    });
    if (!newLabel) return;
    const newCommand = await vscode.window.showInputBox({
      prompt: "New command",
      value: item.commandStr,
    });
    if (!newCommand) return;
    comandoProvider.editarComando(item.label, {
      label: newLabel,
      command: newCommand,
    });
  });

  vscode.commands.registerCommand("myCommands.removeCommand", (item) => {
    comandoProvider.removerComando(item.label);
  });
}
