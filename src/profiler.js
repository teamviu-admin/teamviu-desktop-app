const {app} = require('electron');

module.exports.logPerformanceMetrics = logPerformanceMetrics;

function logPerformanceMetrics() {
	let total = {memory: 0, cpu: 0, maxMemory: 0};
	app.getAppMetrics().forEach(function (metric) {
		total.memory += metric.memory.workingSetSize / 1024;
		total.cpu += metric.cpu.percentCPUUsage;
		total.maxMemory += metric.memory.peakWorkingSetSize / 1024;
	});
	console.log(app.getAppMetrics().length + " processes || memory: " + total.memory + "MB || cpu:" + total.cpu + "% || maxMemory:" + total.maxMemory + "MB");
	return total;
}
