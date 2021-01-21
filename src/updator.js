const {autoUpdater} = require('electron-updater');
const {is} = require('electron-util');
const log = require('electron-log');

module.exports.checkForUpdate = function () {
	// Uncomment this before publishing your first version.
// It's commented out as it throws an error if there are no published versions.
//https://github.com/iffy/electron-updater-example
	if (!is.development) {
		const FOUR_HOURS = 1000 * 60 * 60 * 4;
		setInterval(() => {
			try {
				log.info("Checking for updates");
				autoUpdater.checkForUpdates();
			} catch (err) {
				log.info(err && err.toString());
			}
		}, FOUR_HOURS);

		autoUpdater.checkForUpdates();
	}
};
