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
let newWindowDescriptor = null;

let currentState = 1;
let IDLE_THRESHOLD = 600;

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
				IDLE_THRESHOLD = appConfig.idle;
				log.info("IDLE_THRESHOLD" + IDLE_THRESHOLD);
			} else {
				log.error(response.data.error);
			}
		})
		.catch((error) => {
			log.error(error);
		});
}

function processWindowTitle() {
	if (newWindowDescriptor && currentWindowDescriptor && activeSessionId && sessionOrganizationId
		&& newWindowDescriptor.startedAt - currentWindowDescriptor.startedAt > 0) {
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
	let latestState = 1;
	if (powerMonitor.getSystemIdleTime() > IDLE_THRESHOLD) {
		latestState = 0;
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

function resetSession(data) {
	activeSessionId = data ? data.id : null;
	sessionOrganizationId = data ? data.orgId : null;
	currentWindowDescriptor = null;
	newWindowDescriptor = null;
}

module.exports.applyEventListeners = function () {
	//IPC EVENT HANDLERS
	//https://stackoverflow.com/questions/52236641/electron-ipc-and-nodeintegration

	ipcMain.on('start-work', (event, data) => {
		log.info("start-work" + JSON.stringify(data));
		resetSession(data);
		requestOSPermissionToTrackActivity();
		startMonitoring(function (win) {
			processIdleTime();
			if (!win) {
				return;
			}
			newWindowDescriptor = getWindowDescriptor(win);
			if (!currentWindowDescriptor) {
				currentWindowDescriptor = newWindowDescriptor;
			}
			if (newWindowDescriptor.title !== currentWindowDescriptor.title
				|| newWindowDescriptor.startedAt - currentWindowDescriptor.startedAt >= 1000 * IDLE_THRESHOLD) {
				processWindowTitle();
			}
		}, -1, 10);
		tray.startWork();
	});

	ipcMain.on('stop-work', (event, data) => {
		log.info("stop-work" + JSON.stringify(data));
		stopMonitoring();
		processWindowTitle();
		resetSession(null);
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
