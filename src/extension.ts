import * as vscode from "vscode";
import {
  CommandProvider,
  CommandGroupItem,
  CommandItem,
} from "./CommandProvider";

export function activate(context: vscode.ExtensionContext) {
  const provider = new CommandProvider(context);

  const treeView = vscode.window.createTreeView("commandsView", {
    treeDataProvider: provider,
    dragAndDropController: provider,
    showCollapseAll: true,
  });

  // Persist the collapsed state of groups so it survives reloads.
  treeView.onDidCollapseElement(
    (e) => {
      if (e.element instanceof CommandGroupItem) {
        provider.setGroupCollapsed(e.element.id, true);
      }
    },
    null,
    context.subscriptions
  );
  treeView.onDidExpandElement(
    (e) => {
      if (e.element instanceof CommandGroupItem) {
        provider.setGroupCollapsed(e.element.id, false);
      }
    },
    null,
    context.subscriptions
  );

  const register = (command: string, callback: (...args: any[]) => any) =>
    context.subscriptions.push(
      vscode.commands.registerCommand(command, callback)
    );

  register("code-commands.refreshView", () => provider.refresh());

  register("code-commands.addCommand", async (group?: CommandGroupItem) => {
    const label = await vscode.window.showInputBox({ prompt: "Command name" });
    if (!label) return;
    const command = await vscode.window.showInputBox({
      prompt: "Command to execute",
    });
    if (!command) return;
    provider.addCommand({ label, command }, group?.id ?? "default");
  });

  register("code-commands.addGroup", async () => {
    const name = await vscode.window.showInputBox({ prompt: "Group name" });
    if (!name) return;
    provider.addGroup(name);
  });

  register("code-commands.renameGroup", async (group: CommandGroupItem) => {
    const newName = await vscode.window.showInputBox({
      prompt: "New group name",
      value: group.name,
    });
    if (!newName) return;
    provider.renameGroup(group.id, newName);
  });

  register("code-commands.removeGroup", async (group: CommandGroupItem) => {
    const confirm = await vscode.window.showWarningMessage(
      `Delete the group "${group.name}" and all of its commands?`,
      { modal: true },
      "Delete"
    );
    if (confirm === "Delete") {
      provider.removeGroup(group.id);
    }
  });

  register("code-commands.runCommand", async (item: CommandItem) => {
    const terminal = await pickTerminal(item.label);
    if (!terminal) return; // user cancelled the picker
    terminal.show();
    terminal.sendText(item.commandStr);
  });

  register("code-commands.editCommand", async (item: CommandItem) => {
    const label = await vscode.window.showInputBox({
      prompt: "New command name",
      value: item.label,
    });
    if (!label) return;
    const command = await vscode.window.showInputBox({
      prompt: "New command",
      value: item.commandStr,
    });
    if (!command) return;
    provider.editCommand(item.id, { label, command }, item.groupId);
  });

  register("code-commands.removeCommand", async (item: CommandItem) => {
    const confirm = await vscode.window.showWarningMessage(
      `Delete the command "${item.label}"?`,
      { modal: true },
      "Delete"
    );
    if (confirm === "Delete") {
      provider.removeCommand(item.id, item.groupId);
    }
  });

  context.subscriptions.push(treeView);
}

interface TerminalPick extends vscode.QuickPickItem {
  /** The terminal to run in; undefined means "create a new one". */
  terminal?: vscode.Terminal;
}

/**
 * Lets the user choose which terminal to run a command in. When no terminal is
 * open there is nothing to choose, so a new one is created silently. Returns
 * `undefined` when the user dismisses the picker.
 */
async function pickTerminal(
  commandLabel: string
): Promise<vscode.Terminal | undefined> {
  const openTerminals = vscode.window.terminals;
  if (openTerminals.length === 0) {
    return vscode.window.createTerminal(commandLabel);
  }

  const picks: TerminalPick[] = [
    {
      label: "$(add) New terminal",
      description: `named "${commandLabel}"`,
    },
    ...openTerminals.map((t, i) => ({
      label: `$(terminal) ${t.name}`,
      description:
        t === vscode.window.activeTerminal ? "active" : `terminal ${i + 1}`,
      terminal: t,
    })),
  ];

  const choice = await vscode.window.showQuickPick(picks, {
    placeHolder: `Run "${commandLabel}" in which terminal?`,
  });
  if (!choice) return undefined;
  return choice.terminal ?? vscode.window.createTerminal(commandLabel);
}

export function deactivate() {}
