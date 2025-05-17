import * as vscode from "vscode";
import * as path from "path";

export interface CommandData {
  label: string;
  command: string;
}

export interface CommandGroup {
  id: string;
  name: string;
  commands: CommandData[];
  collapsed?: boolean;
}

export type CommandTreeItem = CommandGroupItem | CommandItem;

export class CommandProvider
  implements
    vscode.TreeDataProvider<CommandTreeItem>,
    vscode.TreeDragAndDropController<CommandTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    CommandTreeItem | undefined | void
  > = new vscode.EventEmitter<CommandTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<
    CommandTreeItem | undefined | void
  > = this._onDidChangeTreeData.event;

  private groups: CommandGroup[] = [];
  readonly dragMimeTypes = ["application/vnd.code-commands.command"];
  readonly dropMimeTypes = ["application/vnd.code-commands.command"];

  constructor(private context: vscode.ExtensionContext) {
    this.loadGroups();
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("code-commands.groups")) {
        this.refresh();
      }
    });
  }

  refresh(): void {
    this.loadGroups();
    setTimeout(() => this._onDidChangeTreeData.fire(), 50);
  }

  getTreeItem(element: CommandTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CommandTreeItem): Thenable<CommandTreeItem[]> {
    if (!element) {
      // Root: return groups
      if (!this.groups || this.groups.length === 0) {
        return Promise.resolve([
          new CommandGroupItem("default", "Default", [], false),
        ]);
      }
      return Promise.resolve(
        this.groups.map(
          (g) => new CommandGroupItem(g.id, g.name, g.commands, g.collapsed)
        )
      );
    }
    if (element instanceof CommandGroupItem) {
      return Promise.resolve(
        element.commands.map(
          (cmd) => new CommandItem(cmd.label, cmd.command, element.id)
        )
      );
    }
    return Promise.resolve([]);
  }

  private loadGroups() {
    try {
      const config = vscode.workspace.getConfiguration("code-commands");
      const content = config.get<CommandGroup[]>("groups");
      this.groups = Array.isArray(content)
        ? content
        : [{ id: "default", name: "Default", commands: [] }];
    } catch (e) {
      vscode.window.showErrorMessage("Error loading command groups: " + e);
      this.groups = [{ id: "default", name: "Default", commands: [] }];
    }
  }

  private saveGroups() {
    try {
      const config = vscode.workspace.getConfiguration("code-commands");
      config
        .update("groups", this.groups, vscode.ConfigurationTarget.Global)
        .then(() => {
          this.refresh();
        });
    } catch (e) {
      vscode.window.showErrorMessage("Error saving command groups: " + e);
    }
  }

  // Command management
  public addCommand(command: CommandData, groupId: string = "default") {
    const group = this.groups.find((g) => g.id === groupId);
    if (group) {
      group.commands.push(command);
      this.saveGroups();
    }
  }

  public editCommand(
    oldLabel: string,
    newCommand: CommandData,
    groupId: string = "default"
  ) {
    const group = this.groups.find((g) => g.id === groupId);
    if (group) {
      const idx = group.commands.findIndex((c) => c.label === oldLabel);
      if (idx !== -1) {
        group.commands[idx] = newCommand;
        this.saveGroups();
      }
    }
  }

  public removeCommand(label: string, groupId: string = "default") {
    const group = this.groups.find((g) => g.id === groupId);
    if (group) {
      group.commands = group.commands.filter((c) => c.label !== label);
      this.saveGroups();
    }
  }

  // Group management
  public addGroup(name: string) {
    const id = Date.now().toString();
    this.groups.push({ id, name, commands: [] });
    this.saveGroups();
  }

  public renameGroup(groupId: string, newName: string) {
    const group = this.groups.find((g) => g.id === groupId);
    if (group) {
      group.name = newName;
      this.saveGroups();
    }
  }

  public removeGroup(groupId: string) {
    this.groups = this.groups.filter((g) => g.id !== groupId);
    this.saveGroups();
  }

  public setGroupCollapsed(groupId: string, collapsed: boolean) {
    const group = this.groups.find((g) => g.id === groupId);
    if (group) {
      group.collapsed = collapsed;
      this.saveGroups();
    }
  }

  // Drag and drop support
  async handleDrag(
    source: readonly CommandTreeItem[],
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    const items = source.filter(
      (i) => i instanceof CommandItem
    ) as CommandItem[];
    if (items.length > 0) {
      dataTransfer.set(
        "application/vnd.code-commands.command",
        new vscode.DataTransferItem(
          JSON.stringify(
            items.map((i) => ({
              label: i.label,
              command: i.commandStr,
              groupId: i.groupId,
            }))
          )
        )
      );
    }
  }

  async handleDrop(
    target: CommandTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    token: vscode.CancellationToken
  ): Promise<void> {
    const raw = dataTransfer.get("application/vnd.code-commands.command");
    if (!raw) return;
    const items: { label: string; command: string; groupId: string }[] =
      JSON.parse(await raw.asString());
    if (target instanceof CommandGroupItem) {
      // Move to group
      for (const item of items) {
        this.moveCommandToGroup(item.label, item.groupId, target.id);
      }
    } else if (target instanceof CommandItem) {
      // Move to same group, reorder
      for (const item of items) {
        this.moveCommandToGroup(
          item.label,
          item.groupId,
          target.groupId,
          target.label
        );
      }
    }
    this.saveGroups();
  }

  private moveCommandToGroup(
    label: string,
    fromGroupId: string,
    toGroupId: string,
    beforeLabel?: string
  ) {
    if (fromGroupId === toGroupId && !beforeLabel) return;
    const fromGroup = this.groups.find((g) => g.id === fromGroupId);
    const toGroup = this.groups.find((g) => g.id === toGroupId);
    if (!fromGroup || !toGroup) return;
    const idx = fromGroup.commands.findIndex((c) => c.label === label);
    if (idx === -1) return;
    const [cmd] = fromGroup.commands.splice(idx, 1);
    if (beforeLabel) {
      const insertIdx = toGroup.commands.findIndex(
        (c) => c.label === beforeLabel
      );
      if (insertIdx !== -1) {
        toGroup.commands.splice(insertIdx, 0, cmd);
      } else {
        toGroup.commands.push(cmd);
      }
    } else {
      toGroup.commands.push(cmd);
    }
  }
}

export class CommandGroupItem extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    public name: string,
    public commands: CommandData[],
    public collapsed: boolean = false
  ) {
    super(
      name,
      collapsed
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.Expanded
    );
    this.contextValue = "commandGroup";
    this.iconPath = {
      light: vscode.Uri.file(path.join(__dirname, "..", "media", "icon.svg")),
      dark: vscode.Uri.file(path.join(__dirname, "..", "media", "icon.svg")),
    };
  }
}

export class CommandItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly commandStr: string,
    public readonly groupId: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${this.label} - ${this.commandStr}`;
    this.description = this.commandStr;
    this.contextValue = "commandItem";
    this.iconPath = {
      light: vscode.Uri.file(
        path.join(__dirname, "..", "media", "terminal.svg")
      ),
      dark: vscode.Uri.file(
        path.join(__dirname, "..", "media", "terminal.svg")
      ),
    };
  }
}
