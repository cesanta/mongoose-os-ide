# Mongoose OS for Visual Studio Code

This preview release of the extension provides support for
[Mongoose OS](https://mongoose-os.com) in Visual Studio Code.

![](https://mongoose-os.com/docs/quickstart/images/ide.png)

See [Mongoose OS IDE](https://mongoose-os.com/docs/mongoose-os/quickstart/ide.md)
for more details.

## Features

- Run any mos command: `Ctrl+.`
- Open device serial log console: toggle "Output" panel
  (`Shift+Ctrl+U` / `Shift+Cmd+U`)
  and select "Mongoose OS" output in a dropdown
- To build firmware, open app directory in VSCode, select board and run `build`.
  Note: `mos` tool executes in the first workspace's directory, so only that
  directory can be built, and it must be a Mongoose firmware directory with
  the `mos.yml` file
- To flash firmware, select port and run `flash`
- To configure wifi, run `wifi NETWORK PASSWORD`
- Edit files on a device: select port and click on a file to edit and save
- Edit device config as a file: select port and click on "Device configuration"
- C/C++ and JS API autocompletions:

![](https://mongoose-os.com/docs/quickstart/images/ide_autocomplete.gif)

## Requirements

* [mos command-line tool](https://mongoose-os.com/docs/) installed
