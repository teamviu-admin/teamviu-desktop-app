const path = require('path');
const fs = require('fs');
const log = require('electron-log');

const config = getConfig();
exports.startMonitoring = startMonitoring;
exports.stopMonitoring = stopMonitoring;
exports.isLastShellProcessActive = isLastShellProcessActive;

let shellScriptProcesses = [];

/**
 * Get the active window
 * @param {getActiveWindowCallback} callback - The callback that handles the response.
 * @param {integer} [repeats  = 1] - Number of repeats; Use -1 to infinity repeats
 * @param {float}   [interval = 0] - Loop interval in seconds. For milliseconds use fraction (0.1 = 100ms)
 */
function startMonitoring(callback, repeats, interval) {
	log.info("Get window now: " + new Date().toString());
	if (countRunningProcesses() > 0) {
		log.info("Already running shell processes: " + countRunningProcesses());
		return false;
	}
	const spawn = require('child_process').spawn;

	interval = (interval) ? interval : 0;
	repeats = (repeats) ? repeats : 1;

	// Scape negative number of repeats on Windows OS
	if (process.platform === 'win32' && repeats < 0) {
		repeats = '\\-1';
	}

	let parameters = config.parameters;
	parameters.push(repeats);
	parameters.push(interval);

	// Run shell script
	let shellScriptProcess = spawn(config.bin, parameters);
	shellScriptProcess.stdout.setEncoding('utf8');

	// Obtain successful response from script
	shellScriptProcess.stdout.on('data', function (stdout) {
		callback(reponseTreatment(stdout.toString()));
	});

	// Obtain error response from script
	shellScriptProcess.stderr.on('data', function (stderr) {
		log.error("Error from script: " + stderr.toString());
		throw stderr.toString()
	});

	shellScriptProcess.on('close', (code) => {
		log.info("Child process: " + shellScriptProcess.pid + " closed, code " + code);
	});

	shellScriptProcess.on('close', (code, signal) => {
		log.info("Child process: " + shellScriptProcess.pid + " closed: " + code);
	});
	shellScriptProcess.on('disconnect', () => {
		log.info("Child process: " + shellScriptProcess.pid + " disconnected");
	});
	shellScriptProcess.on('error', (err) => {
		log.info("Child process: " + shellScriptProcess.pid + " error: " + err ? err.toString() : "__");
	});
	shellScriptProcess.on('exit', (code, signal) => {
		log.info('debug', "Child process: " + shellScriptProcess.pid + " exited: " + code);
	});
	shellScriptProcess.on('message', (message, sendHandle) => {
		log.info('debug', "Child process: " + shellScriptProcess.pid + " received message: " + message);
	});

	log.info('debug', "Process id: " + shellScriptProcess.pid);
	shellScriptProcess.stdin.end();
	shellScriptProcesses.push(shellScriptProcess);
	return true;
}

function reponseTreatment(response) {
	let window = {};
	if (process.platform === 'linux') {
		response = response.replace(/(WM_CLASS|WM_NAME)(\(\w+\)\s=\s)/g, '').split('\n', 2);
		window.app = response[0];
		window.title = response[1];
	} else if (process.platform === 'win32') {
		response = response.replace(/(@{ProcessName=| AppTitle=)/g, '').slice(0, -1).split(';', 2);
		window.app = response[0];
		window.title = response[1];
	} else if (process.platform === 'darwin') {
		response = response.split(',');
		window.app = response[0];
		window.title = response[1].replace(/\n$/, '').replace(/^\s/, '')
		// if(response.length>2 && response[2]) window.error = response.slice(2).join(',')
	}
	return window;
}

/**
 * Get script config accordingly the operating system
 * @function getConfig
 */
function getConfig() {
	// Retrieve configs
	let configs = JSON.parse(fs.readFileSync(path.join(__dirname, 'configs.json'), 'utf8'));

	let config = null;
	switch (process.platform) {
		case 'linux':
		case 'linux2':
			config = configs.linux;
			break;
		case 'win32':
			config = configs.win32;
			break;
		case 'darwin':
			config = configs.mac;
			break;
		default:
			throw 'Operating System not supported yet. ' + process.platform
	}
	let pathToScripts = null;
	if (isFileReadable(path.join(process.resourcesPath, config.script_url))) {
		pathToScripts = process.resourcesPath;
		log.info('pathToScripts url is actually : ' + pathToScripts);
	} else {
		pathToScripts = __dirname;
		log.info('pathToScripts url is actually : ' + pathToScripts);
	}
	let script_url = path.join(pathToScripts, config.script_url);
	config.parameters.push(script_url);

	// Append directory to subscript url on OSX
	if (process.platform === 'darwin') {
		config.parameters.push(path.join(pathToScripts, config.subscript_url))
	}
	return config
}

function isFileReadable(url) {
	try {
		fs.accessSync(url, fs.R_OK)
		return true
	} catch (e) {
		return false
	}
}

function stopMonitoring() {
	log.info("Going to kill scripts");
	if (shellScriptProcesses && shellScriptProcesses.length > 0) {
		shellScriptProcesses = shellScriptProcesses.filter(function (proc) {
			log.info("going to kill the process :" + proc.pid);
			proc.kill();
			return false //removes process from array list
		});
	} else {
		log.info("Nothing to kill. Everything has been cleared already.");
	}
}

function countRunningProcesses() {
	return shellScriptProcesses.length;
}

function isLastShellProcessActive() {
	if (!shellScriptProcesses || shellScriptProcesses.length < 1) {
		return false;
	}
	try {
		let lastProcessId = shellScriptProcesses[shellScriptProcesses.length - 1].pid;
		if (!lastProcessId) return false;
		// Is last shell process id exists?
		process.kill(lastProcessId, 0);
		// 0 signal means, it won't actually kill but will throw error if process does not exists
		// Source: https://nodejs.org/api/process.html#process_process_kill_pid_signal
		return true;
	} catch (e) {
		return false;
	}
}
