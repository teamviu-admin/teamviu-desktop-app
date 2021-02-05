const {app, } = require('electron');
const dbService = require('./dbService');
const axios = require('axios');
const {is} = require('electron-util');
const log = require('electron-log');
const {API, BASE_URL} = require('./config');


module.exports.doSync = doSync;

function doSync() {
	if (!axios.defaults.headers.common.Authorization) {
		log.info("Auth header not set");
		return;
	}
	doSyncActivites();
	doSyncStates();
}

function doSyncActivites() {
	log.info("sync-activities");
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
				"topic": activity.topic
			});
		}
		axios.post(API + '/sync', transformedActivityDtos)
			.then((response) => {
				if (response.data.status === 1) {
					let savedActivities = response.data.body;
					for (let activity of savedActivities) {
						if (activity.remoteId) {
							dbService.activities.remove({_id: activity.localId});
						}
					}
				} else {
					log.error(response.data.error);
				}
			})
			.catch((error) => {
				log.error(error);
			});
	}).catch(function (err) {
		log.error(err);
	});
}

function doSyncStates() {
	log.info("sync-states");
	dbService.activityLevels.find({"remoteId": null}).sort({startAt: -1}).limit(10).then(function (states) {
		log.info("State Batch Picked" + states.length);
		let transformedStateDtos = [];
		for (let state of states) {
			transformedStateDtos.push({
				"localId": state._id,
				"sessionId": state.sessionId,
				"level": state.level,
				"startAt": state.startAt
			});
		}
		axios.post(API + '/sync/state', transformedStateDtos)
			.then((response) => {
				if (response.data.status === 1) {
					let savedStates = response.data.body;
					for (let state of savedStates) {
						if (state.remoteId) {
							dbService.activityLevels.remove({_id: state.localId});
						}
					}
				} else {
					log.error(response.data.error);
				}
			})
			.catch((error) => {
				log.error(error);
			});
	}).catch(function (err) {
		log.error(err);
	});
}
