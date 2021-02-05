const log = require('electron-log');
const dbService = require('./dbService');
const {app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, Notification, powerMonitor, dialog, systemPreferences} = require('electron');
const {is, openSystemPreferences} = require('electron-util');
const tray = require('./tray');
const {startMonitoring, stopMonitoring} = require("./monitor/monitor");
const axios = require('axios');
const {API, BASE_URL} = require('./config');

let activeSessionId = null;
let sessionOrganizationId = null;
let currentWindowDescriptor = null;
let idleStatus = "ACTIVE";

let currentState = null;
let DEEP_THRESHOLD = 180;
let SHALLOW_THRESHOLD = 600;

function getWindowDescriptor(win) {
	return {
		"title": win.title,
		"application": win.app,
		"startedAt": Date.now()
	};
}

function getConfig() {
	axios.get(API + '/metrics/app-config')
		.then((response) => {
			if (response.data.status === 1) {
				let appConfig = response.data.body;
				DEEP_THRESHOLD = appConfig.deep;
				SHALLOW_THRESHOLD = appConfig.shallow;
				log.info("DEEP_THRESHOLD" + DEEP_THRESHOLD);
				log.info("SHALLOW_THRESHOLD" + SHALLOW_THRESHOLD);
			} else {
				log.error(response.data.error);
			}
		})
		.catch((error) => {
			log.error(error);
		});
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

function processIdleTime() {
	let latestState = 0;
	if (powerMonitor.getSystemIdleTime() < DEEP_THRESHOLD) {
		latestState = 2;
	}
	else if (powerMonitor.getSystemIdleTime() < SHALLOW_THRESHOLD) {
		latestState = 1;
	}
	if (latestState !== currentState && latestState != null) {
		currentState = latestState;
		dbService.activityLevels.insert({
			"remoteId": null,
			"startAt": (new Date()).valueOf(),
			"sessionId": activeSessionId,
			"level": currentState
		}).then(() => {
			log.info("Saved State " + currentState);
		});
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
			processIdleTime();
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

	ipcMain.on('get-version', (event, data) => {
		log.info("get-version" + JSON.stringify(data));
		event.sender.send('get-version-result', app.getVersion());
	});

	getConfig();
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
