'use strict';

const path = require('path');
const {app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, Notification, powerMonitor} = require('electron');
const unhandled = require('electron-unhandled');
const debug = require('electron-debug');
const contextMenu = require('electron-context-menu');
const {is} = require('electron-util');
const log = require('electron-log');
const menu = require('./src/menu');
const updator = require("./src/updator");
const tray = require('./src/tray');
const process = require('./src/process');

// Prevent window from being garbage collected
let mainWindow;

// Prevent multiple instances of the app
const applock = app.requestSingleInstanceLock();
if (!applock) {
	app.quit();
} else {
	unhandled();
	debug();
	contextMenu();

	// Note: Must match `build.appId` in package.json
	app.setAppUserModelId('io.teamviu.app');
	app.commandLine.appendSwitch("disable-http-cache");

	const createMainWindow = async () => {
		const win = new BrowserWindow({
			title: app.name,
			show: true,
			width: 600,
			height: 400,
			webPreferences: {
				preload: path.join(__dirname, './preload.js'),
				nodeIntegration: false,
				enableRemoteModule: false,
				contextIsolation: true,
				sandbox: true,
			}
		});

		win.on('ready-to-show', () => {
			win.show();
		});

		win.on('closed', () => {
			// Dereference the window
			// For multiple windows store them in an array
			mainWindow = undefined;
		});

		win.on('page-title-updated', function (e) {
			e.preventDefault();
		});

		if (is.development || app.getName().startsWith("local-")) {
			await win.loadURL("http://localhost:3000");
		} else if (app.getName().startsWith("staging-")) {
			await win.loadURL("https://dashboard-staging.teamviu.io");
		}
		else {
			await win.loadURL("https://dashboard.teamviu.io");
		}

		await win.maximize();

		return win;
	};

	app.on('second-instance', () => {
		if (mainWindow) {
			if (mainWindow.isMinimized()) {
				mainWindow.restore();
			}

			mainWindow.show();
		}
	});

	app.on('window-all-closed', () => {
		if (!is.macos) {
			app.quit();
			tray.destroy();
		}
	});

	app.on('activate', async () => {
		if (!mainWindow) {
			mainWindow = await createMainWindow();
		}
	});
	process.applyEventListeners();

	(async () => {
		await app.whenReady();
		Menu.setApplicationMenu(menu);
		tray.createTray(mainWindow);
		mainWindow = await createMainWindow();
		updator.checkForUpdate();
	})();
}
