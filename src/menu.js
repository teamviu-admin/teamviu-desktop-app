'use strict';
const path = require('path');
const {app, Menu, shell} = require('electron');
const {
	is,
	appMenu,
	aboutMenuItem,
	openUrlMenuItem,
	openNewGitHubIssue,
	debugInfo
} = require('electron-util');
const version = app.getVersion();
const name = app.getName();

const showPreferences = () => {
	// Show the app's preferences here
};

const helpSubmenu = [
	openUrlMenuItem({
		label: 'Website',
		url: 'https://www.teamviu.io'
	}),
	openUrlMenuItem({
		label: 'Source Code',
		url: 'https://github.com/teamviu-admin/teamviu-desktop-app'
	}),
	{
		label: 'Report an Issue…',
		click() {
			const body = `
<!-- Please succinctly describe your issue and steps to reproduce it. -->


---

${debugInfo()}`;

			openNewGitHubIssue({
				user: 'teamviu-admin',
				repo: 'teamviu-desktop-app',
				body
			});
		}
	}, {
		type: 'separator'
	}, {
		label: 'Show App Data',
		click() {
			shell.openItem(app.getPath('userData'));
		}
	},
	{
		label: 'Delete App Data',
		click() {
			shell.moveItemToTrash(app.getPath('userData'));
			app.relaunch();
			app.quit();
		}
	},
	{
		type: 'separator'
	},
	{
		label: name + " Version " + version
	}
];

const macosTemplate = [
	{
		role: 'fileMenu',
		submenu: [
			{
				role: 'close'
			},
			{
				label: "Version " + version
			}
		]
	},
	{
		label: 'Refresh',
		submenu: [
			{
				role: 'reload'
			},
			{
				role: 'forceReload'
			},
			{
				role: 'toggleDevTools'
			}
		]
	},
	{
		role: 'help',
		submenu: helpSubmenu
	}
];

// Linux and Windows
const otherTemplate = [
	{
		role: 'fileMenu',
		submenu: [
			{
				role: 'quit'
			},
			{
				label: "Version " + version
			}
		]
	},
	{
		label: 'Refresh',
		submenu: [
			{
				role: 'reload'
			},
			{
				role: 'forceReload'
			},
			{
				role: 'toggleDevTools'
			}
		]
	},
	{
		role: 'help',
		submenu: helpSubmenu
	}
];

const template = process.platform === 'darwin' ? macosTemplate : otherTemplate;

module.exports = Menu.buildFromTemplate(template);
