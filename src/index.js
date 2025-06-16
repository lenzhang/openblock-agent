// 首先加载native模块fallback处理器
require('./native-modules-fallback');

const {app, BrowserWindow, nativeImage, dialog} = require('electron');
const electron = require('electron');

const path = require('path');
const os = require('os');
const {execFile} = require('child_process');
const fs = require('fs');
const compareVersions = require('./lib/compare-versions');
// const del = require('del'); // 将在需要时动态导入

const OpenBlockLink = require('openblock-link');
const OpenblockResourceServer = require('openblock-resource');
const ProgressBar = require('electron-progressbar');

const formatMessage = require('format-message');
const locales = require('openblock-l10n/locales/link-desktop-msgs');
const osLocale = require('os-locale');

const {productName, version} = require('../package.json');

const {JSONStorage} = require('node-localstorage');
const nodeStorage = new JSONStorage(app.getPath('userData'));

const Menu = electron.Menu;
const Tray = electron.Tray;

let mainWindow;
let appTray;
let locale = osLocale.sync();
let resourceServer;
let linkServer;
let resourcePath;
let dataPath;
let makeTrayMenu = () => {};

const showOperationFailedMessageBox = err => {
    dialog.showMessageBox({
        type: 'error',
        buttons: ['Ok'],
        message: formatMessage({
            id: 'index.messageBox.operationFailed',
            default: 'Operation failed',
            description: 'Prompt for operation failed'
        }),
        detail: typeof err === 'string' ? err : (err?.message || err?.toString() || 'Unknown error')
    });
};

const handleClickLanguage = l => {
    locale = l;
    formatMessage.setup({
        locale: locale,
        translations: locales
    });

    appTray.setContextMenu(Menu.buildFromTemplate(makeTrayMenu(locale)));
};


const checkUpdate = (alertLatest = true) => {
    resourceServer.checkUpdate(locale)
        .then(info => {
            appTray.setContextMenu(Menu.buildFromTemplate(makeTrayMenu(locale, false)));
            if (info) {
                const rev = dialog.showMessageBoxSync({
                    type: 'question',
                    buttons: [
                        formatMessage({
                            id: 'index.messageBox.upgradeLater',
                            default: 'Upgrade later',
                            description: 'Label in bottom to upgrade later'
                        }),
                        formatMessage({
                            id: 'index.messageBox.upgradeAndRestart',
                            default: 'Upgrade and restart',
                            description: 'Label in bottom to upgrade and restart'
                        })
                    ],
                    defaultId: 1,
                    message: `${formatMessage({
                        id: 'index.messageBox.newExternalResource',
                        default: 'New external resource version detected',
                        description: 'Label for new external resource version detected'
                    })} : ${info.version}`,
                    // Use 100 spaces to prevent the message box from being collapsed
                    // under windows, making the message box very ugly.
                    detail: `${' '.repeat(100)}\n${info.describe}`
                });
                if (rev === 1) {
                    const progressBarPhase = {
                        idle: 0,
                        downloading: 10,
                        extracting: 80,
                        covering: 90
                    };

                    const progressBar = new ProgressBar({
                        indeterminate: false,
                        title: formatMessage({
                            id: 'index.messageBox.upgrading',
                            default: 'Upgrading',
                            description: 'Tile for upgrade progress bar message box'
                        }),
                        detail: formatMessage({
                            id: 'index.messageBox.upgradingTip',
                            default: 'The upgrade is in progress, please do not close me, ' +
                                'the program will automatically restart after the upgrade is completed.',
                            description: 'Tips during the upgrade process'
                        })
                    });

                    let downloadInterval;

                    progressBar.on('aborted', () => {
                        clearInterval(downloadInterval);
                    });

                    resourceServer.upgrade(state => {
                        if (state.phase === 'downloading') {
                            if (progressBar) {
                                progressBar.value = progressBarPhase.downloading;
                                progressBar.text = formatMessage({
                                    id: 'index.messageBox.downloading',
                                    default: 'Downloading',
                                    description: 'Prompt for in downloading porgress'
                                });

                                downloadInterval = setInterval(() => {
                                    if (progressBar.value < (progressBarPhase.extracting - 1)) {
                                        progressBar.value += 1;
                                    }
                                }, 2000);
                            }
                        } else if (progressBar) {
                            clearInterval(downloadInterval);

                            progressBar.value = progressBarPhase.covering;
                            progressBar.text = formatMessage({
                                id: 'index.messageBox.covering',
                                default: 'Covering',
                                description: 'Prompt for in covering porgress'
                            });
                        }
                    })
                        .then(() => {
                            if (progressBar) {

                                progressBar.setCompleted();
                            }
                            app.relaunch();
                            app.exit();
                        })
                        .catch(err => {
                            showOperationFailedMessageBox(err);
                        });
                }
            } else if (alertLatest) {
                dialog.showMessageBox({
                    type: 'info',
                    buttons: ['Ok'],
                    message: formatMessage({
                        id: 'index.messageBox.alreadyLatest',
                        default: 'Already latest',
                        description: 'Prompt for already latest'
                    }),
                    detail: formatMessage({
                        id: 'index.messageBox.alreadyLatestTips',
                        default: 'External source is already latest.',
                        description: 'Prompt for external source is already latest'
                    })
                });
            }
        })
        .catch(err => {
            showOperationFailedMessageBox(err);
        });
};

const handleClickCheckUpdate = () => {
    appTray.setContextMenu(Menu.buildFromTemplate(makeTrayMenu(locale, true)));
    checkUpdate();
};

makeTrayMenu = (l, checkingUpdate = false) => [
    {
        label: formatMessage({
            id: 'index.menu.setLanguage',
            default: 'set language',
            description: 'Lable in menu item to set language'
        }),
        submenu: [
            {
                label: 'English',
                type: 'radio',
                click: () => handleClickLanguage('en'),
                checked: l === 'en'
            },
            {
                label: '简体中文',
                type: 'radio',
                click: () => handleClickLanguage('zh-cn'),
                checked: l === 'zh-cn'
            }
        ]
    },
    {
        type: 'separator'
    },
    {
        label: checkingUpdate ? formatMessage({
            id: 'index.menu.checkingUpdate',
            default: 'checking for update...',
            description: 'Menu item to prompt checking for update'
        }) : formatMessage({
            id: 'index.menu.checkUpdate',
            default: 'check update',
            description: 'Menu item to check update'
        }),
        enabled: !checkingUpdate,
        click: () => handleClickCheckUpdate()
    },
    {
        label: formatMessage({
            id: 'index.menu.learCacheAndRestart',
            default: 'clear cache and restart',
            description: 'Menu item to clear cache and restart'
        }),
        click: () => {
            try {
                // 使用 Node.js 内置模块删除缓存目录
                if (fs.existsSync(dataPath)) {
                    fs.rmSync(dataPath, { recursive: true, force: true });
                }
            } catch (err) {
                console.error('Failed to clear cache:', err);
            }
            app.relaunch();
            app.exit();
        }
    },
    {
        type: 'separator'
    },
    {
        label: formatMessage({
            id: 'index.menu.installDiver',
            default: 'install driver',
            description: 'Menu item to install driver'
        }),
        click: () => {
            const driverPath = path.join(resourcePath, 'drivers');
            if ((os.platform() === 'win32') && (os.arch() === 'x64')) {
                execFile('install_x64.bat', [], {cwd: driverPath});
            } else if ((os.platform() === 'win32') && (os.arch() === 'ia32')) {
                execFile('install_x86.bat', [], {cwd: driverPath});
            }
        }
    },
    {
        type: 'separator'
    },
    {
        label: '测试点击',
        click: () => {
            console.log('=== Test click works! ===');
        }
    },
    {
        label: '退出',
        click: () => {
            console.log('=== Tray exit clicked ===');
            app.quit();
        }
    }
];

const devToolKey = ((process.platform === 'darwin') ?
    { // macOS: command+option+i
        alt: true, // option
        control: false,
        meta: true, // command
        shift: false,
        code: 'KeyI'
    } : { // Windows: control+shift+i
        alt: false,
        control: true,
        meta: false, // Windows key
        shift: true,
        code: 'KeyI'
    }
);

const createWindow = () => {
    mainWindow = new BrowserWindow({
        icon: path.join(__dirname, './icon/OpenBlock-Link.ico'),
        width: 400,
        height: 400,
        center: true,
        resizable: false,
        fullscreenable: false,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true
        }
    });

    mainWindow.loadFile('./src/index.html');
    mainWindow.setMenu(null);

    if (locale === 'zh-CN') {
        locale = 'zh-cn';
    } else if (locale === 'zh-TW') {
        locale = 'zh-tw';
    }
    formatMessage.setup({
        locale: locale,
        translations: locales
    });

    const webContents = mainWindow.webContents;
    webContents.on('before-input-event', (event, input) => {
        if (input.code === devToolKey.code &&
            input.alt === devToolKey.alt &&
            input.control === devToolKey.control &&
            input.meta === devToolKey.meta &&
            input.shift === devToolKey.shift &&
            input.type === 'keyDown' &&
            !input.isAutoRepeat &&
            !input.isComposing) {
            event.preventDefault();
            webContents.openDevTools({mode: 'detach', activate: true});
        }
    });

    // generate product information.
    webContents.once('dom-ready', () => {
        const electronVersion = process.versions['electron'.toLowerCase()];
        const chromeVersion = process.versions['chrome'.toLowerCase()];
        mainWindow.webContents.executeJavaScript(
            `document.getElementById("product-name").innerHTML = "${productName}";
            document.getElementById("product-version").innerHTML = "Version ${version}";
            document.getElementById("electron-version").innerHTML = "Electron ${electronVersion}";
            document.getElementById("chrome-version").innerHTML = "Chrome ${chromeVersion}";`
        );
    });

    const userDataPath = electron.app.getPath('userData');
    dataPath = path.join(userDataPath, 'Data');
    const appPath = app.getAppPath();
    const appVersion = app.getVersion();

    // if current version is newer then cache log, delet the data cache dir and write the
    // new version into the cache file.
    const oldVersion = nodeStorage.getItem('version');
    if (oldVersion) {
        if (compareVersions.compare(appVersion, oldVersion, '>')) {
            if (fs.existsSync(dataPath)) {
                try {
                    // 使用同步删除替代方案
                    fs.rmSync(dataPath, { recursive: true, force: true });
                } catch (err) {
                    console.error('Failed to clear data cache:', err);
                }
            }
            nodeStorage.setItem('version', appVersion);
        }
    } else {
        nodeStorage.setItem('version', appVersion);
    }

    if (appPath.search(/app.asar/g) === -1) {
        resourcePath = path.join(appPath);
    } else {
        resourcePath = path.join(appPath, '../');
    }

    // start link server
    linkServer = new OpenBlockLink(dataPath, path.join(resourcePath, 'tools'));
    linkServer.listen();

    // start resource server
    resourceServer = new OpenblockResourceServer(dataPath, path.join(resourcePath, 'external-resources'));
    resourceServer.listen();


    appTray = new Tray(nativeImage.createFromPath(path.join(__dirname, './icon/OpenBlock-Link.ico')));
    appTray.setToolTip('Openblock Link');
    
    // 在 macOS 上不设置 contextMenu，改用事件处理
    if (process.platform !== 'darwin') {
        // 非 macOS 平台正常设置 contextMenu
        appTray.setContextMenu(Menu.buildFromTemplate(makeTrayMenu(locale)));
    }

    appTray.on('click', () => {
        if (process.platform === 'darwin') {
            // macOS 上左键点击显示窗口
            mainWindow.show();
        } else {
            mainWindow.show();
        }
    });

    appTray.on('right-click', () => {
        if (process.platform === 'darwin') {
            // macOS 上右键点击显示菜单
            const contextMenu = Menu.buildFromTemplate(makeTrayMenu(locale));
            appTray.popUpContextMenu(contextMenu);
        }
    });

    mainWindow.on('close', event => {
        mainWindow.hide();
        event.preventDefault();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};

const gotTheLock = app.requestSingleInstanceLock();
if (gotTheLock) {
    app.on('second-instance', () => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            mainWindow.show();
        }
    });
    app.on('ready', () => {
        createWindow();
        // 暂时禁用自动检查更新，避免错误
        // checkUpdate(false);
    });
} else {
    app.quit();
}

app.on('window-all-closed', () => {
    // 不要在这里退出，让托盘控制退出
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('before-quit', (event) => {
    console.log('App before-quit event triggered');
    // 清理托盘
    if (appTray) {
        appTray.destroy();
        appTray = null;
    }
    // 确保主窗口也被关闭
    if (mainWindow) {
        mainWindow.removeAllListeners('close');
        mainWindow.destroy();
        mainWindow = null;
    }
});
