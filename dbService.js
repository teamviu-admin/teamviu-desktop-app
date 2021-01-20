// main/src/db.js
const {app} = require('electron');
const Datastore = require('nedb-promises');

//https://github.com/electron/electron/blob/master/docs/api/app.md#appgetpathname
//   ~/Library/Application Support/teamviu/data
const dbFactory = (fileName) => Datastore.create({
  filename: `${process.env.NODE_ENV === 'dev' ? '.' : app.getPath('userData')}/data/${fileName}`,
  timestampData: true,
  autoload: true
});

const db = {
  activities: dbFactory('activities.db')
};

//expire after 4 weeks
db.activities.ensureIndex({fieldName: 'createdAt', expireAfterSeconds: 2419200}, function (err) {
});

module.exports = db;
