import * as vscode from "vscode";
import {
  CommandProvider,
  CommandGroupItem,
  CommandItem,
  CommandData,
} from "./CommandProvider";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  const commandProvider = new CommandProvider(context);
  vscode.window.registerTreeDataProvider("commandsView", commandProvider);
  vscode.window.createTreeView("commandsView", {
    treeDataProvider: commandProvider,
    dragAndDropController: commandProvider,
    showCollapseAll: true,
  });

  vscode.commands.registerCommand("myCommands.refreshView", () => {
    vscode.window.showInformationMessage("Refreshing the commands view");
    commandProvider.refresh();
  });

  vscode.commands.registerCommand(
    "myCommands.addCommand",
    async (groupItem?: CommandGroupItem) => {
      const label = await vscode.window.showInputBox({
        prompt: "Command name",
      });
      if (!label) return;
      const command = await vscode.window.showInputBox({
        prompt: "Command to execute",
      });
      if (!command) return;
      commandProvider.addCommand(
        { label, command },
        groupItem?.id || "default"
      );
    }
  );

  vscode.commands.registerCommand("myCommands.addGroup", async () => {
    const name = await vscode.window.showInputBox({
      prompt: "Group name",
    });
    if (!name) return;
    commandProvider.addGroup(name);
  });

  vscode.commands.registerCommand(
    "myCommands.renameGroup",
    async (groupItem: CommandGroupItem) => {
      const newName = await vscode.window.showInputBox({
        prompt: "New group name",
        value: groupItem.name,
      });
      if (!newName) return;
      commandProvider.renameGroup(groupItem.id, newName);
    }
  );

  vscode.commands.registerCommand(
    "myCommands.removeGroup",
    (groupItem: CommandGroupItem) => {
      commandProvider.removeGroup(groupItem.id);
    }
  );

  vscode.commands.registerCommand(
    "myCommands.runCommand",
    (item: CommandItem) => {
      const terminal = vscode.window.createTerminal("Command");
      terminal.show();
      terminal.sendText(item.commandStr);
      vscode.window.showInformationMessage(`Running: ${item.label}`);
    }
  );

  vscode.commands.registerCommand(
    "myCommands.editCommand",
    async (item: CommandItem) => {
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
      commandProvider.editCommand(
        item.label,
        {
          label: newLabel,
          command: newCommand,
        },
        item.groupId
      );
    }
  );

  vscode.commands.registerCommand(
    "myCommands.removeCommand",
    (item: CommandItem) => {
      commandProvider.removeCommand(item.label, item.groupId);
    }
  );
}
