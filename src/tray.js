const path = require('path');
const {app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, Notification, powerMonitor} = require('electron');

let tray = null;

let dullTrayIconPath = path.join(__dirname, '..', 'static', 'tray_bw.png');
let dullTrayIcon = nativeImage.createFromPath(dullTrayIconPath);
dullTrayIcon = dullTrayIcon.resize({
	width: 16,
	height: 16
});
let brightTrayIconPath = path.join(__dirname, '..', 'static', 'tray.png');
let brightTrayIcon = nativeImage.createFromPath(brightTrayIconPath);
brightTrayIcon = brightTrayIcon.resize({
	width: 16,
	height: 16
});

module.exports.createTray = function (mainWindow) {
	const trayMenu = Menu.buildFromTemplate([
		{
			label: 'Open',
			click: function () {
				if (mainWindow) {
					if (mainWindow.isMinimized()) {
						mainWindow.restore();
					}
					mainWindow.show();
				}
			}
		},
		{
			label: 'Quit',
			click: function () {
				app.quit();
			}
		}
	]);

	tray = new Tray(dullTrayIcon);
	tray.setContextMenu(trayMenu);
	tray.setToolTip(app.getName() + " Status : Not Working");
	tray.setIgnoreDoubleClickEvents(true);
};

module.exports.startWork = function () {
	tray.setImage(brightTrayIcon);
	tray.setToolTip(app.getName() + " Status : Working");
};

module.exports.stopWork = function () {
	tray.setImage(dullTrayIcon);
	tray.setToolTip(app.getName() + " Status : Not Working");
};

module.exports.destroy = function () {
	tray && tray.destroy();
};
