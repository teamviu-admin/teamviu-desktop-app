/**
 https://github.com/electron-userland/electron-builder/blob/docs/encapsulated%20manual%20update%20via%20menu.js
 */
const {dialog} = require('electron');
const {autoUpdater} = require('electron-updater');
const log = require('electron-log');

function checkForUpdates() {
	log.info("Checking for updates");
	autoUpdater.checkForUpdates().then(function () {
		log.info("checkForUpdates successful");
	}).catch(function (err) {
		log.error(err && err.toString());
	});
}

module.exports.checkForUpdates = checkForUpdates;
