const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

let mosPort = '';            // Selected port
let mosBoard = '';           // Selected board
let mosProcess = undefined;  // Currently running mos command
let deviceFiles = [];        // Device file list
let numPortWaiters = 0;      // Number of commands waiting for port
const uartOut = vscode.window.createOutputChannel('Mongoose OS');
const cmdOut = uartOut;
const mgosStatusBarIcon = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);

const boards = {
  'STM32 B-L475E-IOT01A': '--platform stm32 --build-var BOARD=B-L475E-IOT01A',
  'STM32 DISCO-F746NG': '--platform stm32 --build-var BOARD=DISCO-F746NG',
  'STM32 NUCLEO-F746ZG': '--platform stm32 --build-var BOARD=NUCLEO-F746ZG',
  'TI CC3220': '--platform cc3220',
  'TI CC3200': '--platform cc3200',
  'ESP32': '--platform esp32',
  'ESP32 Olimex EVB': '--platform esp32 --build-var BOARD=ESP32-EVB',
  'ESP8266': '--platform esp8266',
  'ESP8266, flash 1M': '--platform esp8266 --build-var BOARD=esp8266-1M',
  'ESP8266, flash 2M': '--platform esp8266 --build-var BOARD=esp8266-2M',
};

const killMosCommandAndWait = () => new Promise((resolve, reject) => {
  if (mosProcess) {
    numPortWaiters++;
    mosProcess.kill(9);  // Kill and then wait
    const tid = setInterval(() => {
      if (mosProcess) return;
      clearInterval(tid);
      numPortWaiters--;
      resolve();
    }, 300);
  } else {
    resolve();  // No mos process is running
  }
});

const runMosCommand = (args, out, nomarks) => new Promise((resolve, reject) => {
  return killMosCommandAndWait().then(() => {
    let fullArgs = args;
    if (mosPort) fullArgs = fullArgs.concat(['--port', mosPort]);
    if (args[0] === 'build' && boards[mosBoard]) {
      fullArgs = fullArgs.concat(boards[mosBoard].split(/\s+/));
    }
    let extra = vscode.workspace.getConfiguration('mos').get('flags');
    if (extra) fullArgs = fullArgs.concat(extra.split(/\s+/));
    const uri = vscode.workspace.workspaceFolders[0].uri;
    const cwd = vscode.Uri.parse(uri).fsPath;
    // console.log('Running', fullArgs.join(' '));
    mosProcess = childProcess.spawn('mos', fullArgs, { cwd });
    if (!nomarks) out.append(`\n--[command: mos ${fullArgs.join(' ')}]\n`);
    mosProcess.stdout.on('data', b => out.append(b.toString()));
    mosProcess.stderr.on('data', b => out.append(b.toString()));
    mosProcess.on('error', (err) => reject(err));
    mosProcess.on('exit', (code) => {
      if (!nomarks) out.append('--[command complete]');
      if (code) {
        reject(`MGOS: Command "mos ${args[0]} ..." failed`);
      } else {
        resolve();
      }
      mosProcess = undefined;
    });
  });
});

// When idle, run `mos console` command if the port is chosen
setInterval(() => {
  if (!mosPort || mosProcess || numPortWaiters) return;
  runMosCommand(['console'], uartOut).catch(() => { });
}, 1000);

const runMosCommandGetOutput = args => {
  const obj = { out: [], append: x => obj.out.push(x) };
  return runMosCommand(args, obj, true).then(() => obj.out.join(''));
};

const mosView = {
  setupStatusBarIcon: () => {
    mgosStatusBarIcon.command = "mos.showPanel"
    mgosStatusBarIcon.text = " $(circuit-board) "
    mgosStatusBarIcon.tooltip = "Mongoose OS Output Panel"
    mgosStatusBarIcon.show()
  },
  _onDidChangeTreeData: new vscode.EventEmitter(),
  getChildren: el => {
    let rootItems = [
      {
        label: 'Build locally',
        command: { command: 'mos.buildLocally' },
        iconPath: {
          light: path.join(__filename, '..', 'resources', 'icons', 'light', 'build-local.svg'),
          dark: path.join(__filename, '..', 'resources', 'icons', 'dark', 'build-local.svg')
        }
      },
      {
        label: 'Build',
        command: { command: 'mos.build' },
        iconPath: {
          light: path.join(__filename, '..', 'resources', 'icons', 'light', 'build-online.svg'),
          dark: path.join(__filename, '..', 'resources', 'icons', 'dark', 'build-online.svg')
        }
      },
      {
        label: 'Flash',
        command: { command: 'mos.flash' },
        iconPath: {
          light: path.join(__filename, '..', 'resources', 'icons', 'light', 'flash.svg'),
          dark: path.join(__filename, '..', 'resources', 'icons', 'dark', 'flash.svg')
        }
      },
      {
        label: 'Console',
        command: { command: 'mos.console' },
        iconPath: {
          light: path.join(__filename, '..', 'resources', 'icons', 'light', 'console.svg'),
          dark: path.join(__filename, '..', 'resources', 'icons', 'dark', 'console.svg')
        }
      },

      {
        label: 'Device info',
        command: { command: 'mos.sysInfo' },
        iconPath: {
          light: path.join(__filename, '..', 'resources', 'icons', 'light', 'device-info.svg'),
          dark: path.join(__filename, '..', 'resources', 'icons', 'dark', 'device-info.svg')
        }
      },

      {
        label: 'RPC List',
        command: { command: 'mos.rpcList' },
        iconPath: {
          light: path.join(__filename, '..', 'resources', 'icons', 'light', 'rpc-list.svg'),
          dark: path.join(__filename, '..', 'resources', 'icons', 'dark', 'rpc-list.svg')
        }
      },

      {
        label: 'Run command...',
        command: { command: 'mos.runCommand' },
        iconPath: {
          light: path.join(__filename, '..', 'resources', 'icons', 'light', 'run-command.svg'),
          dark: path.join(__filename, '..', 'resources', 'icons', 'dark', 'run-command.svg')
        }
      },

      {
        label: 'Reboot device',
        command: { command: 'mos.rebootDevice' },
        iconPath: {
          light: path.join(__filename, '..', 'resources', 'icons', 'light', 'reboot.svg'),
          dark: path.join(__filename, '..', 'resources', 'icons', 'dark', 'reboot.svg')
        }
      },

      {
        label: `Port: ${mosPort || '<click to set>'}`,
        command: { command: 'mos.setPort' }
      },

      {
        label: `Board: ${mosBoard || '<click to set>'}`,
        command: { command: 'mos.setBoard' }
      },
    ];
    if (mosPort) {
      rootItems.push({
        label: 'Device configuration',
        command: { command: 'mos.openConfig' },
        iconPath: vscode.ThemeIcon.File,
      });
      rootItems.push({
        label: 'Device files',
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        iconPath: vscode.ThemeIcon.Folder,
      });
    }
    if (!el) return rootItems;
    return deviceFiles.map(function (name) {
      return {
        label: name, iconPath: vscode.ThemeIcon.File,
        command: { command: 'mos.openFile', arguments: [name] },
      }
    });
  },
  getTreeItem: item => item,
};
mosView.onDidChangeTreeData = mosView._onDidChangeTreeData.event;

const refreshFS = () => {
  return runMosCommandGetOutput(['ls'])
    .then(output => {
      deviceFiles = output.replace(/^\s+|\s+$/g, '').split(/\s+/);
      mosView._onDidChangeTreeData.fire();
    })
    .catch(err => vscode.window.showErrorMessage(err));
};

module.exports = {
  activate: function (context) {
    console.log('MOS IDE activated.');

    mosView.setupStatusBarIcon();

    const dir = context.storagePath;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    mosPort = vscode.workspace.getConfiguration('mos').get('port');
    mosBoard = vscode.workspace.getConfiguration('mos').get('board');
    if (mosPort) refreshFS();

    runMosCommandGetOutput(['ports']).catch(
      () => vscode.window.showErrorMessage(
        'Too old mos tool: "mos ports" failed. Run "mos update latest"'));

    vscode.window.createTreeView('mos', { treeDataProvider: mosView });

    vscode.commands.registerCommand('mos.setPort', () => {
      childProcess.exec('mos ports', (error, stdout, stderr) => {
        const items = (stdout || '').replace(/\s+$/, '').split(/\s+/);
        vscode.window.showQuickPick(items).then(v => {
          mosPort = v || '';
          vscode.workspace.getConfiguration('mos').update('port', mosPort)
          mosView._onDidChangeTreeData.fire();
          if (mosProcess) mosProcess.kill();
          if (v) {
            refreshFS();
          } else {
            deviceFiles = [];
            mosView._onDidChangeTreeData.fire();
          }
        });
      });
    });

    vscode.commands.registerCommand('mos.setBoard', () => {
      vscode.window.showQuickPick(Object.keys(boards)).then(v => {
        mosBoard = v;
        vscode.workspace.getConfiguration('mos').update('board', v)
        mosView._onDidChangeTreeData.fire();
      });
    });

    vscode.commands.registerCommand('mos.openFile', (name) => {
      runMosCommandGetOutput(['get', name]).then(output => {
        const local = path.resolve(dir, name);
        fs.writeFileSync(local, output);
        vscode.window.showTextDocument(vscode.Uri.file(local));
      }, err => console.log('File open error:', err));
    });

    vscode.commands.registerCommand('mos.openConfig', () => {
      runMosCommandGetOutput(['config-get']).then(output => {
        const local = path.resolve(dir, '__config.json');
        fs.writeFileSync(local, output);
        vscode.window.showTextDocument(vscode.Uri.file(local));
      }, err => console.log('config open error:', err));
    });

    vscode.commands.registerCommand('mos.runCommand', () => {
      vscode.window.showInputBox().then(input => {
        input = (input || '').replace(/^mos\s*/i, '').replace(/\s+$/, '');
        if (!input) return;
        runMosCommand(input.split(/\s+/), cmdOut)
          .then(() => cmdOut.show(true))
          .catch(err => vscode.window.showErrorMessage(err));
      });
    });

    vscode.commands.registerCommand('mos.rebootDevice', () => {
      return runMosCommand(['call', 'Sys.Reboot'], cmdOut)
        .then(() => vscode.window.showInformationMessage('MGOS: Device rebooted'))
        .catch(err => vscode.window.showErrorMessage(err));
    });

    vscode.commands.registerCommand('mos.sysInfo', () => {
      return runMosCommand(['call', 'Sys.GetInfo'], cmdOut)
        .then(() => cmdOut.show(true))
        .catch(err => vscode.window.showErrorMessage(err));
    });

    vscode.commands.registerCommand('mos.console', () => {
      return runMosCommand(['console'], cmdOut)
        .then(() => cmdOut.show(true))
        .catch(err => vscode.window.showErrorMessage(err));
    });

    vscode.commands.registerCommand('mos.rpcList', () => {
      return runMosCommand(['call', 'RPC.List'], cmdOut)
        .then(() => cmdOut.show(true))
        .catch(err => vscode.window.showErrorMessage(err));
    });

    vscode.commands.registerCommand('mos.buildLocally', () => {
      return runMosCommand(['build', "--local", "--verbose"], cmdOut)
        .then(() => vscode.window.showInformationMessage('MGOS: Build succeeded!'))
        .catch(err => {
          cmdOut.show(true)
          vscode.window.showErrorMessage(err)
        });
    });

    vscode.commands.registerCommand('mos.build', () => {
      return runMosCommand(['build'], cmdOut)
        .then(() => vscode.window.showInformationMessage('MGOS: Build succeeded!'))
        .catch(err => {
          cmdOut.show(true)
          vscode.window.showErrorMessage(err)
        });
    });

    vscode.commands.registerCommand('mos.flash', () => {
      return runMosCommand(['flash'], cmdOut)
        .then(() => vscode.window.showInformationMessage('MGOS: Flash succeeded!'))
        .catch(err => vscode.window.showErrorMessage(err));
    });

    vscode.commands.registerCommand('mos.refreshDeviceFiles', refreshFS);

    vscode.commands.registerCommand('mos.showPanel', () => { cmdOut.show(true) });

    const mkdiff = (x, y) => {
      try {
        const a = JSON.parse(x), b = JSON.parse(y);
        const isEmpty = o => {
          for (var p in o) return false;
          return true;
        };
        const cmp = (obj1, obj2) => {
          var ret = {};
          for (var i in obj2) {
            if (typeof (obj2[i]) === 'object') {
              const x = cmp(obj1[i], obj2[i]);
              if (!isEmpty(x)) ret[i] = x;
            } else {
              if (!obj1 || obj2[i] !== obj1[i]) ret[i] = obj2[i];
            }
          }
          return ret;
        };
        const ret = cmp(a, b);
        return isEmpty(ret) ? '' : JSON.stringify(ret);
      } catch (e) {
        return '';
      }
    };

    vscode.workspace.onDidSaveTextDocument((document) => {
      const local = path.normalize(document.fileName);
      const cfg = path.resolve(dir, '__config.json');
      if (local === cfg) {
        runMosCommandGetOutput(['config-get']).then(output => {
          const diff = mkdiff(output, document.getText());
          if (!diff) {
            vscode.window.showInfoMessage('Config not changed. Save aborted.');
            return;
          };
          const setArgs = ['call', 'Config.Set', `{"config":${diff}}`];
          const saveArgs = ['call', 'Config.Save', '{"reboot": true}'];
          return runMosCommand(setArgs, cmdOut)
            .then(() => runMosCommand(saveArgs, cmdOut))
            .then(() => vscode.window.showInformationMessage('Config saved'))
            .catch(err => vscode.window.showErrorMessage(err));
        });
      } else if (local.startsWith(dir)) {
        const remote = path.basename(document.fileName);
        return runMosCommand(['put', local, remote], cmdOut)
          .then(() => vscode.window.showInformationMessage('File saved'))
          .catch(err => vscode.window.showErrorMessage(err));
      }
    });

    // Autocompletion support
    // The symbols.json should be taken from here:
    // https://raw.githubusercontent.com/cesanta/mongoose-os-docs/master/symbols.json
    const symbols = { c: [], js: [] };
    try {
      const sp = path.join(context.extensionPath, 'resources', 'symbols.json');
      JSON.parse(fs.readFileSync(sp), 'utf-8').forEach(e => {
        const m = e.file.match(/\((.+)\)/);
        (e.lang === 'c' ? symbols.c : symbols.js).push({
          label: e.name,
          kind: vscode.CompletionItemKind.Function,
          detail: m[1],
          documentation: new vscode.MarkdownString(e.doc),
        });
      });
      console.log(`  ${symbols.c.length} C, ${symbols.js.length} JS`);
    } catch (err) {
      vscode.window.showErrorMessage(err);
    }
    const ac = {
      provideCompletionItems: doc =>
        doc.fileName.match(/\.js$/) ? symbols.js : symbols.c,
    };
    vscode.languages.registerCompletionItemProvider('javascript', ac);
    vscode.languages.registerCompletionItemProvider('c', ac);
    vscode.languages.registerCompletionItemProvider('cpp', ac);
  },
  deactivate: function () { console.log('MOS IDE deactivated.'); },
}
