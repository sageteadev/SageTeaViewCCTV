//
// Shinobi - Tensorflow Plugin
// Copyright (C) 2016-2025 Elad Bar, Moe Alam
//
// Base Init >>
const fs = require('fs');
const config = require('./conf.json')
const fetch = require('node-fetch');
const FormData = require('form-data');
var s
const {
		workerData
	} = require('worker_threads');

if(workerData && workerData.ok === true){
	try{
		s = require('../pluginWorkerBase.js')(__dirname,config)
	}catch(err){
		console.log(err)
		try{
			s = require('./pluginWorkerBase.js')(__dirname,config)
		}catch(err){
			console.log(err)
			return console.log(config.plug,'WORKER : Plugin start has failed. pluginBase.js was not found.')
		}
	}
}else{
	try{
		s = require('../pluginBase.js')(__dirname,config)
	}catch(err){
		console.log(err)
		try{
			s = require('./pluginBase.js')(__dirname,config)
		}catch(err){
			console.log(err)
			return console.log(config.plug,'Plugin start has failed. pluginBase.js was not found.')
		}
	}
	try{
		s = require('../pluginBase.js')(__dirname,config)
	}catch(err){
		console.log(err)
		try{
			const {
				haltMessage,
				checkStartTime,
				setStartTime,
			} = require('../pluginCheck.js')

			if(!checkStartTime()){
				console.log(haltMessage,new Date())
				s.disconnectWebSocket()
				return
			}
			setStartTime()
		}catch(err){
			console.log(`pluginCheck failed`)
		}
	}

}
// Base Init />>

const licensePlateRegion = config.licensePlateRegion || 'us'
const platerecognizerApiKey = config.platerecognizerApiKey || '111111111111111111'
if(!config.platerecognizerApiKey){
	console.log('No Plate Recognizer API Key set.')
	console.log('set conf.json value for `platerecognizerApiKey`')
	return process.exit()
}
const baseUrl = config.platerecognizerEndpoint || "https://api.platerecognizer.com/v1/plate-reader/"

function platerecognizerRequest(d,frameBuffer){
	return new Promise((resolve,reject) => {
		try{
			let body = new FormData();
			frameBufferToPath(d,frameBuffer).then((filePath) => {
				body.append('upload', fs.createReadStream(filePath));
				// Or body.append('upload', base64Image);
				body.append('regions', licensePlateRegion); // Change to your country
				fetch(baseUrl, {
			        method: 'POST',
			        headers: {
						"Authorization": `Token ${platerecognizerApiKey}`
			        },
			        body: body
			    }).then(res => res.json())
			    .then((json) => {
					let predictions = []
					try{
						const response = json || {results: []}
						predictions = response["results"] || []
					}catch(err){
						console.log(json)
						console.log(err)
						console.log(body)
					}
					resolve(predictions);
					fs.rm(filePath,function(){

					})
				})
			    .catch((err) => {
			        console.log(err);
			    });
			})
		}catch(err){
			resolve([])
			console.log(err)
		}
	})
}
function addVehicleMatrix(v,mats){
	const label = v.vehicle["type"]
	const confidence = v.vehicle["score"]
	const y_min = v.vehicle["ymin"]
	const x_min = v.vehicle["xmin"]
	const y_max = v.vehicle["ymax"]
	const x_max = v.vehicle["xmax"]
	const vehicleWidth = x_max - x_min
	const vehicleHeight = y_max - y_min
	mats.push({
		x: x_min,
		y: y_min,
		width: vehicleWidth,
		height: vehicleHeight,
		tag: label,
		confidence: confidence,
	})
}
function frameBufferToPath(d,buffer){
	return new Promise((resolve,reject) => {
		const tmpFile = s.gid(5)+'.jpg'
		if(!fs.existsSync(s.dir.streams)){
			fs.mkdirSync(s.dir.streams);
		}
		frameDirectory = s.dir.streams+d.ke+'/'+d.id+'/'
		fs.writeFile(frameDirectory+tmpFile,buffer,function(err){
			if(err) return s.systemLog(err);
			try{
				resolve(frameDirectory+tmpFile)
			}catch(error){
				console.error('Catch: ' + error);
			}
		})
	})
}
s.detectObject = async function(frameBuffer,d,tx,frameLocation,callback){
	const timeStart = new Date()
	const predictions = await platerecognizerRequest(d,frameBuffer)
	if(predictions.length > 0) {
		const mats = []
		predictions.forEach(function(v){
			const label = v["plate"]
			const confidence = v["score"]
			const y_min = v.box["ymin"]
			const x_min = v.box["xmin"]
			const y_max = v.box["ymax"]
			const x_max = v.box["xmax"]
			const width = x_max - x_min
			const height = y_max - y_min
			mats.push({
				x: x_min,
				y: y_min,
				width: width,
				height: height,
				tag: label,
				confidence: confidence,
			})
			addVehicleMatrix(v,mats)
		})
		const isObjectDetectionSeparate = d.mon.detector_pam === '1' && d.mon.detector_use_detect_object === '1'
		const width = parseFloat(isObjectDetectionSeparate  && d.mon.detector_scale_y_object ? d.mon.detector_scale_y_object : d.mon.detector_scale_y)
		const height = parseFloat(isObjectDetectionSeparate  && d.mon.detector_scale_x_object ? d.mon.detector_scale_x_object : d.mon.detector_scale_x)

		tx({
			f:'trigger',
			id:d.id,
			ke:d.ke,
			details:{
				plug: config.plug,
				name: `PlateRecognizer`,
				reason: 'object',
				matrices: mats,
				imgHeight: width,
				imgWidth: height,
			},
			frame: frameBuffer
		})
	}
	callback()
}
