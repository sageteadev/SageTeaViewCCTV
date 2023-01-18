// Shinobi - DeepStack Face Recognition Plugin
// Copyright (C) 2021 Elad Bar
//
// Base Init >>
const { spawn } = require('child_process');
const fs = require('fs');
const request = require("request");
const moment = require('moment');
const config = require('./conf.json');

let s = null;

const {
		workerData
	} = require('worker_threads');

const isWorker = workerData && workerData.ok === true;
const pluginBasePath = isWorker ? "pluginWorkerBase.js" : "pluginBase.js";

for(let i = 0; i < 2; i++) {
    try {
		s = require(`../${pluginBasePath}`)(__dirname, config);

	} catch(err) {
		console.log(err);

        s = null;
	}
}

if(s === null) {
    console.log(config.plug, `Plugin start has failed. ${pluginBasePath} was not found.`);
} else {
    if(!isWorker) {
        const {
            haltMessage,
            checkStartTime,
            setStartTime,
        } = require('../pluginCheck.js');
    
        if(!checkStartTime()) {
            console.log(haltMessage, new Date());
            s.disconnectWebSocket();
        }
    
        setStartTime();
    }
}
// Base Init />>

let detectorSettings = null;

const DETECTOR_TYPE_FACE = 'face';
const DETECTOR_TYPE_OBJECT = 'object';

const FACE_UNKNOWN = 'unknown';
const DEEPSTACK_API_KEY = 'api_key';

const DETECTOR_CONFIGUTATION = {
    face: {
        detectEndpoint: '/vision/face/recognize',
        startupEndpoint: '/vision/face/list',
        key: 'userid'
    },
    object: {
        detectEndpoint: '/vision/detection',
        key: 'label'
    }
}

const PROTOCOLS = {
    true: "https",
    false: "http"
};

const log = (logger, message) => {
    logger(`${moment().format()} [${config.plug}] ${message}`);
}

const logError = (message) => {
    log(console.error, message);
};

const logWarn = (message) => {
    log(console.warn, message);
};

const logInfo = (message) => {
    log(console.info, message);
};

const logDebug = (message) => {
    log(console.debug, message);
};

const postMessage = (data) => {
    const message = JSON.stringify(data);

	logInfo(message);
};

const initialize = () => {
    const deepStackProtocol = PROTOCOLS[config.deepStack.isSSL];
    
    baseUrl = `${deepStackProtocol}://${config.deepStack.host}:${config.deepStack.port}/v1`;
    
    const detectionType = config.plug.split("-")[1].toLowerCase();
    const detectorConfig = DETECTOR_CONFIGUTATION[detectionType];
    const detectorConfigKeys = Object.keys(detectorConfig);
    
    detectorSettings = {
        type: detectionType,
        active: false,
        baseUrl: baseUrl,
        apiKey: config.deepStack.apiKey
	};

    if(detectionType === DETECTOR_TYPE_FACE) {
        detectorSettings["registeredPersons"] = config.persons === undefined ? [] : config.persons;
    }

	detectorConfigKeys.forEach(k => detectorSettings[k] = detectorConfig[k]);

    const testRequestData = getFormData(detectorSettings.detectEndpoint);
    
    request.post(testRequestData, (err, res, body) => {
        try {
            if(err) {
                throw err;
            }
            
            const response = JSON.parse(body);
                
            if(response.error) {
                detectorSettings.active = !response.error.endsWith('endpoint not activated');
            } else {
                detectorSettings.active = response.success;
            }

            const detectorSettingsKeys = Object.keys(detectorSettings);
			
			const pluginMessageHeader = [];
            pluginMessageHeader.push(`${config.plug} loaded`);

			const configMessage = detectorSettingsKeys.map(k => `${k}: ${detectorSettings[k]}`);

            const fullPluginMessage = pluginMessageHeader.concat(configMessage);

            const pluginMessage = fullPluginMessage.join(", ");

			logInfo(pluginMessage);

            if (detectorSettings.active) {
                s.detectObject = detectObject;

                if(detectionType === DETECTOR_TYPE_FACE) {
                    const requestData = getFormData(detectorSettings.startupEndpoint);
                    const requestTime = getCurrentTimestamp();
                    
                    request.post(requestData, (errStartup, resStartup, bodyStartup) => {
                        if (!!resStartup) {
                            resStartup.duration = getDuration(requestTime);
                        }

                        onFaceListResult(errStartup, resStartup, bodyStartup);
                    });
                }
            }            
        } catch(ex) {
            logError(`Failed to initialize ${config.plug} plugin, Error: ${ex}`)
        }
    });
};

const processImage = (frameBuffer, d, tx, frameLocation, callback) => {
	if(!detectorSettings.active) {
        return;
    }

    try{
        const imageStream = fs.createReadStream(frameLocation);
        
        const form = {
			image: imageStream,
            min_confidence: 0.7
		};
		
		const requestData = getFormData(detectorSettings.detectEndpoint, form);
		
        const requestTime = getCurrentTimestamp();

		request.post(requestData, (err, res, body) => {
            if (!!res) {
                res.duration = getDuration(requestTime);
            }

            onImageProcessed(d, tx, err, res, body, frameBuffer);

            fs.unlinkSync(frameLocation);
		});        
	}catch(ex){
		logError(`Failed to process image, Error: ${ex}`);

        if(fs.existsSync(frameLocation)) {
            fs.unlinkSync(frameLocation);
        }
	}

	callback();
};

const detectObject = (frameBuffer, d, tx, frameLocation, callback) => {
	if(!detectorSettings.active) {
        return;
    }

    const dirCreationOptions = {
        recursive: true
    };

    d.dir = `${s.dir.streams}${d.ke}/${d.id}/`;
    
    const filePath = `${d.dir}${s.gid(5)}.jpg`;

    if(!fs.existsSync(d.dir)) {
        fs.mkdirSync(d.dir, dirCreationOptions);
    }
    
    fs.writeFile(filePath, frameBuffer, function(err) {
        if(err) {
            return s.systemLog(err);
        }
    
        try {
            processImage(frameBuffer, d, tx, filePath, callback);

        } catch(ex) {
            logError(`Detector failed to parse frame, Error: ${ex}`);
        }
    });
};

const getCurrentTimestamp = () => {
    const currentTime = new Date();
    const currentTimestamp = currentTime.getTime();

    return currentTimestamp
};

const getDuration = (requestTime) => {
    const currentTime = new Date();
    const currentTimestamp = currentTime.getTime();

    const duration = currentTimestamp - requestTime;

    return duration;
};

const onFaceListResult = (err, res, body) => {
    const duration = !!res ? res.duration : 0;

    try {
        const response = JSON.parse(body);

        const success = response.success;
        const facesArr = response.faces;
        const faceStr = facesArr.join(",");

        if(success) {
            logInfo(`DeepStack loaded with the following faces: ${faceStr}, Response time: ${duration} ms`);
        } else {
            logWarn(`Failed to connect to DeepStack server, Error: ${err}, Response time: ${duration} ms`);
        }
    } catch(ex) {
        logError(`Error while connecting to DeepStack server, Error: ${ex} | ${err}, Response time: ${duration} ms`);
    }
};

const onImageProcessed = (d, tx, err, res, body, frameBuffer) => {
    const duration = !!res ? res.duration : 0;

    let objects = [];
    
    try {
        if(err) {
            throw err;
        }
        
        const response = JSON.parse(body);

        const success = response.success;

        if(success) {
            const predictions = response.predictions;
    
            if(predictions !== null && predictions.length > 0) {
                objects = predictions.map(p => getDeepStackObject(p)).filter(p => !!p);

                if(objects.length > 0) {
                    const identified = objects.filter(p => p.tag !== FACE_UNKNOWN);
                    const unknownCount = objects.length - identified.length;
                    
                    if(unknownCount > 0) {
                        logInfo(`${d.id} detected ${unknownCount} unknown ${detectorSettings.type}s, Response time: ${duration} ms`);
                    }

                    if(identified.length > 0) {
                        const detectedObjectsStrArr = [];

                        if (detectorSettings.type === DETECTOR_TYPE_FACE) {
                            identified.forEach(f => detectedObjectsStrArr.push(`${f.tag} (${f.person}) [${(f.confidence * 100).toFixed(2)}]`));
                        } else {
                            identified.forEach(f => detectedObjectsStrArr.push(`${f.tag} [${(f.confidence * 100).toFixed(2)}]`));
                        }
                        
                        const detectedObjectsStr = detectedObjectsStrArr.join(", ");

                        logInfo(`${d.id} detected ${detectorSettings.type}s: ${detectedObjectsStr}, Response time: ${duration} ms`);
                    }

                    const isObjectDetectionSeparate = d.mon.detector_pam === '1' && d.mon.detector_use_detect_object === '1';
                    const width = parseFloat(isObjectDetectionSeparate && d.mon.detector_scale_y_object ? d.mon.detector_scale_y_object : d.mon.detector_scale_y);
                    const height = parseFloat(isObjectDetectionSeparate && d.mon.detector_scale_x_object ? d.mon.detector_scale_x_object : d.mon.detector_scale_x);

                    const eventData = {
                        f: 'trigger',
                        id: d.id,
                        ke: d.ke,
                        details: {
                            plug: config.plug,
                            name: d.id,
                            reason: detectorSettings.type,
                            matrices: objects,
                            imgHeight: width,
                            imgWidth: height,
                            time: duration
                        },
                        frame: frameBuffer          
                    };

                    tx(eventData);
                }
            }
        }
    } catch(ex) {
        logError(`Error while processing image, Error: ${ex} | ${err},, Response time: ${duration} ms, Body: ${body}`);
    }

    return objects
};

const getFormData = (endpoint, additionalParameters) => {
    const formData = {};

    if(detectorSettings.apiKey) {
        formData[DEEPSTACK_API_KEY] = detectorSettings.apiKey;
    }

    if(additionalParameters !== undefined && additionalParameters !== null) {
        const keys = Object.keys(additionalParameters);

        keys.forEach(k => formData[k] = additionalParameters[k]);
    }

    const requestData = {
        url: `${detectorSettings.baseUrl}${endpoint}`,
        time: true,
        formData: formData
    };

    return requestData;
};

const getDeepStackObject = (prediction) => {
    if(prediction === undefined) {
        return null;
    }

    const tag = prediction[detectorSettings.key];

    const confidence = prediction.confidence ?? 0;
    const y_min = prediction.y_min ?? 0;
    const x_min = prediction.x_min ?? 0;
    const y_max = prediction.y_max ?? 0;
    const x_max = prediction.x_max ?? 0;
    const width = x_max - x_min;
    const height = y_max - y_min;

    const obj = {
        x: x_min,
        y: y_min,
        width: width,
        height: height,
        tag: tag,
        confidence: confidence
    };    

    if (detectorSettings.type === DETECTOR_TYPE_FACE) {
        const matchingPersons = detectorSettings.registeredPersons.filter(p => tag.startsWith(p))
        const person = matchingPersons.length > 0 ? matchingPersons[0] : null;

        obj["person"] = person;
    }
    

    return obj;
};

initialize();
