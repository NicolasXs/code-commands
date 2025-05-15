import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

interface Comando {
  label: string;
  command: string;
}

export class ComandoProvider implements vscode.TreeDataProvider<ComandoItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    ComandoItem | undefined | void
  > = new vscode.EventEmitter<ComandoItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ComandoItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private comandos: Comando[] = [];

  constructor(private context: vscode.ExtensionContext) {
    this.carregarComandos();
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("code-commands.commands")) {
        this.refresh();
      }
    });
  }

  refresh(): void {
    this.carregarComandos();
    setTimeout(() => this._onDidChangeTreeData.fire(), 50);
  }
  getTreeItem(element: ComandoItem): vscode.TreeItem {
    const getIcon = (file: string) => {
      return {
        light: vscode.Uri.file(path.join(__dirname, "..", "media", file)),
        dark: vscode.Uri.file(path.join(__dirname, "..", "media", file)),
      };
    };

    element.iconPath = getIcon("terminal.svg");
    return element;
  }

  getChildren(element?: ComandoItem): Thenable<ComandoItem[]> {
    console.log("getChildren chamados, comandos:", this.comandos);
    if (!this.comandos || this.comandos.length === 0) {
      return Promise.resolve([
        new ComandoItem('No commands found. Click "+" to add.', ""),
      ]);
    }
    return Promise.resolve(
      this.comandos.map(
        (comando) => new ComandoItem(comando.label, comando.command)
      )
    );
  }

  private carregarComandos() {
    try {
      const config = vscode.workspace.getConfiguration("code-commands");
      const content = config.get<Comando[]>("commands");
      this.comandos = Array.isArray(content) ? content : [];
      console.log("Loaded commands:", this.comandos);
    } catch (e) {
      vscode.window.showErrorMessage("Error loading commands: " + e);
      this.comandos = [];
    }
  }
  public adicionarComando(comando: Comando) {
    this.comandos.push(comando);
    this.salvarComandos();
  }

  public editarComando(oldLabel: string, newComando: Comando) {
    const index = this.comandos.findIndex((c) => c.label === oldLabel);
    if (index !== -1) {
      this.comandos[index] = newComando;
      this.salvarComandos();
    }
  }

  public removerComando(label: string) {
    this.comandos = this.comandos.filter((c) => c.label !== label);
    this.salvarComandos();
  }

  private salvarComandos() {
    try {
      const config = vscode.workspace.getConfiguration("code-commands");
      config.update(
        "commands",
        this.comandos,
        vscode.ConfigurationTarget.Global
      ).then(() => {
        this.refresh();
      });
    } catch (e) {
      vscode.window.showErrorMessage("Error saving commands: " + e);
    }
  }
}

class ComandoItem extends vscode.TreeItem {
  public readonly commandStr: string;

  constructor(public readonly label: string, commandStr: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.commandStr = commandStr;
    this.tooltip = `${this.label} - ${this.commandStr}`;
    this.description = this.commandStr;
    this.contextValue = "comandoItem";
  }
}
