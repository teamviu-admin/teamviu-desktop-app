const log = require('electron-log');
const activeWin = require('active-win');
const dbService = require('./dbService');
const {app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, Notification, powerMonitor} = require('electron');
const tray = require('./tray');

let activeSessionId = null;
let sessionOrganizationId = null;
let activeWindowInterval = null;
let currentWindowDescriptor = null;

function getWindowDescriptor(win) {
	return {
		"title": win.title,
		"application": win.owner && win.owner.name,
		"url": win.url,
		"startedAt": Date.now()
	};
}

function processWindowTitle(win, forceSave) {
	if (!win) {
		return;
	}
	let newWindowDescriptor = getWindowDescriptor(win);
	if (!currentWindowDescriptor) {
		currentWindowDescriptor = newWindowDescriptor;
	}
	if (newWindowDescriptor.title !== currentWindowDescriptor.title && activeSessionId) {
		dbService.activities.insert({
			"remoteId": null,
			"title": currentWindowDescriptor.title,
			"appName": currentWindowDescriptor.application,
			"url": currentWindowDescriptor.url,
			"startAt": currentWindowDescriptor.startedAt,
			"endAt": newWindowDescriptor.startedAt,
			"sessionId": activeSessionId,
			"category": null,
			"subcategory": null,
			"topic": null,
			"orgId": sessionOrganizationId
		}).then(() => {
			log.info("Saved");
		});
		currentWindowDescriptor = newWindowDescriptor;
	}
}

module.exports.applyEventListeners = function () {
	//IPC EVENT HANDLERS
	//https://stackoverflow.com/questions/52236641/electron-ipc-and-nodeintegration

	ipcMain.on('start-work', (event, data) => {
		log.info("start-work" + JSON.stringify(data));
		activeSessionId = data.id;
		sessionOrganizationId = data.orgId;
		if (activeWindowInterval) {
			clearInterval(activeWindowInterval);
			activeWindowInterval = null;
		}
		activeWindowInterval = setInterval(function () {
			activeWin().then((win) => {
				processWindowTitle(win, false);
			}).catch((err) => {
				log.error(err && err.toString());
			});
		}, 5000);
		tray.startWork();
	});

	ipcMain.on('stop-work', (event, data) => {
		log.info("stop-work" + JSON.stringify(data));
		if (activeWindowInterval) {
			clearInterval(activeWindowInterval);
			activeWindowInterval = null;
		}
		activeWin().then((win) => {
			processWindowTitle(win, true);
		}).catch((err) => {
			log.error(err && err.toString());
		});
		activeSessionId = null;
		tray.stopWork();
	});

	ipcMain.on('notification', (event, data) => {
		log.info("notification" + JSON.stringify(data));
		if (Notification.isSupported()) {
			new Notification({title: data.title, subtitle: data.subtitle}).show();
		}
	});

	ipcMain.on('get-activities', (event, data) => {
		log.info("get-activities" + JSON.stringify(data));
		dbService.activities.find({"remoteId": null}).sort({startAt: -1}).limit(10).then(function (activities) {
			log.info("Activity Batch Picked" + activities.length);
			let transformedActivityDtos = [];
			for (let activity of activities) {
				transformedActivityDtos.push({
					"localId": activity._id,
					"title": activity.title,
					"appName": activity.appName,
					"url": activity.url,
					"startAt": activity.startAt,
					"endAt": activity.endAt,
					"sessionId": activity.sessionId,
					"category": activity.category,
					"subcategory": activity.subcategory,
					"topic": activity.topic,
					"orgId": activity.orgId
				});
			}
			event.sender.send('get-activities-result', transformedActivityDtos);
		}).catch(function (err) {
			event.sender.send('get-activities-result', []);
		});
	});

	ipcMain.on('update-activities', (event, savedActivityDtos) => {
		log.info("update-activities" + JSON.stringify(savedActivityDtos));
		for (let activity of savedActivityDtos) {
			if (activity.remoteId) {
				dbService.activities.delete({_id: activity.localId});
			}
		}
	});

	setInterval(function () {
		console.log(powerMonitor.getSystemIdleTime());
	}, 5 * 60000);
};
