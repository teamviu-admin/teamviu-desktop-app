// main/src/db.js
const {app} = require('electron');
const log = require('electron-log');
const Datastore = require('nedb-promises');

//https://github.com/electron/electron/blob/master/docs/api/app.md#appgetpathname
//   ~/Library/Application Support/teamviu/data
const dbFactory = function (fileName) {
	let dbFilePath = `${process.env.NODE_ENV === 'dev' ? '.' : app.getPath('userData')}/data/${fileName}`;
	log.info(dbFilePath);
	let datastore = Datastore.create({
		filename: dbFilePath,
		timestampData: true,
		autoload: true
	});
	return datastore;
};

const db = {
	activities: dbFactory('activities.db'),
	activityLevels: dbFactory('activityLevels.db')
};

//expire after 4 weeks
db.activities.load().then(function () {
	log.info("Applying index on activity.db");
	db.activities.ensureIndex({fieldName: 'createdAt', expireAfterSeconds: 2419200}, function (err) {
	});
});

db.activityLevels.load().then(function () {
	log.info("Applying index on activityLevels.db");
	db.activityLevels.ensureIndex({fieldName: 'createdAt', expireAfterSeconds: 2419200}, function (err) {
	});
});

module.exports = db;
