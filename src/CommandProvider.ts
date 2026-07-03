import * as vscode from "vscode";

const CONFIG_SECTION = "code-commands";
const GROUPS_KEY = "groups";
const DEFAULT_GROUP_ID = "default";
const COMMAND_MIME_TYPE = "application/vnd.code-commands.command";
const GROUP_MIME_TYPE = "application/vnd.code-commands.group";

export interface CommandData {
  /** Stable unique identifier, independent from the (editable) label. */
  id: string;
  label: string;
  command: string;
}

export interface CommandGroup {
  id: string;
  name: string;
  commands: CommandData[];
  collapsed?: boolean;
}

/** Shape moved through drag & drop transfers. */
interface CommandDragPayload {
  id: string;
  groupId: string;
}

interface GroupDragPayload {
  id: string;
}

export type CommandTreeItem = CommandGroupItem | CommandItem;

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultGroups(): CommandGroup[] {
  return [{ id: DEFAULT_GROUP_ID, name: "Default", commands: [] }];
}

export class CommandProvider
  implements
    vscode.TreeDataProvider<CommandTreeItem>,
    vscode.TreeDragAndDropController<CommandTreeItem>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    CommandTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private groups: CommandGroup[] = defaultGroups();
  /** Guards against reacting to configuration changes we triggered ourselves. */
  private isSaving = false;

  readonly dragMimeTypes = [COMMAND_MIME_TYPE, GROUP_MIME_TYPE];
  readonly dropMimeTypes = [COMMAND_MIME_TYPE, GROUP_MIME_TYPE];

  constructor(private readonly context: vscode.ExtensionContext) {
    this.loadGroups();
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (
          !this.isSaving &&
          e.affectsConfiguration(`${CONFIG_SECTION}.${GROUPS_KEY}`)
        ) {
          this.refresh();
        }
      })
    );
  }

  refresh(): void {
    this.loadGroups();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CommandTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CommandTreeItem): Thenable<CommandTreeItem[]> {
    if (!element) {
      return Promise.resolve(
        this.groups.map(
          (g) =>
            new CommandGroupItem(g.id, g.name, g.commands, g.collapsed ?? false)
        )
      );
    }
    if (element instanceof CommandGroupItem) {
      return Promise.resolve(
        element.commands.map(
          (cmd) => new CommandItem(cmd.id, cmd.label, cmd.command, element.id)
        )
      );
    }
    return Promise.resolve([]);
  }

  // --- Persistence ---------------------------------------------------------

  private loadGroups(): void {
    try {
      const stored = vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .get<CommandGroup[]>(GROUPS_KEY);
      this.groups =
        Array.isArray(stored) && stored.length > 0
          ? this.normalize(stored)
          : defaultGroups();
    } catch (e) {
      vscode.window.showErrorMessage(`Error loading command groups: ${e}`);
      this.groups = defaultGroups();
    }
  }

  /** Ensures every command has a stable id (migrates legacy data). */
  private normalize(groups: CommandGroup[]): CommandGroup[] {
    return groups.map((g) => ({
      ...g,
      commands: (g.commands ?? []).map((c) => ({
        ...c,
        id: c.id ?? createId(),
      })),
    }));
  }

  private async saveGroups(): Promise<void> {
    this.isSaving = true;
    try {
      await vscode.workspace
        .getConfiguration(CONFIG_SECTION)
        .update(GROUPS_KEY, this.groups, vscode.ConfigurationTarget.Global);
      this._onDidChangeTreeData.fire();
    } catch (e) {
      vscode.window.showErrorMessage(`Error saving command groups: ${e}`);
    } finally {
      this.isSaving = false;
    }
  }

  private findGroup(groupId: string): CommandGroup | undefined {
    return this.groups.find((g) => g.id === groupId);
  }

  // --- Command management --------------------------------------------------

  addCommand(
    command: Omit<CommandData, "id">,
    groupId: string = DEFAULT_GROUP_ID
  ): void {
    const group = this.findGroup(groupId);
    if (!group) return;
    group.commands.push({ id: createId(), ...command });
    void this.saveGroups();
  }

  editCommand(
    commandId: string,
    changes: Omit<CommandData, "id">,
    groupId: string = DEFAULT_GROUP_ID
  ): void {
    const group = this.findGroup(groupId);
    const cmd = group?.commands.find((c) => c.id === commandId);
    if (!cmd) return;
    cmd.label = changes.label;
    cmd.command = changes.command;
    void this.saveGroups();
  }

  removeCommand(commandId: string, groupId: string = DEFAULT_GROUP_ID): void {
    const group = this.findGroup(groupId);
    if (!group) return;
    group.commands = group.commands.filter((c) => c.id !== commandId);
    void this.saveGroups();
  }

  // --- Group management ----------------------------------------------------

  addGroup(name: string): void {
    this.groups.push({ id: createId(), name, commands: [] });
    void this.saveGroups();
  }

  renameGroup(groupId: string, newName: string): void {
    const group = this.findGroup(groupId);
    if (!group) return;
    group.name = newName;
    void this.saveGroups();
  }

  removeGroup(groupId: string): void {
    this.groups = this.groups.filter((g) => g.id !== groupId);
    void this.saveGroups();
  }

  setGroupCollapsed(groupId: string, collapsed: boolean): void {
    const group = this.findGroup(groupId);
    if (!group || group.collapsed === collapsed) return;
    group.collapsed = collapsed;
    // Persist silently: firing a tree change here would fight the view's own
    // expand/collapse animation.
    this.isSaving = true;
    void vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .update(GROUPS_KEY, this.groups, vscode.ConfigurationTarget.Global)
      .then(
        () => (this.isSaving = false),
        () => (this.isSaving = false)
      );
  }

  // --- Drag & drop ---------------------------------------------------------

  async handleDrag(
    source: readonly CommandTreeItem[],
    dataTransfer: vscode.DataTransfer
  ): Promise<void> {
    const commands: CommandDragPayload[] = source
      .filter((i): i is CommandItem => i instanceof CommandItem)
      .map((i) => ({ id: i.id, groupId: i.groupId }));
    if (commands.length > 0) {
      dataTransfer.set(
        COMMAND_MIME_TYPE,
        new vscode.DataTransferItem(JSON.stringify(commands))
      );
    }

    const groups: GroupDragPayload[] = source
      .filter((i): i is CommandGroupItem => i instanceof CommandGroupItem)
      .map((i) => ({ id: i.id }));
    if (groups.length > 0) {
      dataTransfer.set(
        GROUP_MIME_TYPE,
        new vscode.DataTransferItem(JSON.stringify(groups))
      );
    }
  }

  async handleDrop(
    target: CommandTreeItem | undefined,
    dataTransfer: vscode.DataTransfer
  ): Promise<void> {
    // Reordering groups takes precedence when a group is being dragged.
    if (await this.handleGroupDrop(target, dataTransfer)) return;
    await this.handleCommandDrop(target, dataTransfer);
  }

  private async handleGroupDrop(
    target: CommandTreeItem | undefined,
    dataTransfer: vscode.DataTransfer
  ): Promise<boolean> {
    const raw = dataTransfer.get(GROUP_MIME_TYPE);
    if (!raw) return false;

    let items: GroupDragPayload[];
    try {
      items = JSON.parse(await raw.asString());
    } catch {
      return true;
    }

    // Drop before the target's group (whether the target is a group or one of
    // its commands); dropping on empty space moves to the end.
    const beforeGroupId =
      target instanceof CommandGroupItem
        ? target.id
        : target instanceof CommandItem
        ? target.groupId
        : undefined;

    let changed = false;
    for (const item of items) {
      changed = this.moveGroup(item.id, beforeGroupId) || changed;
    }
    if (changed) void this.saveGroups();
    return true;
  }

  private async handleCommandDrop(
    target: CommandTreeItem | undefined,
    dataTransfer: vscode.DataTransfer
  ): Promise<void> {
    const raw = dataTransfer.get(COMMAND_MIME_TYPE);
    if (!raw) return;

    let items: CommandDragPayload[];
    try {
      items = JSON.parse(await raw.asString());
    } catch {
      return;
    }

    let changed = false;
    for (const item of items) {
      if (target instanceof CommandGroupItem) {
        changed = this.moveCommand(item.id, item.groupId, target.id) || changed;
      } else if (target instanceof CommandItem) {
        changed =
          this.moveCommand(
            item.id,
            item.groupId,
            target.groupId,
            target.id
          ) || changed;
      }
    }
    if (changed) void this.saveGroups();
  }

  private moveGroup(groupId: string, beforeGroupId?: string): boolean {
    if (groupId === beforeGroupId) return false;
    const idx = this.groups.findIndex((g) => g.id === groupId);
    if (idx === -1) return false;

    const [group] = this.groups.splice(idx, 1);
    const insertIdx = beforeGroupId
      ? this.groups.findIndex((g) => g.id === beforeGroupId)
      : -1;
    if (insertIdx !== -1) {
      this.groups.splice(insertIdx, 0, group);
    } else {
      this.groups.push(group);
    }
    return true;
  }

  private moveCommand(
    commandId: string,
    fromGroupId: string,
    toGroupId: string,
    beforeCommandId?: string
  ): boolean {
    const fromGroup = this.findGroup(fromGroupId);
    const toGroup = this.findGroup(toGroupId);
    if (!fromGroup || !toGroup) return false;

    const idx = fromGroup.commands.findIndex((c) => c.id === commandId);
    if (idx === -1) return false;
    if (fromGroupId === toGroupId && !beforeCommandId) return false;

    const [cmd] = fromGroup.commands.splice(idx, 1);
    const insertIdx = beforeCommandId
      ? toGroup.commands.findIndex((c) => c.id === beforeCommandId)
      : -1;
    if (insertIdx !== -1) {
      toGroup.commands.splice(insertIdx, 0, cmd);
    } else {
      toGroup.commands.push(cmd);
    }
    return true;
  }
}

export class CommandGroupItem extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    public name: string,
    public commands: CommandData[],
    collapsed: boolean = false
  ) {
    super(
      name,
      collapsed
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.Expanded
    );
    this.contextValue = "commandGroup";
    this.iconPath = new vscode.ThemeIcon("folder");
  }
}

export class CommandItem extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly commandStr: string,
    public readonly groupId: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${label} — ${commandStr}`;
    this.description = commandStr;
    this.contextValue = "commandItem";
    this.iconPath = new vscode.ThemeIcon("terminal");
  }
}
