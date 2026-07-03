# Save Commands

Manage and execute your custom project commands globally in VS Code.

## Features

- Organize commands into **groups** (folders) that can be created, renamed, reordered, and removed
- Add, edit, and remove commands from a side panel, scoped to a group
- **Run a single command** or **run all commands in a group** in sequence
- Choose which terminal to run a command in — reuse an open terminal or create a new one
- **Drag and drop** to reorder commands within/between groups, or to reorder groups themselves
- Group collapse/expand state is remembered across reloads
- Confirmation prompt before deleting a command or a group (deleting a group removes all of its commands)
- Commands and groups are saved globally and available in any project
- Custom icons for run, edit, and delete actions

## Usage

1. Open the Save Commands panel in the activity bar
2. Add a group (folder icon in the view title bar) to organize your commands
3. Add commands to a group (name and command line)
4. Run a command, or run an entire group at once, choosing an existing terminal or a new one
5. Edit or remove commands and groups via right-click or the inline icons
6. Drag and drop commands and groups to reorder them

## Extension Settings

No settings required. All commands and groups are stored globally under `code-commands.groups`.

## Release Notes

### 0.1.0

- Added command groups with drag-and-drop reordering
- Added running all commands in a group, with a terminal picker
- Added confirmation before deleting commands and groups

### 0.0.1

- Initial release with global command storage and custom icons

---

GitHub: [https://github.com/NicolasXs/code-commands](https://github.com/NicolasXs/code-commands)
