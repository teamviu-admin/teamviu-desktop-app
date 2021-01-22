const log = require('electron-log');
const dbService = require('./dbService');
const {app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, Notification, powerMonitor, dialog, systemPreferences} = require('electron');
const {is, openSystemPreferences} = require('electron-util');
const tray = require('./tray');
const {startMonitoring, stopMonitoring} = require("./monitor/monitor");

let activeSessionId = null;
let sessionOrganizationId = null;
let currentWindowDescriptor = null;

function getWindowDescriptor(win) {
	return {
		"title": win.title,
		"application": win.app,
		"startedAt": Date.now()
	};
}

function processWindowTitle(win) {
	if (!win) {
		return;
	}
	let newWindowDescriptor = getWindowDescriptor(win);
	if (!currentWindowDescriptor) {
		currentWindowDescriptor = newWindowDescriptor;
	}
	if (newWindowDescriptor.title !== currentWindowDescriptor.title && activeSessionId && sessionOrganizationId) {
		dbService.activities.insert({
			"remoteId": null,
			"title": currentWindowDescriptor.title,
			"appName": currentWindowDescriptor.application,
			"startAt": currentWindowDescriptor.startedAt,
			"endAt": newWindowDescriptor.startedAt,
			"sessionId": activeSessionId,
			"category": null,
			"subcategory": null,
			"topic": null,
			"orgId": sessionOrganizationId
		}).then(() => {
			log.info("Saved " + currentWindowDescriptor.title);
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
		requestOSPermissionToTrackActivity();
		startMonitoring(function (win) {
			log.info(powerMonitor.getSystemIdleTime());
			processWindowTitle(win);
		}, -1, 10);
		tray.startWork();
	});

	ipcMain.on('stop-work', (event, data) => {
		log.info("stop-work" + JSON.stringify(data));
		stopMonitoring();
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
};

function requestOSPermissionToTrackActivity() {
	if (!doesHavePermissions()) {
		dialog.showMessageBox({
			type: 'question',
			message: `Allow Accessibility Permission For ${ app.getName()}`,
			detail: 'We need active window title and appname for deep work analysis. This is optional and you can continue working untracked.',
			buttons: ['Skip', 'Open System Preferences'],
			cancelId: 0,
			defaultId: 1
		}).then(function (result) {
			if (result.response === 1) openSystemPreferences('security', 'Privacy_Accessibility');
		});
	}
}

function doesHavePermissions() {
	if (is.macos && !systemPreferences.isTrustedAccessibilityClient(false)) {
		return false;
	}
	return true;
}
