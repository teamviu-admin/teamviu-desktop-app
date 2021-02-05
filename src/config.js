const {is} = require('electron-util');
const {app, ipcMain} = require('electron');
const axios = require('axios');
const log = require('electron-log');

let API = null;
let BASE_URL = null;
let AUTH_HEADER = null;

ipcMain.on('set-auth', (event, data) => {
	log.info("set-auth" + JSON.stringify(data));
	AUTH_HEADER = data.accessToken;
	axios.defaults.headers.common.Authorization = data.accessToken;
});

if (is.development || app.getName().startsWith("local-")) {
	API = "https://api.teamviu.io";
	BASE_URL = "https://dashboard.teamviu.io";
} else if (app.getName().startsWith("staging-")) {
	API = "https://api-staging.teamviu.io";
	BASE_URL = "https://dashboard-staging.teamviu.io";
}
else {
	API = "https://api.teamviu.io";
	BASE_URL = "https://dashboard.teamviu.io";
}

module.exports.API = API;
module.exports.BASE_URL = BASE_URL;
module.exports.AUTH_HEADER = AUTH_HEADER;
