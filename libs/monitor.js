var fs = require('fs');
var events = require('events');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var Mp4Frag = require('mp4frag');
var onvif = require('node-onvif');
var request = require('request');
var connectionTester = require('connection-tester')
var SoundDetection = require('shinobi-sound-detection')
var async = require("async");
var URL = require('url')
module.exports = function(s,config,lang){
    const startMonitorInQueue = async.queue(function(action, callback) {
        setTimeout(function(){
            action(callback)
        },2000)
    }, 1)
    s.initiateMonitorObject = function(e){
        if(!s.group[e.ke]){s.group[e.ke]={}};
        if(!s.group[e.ke].activeMonitors){s.group[e.ke].activeMonitors={}}
        if(!s.group[e.ke].activeMonitors[e.mid]){s.group[e.ke].activeMonitors[e.mid]={}}
        if(!s.group[e.ke].activeMonitors[e.mid].streamIn){s.group[e.ke].activeMonitors[e.mid].streamIn={}};
        if(!s.group[e.ke].activeMonitors[e.mid].emitterChannel){s.group[e.ke].activeMonitors[e.mid].emitterChannel={}};
        if(!s.group[e.ke].activeMonitors[e.mid].mp4frag){s.group[e.ke].activeMonitors[e.mid].mp4frag={}};
        if(!s.group[e.ke].activeMonitors[e.mid].firstStreamChunk){s.group[e.ke].activeMonitors[e.mid].firstStreamChunk={}};
        if(!s.group[e.ke].activeMonitors[e.mid].contentWriter){s.group[e.ke].activeMonitors[e.mid].contentWriter={}};
        if(!s.group[e.ke].activeMonitors[e.mid].childNodeStreamWriters){s.group[e.ke].activeMonitors[e.mid].childNodeStreamWriters={}};
        if(!s.group[e.ke].activeMonitors[e.mid].eventBasedRecording){s.group[e.ke].activeMonitors[e.mid].eventBasedRecording={}};
        if(!s.group[e.ke].activeMonitors[e.mid].watch){s.group[e.ke].activeMonitors[e.mid].watch={}};
        if(!s.group[e.ke].activeMonitors[e.mid].fixingVideos){s.group[e.ke].activeMonitors[e.mid].fixingVideos={}};
        // if(!s.group[e.ke].activeMonitors[e.mid].viewerConnection){s.group[e.ke].activeMonitors[e.mid].viewerConnection={}};
        // if(!s.group[e.ke].activeMonitors[e.mid].viewerConnectionCount){s.group[e.ke].activeMonitors[e.mid].viewerConnectionCount=0};
        if(!s.group[e.ke].activeMonitors[e.mid].parsedObjects){s.group[e.ke].activeMonitors[e.mid].parsedObjects={}};
        if(!s.group[e.ke].activeMonitors[e.mid].isStarted){s.group[e.ke].activeMonitors[e.mid].isStarted = false};
        if(s.group[e.ke].activeMonitors[e.mid].delete){clearTimeout(s.group[e.ke].activeMonitors[e.mid].delete)}
        if(!s.group[e.ke].rawMonitorConfigurations){s.group[e.ke].rawMonitorConfigurations={}}
        s.onMonitorInitExtensions.forEach(function(extender){
            extender(e)
        })
    }
    s.sendMonitorStatus = function(e){
        s.group[e.ke].activeMonitors[e.id].monitorStatus = e.status
        s.tx(Object.assign(e,{f:'monitor_status'}),'GRP_'+e.ke)
    }
    s.getMonitorCpuUsage = function(e,callback){
        if(s.group[e.ke].activeMonitors[e.mid] && s.group[e.ke].activeMonitors[e.mid].spawn){
            var getUsage = function(callback2){
                s.readFile("/proc/" + s.group[e.ke].activeMonitors[e.mid].spawn.pid + "/stat", function(err, data){
                    if(!err){
                        var elems = data.toString().split(' ');
                        var utime = parseInt(elems[13]);
                        var stime = parseInt(elems[14]);

                        callback2(utime + stime);
                    }else{
                        clearInterval(s.group[e.ke].activeMonitors[e.mid].getMonitorCpuUsage)
                    }
                })
            }
            getUsage(function(startTime){
                setTimeout(function(){
                    getUsage(function(endTime){
                        var delta = endTime - startTime;
                        var percentage = 100 * (delta / 10000);
                        callback(percentage)
                    });
                }, 1000)
            })
        }else{
            callback(0)
        }
    }
    s.buildMonitorUrl = function(e,noPath){
        var authd = ''
        var url
        if(e.details.muser&&e.details.muser!==''&&e.host.indexOf('@')===-1) {
            e.username = e.details.muser
            e.password = e.details.mpass
            authd = e.details.muser+':'+e.details.mpass+'@'
        }
        if(e.port==80&&e.details.port_force!=='1'){e.porty=''}else{e.porty=':'+e.port}
        url = e.protocol+'://'+authd+e.host+e.porty
        if(noPath !== true)url += e.path
        return url
    }
    s.cleanMonitorObjectForDatabase = function(dirtyMonitor){
        var cleanMonitor = {}
        var acceptedFields = ['mid','ke','name','shto','shfr','details','type','ext','protocol','host','path','port','fps','mode','width','height']
        Object.keys(dirtyMonitor).forEach(function(key){
            if(acceptedFields.indexOf(key) > -1){
                cleanMonitor[key] = dirtyMonitor[key]
            }
        })
        return cleanMonitor
    }
    s.cleanMonitorObject = function(e){
        x={keys:Object.keys(e),ar:{}};
        x.keys.forEach(function(v){
            if(v!=='last_frame'&&v!=='record'&&v!=='spawn'&&v!=='running'&&(v!=='time'&&typeof e[v]!=='function')){x.ar[v]=e[v];}
        });
        return x.ar;
    }
    s.getRawSnapshotFromMonitor = function(monitor,options,callback){
        if(!callback){
            callback = options
            var options = {flags: ''}
        }
        s.checkDetails(monitor)
        var inputOptions = []
        var outputOptions = []
        var streamDir = s.dir.streams + monitor.ke + '/' + monitor.mid + '/'
        var url = options.url
        var secondsInward = options.secondsInward || '0'
        if(secondsInward.length === 1)secondsInward = '0' + secondsInward
        if(options.flags)outputOptions.push(options.flags)
        const checkExists = function(streamDir,callback){
            s.fileStats(streamDir,function(err){
                var response = false
                if(err){
                    // s.debugLog(err)
                }else{
                    response = true
                }
                callback(response)
            })
        }
        const noIconChecks = function(){
            const runExtraction = function(){
                try{
                    var snapBuffer = []
                    var temporaryImageFile = streamDir + s.gid(5) + '.jpg'
                    var iconImageFile = streamDir + 'icon.jpg'
                    var ffmpegCmd = `-loglevel quiet -re -probesize 1000000 -analyzeduration 1000000 ${inputOptions.join(' ')} -i "${url}" ${outputOptions.join(' ')} -vframes 1 "${temporaryImageFile}"`
                    var snapProcess = spawn(config.ffmpegDir,s.splitForFFPMEG(ffmpegCmd),{detached: true})
                    snapProcess.stderr.on('data',function(data){
                        console.log(data.toString())
                    })
                    snapProcess.on('close',function(data){
                        clearTimeout(snapProcessTimeout)
                        fs.readFile(temporaryImageFile,function(err,buffer){
                            if(buffer){
                                if(options.useIcon === true){
                                    fs.writeFile(iconImageFile,buffer,function(){
                                        callback(buffer,false)
                                    })
                                }else{
                                    callback(buffer,false)
                                }
                            }else{
                                fs.readFile(config.defaultMjpeg,function(err,buffer){
                                    callback(buffer,false)
                                })
                            }
                            fs.unlink(temporaryImageFile,function(){})
                        })
                    })
                    var snapProcessTimeout = setTimeout(function(){
                        snapProcess.stdin.setEncoding('utf8')
                        snapProcess.stdin.write('q')
                        snapProcess.kill()
                    },30000)
                }catch(err){
                    fs.readFile(config.defaultMjpeg,function(err,buffer){
                        callback(buffer,false)
                    })
                }
            }
            if(url){
                runExtraction()
            }else{
                checkExists(streamDir + 's.jpg',function(success){
                    if(success === false){
                        checkExists(streamDir + 'detectorStream.m3u8',function(success){
                            if(success === false){
                                checkExists(streamDir + 's.m3u8',function(success){
                                    if(success === false){
                                        switch(monitor.type){
                                            case'h264':
                                                switch(monitor.protocol){
                                                    case'rtsp':
                                                        if(
                                                            monitor.details.rtsp_transport
                                                            && monitor.details.rtsp_transport !== ''
                                                            && monitor.details.rtsp_transport !== 'no'
                                                        ){
                                                            inputOptions.push('-rtsp_transport ' + monitor.details.rtsp_transport)
                                                        }
                                                    break;
                                                }
                                            break;
                                        }
                                        url = s.buildMonitorUrl(monitor)
                                    }else{
                                        outputOptions.push(`-ss 00:00:${secondsInward}`)
                                        url = streamDir + 's.m3u8'
                                    }
                                    runExtraction()
                                })
                            }else{
                                outputOptions.push(`-ss 00:00:${secondsInward}`)
                                url = streamDir + 'detectorStream.m3u8'
                                runExtraction()
                            }
                        })
                    }else{
                        s.readFile(streamDir + 's.jpg',function(err,snapBuffer){
                            callback(snapBuffer,true)
                        })
                    }
                })
            }
        }
        if(options.useIcon === true){
            checkExists(streamDir + 'icon.jpg',function(success){
                if(success === false){
                    noIconChecks()
                }else{
                    s.readFile(streamDir + 'icon.jpg',function(err,snapBuffer){
                        callback(snapBuffer,true)
                    })
                }
            })
        }else{
            noIconChecks()
        }
    }
    s.mergeDetectorBufferChunks = function(monitor,callback){
        var pathDir = s.dir.streams+monitor.ke+'/'+monitor.id+'/'
        var mergedFile = s.formattedTime()+'.mp4'
        var mergedFilepath = pathDir+mergedFile
        fs.readdir(pathDir,function(err,streamDirItems){
            var items = []
            var copiedItems = []
            var videoLength = s.group[monitor.ke].rawMonitorConfigurations[monitor.id].details.detector_send_video_length
            if(!videoLength || videoLength === '')videoLength = '10'
            if(videoLength.length === 1)videoLength = '0' + videoLength
            var createMerged = function(copiedItems){
                var allts = pathDir+items.join('_')
                s.fileStats(allts,function(err,stats){
                    if(err){
                        //not exist
                        var cat = 'cat '+copiedItems.join(' ')+' > '+allts
                        exec(cat,function(){
                            var merger = spawn(config.ffmpegDir,s.splitForFFPMEG(('-re -i '+allts+' -acodec copy -vcodec copy -t 00:00:' + videoLength + ' '+pathDir+mergedFile)))
                            merger.stderr.on('data',function(data){
                                s.userLog(monitor,{type:"Buffer Merge",msg:data.toString()})
                            })
                            merger.on('close',function(){
                                s.file('delete',allts)
                                copiedItems.forEach(function(copiedItem){
                                    s.file('delete',copiedItem)
                                })
                                setTimeout(function(){
                                    s.file('delete',mergedFilepath)
                                },1000 * 60 * 3)
                                delete(merger)
                                callback(mergedFilepath,mergedFile)
                            })
                        })
                    }else{
                        //file exist
                        callback(mergedFilepath,mergedFile)
                    }
                })
            }
            streamDirItems.forEach(function(filename){
                if(filename.indexOf('detectorStream') > -1 && filename.indexOf('.m3u8') === -1){
                    items.push(filename)
                }
            })
            items.sort()
            // items = items.slice(items.length - 5,items.length)
            items.forEach(function(filename){
                try{
                    var tempFilename = filename.split('.')
                    tempFilename[0] = tempFilename[0] + 'm'
                    tempFilename = tempFilename.join('.')
                    var tempWriteStream = fs.createWriteStream(pathDir+tempFilename)
                    tempWriteStream.on('finish', function(){
                        copiedItems.push(pathDir+tempFilename)
                        if(copiedItems.length === items.length){
                            createMerged(copiedItems.sort())
                        }
                    })
                    fs.createReadStream(pathDir+filename).pipe(tempWriteStream)
                }catch(err){

                }
            })
        })
    }
    s.mergeRecordedVideos = function(videoRows,groupKey,callback){
        var tempDir = s.dir.streams + groupKey + '/'
        var pathDir = s.dir.fileBin + groupKey + '/'
        var streamDirItems = fs.readdirSync(pathDir)
        var items = []
        var mergedFile = []
        videoRows.forEach(function(video){
            var filepath = s.getVideoDirectory(video) + s.formattedTime(video.time) + '.' + video.ext
            if(
                filepath.indexOf('.mp4') > -1
                // || filename.indexOf('.webm') > -1
            ){
                mergedFile.push(s.formattedTime(video.time))
                items.push(filepath)
            }
        })
        mergedFile.sort()
        mergedFile = mergedFile.join('_') + '.mp4'
        var mergedFilepath = pathDir + mergedFile
        var mergedRawFilepath = pathDir + 'raw_' + mergedFile
        items.sort()
        s.fileStats(mergedFilepath,function(err,stats){
            if(err){
                //not exist
                var tempScriptPath = tempDir + s.gid(5) + '.sh'
                var cat = 'cat '+items.join(' ')+' > '+mergedRawFilepath
                fs.writeFileSync(tempScriptPath,cat,'utf8')
                exec('sh ' + tempScriptPath,function(){
                    s.userLog({
                        ke: groupKey,
                        mid: '$USER'
                    },{type:lang['Videos Merge'],msg:mergedFile})
                    var merger = spawn(config.ffmpegDir,s.splitForFFPMEG(('-re -loglevel warning -i ' + mergedRawFilepath + ' -acodec copy -vcodec copy ' + mergedFilepath)))
                    merger.stderr.on('data',function(data){
                        s.userLog({
                            ke: groupKey,
                            mid: '$USER'
                        },{type:lang['Videos Merge'],msg:data.toString()})
                    })
                    merger.on('close',function(){
                        s.file('delete',mergedRawFilepath)
                        s.file('delete',tempScriptPath)
                        setTimeout(function(){
                            s.fileStats(mergedFilepath,function(err,stats){
                                if(!err)s.file('delete',mergedFilepath)
                            })
                        },1000 * 60 * 60 * 24)
                        delete(merger)
                        callback(mergedFilepath,mergedFile)
                    })
                })
            }else{
                //file exist
                callback(mergedFilepath,mergedFile)
            }
        })
        return items
    }

    s.cameraDestroy = function(x,e,p){
        if(s.group[e.ke]&&s.group[e.ke].activeMonitors[e.id]&&s.group[e.ke].activeMonitors[e.id].spawn !== undefined){
            if(s.group[e.ke].activeMonitors[e.id].spawn){
                s.group[e.ke].activeMonitors[e.id].allowStdinWrite = false
                s.txToDashcamUsers({
                    f : 'disable_stream',
                    ke : e.ke,
                    mid : e.id
                },e.ke)
                s.group[e.ke].activeMonitors[e.id].spawn.stdio[3].unpipe();
    //            if(s.group[e.ke].activeMonitors[e.id].p2pStream){s.group[e.ke].activeMonitors[e.id].p2pStream.unpipe();}
                if(s.group[e.ke].activeMonitors[e.id].p2p){s.group[e.ke].activeMonitors[e.id].p2p.unpipe();}
                delete(s.group[e.ke].activeMonitors[e.id].p2pStream)
                delete(s.group[e.ke].activeMonitors[e.id].p2p)
                delete(s.group[e.ke].activeMonitors[e.id].pamDiff)
                try{
                    s.group[e.ke].activeMonitors[e.id].spawn.removeListener('end',s.group[e.ke].activeMonitors[e.id].spawn_exit);
                    s.group[e.ke].activeMonitors[e.id].spawn.removeListener('exit',s.group[e.ke].activeMonitors[e.id].spawn_exit);
                    delete(s.group[e.ke].activeMonitors[e.id].spawn_exit);
                }catch(er){}
            }
            s.group[e.ke].activeMonitors[e.id].firstStreamChunk = {}
            clearTimeout(s.group[e.ke].activeMonitors[e.id].recordingChecker);
            delete(s.group[e.ke].activeMonitors[e.id].recordingChecker);
            clearTimeout(s.group[e.ke].activeMonitors[e.id].streamChecker);
            delete(s.group[e.ke].activeMonitors[e.id].streamChecker);
            clearTimeout(s.group[e.ke].activeMonitors[e.id].checkSnap);
            delete(s.group[e.ke].activeMonitors[e.id].checkSnap);
            clearTimeout(s.group[e.ke].activeMonitors[e.id].watchdog_stop);
            delete(s.group[e.ke].activeMonitors[e.id].watchdog_stop);
            delete(s.group[e.ke].activeMonitors[e.id].lastJpegDetectorFrame);
            delete(s.group[e.ke].activeMonitors[e.id].detectorFrameSaveBuffer);
            clearTimeout(s.group[e.ke].activeMonitors[e.id].recordingSnapper);
            clearInterval(s.group[e.ke].activeMonitors[e.id].getMonitorCpuUsage);
            if(s.group[e.ke].activeMonitors[e.id].onChildNodeExit){
                s.group[e.ke].activeMonitors[e.id].onChildNodeExit()
            }
            if(s.group[e.ke].activeMonitors[e.id].mp4frag){
                var mp4FragChannels = Object.keys(s.group[e.ke].activeMonitors[e.id].mp4frag)
                mp4FragChannels.forEach(function(channel){
                    s.group[e.ke].activeMonitors[e.id].mp4frag[channel].removeAllListeners()
                    delete(s.group[e.ke].activeMonitors[e.id].mp4frag[channel])
                })
            }
            if(config.childNodes.enabled === true && config.childNodes.mode === 'child' && config.childNodes.host){
                s.cx({f:'clearCameraFromActiveList',ke:e.ke,id:e.id})
            }
            if(s.group[e.ke].activeMonitors[e.id].childNode){
                s.cx({f:'kill',d:s.cleanMonitorObject(e)},s.group[e.ke].activeMonitors[e.id].childNodeId)
            }else{
                s.coSpawnClose(e)
                if(!x||x===1){return};
                p=x.pid;
                if(s.group[e.ke].rawMonitorConfigurations[e.id].type===('dashcam'||'socket'||'jpeg'||'pipe')){
                    x.stdin.pause();setTimeout(function(){x.kill('SIGTERM');},500)
                }else{
                    try{
                        x.stdin.setEncoding('utf8');x.stdin.write('q');
                    }catch(er){}
                }
                setTimeout(function(){exec('kill -9 '+p,{detached: true})},1000)
            }
        }
    }
    s.cameraCheckObjectsInDetails = function(e){
        //parse Objects
        (['detector_cascades','cords','detector_filters','input_map_choices']).forEach(function(v){
            if(e.details && e.details[v]){
                try{
                    if(!e.details[v] || e.details[v] === '')e.details[v] = '{}'
                    e.details[v] = s.parseJSON(e.details[v])
                    if(!e.details[v])e.details[v] = {}
                    s.group[e.ke].activeMonitors[e.id].details = e.details
                    switch(v){
                        case'cords':
                            s.group[e.ke].activeMonitors[e.id].parsedObjects[v] = Object.values(s.parseJSON(e.details[v]))
                        break;
                        default:
                            s.group[e.ke].activeMonitors[e.id].parsedObjects[v] = s.parseJSON(e.details[v])
                        break;
                    }
                }catch(err){

                }
            }
        });
        //parse Arrays
        (['stream_channels','input_maps']).forEach(function(v){
            if(e.details&&e.details[v]&&(e.details[v] instanceof Array)===false){
                try{
                    e.details[v]=JSON.parse(e.details[v]);
                    if(!e.details[v])e.details[v]=[];
                }catch(err){
                    e.details[v]=[];
                }
            }
        });
    }
    s.cameraControl = function(e,callback){
        s.checkDetails(e)
        if(!s.group[e.ke]||!s.group[e.ke].activeMonitors[e.id]){return}
        var monitorConfig = s.group[e.ke].rawMonitorConfigurations[e.id];
        if(monitorConfig.details.control!=="1"){s.userLog(e,{type:lang['Control Error'],msg:lang.ControlErrorText1});return}
        if(!monitorConfig.details.control_base_url||monitorConfig.details.control_base_url===''){
            e.base = s.buildMonitorUrl(monitorConfig, true);
        }else{
            e.base = monitorConfig.details.control_base_url;
        }
        if(!monitorConfig.details.control_url_stop_timeout || monitorConfig.details.control_url_stop_timeout === ''){
            monitorConfig.details.control_url_stop_timeout = 1000
        }
        if(!monitorConfig.details.control_url_method||monitorConfig.details.control_url_method===''){monitorConfig.details.control_url_method="GET"}
        var controlURL = e.base+monitorConfig.details['control_url_'+e.direction]
        var controlURLOptions = s.cameraControlOptionsFromUrl(controlURL,monitorConfig)
        if(monitorConfig.details.control_url_stop_timeout === '0' && monitorConfig.details.control_stop === '1' && s.group[e.ke].activeMonitors[e.id].ptzMoving === true){
            e.direction = 'stopMove'
            s.group[e.ke].activeMonitors[e.id].ptzMoving = false
        }else{
            s.group[e.ke].activeMonitors[e.id].ptzMoving = true
        }
        if(monitorConfig.details.control_url_method === 'ONVIF'){
            try{
                var move = function(device){
                    var stopOptions = {ProfileToken : device.current_profile.token,'PanTilt': true,'Zoom': true}
                    switch(e.direction){
                        case'center':
//                                device.services.ptz.gotoHomePosition()
                            msg = {type:'Center button inactive'}
                            s.userLog(e,msg)
                            callback(msg)
                        break;
                        case'stopMove':
                            msg = {type:'Control Trigger Ended'}
                            s.userLog(e,msg)
                            callback(msg)
                            device.services.ptz.stop(stopOptions).then((result) => {
//                                    console.log(JSON.stringify(result['data'], null, '  '));
                            }).catch((error) => {
//                                    console.error(error);
                            });
                        break;
                        default:
                            var controlOptions = {
                                ProfileToken : device.current_profile.token,
                                Velocity : {}
                            }
                            var onvifDirections = {
                                "left" : [-1.0,'x'],
                                "right" : [1.0,'x'],
                                "down" : [-1.0,'y'],
                                "up" : [1.0,'y'],
                                "zoom_in" : [1.0,'z'],
                                "zoom_out" : [-1.0,'z']
                            }
                            var direction = onvifDirections[e.direction]
                            controlOptions.Velocity[direction[1]] = direction[0];
                            (['x','y','z']).forEach(function(axis){
                                if(!controlOptions.Velocity[axis])
                                    controlOptions.Velocity[axis] = 0
                            })
                            if(monitorConfig.details.control_stop=='1'){
                                device.services.ptz.continuousMove(controlOptions).then(function(err){
                                    s.userLog(e,{type:'Control Trigger Started'});
                                    if(monitorConfig.details.control_url_stop_timeout !== '0'){
                                        setTimeout(function(){
                                            msg = {type:'Control Trigger Ended'}
                                            s.userLog(e,msg)
                                            callback(msg)
                                            device.services.ptz.stop(stopOptions).then((result) => {
//                                                    console.log(JSON.stringify(result['data'], null, '  '));
                                            }).catch((error) => {
                                                console.log(error);
                                            });
                                        },monitorConfig.details.control_url_stop_timeout)
                                    }
                                }).catch(function(err){
                                    console.log(err)
                                });
                            }else{
                                device.services.ptz.absoluteMove(controlOptions).then(function(err){
                                    msg = {type:'Control Triggered'}
                                    s.userLog(e,msg);
                                    callback(msg)
                                }).catch(function(err){
                                    console.log(err)
                                });
                            }
                        break;
                    }
                }
                //create onvif connection
                if(!s.group[e.ke].activeMonitors[e.id].onvifConnection || !s.group[e.ke].activeMonitors[e.id].onvifConnection.current_profile || !s.group[e.ke].activeMonitors[e.id].onvifConnection.current_profile.token){
                    s.group[e.ke].activeMonitors[e.id].onvifConnection = new onvif.OnvifDevice({
                        xaddr : 'http://' + controlURLOptions.host + ':' + controlURLOptions.port + '/onvif/device_service',
                        user : controlURLOptions.username,
                        pass : controlURLOptions.password
                    })
                    s.group[e.ke].activeMonitors[e.id].onvifConnection.init().then((info) => {
                        move(s.group[e.ke].activeMonitors[e.id].onvifConnection)
                    }).catch(function(error){
                        console.log(error)
                        s.userLog(e,{type:lang['Control Error'],msg:error})
                    })
                }else{
                    move(s.group[e.ke].activeMonitors[e.id].onvifConnection)
                }
            }catch(err){
                console.log(err)
                msg = {type:lang['Control Error'],msg:{msg:lang.ControlErrorText2,error:err,options:controlURLOptions,direction:e.direction}}
                s.userLog(e,msg)
                callback(msg)
            }
        }else{
            var stopCamera = function(){
                var stopURL = e.base+monitorConfig.details['control_url_'+e.direction+'_stop']
                var options = s.cameraControlOptionsFromUrl(stopURL,monitorConfig)
                var requestOptions = {
                    url : stopURL,
                    method : options.method,
                    auth : {
                        user : options.username,
                        pass : options.password
                    }
                }
                if(monitorConfig.details.control_digest_auth === '1'){
                    requestOptions.sendImmediately = true
                }
                request(requestOptions,function(err,data){
                    if(err){
                        msg = {ok:false,type:'Control Error',msg:err}
                    }else{
                        msg = {ok:true,type:'Control Trigger Ended'}
                    }
                    callback(msg)
                    s.userLog(e,msg);
                })
            }
            if(e.direction === 'stopMove'){
                stopCamera()
            }else{
                var requestOptions = {
                    url: controlURL,
                    method: controlURLOptions.method,
                    auth: {
                        user: controlURLOptions.username,
                        pass: controlURLOptions.password
                    }
                }
                if(monitorConfig.details.control_digest_auth === '1'){
                    requestOptions.sendImmediately = true
                }
                request(requestOptions,function(err,data){
                    if(err){
                        msg = {ok:false,type:'Control Error',msg:err};
                        callback(msg)
                        s.userLog(e,msg);
                        return
                    }
                    if(monitorConfig.details.control_stop=='1'&&e.direction!=='center'){
                        s.userLog(e,{type:'Control Triggered Started'});
                        if(monitorConfig.details.control_url_stop_timeout > 0){
                            setTimeout(function(){
                                stopCamera()
                            },monitorConfig.details.control_url_stop_timeout)
                        }
                    }else{
                        msg = {ok:true,type:'Control Triggered'};
                        callback(msg)
                        s.userLog(e,msg);
                    }
                })
            }
        }
    }
    s.cameraControlOptionsFromUrl = function(e,monitorConfig){
        s.checkDetails(e)
        URLobject = URL.parse(e)
        if(monitorConfig.details.control_url_method === 'ONVIF' && monitorConfig.details.control_base_url === ''){
            if(monitorConfig.details.onvif_port === ''){
                monitorConfig.details.onvif_port = 8000
            }
            URLobject.port = monitorConfig.details.onvif_port
        }else if(!URLobject.port){
            URLobject.port = 80
        }
        options = {
            host: URLobject.hostname,
            port: URLobject.port,
            method: monitorConfig.details.control_url_method,
            path: URLobject.pathname,
        };
        if(URLobject.query){
            options.path=options.path+'?'+URLobject.query
        }
        if(URLobject.username&&URLobject.password){
            options.username = URLobject.username
            options.password = URLobject.password
            options.auth=URLobject.username+':'+URLobject.password
        }else if(URLobject.auth){
            var auth = URLobject.auth.split(':')
            options.auth=URLobject.auth
            options.username = auth[0]
            options.password = auth[1]
        }
        return options
    }
    s.cameraSendSnapshot = function(e,options){
        if(!options)options = {}
        s.checkDetails(e)
        if(config.doSnapshot === true){
            if(e.mon.mode !== 'stop'){
                var pathDir = s.dir.streams+e.ke+'/'+e.mid+'/'
                s.getRawSnapshotFromMonitor(e.mon,Object.assign({
                    flags: '-s 200x200'
                },options),function(data,isStaticFile){
                    if(data && (data[data.length-2] === 0xFF && data[data.length-1] === 0xD9)){
                        s.tx({
                            f: 'monitor_snapshot',
                            snapshot: data.toString('base64'),
                            snapshot_format: 'b64',
                            mid: e.mid,
                            ke: e.ke
                        },'GRP_'+e.ke)
                    }else{
                        s.tx({f:'monitor_snapshot',snapshot:e.mon.name,snapshot_format:'plc',mid:e.mid,ke:e.ke},'GRP_'+e.ke)
                   }
                })
            }else{
                s.tx({f:'monitor_snapshot',snapshot:'Disabled',snapshot_format:'plc',mid:e.mid,ke:e.ke},'GRP_'+e.ke)
            }
        }else{
            s.tx({f:'monitor_snapshot',snapshot:e.mon.name,snapshot_format:'plc',mid:e.mid,ke:e.ke},'GRP_'+e.ke)
        }
    }
    var createRecordingDirectory = function(e,callback){
        var directory
        if(e.details && e.details.dir && e.details.dir !== '' && config.childNodes.mode !== 'child'){
            //addStorage choice
            directory = s.checkCorrectPathEnding(e.details.dir) + e.ke + '/'
            fs.mkdir(directory,function(err){
                s.handleFolderError(err)
                directory = directory + e.id + '/'
                fs.mkdir(directory,function(err){
                    s.handleFolderError(err)
                    callback(err,directory)
                })
            })
        }else{
            //MAIN videos dir
            directory = s.dir.videos + e.ke + '/'
            fs.mkdir(directory,function(err){
                s.handleFolderError(err)
                directory = s.dir.videos + e.ke + '/' + e.id + '/'
                fs.mkdir(directory,function(err){
                    s.handleFolderError(err)
                    callback(err,directory)
                })
            })
        }
    }
    var createTimelapseDirectory = function(e,callback){
        var directory = s.getTimelapseFrameDirectory(e)
        fs.mkdir(directory,function(err){
            s.handleFolderError(err)
            callback(err,directory)
        })
    }
    var createFileBinDirectory = function(e,callback){
        var directory = s.dir.fileBin + e.ke + '/'
        fs.mkdir(directory,function(err){
            s.handleFolderError(err)
            directory = s.dir.fileBin + e.ke + '/' + e.id + '/'
            fs.mkdir(directory,function(err){
                s.handleFolderError(err)
                callback(err,directory)
            })
        })
    }
    var createStreamDirectory = function(e,callback){
        callback = callback || function(){}
        var directory = s.dir.streams + e.ke + '/'
        fs.mkdir(directory,function(err){
            directory = s.dir.streams + e.ke + '/' + e.id + '/'
            s.handleFolderError(err)
            fs.mkdir(directory,function(err){
                if (err){
                    s.handleFolderError(err)
                    s.file('deleteFolder',directory + '*',function(err){
                        callback(err,directory)
                    })
                }else{
                    callback(err,directory)
                }
            })
        })
    }
    var createCameraFolders = function(e,callback){
        //set the recording directory
        createStreamDirectory(e,function(err,directory){
            e.sdir = directory
            createRecordingDirectory(e,function(err,directory){
                e.dir = directory
                createTimelapseDirectory(e,function(err,directory){
                    e.dirTimelapse = directory
                    createFileBinDirectory(e,function(err){
                        if(callback)callback()
                    })
                })
            })
        })
    }
    s.stripAuthFromHost = function(e){
        var host = e.host.split('@');
        if(host[1]){
            //username and password found
            host = host[1]
        }else{
            //no username or password in `host` string
            host = host[0]
        }
        return host
    }
    s.resetRecordingCheck = function(e){
        clearTimeout(s.group[e.ke].activeMonitors[e.id].recordingChecker)
        var cutoff = e.cutoff + 0
        if(e.type === 'dashcam'){
            cutoff *= 100
        }
        s.group[e.ke].activeMonitors[e.id].recordingChecker = setTimeout(function(){
            if(s.group[e.ke].activeMonitors[e.id].isStarted === true && s.group[e.ke].rawMonitorConfigurations[e.id].mode === 'record'){
                s.launchMonitorProcesses(s.cleanMonitorObject(e));
                s.sendMonitorStatus({id:e.id,ke:e.ke,status:lang.Restarting});
                s.userLog(e,{type:lang['Camera is not recording'],msg:{msg:lang['Restarting Process']}});
                s.orphanedVideoCheck(e,2,null,true)
            }
        },60000 * cutoff * 1.3);
    }
    s.resetStreamCheck = function(e){
        clearTimeout(s.group[e.ke].activeMonitors[e.id].streamChecker)
        s.group[e.ke].activeMonitors[e.id].streamChecker = setTimeout(function(){
            if(s.group[e.ke].activeMonitors[e.id] && s.group[e.ke].activeMonitors[e.id].isStarted === true){
                s.launchMonitorProcesses(s.cleanMonitorObject(e));
                s.userLog(e,{type:lang['Camera is not streaming'],msg:{msg:lang['Restarting Process']}});
                s.orphanedVideoCheck(e,2,null,true)
            }
        },60000*1);
    }
    s.cameraPullJpegStream = function(e){
        if(!e.details.sfps||e.details.sfps===''){
            e.details.sfps = 1
        }
        var capture_fps = parseFloat(e.details.sfps);
        if(isNaN(capture_fps)){capture_fps = 1}
        if(s.group[e.ke].activeMonitors[e.id].spawn){
            s.group[e.ke].activeMonitors[e.id].spawn.stdin.on('error',function(err){
                if(err&&e.details.loglevel!=='quiet'){
                    s.userLog(e,{type:'STDIN ERROR',msg:err});
                }
            })
        }else{
            if(e.functionMode === 'record'){
                s.userLog(e,{type:lang.FFmpegCantStart,msg:lang.FFmpegCantStartText});
                return
            }
        }
        e.captureOne = function(f){
            s.group[e.ke].activeMonitors[e.id].recordingSnapRequest = request({
                url: e.url,
                method: 'GET',
                encoding: null,
                timeout: 15000
            },function(err,data){
                if(err){
                    return;
                }
            }).on('data',function(d){
                if(!e.buffer0){
                    e.buffer0 = [d]
                }else{
                    e.buffer0.push(d)
                }
                if((d[d.length-2] === 0xFF && d[d.length-1] === 0xD9)){
                    e.buffer0 = Buffer.concat(e.buffer0);
                  if(s.group[e.ke].activeMonitors[e.id].spawn&&s.group[e.ke].activeMonitors[e.id].spawn.stdin){
                      s.group[e.ke].activeMonitors[e.id].spawn.stdin.write(e.buffer0);
                  }
                  if(s.group[e.ke].activeMonitors[e.id].isStarted === true){
                      s.group[e.ke].activeMonitors[e.id].recordingSnapper = setTimeout(function(){
                          e.captureOne()
                      },1000/capture_fps)
                  }
                  e.buffer0 = null
                }
                if(!e.timeOut){
                    e.timeOut = setTimeout(function(){
                        e.errorCount = 0;
                        delete(e.timeOut)
                    },3000)
                }
            }).on('error', function(err){
                ++e.errorCount
                clearTimeout(e.timeOut)
                delete(e.timeOut)
                if(e.details.loglevel !== 'quiet'){
                    s.userLog(e,{
                        type: lang['JPEG Error'],
                        msg: {
                            msg: lang.JPEGErrorText,
                            info: err
                        }
                    });
                    switch(err.code){
                        case'ESOCKETTIMEDOUT':
                        case'ETIMEDOUT':
                            ++s.group[e.ke].activeMonitors[e.id].errorSocketTimeoutCount
                            if(
                                e.details.fatal_max !== 0 &&
                                s.group[e.ke].activeMonitors[e.id].errorSocketTimeoutCount > e.details.fatal_max
                            ){
                                s.userLog(e,{type:lang['Fatal Maximum Reached'],msg:{code:'ESOCKETTIMEDOUT',msg:lang.FatalMaximumReachedText}});
                                s.camera('stop',e)
                            }else{
                                s.userLog(e,{type:lang['Restarting Process'],msg:{code:'ESOCKETTIMEDOUT',msg:lang.FatalMaximumReachedText}});
                                s.camera('restart',e)
                            }
                            return;
                        break;
                    }
                }
                if(e.details.fatal_max !== 0 && e.errorCount > e.details.fatal_max){
                    clearTimeout(s.group[e.ke].activeMonitors[e.id].recordingSnapper)
                    s.launchMonitorProcesses(s.cleanMonitorObject(e))
                }
            })
        }
        e.captureOne()
    }
    var onDetectorJpegOutputAlone = function(e,d){
        s.ocvTx({
            f: 'frame',
            mon: s.group[e.ke].rawMonitorConfigurations[e.id].details,
            ke: e.ke,
            id: e.id,
            time: s.formattedTime(),
            frame: d
        })
    }
    var onDetectorJpegOutputSecondary = function(e,d){
        s.group[e.ke].activeMonitors[e.id].lastJpegDetectorFrame = d
    }
    s.onMonitorDetectorDataOutputAlone = onDetectorJpegOutputAlone
    s.onMonitorDetectorDataOutputSecondary = onDetectorJpegOutputSecondary
    s.createCameraFfmpegProcess = function(e){
        //launch ffmpeg (main)
        s.tx({
            f: 'monitor_starting',
            mode: e.functionMode,
            mid: e.id,
            time: s.formattedTime()
        },'GRP_'+e.ke)
        s.group[e.ke].activeMonitors[e.id].spawn = s.ffmpeg(e)
        s.sendMonitorStatus({id:e.id,ke:e.ke,status:e.wantedStatus});
        //on unexpected exit restart
        s.group[e.ke].activeMonitors[e.id].spawn_exit = function(){
            if(s.group[e.ke].activeMonitors[e.id].isStarted === true){
                if(e.details.loglevel!=='quiet'){
                    s.userLog(e,{type:lang['Process Unexpected Exit'],msg:{msg:lang['Process Crashed for Monitor'],cmd:s.group[e.ke].activeMonitors[e.id].ffmpeg}});
                }
                s.fatalCameraError(e,'Process Unexpected Exit');
                s.orphanedVideoCheck(e,2,null,true)
                s.onMonitorUnexpectedExitExtensions.forEach(function(extender){
                    extender(Object.assign(s.group[e.ke].rawMonitorConfigurations[e.id],{}),e)
                })
            }
        }
        s.group[e.ke].activeMonitors[e.id].spawn.on('end',s.group[e.ke].activeMonitors[e.id].spawn_exit)
        s.group[e.ke].activeMonitors[e.id].spawn.on('exit',s.group[e.ke].activeMonitors[e.id].spawn_exit)
        s.group[e.ke].activeMonitors[e.id].spawn.on('error',function(er){
            s.userLog(e,{type:'Spawn Error',msg:er});s.fatalCameraError(e,'Spawn Error')
        })
        s.userLog(e,{type:lang['Process Started'],msg:{cmd:s.group[e.ke].activeMonitors[e.id].ffmpeg}})
        if(s.isWin === false){
            var strippedHost = s.stripAuthFromHost(e)
            var sendProcessCpuUsage = function(){
                s.getMonitorCpuUsage(e,function(percent){
                    s.group[e.ke].activeMonitors[e.id].currentCpuUsage = percent
                    s.tx({
                        f: 'camera_cpu_usage',
                        ke: e.ke,
                        id: e.id,
                        percent: percent
                    },'MON_STREAM_'+e.ke+e.id)
                })
            }
            s.group[e.ke].activeMonitors[e.id].getMonitorCpuUsage = setInterval(function(){
                if(e.details.skip_ping !== '1'){
                    connectionTester.test(strippedHost,e.port,2000,function(err,response){
                        if(response.success){
                            sendProcessCpuUsage()
                        }else{
                            s.launchMonitorProcesses(e)
                        }
                    })
                }else{
                    sendProcessCpuUsage()
                }
            },1000 * 60)
        }
    }
    s.createCameraStreamHandlers = function(e){
        s.group[e.ke].activeMonitors[e.id].spawn.stdio[5].on('data',function(data){
            s.resetStreamCheck(e)
        })
        //emitter for mjpeg
        if(!e.details.stream_mjpeg_clients||e.details.stream_mjpeg_clients===''||isNaN(e.details.stream_mjpeg_clients)===false){e.details.stream_mjpeg_clients=20;}else{e.details.stream_mjpeg_clients=parseInt(e.details.stream_mjpeg_clients)}
        s.group[e.ke].activeMonitors[e.id].emitter = new events.EventEmitter().setMaxListeners(e.details.stream_mjpeg_clients);
        if(e.type==='jpeg'){
            s.cameraPullJpegStream(e)
        }
        if(e.details.detector_audio === '1'){
            var triggerLevel
            var triggerLevelMax
            if(e.details.detector_audio_min_db && e.details.detector_audio_min_db !== ''){
                triggerLevel = parseInt(e.details.detector_audio_min_db)
            }else{
                triggerLevel = 5
            }
            if(e.details.detector_audio_max_db && e.details.detector_audio_max_db !== ''){
                triggerLevelMax = parseInt(e.details.detector_audio_max_db)
            }
            var audioDetector = new SoundDetection({
                format: {
                    bitDepth: 16,
                    numberOfChannels: 1,
                    signed: true
                },
                triggerLevel: triggerLevel,
                triggerLevelMax: triggerLevelMax
            },function(dB) {
                s.triggerEvent({
                    f:'trigger',
                    id:e.id,
                    ke:e.ke,
                    name: 'db',
                    details:{
                        plug:'audio',
                        name:'db',
                        reason:'soundChange',
                        confidence:dB
                    },
                    plates:[],
                    imgHeight:e.details.detector_scale_y,
                    imgWidth:e.details.detector_scale_x
                })
            })
            s.group[e.ke].activeMonitors[e.id].audioDetector = audioDetector
            audioDetector.start()
            s.group[e.ke].activeMonitors[e.id].spawn.stdio[6].pipe(audioDetector.streamDecoder)
        }
        if(e.details.record_timelapse === '1'){
            s.group[e.ke].activeMonitors[e.id].spawn.stdio[7].on('data',function(data){
                var fileStream = s.group[e.ke].activeMonitors[e.id].recordTimelapseWriter
                if(!fileStream){
                    var currentDate = s.formattedTime(null,'YYYY-MM-DD')
                    var filename = s.formattedTime() + '.jpg'
                    var location = s.getTimelapseFrameDirectory(e) + currentDate + '/'
                    if(!fs.existsSync(location)){
                        fs.mkdirSync(location)
                    }
                    fileStream = fs.createWriteStream(location + filename)
                    fileStream.on('close', function () {
                        s.group[e.ke].activeMonitors[e.id].recordTimelapseWriter = null
                        s.createTimelapseFrameAndInsert(e,location,filename)
                    })
                    s.group[e.ke].activeMonitors[e.id].recordTimelapseWriter = fileStream
                }
                fileStream.write(data)
                clearTimeout(s.group[e.ke].activeMonitors[e.id].recordTimelapseWriterTimeout)
                s.group[e.ke].activeMonitors[e.id].recordTimelapseWriterTimeout = setTimeout(function(){
                    fileStream.end()
                },900)
            })
        }
        if(e.details.detector === '1' && e.coProcessor === false){
            s.ocvTx({f:'init_monitor',id:e.id,ke:e.ke})
            //frames from motion detect
            if(e.details.detector_pam === '1'){
               s.createPamDiffEngine(e)
               s.group[e.ke].activeMonitors[e.id].spawn.stdio[3].pipe(s.group[e.ke].activeMonitors[e.id].p2p).pipe(s.group[e.ke].activeMonitors[e.id].pamDiff)
                if(e.details.detector_use_detect_object === '1'){
                    s.group[e.ke].activeMonitors[e.id].spawn.stdio[4].on('data',function(data){
                        s.onMonitorDetectorDataOutputSecondary(e,data)
                    })
                }
            }else if(s.isAtleatOneDetectorPluginConnected){
                s.group[e.ke].activeMonitors[e.id].spawn.stdio[3].on('data',function(data){
                    s.onMonitorDetectorDataOutputAlone(e,data)
                })
            }
        }
        //frames to stream
       switch(e.details.stream_type){
           case'mp4':
               s.group[e.ke].activeMonitors[e.id].mp4frag['MAIN'] = new Mp4Frag()
               s.group[e.ke].activeMonitors[e.id].mp4frag['MAIN'].on('error',function(error){
                   s.userLog(e,{type:lang['Mp4Frag'],msg:{error:error}})
               })
               s.group[e.ke].activeMonitors[e.id].spawn.stdio[1].pipe(s.group[e.ke].activeMonitors[e.id].mp4frag['MAIN'])
           break;
           case'flv':
               e.frameToStream = function(d){
                   if(!s.group[e.ke].activeMonitors[e.id].firstStreamChunk['MAIN'])s.group[e.ke].activeMonitors[e.id].firstStreamChunk['MAIN'] = d;
                   e.frameToStream = function(d){
                       s.resetStreamCheck(e)
                       s.group[e.ke].activeMonitors[e.id].emitter.emit('data',d)
                   }
                   e.frameToStream(d)
               }
           break;
           case'mjpeg':
               e.frameToStream = function(d){
                   s.resetStreamCheck(e)
                   s.group[e.ke].activeMonitors[e.id].emitter.emit('data',d)
               }
           break;
           case'h265':
               e.frameToStream = function(d){
                   s.resetStreamCheck(e)
                   s.group[e.ke].activeMonitors[e.id].emitter.emit('data',d)
               }
           break;
           case'b64':case undefined:case null:case'':
               var buffer
               e.frameToStream = function(d){
                  s.resetStreamCheck(e)
                  if(!buffer){
                      buffer=[d]
                  }else{
                      buffer.push(d)
                  }
                  if((d[d.length-2] === 0xFF && d[d.length-1] === 0xD9)){
                      s.group[e.ke].activeMonitors[e.id].emitter.emit('data',Buffer.concat(buffer))
                      buffer = null
                  }
               }
           break;
        }
        if(e.frameToStream){
            if(e.coProcessor === true && e.details.stream_type === ('b64'||'mjpeg')){

            }else{
                s.group[e.ke].activeMonitors[e.id].spawn.stdout.on('data',e.frameToStream)
            }
        }
        if(e.details.stream_channels && e.details.stream_channels !== ''){
            var createStreamEmitter = function(channel,number){
                var pipeNumber = number+config.pipeAddition;
                if(!s.group[e.ke].activeMonitors[e.id].emitterChannel[pipeNumber]){
                    s.group[e.ke].activeMonitors[e.id].emitterChannel[pipeNumber] = new events.EventEmitter().setMaxListeners(0);
                }
               var frameToStream
               switch(channel.stream_type){
                   case'mp4':
                       s.group[e.ke].activeMonitors[e.id].mp4frag[pipeNumber] = new Mp4Frag();
                       s.group[e.ke].activeMonitors[e.id].spawn.stdio[pipeNumber].pipe(s.group[e.ke].activeMonitors[e.id].mp4frag[pipeNumber])
                   break;
                   case'mjpeg':
                       frameToStream = function(d){
                           s.group[e.ke].activeMonitors[e.id].emitterChannel[pipeNumber].emit('data',d)
                       }
                   break;
                   case'flv':
                       frameToStream = function(d){
                           if(!s.group[e.ke].activeMonitors[e.id].firstStreamChunk[pipeNumber])s.group[e.ke].activeMonitors[e.id].firstStreamChunk[pipeNumber] = d;
                           frameToStream = function(d){
                               s.group[e.ke].activeMonitors[e.id].emitterChannel[pipeNumber].emit('data',d)
                           }
                           frameToStream(d)
                       }
                   break;
                   case'h264':
                       frameToStream = function(d){
                           s.group[e.ke].activeMonitors[e.id].emitterChannel[pipeNumber].emit('data',d)
                       }
                   break;
                }
                if(frameToStream){
                    s.group[e.ke].activeMonitors[e.id].spawn.stdio[pipeNumber].on('data',frameToStream)
                }
            }
            e.details.stream_channels.forEach(createStreamEmitter)
        }
    }
    s.cameraFilterFfmpegLog = function(e){
        var checkLog = function(d,x){return d.indexOf(x)>-1}
        s.group[e.ke].activeMonitors[e.id].spawn.stderr.on('data',function(d){
            d=d.toString();
            switch(true){
                case checkLog(d,'No space left on device'):
                    s.checkUserPurgeLock(e.ke)
                    s.purgeDiskForGroup(e)
                break;
                case checkLog(d,'error while decoding'):
                    s.userLog(e,{type:lang['Error While Decoding'],msg:lang.ErrorWhileDecodingText});
                break;
                case checkLog(d,'[hls @'):
                case checkLog(d,'Past duration'):
                case checkLog(d,'Last message repeated'):
                case checkLog(d,'pkt->duration = 0'):
                case checkLog(d,'Non-monotonous DTS'):
                case checkLog(d,'NULL @'):
                case checkLog(d,'RTP: missed'):
                case checkLog(d,'deprecated pixel format used'):
                    return
                break;
                case checkLog(d,'Could not find tag for vp8'):
                case checkLog(d,'Only VP8 or VP9 Video'):
                case checkLog(d,'Could not write header'):
                    return s.userLog(e,{type:lang['Incorrect Settings Chosen'],msg:{msg:d}})
                break;
                case checkLog(d,'Connection refused'):
                case checkLog(d,'Connection timed out'):
                    //restart
                    setTimeout(function(){
                        s.userLog(e,{type:lang['Connection timed out'],msg:lang['Retrying...']});
                        s.fatalCameraError(e,'Connection timed out');
                    },1000)
                break;
                case checkLog(d,'Immediate exit requested'):
                case checkLog(d,'mjpeg_decode_dc'):
                case checkLog(d,'bad vlc'):
                case checkLog(d,'error dc'):
                case checkLog(d,'No route to host'):
                    s.launchMonitorProcesses(e)
                break;
                case /T[0-9][0-9]-[0-9][0-9]-[0-9][0-9]./.test(d):
                    var filename = d.split('.')[0].split(' [')[0].trim()+'.'+e.ext
                    s.insertCompletedVideo(e,{
                        file : filename
                    },function(err){
                        s.userLog(e,{type:lang['Video Finished'],msg:{filename:d}})
                        if(
                            e.details.detector === '1' &&
                            s.group[e.ke].activeMonitors[e.id].isStarted === true &&
                            e.details &&
                            e.details.detector_record_method === 'del'&&
                            e.details.detector_delete_motionless_videos === '1'&&
                            s.group[e.ke].activeMonitors[e.id].detector_motion_count === 0
                        ){
                            if(e.details.loglevel !== 'quiet'){
                                s.userLog(e,{type:lang['Delete Motionless Video'],msg:filename})
                            }
                            s.deleteVideo({
                                filename : filename,
                                ke : e.ke,
                                id : e.id
                            })
                        }
                        s.group[e.ke].activeMonitors[e.id].detector_motion_count = 0
                    })
                    s.resetRecordingCheck(e)
                    return;
                break;
            }
            s.userLog(e,{type:"FFMPEG STDERR",msg:d})
        })
    }
    //set master based process launcher
    s.launchMonitorProcesses = function(e){
        // e = monitor object
        //create host string without username and password
        var strippedHost = s.stripAuthFromHost(e)
        var doOnThisMachine = function(callback){
            createCameraFolders(e,function(){
                s.group[e.ke].activeMonitors[e.id].allowStdinWrite = false
                s.txToDashcamUsers({
                    f : 'disable_stream',
                    ke : e.ke,
                    mid : e.id
                },e.ke)
                if(e.details.detector_trigger === '1'){
                    s.group[e.ke].activeMonitors[e.id].motion_lock=setTimeout(function(){
                        clearTimeout(s.group[e.ke].activeMonitors[e.id].motion_lock);
                        delete(s.group[e.ke].activeMonitors[e.id].motion_lock);
                    },15000)
                }
                //start "no motion" checker
                if(e.details.detector === '1' && e.details.detector_notrigger === '1'){
                    if(!e.details.detector_notrigger_timeout || e.details.detector_notrigger_timeout === ''){
                        e.details.detector_notrigger_timeout = 10
                    }
                    e.detector_notrigger_timeout = parseFloat(e.details.detector_notrigger_timeout)*1000*60;
                    s.group[e.ke].activeMonitors[e.id].detector_notrigger_timeout_function = function(){
                        s.onDetectorNoTriggerTimeoutExtensions.forEach(function(extender){
                            extender(e)
                        })
                    }
                    clearInterval(s.group[e.ke].activeMonitors[e.id].detector_notrigger_timeout)
                    s.group[e.ke].activeMonitors[e.id].detector_notrigger_timeout=setInterval(s.group[e.ke].activeMonitors[e.id].detector_notrigger_timeout_function,s.group[e.ke].activeMonitors[e.id].detector_notrigger_timeout)
                }
                if(e.details.snap === '1'){
                    var resetSnapCheck = function(){
                        clearTimeout(s.group[e.ke].activeMonitors[e.id].checkSnap)
                        s.group[e.ke].activeMonitors[e.id].checkSnap = setTimeout(function(){
                            if(s.group[e.ke].activeMonitors[e.id].isStarted === true){
                                s.fileStats(e.sdir+'s.jpg',function(err,snap){
                                    var notStreaming = function(){
                                        if(e.coProcessor === true){
                                            s.coSpawnLauncher(e)
                                        }else{
                                            s.launchMonitorProcesses(e)
                                        }
                                        s.userLog(e,{type:lang['Camera is not streaming'],msg:{msg:lang['Restarting Process']}})
                                        s.orphanedVideoCheck(e,2,null,true)
                                    }
                                    if(err){
                                        notStreaming()
                                    }else{
                                        if(!e.checkSnapTime)e.checkSnapTime = snap.mtime
                                        if(err || e.checkSnapTime === snap.mtime){
                                            e.checkSnapTime = snap.mtime
                                            notStreaming()
                                        }else{
                                            resetSnapCheck()
                                        }
                                    }
                                })
                            }
                        },60000*1);
                    }
                    resetSnapCheck()
                }
                if(config.childNodes.mode !== 'child' && s.platform!=='darwin' && (e.functionMode === 'record' || (e.functionMode === 'start'&&e.details.detector_record_method==='sip'))){
                    //check if ffmpeg is recording
                    s.group[e.ke].activeMonitors[e.id].fswatch = fs.watch(e.dir, {encoding : 'utf8'}, (event, filename) => {
                        switch(event){
                            case'change':
                                s.resetRecordingCheck(e)
                            break;
                        }
                    });
                }
                if(
                    //is MacOS
                    s.platform !== 'darwin' &&
                    //is Watch-Only or Record
                    (e.functionMode === 'start' || e.functionMode === 'record') &&
                    //if JPEG API enabled or Stream Type is HLS
                    (
                        e.details.stream_type === 'jpeg' ||
                        e.details.stream_type === 'hls' ||
                        e.details.snap === '1'
                    )
                ){
                    s.group[e.ke].activeMonitors[e.id].fswatchStream = fs.watch(e.sdir, {encoding : 'utf8'}, () => {
                        s.resetStreamCheck(e)
                    })
                }
                s.cameraSendSnapshot({mid:e.id,ke:e.ke,mon:e},{useIcon: true})
                //check host to see if has password and user in it
                clearTimeout(s.group[e.ke].activeMonitors[e.id].recordingChecker)
                if(s.group[e.ke].activeMonitors[e.id].isStarted === true){
                    e.errorCount = 0;
                    s.group[e.ke].activeMonitors[e.id].errorSocketTimeoutCount = 0;
                    s.cameraDestroy(s.group[e.ke].activeMonitors[e.id].spawn,e)
                    startVideoProcessor = function(err,o){
                        if(o.success === true){
                            s.group[e.ke].activeMonitors[e.id].isRecording = true
                            s.createCameraFfmpegProcess(e)
                            s.createCameraStreamHandlers(e)
                            if(e.type === 'dashcam'){
                                setTimeout(function(){
                                    s.group[e.ke].activeMonitors[e.id].allowStdinWrite = true
                                    s.txToDashcamUsers({
                                        f : 'enable_stream',
                                        ke : e.ke,
                                        mid : e.id
                                    },e.ke)
                                },30000)
                            }
                            if(
                                e.functionMode === 'record' ||
                                e.type === 'mjpeg' ||
                                e.type === 'h264' ||
                                e.type === 'local'
                            ){
                                s.cameraFilterFfmpegLog(e)
                            }
                            if(e.coProcessor === true){
                                setTimeout(function(){
                                    s.coSpawnLauncher(e)
                                },6000)
                            }
                            s.onMonitorStartExtensions.forEach(function(extender){
                                extender(Object.assign(s.group[e.ke].rawMonitorConfigurations[e.id],{}),e)
                            })
                          }else{
                              s.onMonitorPingFailedExtensions.forEach(function(extender){
                                  extender(Object.assign(s.group[e.ke].rawMonitorConfigurations[e.id],{}),e)
                              })
                              s.userLog(e,{type:lang["Ping Failed"],msg:lang.skipPingText1});
                              s.fatalCameraError(e,"Ping Failed");return;
                          }
                      }
                    if(
                        e.type !== 'socket' &&
                        e.type !== 'dashcam' &&
                        e.protocol !== 'udp' &&
                        e.type !== 'local' &&
                        e.details.skip_ping !== '1'
                    ){
                        connectionTester.test(strippedHost,e.port,2000,startVideoProcessor);
                    }else{
                        startVideoProcessor(null,{success:true})
                    }
                }else{
                    s.cameraDestroy(s.group[e.ke].activeMonitors[e.id].spawn,e)
                }
                if(callback)callback()
            })
        }
        var doOnChildMachine = function(){
            startVideoProcessor = function(){
                s.cx({
                    //function
                    f : 'cameraStart',
                    //mode
                    mode : e.functionMode,
                    //data, options
                    d : s.group[e.ke].rawMonitorConfigurations[e.id]
                },s.group[e.ke].activeMonitors[e.id].childNodeId)
            }
            if(
                e.type !== 'socket' &&
                e.type !== 'dashcam' &&
                e.protocol !== 'udp' &&
                e.type !== 'local' &&
                e.details.skip_ping !== '1'
            ){
                connectionTester.test(strippedHost,e.port,2000,function(err,o){
                    if(o.success === true){
                        startVideoProcessor()
                    }else{
                        s.onMonitorPingFailedExtensions.forEach(function(extender){
                            extender(Object.assign(s.group[e.ke].rawMonitorConfigurations[e.id],{}),e)
                        })
                        s.userLog(e,{type:lang["Ping Failed"],msg:lang.skipPingText1});
                        s.fatalCameraError(e,"Ping Failed");return;
                    }
                })
            }else{
                startVideoProcessor()
            }
        }
        try{
            if(config.childNodes.enabled === true && config.childNodes.mode === 'master'){
                var copiedMonitorObject = s.cleanMonitorObject(s.group[e.ke].rawMonitorConfigurations[e.id])
                var childNodeList = Object.keys(s.childNodes)
                if(childNodeList.length > 0){
                    e.childNodeFound = false
                    var selectNode = function(ip){
                        e.childNodeFound = true
                        e.childNodeSelected = ip
                    }
                    var nodeWithLowestActiveCamerasCount = 65535
                    var nodeWithLowestActiveCameras = null
                    childNodeList.forEach(function(ip){
                        delete(s.childNodes[ip].activeCameras[e.ke+e.id])
                        var nodeCameraCount = Object.keys(s.childNodes[ip].activeCameras).length
                        if(!s.childNodes[ip].dead && nodeCameraCount < nodeWithLowestActiveCamerasCount && s.childNodes[ip].cpu < 75){
                            nodeWithLowestActiveCamerasCount = nodeCameraCount
                            nodeWithLowestActiveCameras = ip
                        }
                    })
                    if(nodeWithLowestActiveCameras)selectNode(nodeWithLowestActiveCameras)
                    if(e.childNodeFound === true){
                        s.childNodes[e.childNodeSelected].activeCameras[e.ke+e.id] = copiedMonitorObject
                        s.group[e.ke].activeMonitors[e.id].childNode = e.childNodeSelected
                        s.group[e.ke].activeMonitors[e.id].childNodeId = s.childNodes[e.childNodeSelected].cnid;
                        s.cx({f:'sync',sync:s.group[e.ke].rawMonitorConfigurations[e.id],ke:e.ke,mid:e.id},s.group[e.ke].activeMonitors[e.id].childNodeId);
                        doOnChildMachine()
                    }else{
                        startMonitorInQueue.push(doOnThisMachine,function(){})
                    }
                }else{
                    startMonitorInQueue.push(doOnThisMachine,function(){})
                }
            }else{
                startMonitorInQueue.push(doOnThisMachine,function(){})
            }
        }catch(err){
            startMonitorInQueue.push(doOnThisMachine,function(){})
            console.log(err)
        }
    }
    s.fatalCameraError = function(e,errorMessage){
        clearTimeout(s.group[e.ke].activeMonitors[e.id].err_fatal_timeout);
        ++e.errorFatalCount;
        if(s.group[e.ke].activeMonitors[e.id].isStarted === true){
            s.group[e.ke].activeMonitors[e.id].err_fatal_timeout = setTimeout(function(){
                if(e.details.fatal_max !== 0 && e.errorFatalCount > e.details.fatal_max){
                    s.camera('stop',{id:e.id,ke:e.ke})
                }else{
                    s.launchMonitorProcesses(s.cleanMonitorObject(e))
                };
            },5000);
        }else{
            s.cameraDestroy(s.group[e.ke].activeMonitors[e.id].spawn,e)
        }
        s.sendMonitorStatus({id:e.id,ke:e.ke,status:lang.Died})
        s.onMonitorDiedExtensions.forEach(function(extender){
            extender(Object.assign(s.group[e.ke].rawMonitorConfigurations[e.id],{}),e)
        })
    }
    s.isWatchCountable = function(d){
        try{
            var variableMethodsToAllow = [
                'mp4ws', //Poseidon over Websocket
                'flvws',
                'h265ws',
            ];
            var indefiniteIgnore = [
                'mjpeg',
                'h264',
            ];
            var monConfig = s.group[d.ke].rawMonitorConfigurations[d.id]
            if(
                variableMethodsToAllow.indexOf(monConfig.details.stream_type + monConfig.details.stream_flv_type) > -1 &&
                indefiniteIgnore.indexOf(monConfig.details.stream_type) === -1
            ){
                return true
            }
        }catch(err){}
        return false
    }
    s.addOrEditMonitor = function(form,callback,user){
        var endData = {
            ok: false
        }
        if(!form.mid){
            endData.msg = lang['No Monitor ID Present in Form']
            callback(endData)
            return
        }
        form.mid = form.mid.replace(/[^\w\s]/gi,'').replace(/ /g,'')
        form = s.cleanMonitorObjectForDatabase(form)
        s.sqlQuery('SELECT * FROM Monitors WHERE ke=? AND mid=?',[form.ke,form.mid],function(er,r){
            var affectMonitor = false
            var monitorQuery = []
            var monitorQueryValues = []
            var txData = {
                f: 'monitor_edit',
                mid: form.mid,
                ke: form.ke,
                mon: form
            }
            if(r&&r[0]){
                txData.new = false
                Object.keys(form).forEach(function(v){
                    if(
                        form[v] !== undefined &&
                        form[v] !== `undefined` &&
                        form[v] !== null &&
                        form[v] !== `null` &&
                        form[v] !== false &&
                        form[v] !== `false`
                    ){
                        monitorQuery.push(v+'=?')
                        if(form[v] instanceof Object){
                            form[v] = s.s(form[v])
                        }
                        monitorQueryValues.push(form[v])
                    }
                })
                monitorQuery = monitorQuery.join(',')
                monitorQueryValues.push(form.ke)
                monitorQueryValues.push(form.mid)
                s.userLog(form,{type:'Monitor Updated',msg:'by user : '+user.uid})
                endData.msg = user.lang['Monitor Updated by user']+' : '+user.uid
                s.sqlQuery('UPDATE Monitors SET '+monitorQuery+' WHERE ke=? AND mid=?',monitorQueryValues)
                affectMonitor = true
            }else if(
                !s.group[form.ke].init.max_camera ||
                s.group[form.ke].init.max_camera === '' ||
                Object.keys(s.group[form.ke].activeMonitors).length <= parseInt(s.group[form.ke].init.max_camera)
            ){
                txData.new = true
                monitorQueryInsertValues = []
                Object.keys(form).forEach(function(v){
                    if(form[v] && form[v] !== ''){
                        monitorQuery.push(v)
                        monitorQueryInsertValues.push('?')
                        if(form[v] instanceof Object){
                            form[v] = s.s(form[v])
                        }
                        monitorQueryValues.push(form[v])
                    }
                })
                monitorQuery = monitorQuery.join(',')
                monitorQueryInsertValues = monitorQueryInsertValues.join(',')
                s.userLog(form,{type:'Monitor Added',msg:'by user : '+user.uid})
                endData.msg = user.lang['Monitor Added by user']+' : '+user.uid
                s.sqlQuery('INSERT INTO Monitors ('+monitorQuery+') VALUES ('+monitorQueryInsertValues+')',monitorQueryValues)
                affectMonitor = true
            }else{
                txData.f = 'monitor_edit_failed'
                txData.ff = 'max_reached'
                endData.msg = user.lang.monitorEditFailedMaxReached
            }
            if(affectMonitor === true){
                form.details = JSON.parse(form.details)
                endData.ok = true
                s.initiateMonitorObject({mid:form.mid,ke:form.ke})
                s.group[form.ke].rawMonitorConfigurations[form.mid] = s.cleanMonitorObject(form)
                if(form.mode === 'stop'){
                    s.camera('stop',form)
                }else{
                    s.camera('stop',form)
                    setTimeout(function(){
                        s.camera(form.mode,form)
                    },5000)
                }
                s.tx(txData,'STR_'+form.ke)
            }
            s.tx(txData,'GRP_'+form.ke)
            callback(!endData.ok,endData)
            s.onMonitorSaveExtensions.forEach(function(extender){
                extender(Object.assign(s.group[form.ke].rawMonitorConfigurations[form.mid],{}),form,endData)
            })
        })
    }
    s.camera = function(x,e,cn){
        // x = function or mode
        // e = monitor object
        // cn = socket connection or callback or options (depends on function chosen)
        if(cn && cn.ke && !e.ke){e.ke = cn.ke}
        e.functionMode = x
        if(!e.mode){e.mode = x}
        s.checkDetails(e)
        s.cameraCheckObjectsInDetails(e)
        s.initiateMonitorObject({ke:e.ke,mid:e.id})
        switch(e.functionMode){
            case'watch_on'://live streamers - join
               if(!cn.monitorsCurrentlyWatching){cn.monitorsCurrentlyWatching = {}}
               if(!cn.monitorsCurrentlyWatching[e.id]){cn.monitorsCurrentlyWatching[e.id]={ke:e.ke}}
               s.group[e.ke].activeMonitors[e.id].watch[cn.id]={};
               var numberOfViewers = Object.keys(s.group[e.ke].activeMonitors[e.id].watch).length
               s.tx({
                   viewers: numberOfViewers,
                   ke: e.ke,
                   id: e.id
               },'MON_'+e.ke+e.id)
            break;
            case'watch_off'://live streamers - leave
                if(cn.monitorsCurrentlyWatching){delete(cn.monitorsCurrentlyWatching[e.id])}
                var numberOfViewers = 0
                delete(s.group[e.ke].activeMonitors[e.id].watch[cn.id]);
                numberOfViewers = Object.keys(s.group[e.ke].activeMonitors[e.id].watch).length
                s.tx({
                    viewers: numberOfViewers,
                    ke: e.ke,
                    id: e.id
                },'MON_'+e.ke+e.id)
            break;
            case'restart'://restart monitor
                s.sendMonitorStatus({id:e.id,ke:e.ke,status:'Restarting'});
                s.camera('stop',e)
                setTimeout(function(){
                    s.camera(e.mode,e)
                },1300)
            break;
            case'idle':case'stop'://stop monitor
                if(!s.group[e.ke]||!s.group[e.ke].activeMonitors[e.id]){return}
                if(config.childNodes.enabled === true && config.childNodes.mode === 'master' && s.group[e.ke].activeMonitors[e.id].childNode && s.childNodes[s.group[e.ke].activeMonitors[e.id].childNode].activeCameras[e.ke+e.id]){
                    s.group[e.ke].activeMonitors[e.id].isStarted = false
                    s.cx({
                        //function
                        f : 'cameraStop',
                        //data, options
                        d : s.group[e.ke].rawMonitorConfigurations[e.id]
                    },s.group[e.ke].activeMonitors[e.id].childNodeId)
                    s.cx({f:'sync',sync:s.group[e.ke].rawMonitorConfigurations[e.id],ke:e.ke,mid:e.id},s.group[e.ke].activeMonitors[e.id].childNodeId);
                }else{
                    s.closeEventBasedRecording(e)
                    if(s.group[e.ke].activeMonitors[e.id].fswatch){s.group[e.ke].activeMonitors[e.id].fswatch.close();delete(s.group[e.ke].activeMonitors[e.id].fswatch)}
                    if(s.group[e.ke].activeMonitors[e.id].fswatchStream){s.group[e.ke].activeMonitors[e.id].fswatchStream.close();delete(s.group[e.ke].activeMonitors[e.id].fswatchStream)}
                    if(s.group[e.ke].activeMonitors[e.id].last_frame){delete(s.group[e.ke].activeMonitors[e.id].last_frame)}
                    if(s.group[e.ke].activeMonitors[e.id].isStarted !== true){return}
                    s.cameraDestroy(s.group[e.ke].activeMonitors[e.id].spawn,e)
                    if(e.neglectTriggerTimer === 1){
                        delete(e.neglectTriggerTimer);
                    }else{
                        clearTimeout(s.group[e.ke].activeMonitors[e.id].trigger_timer)
                        delete(s.group[e.ke].activeMonitors[e.id].trigger_timer)
                    }
                    clearInterval(s.group[e.ke].activeMonitors[e.id].running);
                    clearInterval(s.group[e.ke].activeMonitors[e.id].detector_notrigger_timeout)
                    clearTimeout(s.group[e.ke].activeMonitors[e.id].err_fatal_timeout);
                    s.group[e.ke].activeMonitors[e.id].isStarted = false
                    s.group[e.ke].activeMonitors[e.id].isRecording = false
                    s.tx({f:'monitor_stopping',mid:e.id,ke:e.ke,time:s.formattedTime()},'GRP_'+e.ke);
                    s.cameraSendSnapshot({mid:e.id,ke:e.ke,mon:e},{useIcon: true})
                    if(e.functionMode === 'stop'){
                        s.userLog(e,{type:lang['Monitor Stopped'],msg:lang.MonitorStoppedText});
                        clearTimeout(s.group[e.ke].activeMonitors[e.id].delete)
                        if(e.delete===1){
                            s.group[e.ke].activeMonitors[e.id].delete=setTimeout(function(){
                                delete(s.group[e.ke].activeMonitors[e.id]);
                                delete(s.group[e.ke].rawMonitorConfigurations[e.id]);
                            },1000*60);
                        }
                    }else{
                        s.tx({f:'monitor_idle',mid:e.id,ke:e.ke,time:s.formattedTime()},'GRP_'+e.ke);
                        s.userLog(e,{type:lang['Monitor Idling'],msg:lang.MonitorIdlingText});
                    }
                }
                var wantedStatus = lang.Stopped
                if(e.functionMode === 'idle'){
                    var wantedStatus = lang.Idle
                }
                s.sendMonitorStatus({id:e.id,ke:e.ke,status:wantedStatus})
                s.onMonitorStopExtensions.forEach(function(extender){
                    extender(Object.assign(s.group[e.ke].rawMonitorConfigurations[e.id],{}),e)
                })
            break;
            case'start':case'record'://watch or record monitor url
                s.initiateMonitorObject({ke:e.ke,mid:e.id})
                if(!s.group[e.ke].rawMonitorConfigurations[e.id]){s.group[e.ke].rawMonitorConfigurations[e.id]=s.cleanMonitorObject(e);}
                e.url = s.buildMonitorUrl(e);
                if(s.group[e.ke].activeMonitors[e.id].isStarted === true){
                    //stop action, monitor already started or recording
                    return
                }
                //lock this function
                s.sendMonitorStatus({id:e.id,ke:e.ke,status:lang.Starting});
                s.group[e.ke].activeMonitors[e.id].isStarted = true
                if(e.details && e.details.dir && e.details.dir !== ''){
                    s.group[e.ke].activeMonitors[e.id].addStorageId = e.details.dir
                }else{
                    s.group[e.ke].activeMonitors[e.id].addStorageId = null
                }
                //set recording status
                e.wantedStatus = lang.Watching
                if(e.functionMode === 'record'){
                    e.wantedStatus = lang.Recording
                    s.group[e.ke].activeMonitors[e.id].isRecording = true
                }else{
                    s.group[e.ke].activeMonitors[e.mid].isRecording = false
                }
                //set up fatal error handler
                if(e.details.fatal_max === ''){
                    e.details.fatal_max = 0
                }else{
                    e.details.fatal_max = parseFloat(e.details.fatal_max)
                }
                e.errorFatalCount = 0;
                //cutoff time and recording check interval
                if(!e.details.cutoff||e.details.cutoff===''){e.cutoff=15}else{e.cutoff=parseFloat(e.details.cutoff)};
                if(isNaN(e.cutoff)===true){e.cutoff=15}
                //start drawing files
                delete(s.group[e.ke].activeMonitors[e.id].childNode)
                s.launchMonitorProcesses(e)
            break;
            default:
                console.log(x)
            break;
        }
        if(typeof cn === 'function'){setTimeout(function(){cn()},1000)}
    }
    //
    s.activateMonitorStates = function(groupKey,stateName,user,callback){
        var endData = {
            ok: false
        }
        s.findPreset([groupKey,'monitorStates',stateName],function(notFound,preset){
            if(notFound === false){
                var sqlQuery = 'SELECT * FROM Monitors WHERE ke=? AND '
                var monitorQuery = []
                var sqlQueryValues = [groupKey]
                var monitorPresets = {}
                preset.details.monitors.forEach(function(monitor){
                    monitorQuery.push('mid=?')
                    sqlQueryValues.push(monitor.mid)
                    monitorPresets[monitor.mid] = monitor
                })
                sqlQuery += '('+monitorQuery.join(' OR ')+')'
                s.sqlQuery(sqlQuery,sqlQueryValues,function(err,monitors){
                    if(monitors && monitors[0]){
                        monitors.forEach(function(monitor){
                            s.checkDetails(monitor)
                            s.checkDetails(monitorPresets[monitor.mid])
                            var monitorPreset = monitorPresets[monitor.mid]
                            monitorPreset.details = Object.assign(monitor.details,monitorPreset.details)
                            monitor = s.cleanMonitorObjectForDatabase(Object.assign(monitor,monitorPreset))
                            monitor.details = JSON.stringify(monitor.details)
                            s.addOrEditMonitor(Object.assign(monitor,{}),function(err,endData){

                            },user)
                        })
                        endData.ok = true
                        s.tx({f:'change_group_state',ke:groupKey,name:stateName},'GRP_'+groupKey)
                        callback(endData)
                    }else{
                        endData.msg = user.lang['State Configuration has no monitors associated']
                        callback(endData)
                    }
                })
            }else{
                endData.msg = user.lang['State Configuration Not Found']
                callback(endData)
            }
        })
    }
    s.getCamerasForMultiTrigger = function(monitor){
        var list={}
        var cameras=[]
        var group
        try{
            group=JSON.parse(monitor.details.group_detector_multi)
            if(!group){group=[]}
        }catch(err){
            group=[]
        }
        group.forEach(function(b){
            Object.keys(s.group[monitor.ke].rawMonitorConfigurations).forEach(function(v){
                try{
                    var groups = JSON.parse(s.group[monitor.ke].rawMonitorConfigurations[v].details.groups)
                    if(!groups){
                        groups=[]
                    }
                }catch(err){
                    groups=[]
                }
                if(!list[v]&&groups.indexOf(b)>-1){
                    list[v]={}
                    if(s.group[monitor.ke].rawMonitorConfigurations[v].mode !== 'stop'){
                        cameras.push(Object.assign({},s.group[monitor.ke].rawMonitorConfigurations[v]))
                    }
                }
            })
        })
        return cameras
    }
    // s.checkViewerConnectionsForMonitor = function(monitorObject){
    //     var monitorConfig = s.group[monitorObject.ke].rawMonitorConfigurations[monitorObject.mid]
    //     if(monitorConfig.mode === 'start'){
    //
    //     }
    // }
    // s.addViewerConnectionForMonitor = function(monitorObject,viewerDetails){
    //     s.group[monitorObject.ke].activeMonitors[monitorObject.mid].viewerConnection[viewerDetails.viewerId] = viewerDetails
    //     s.group[monitorObject.ke].activeMonitors[monitorObject.mid].viewerConnectionCount += 1
    //     return s.group[monitorObject.ke].activeMonitors[monitorObject.mid].viewerConnectionCount
    // }
    // s.removeViewerConnectionForMonitor = function(monitorObject,viewerDetails){
    //     delete(s.group[monitorObject.ke].activeMonitors[monitorObject.mid].viewerConnection[viewerDetails.viewerId])
    //     s.group[monitorObject.ke].activeMonitors[monitorObject.mid].viewerConnectionCount -= 1
    //     return s.group[monitorObject.ke].activeMonitors[monitorObject.mid].viewerConnectionCount
    // }
}
