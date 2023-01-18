const fs = require('fs');
const treekill = require('tree-kill');
const spawn = require('child_process').spawn;
const events = require('events');
const Mp4Frag = require('mp4frag');
const streamViewerCountTimeouts = {}
module.exports = (s,config,lang) => {
    const {
        scanForOrphanedVideos
    } = require('../video/utils.js')(s,config,lang)
    const {
        createPipeArray,
        splitForFFPMEG,
        sanitizedFfmpegCommand,
    } = require('../ffmpeg/utils.js')(s,config,lang)
    const {
        buildSubstreamString,
        getDefaultSubstreamFields,
    } = require('../ffmpeg/builders.js')(s,config,lang)
    const getUpdateableFields = require('./updatedFields.js')
    const processKill = (proc) => {
        const response = {ok: true}
        return new Promise((resolve,reject) => {
            if(!proc){
                resolve(response)
                return
            }
            function sendError(err){
                response.ok = false
                response.err = err
                resolve(response)
            }
            try{
                if(proc && proc.stdin) {
                    proc.stdin.write("q\r\n");
                }
                setTimeout(() => {
                    if(proc && proc.kill){
                        if(s.isWin){
                            spawn("taskkill", ["/pid", proc.pid, '/t'])
                        }else{
                            proc.kill('SIGTERM')
                        }
                        setTimeout(function(){
                            try{
                                treekill(proc.pid)
                                resolve(response)
                            }catch(err){
                                s.debugLog(err)
                                sendError(err)
                            }
                        },3000)
                    }
                },1000)
            }catch(err){
                s.debugLog(err)
                sendError(err)
            }
        })
    }
    const cameraDestroy = function(e,p){
        if(
            s.group[e.ke] &&
            s.group[e.ke].activeMonitors[e.id] &&
            s.group[e.ke].activeMonitors[e.id].spawn !== undefined
        ){
            const activeMonitor = s.group[e.ke].activeMonitors[e.id];
            const proc = s.group[e.ke].activeMonitors[e.id].spawn;
            if(proc){
                activeMonitor.allowStdinWrite = false
                s.txToDashcamUsers({
                    f : 'disable_stream',
                    ke : e.ke,
                    mid : e.id
                },e.ke)
    //            if(activeMonitor.p2pStream){activeMonitor.p2pStream.unpipe();}
                try{
                    proc.removeListener('end',activeMonitor.spawn_exit);
                    proc.removeListener('exit',activeMonitor.spawn_exit);
                    delete(activeMonitor.spawn_exit);
                }catch(er){

                }
            }
            if(activeMonitor.audioDetector){
              activeMonitor.audioDetector.stop()
              delete(activeMonitor.audioDetector)
            }
            activeMonitor.firstStreamChunk = {}
            clearTimeout(activeMonitor.recordingChecker);
            delete(activeMonitor.recordingChecker);
            clearTimeout(activeMonitor.streamChecker);
            delete(activeMonitor.streamChecker);
            clearTimeout(activeMonitor.checkSnap);
            delete(activeMonitor.checkSnap);
            clearTimeout(activeMonitor.watchdog_stop);
            delete(activeMonitor.watchdog_stop);
            // delete(activeMonitor.secondaryDetectorOutput);
            delete(activeMonitor.detectorFrameSaveBuffer);
            clearTimeout(activeMonitor.recordingSnapper);
            clearInterval(activeMonitor.getMonitorCpuUsage);
            clearInterval(activeMonitor.objectCountIntervals);
            clearTimeout(activeMonitor.timeoutToRestart)
            delete(activeMonitor.onvifConnection)
            if(activeMonitor.onChildNodeExit){
                activeMonitor.onChildNodeExit()
            }
            try{
                activeMonitor.spawn.stdio.forEach(function(stdio){
                  try{
                    stdio.unpipe()
                  }catch(err){
                    console.log(err)
                  }
                })
            }catch(err){
                // s.debugLog(err)
            }
            if(activeMonitor.mp4frag){
                var mp4FragChannels = Object.keys(activeMonitor.mp4frag)
                mp4FragChannels.forEach(function(channel){
                    activeMonitor.mp4frag[channel].removeAllListeners()
                    delete(activeMonitor.mp4frag[channel])
                })
            }
            if(config.childNodes.enabled === true && config.childNodes.mode === 'child' && config.childNodes.host){
                s.cx({f:'clearCameraFromActiveList',ke:e.ke,id:e.id})
            }
            if(activeMonitor.childNode){
                s.cx({f:'kill',d:s.cleanMonitorObject(e)},activeMonitor.childNodeId)
            }else{
                processKill(proc).then((response) => {
                    s.debugLog(`cameraDestroy`,response)
                    activeMonitor.allowDestroySubstream = true
                    destroySubstreamProcess(activeMonitor).then((response) => {
                        if(response.hadSubStream)s.debugLog(`cameraDestroy`,response.closeResponse)
                    })
                })
            }
        }
    }
    const createSnapshot = (options) => {
        const url = options.url
        const streamDir = options.streamDir || s.dir.streams
        const inputOptions = options.input || []
        const outputOptions = options.output || []
        return new Promise((resolve,reject) => {
            if(!url){
                resolve(null);
                return
            }
            const completeRequest = () => {
                fs.readFile(temporaryImageFile,(err,imageBuffer) => {
                    fs.rm(temporaryImageFile,(err) => {
                        if(err){
                            s.debugLog(err)
                        }
                    })
                    if(err){
                        s.debugLog(err)
                    }
                    resolve(imageBuffer)
                })
            }
            const temporaryImageFile = streamDir + s.gid(5) + '.jpg'
            const ffmpegCmd = splitForFFPMEG(`-y -loglevel warning -re ${inputOptions.join(' ')} -i "${url}" ${outputOptions.join(' ')} -f image2 -an -frames:v 1 "${temporaryImageFile}"`)
            const snapProcess = spawn('ffmpeg',ffmpegCmd,{detached: true})
            snapProcess.stderr.on('data',function(data){
                // s.debugLog(data.toString())
            })
            snapProcess.on('close',async function(data){
                clearTimeout(snapProcessTimeout)
                completeRequest()
            })
            var snapProcessTimeout = setTimeout(function(){
                processKill(snapProcess).then((response) => {
                    s.debugLog(`createSnapshot-snapProcessTimeout`,response)
                    completeRequest()
                })
            },5000)
        })
    }
    const addCredentialsToStreamLink = (options) => {
        const streamUrl = options.url
        const username = options.username
        const password = options.password
        const urlParts = streamUrl.split('://')
        urlParts[0] = 'http'
        return ['rtsp','://',`${username}:${password}@`,urlParts[1]].join('')
    }
    const monitorConfigurationMigrator = (monitor) => {
        // converts the old style to the new style.
        const updatedFields = getUpdateableFields()
        const fieldKeys = Object.keys(updatedFields)
        fieldKeys.forEach((oldKey) => {
            if(oldKey === 'details'){
                const detailKeys = Object.keys(updatedFields.details)
                detailKeys.forEach((oldKey) => {
                    if(oldKey === 'stream_channels'){
                        if(monitor.details.stream_channels){
                            const channelUpdates = updatedFields.details.stream_channels
                            const channelKeys = Object.keys(channelUpdates)
                            const streamChannels = s.parseJSON(monitor.details.stream_channels) || []
                            streamChannels.forEach(function(channel,number){
                                channelKeys.forEach((oldKey) => {
                                    const newKey = channelUpdates[oldKey]
                                    monitor.details.stream_channels[number][newKey] = streamChannels[number][oldKey] ? streamChannels[number][oldKey] : monitor.details.stream_channels[number][newKey]
                                    // delete(e.details.stream_channels[number][oldKey])
                                })
                            })
                        }
                    }else{
                        const newKey = updatedFields.details[oldKey]
                        monitor.details[newKey] = monitor.details[oldKey] ? monitor.details[oldKey] : monitor.details[newKey]
                        // delete(monitor.details[oldKey])
                    }
                })
            }else{
                const newKey = updatedFields[oldKey]
                monitor[newKey] = monitor[oldKey] ? monitor[oldKey] : monitor[newKey]
                // delete(monitor[oldKey])
            }
        })
    }
    const spawnSubstreamProcess = function(e){
        // e = monitorConfig
        try{
            const groupKey = e.ke
            const monitorId = e.mid
            const monitorConfig = Object.assign({},s.group[groupKey].rawMonitorConfigurations[monitorId])
            const monitorDetails = monitorConfig.details
            const activeMonitor = s.group[e.ke].activeMonitors[e.mid]
            const channelNumber = 1 + (monitorDetails.stream_channels || []).length
            const ffmpegCommand = [`-progress pipe:5`];
            const logLevel = monitorDetails.loglevel ? e.details.loglevel : 'warning'
            const stdioPipes = createPipeArray({}, 2)
            const substreamConfig = monitorConfig.details.substream
            substreamConfig.input.type = !substreamConfig.input.fulladdress ? monitorConfig.type : substreamConfig.input.type || monitorConfig.details.rtsp_transport
            substreamConfig.input.fulladdress = substreamConfig.input.fulladdress || s.buildMonitorUrl(monitorConfig)
            substreamConfig.input.rtsp_transport = substreamConfig.input.rtsp_transport || monitorConfig.details.rtsp_transport
            const {
                inputAndConnectionFields,
                outputFields,
            } = getDefaultSubstreamFields(monitorConfig);
            ([
                buildSubstreamString(channelNumber + config.pipeAddition,e),
            ]).forEach(function(commandStringPart){
                ffmpegCommand.push(commandStringPart)
            });
            const ffmpegCommandString = ffmpegCommand.join(' ')
            activeMonitor.ffmpegSubstream = sanitizedFfmpegCommand(e,ffmpegCommandString)
            const ffmpegCommandParsed = splitForFFPMEG(ffmpegCommandString)
            activeMonitor.subStreamChannel = channelNumber;
            s.userLog({
                ke: e.ke,
                mid: e.mid,
            },
            {
                type: lang["Substream Process"],
                msg: {
                    msg: lang["Process Started"],
                    cmd: ffmpegCommandString,
                },
            });
            const subStreamProcess = spawn(config.ffmpegDir,ffmpegCommandParsed,{detached: true,stdio: stdioPipes})
            attachStreamChannelHandlers({
                ke: e.ke,
                mid: e.mid,
                fields: Object.assign({},inputAndConnectionFields,outputFields),
                number: activeMonitor.subStreamChannel,
                ffmpegProcess: subStreamProcess,
            })
            if(config.debugLog === true){
                subStreamProcess.stderr.on('data',(data) => {
                    console.log(`${e.ke} ${e.mid}`)
                    console.log(data.toString())
                })
            }
            if(logLevel !== 'quiet'){
                subStreamProcess.stderr.on('data',(data) => {
                    s.userLog({
                        ke: e.ke,
                        mid: e.mid,
                    },{
                        type: lang["Substream Process"],
                        msg: data.toString()
                    })
                })
            }
            subStreamProcess.on('close',(data) => {
                if(!activeMonitor.allowDestroySubstream){
                    subStreamProcess.stderr.on('data',(data) => {
                        s.userLog({
                            ke: e.ke,
                            mid: e.mid,
                        },
                        {
                            type: lang["Substream Process"],
                            msg: lang["Process Crashed for Monitor"],
                        })
                    })
                    setTimeout(() => {
                        spawnSubstreamProcess(e)
                    },2000)
                }
            })
            activeMonitor.subStreamProcess = subStreamProcess
            s.tx({
                f: 'substream_start',
                mid: e.mid,
                ke: e.ke,
                channel: activeMonitor.subStreamChannel
            },'GRP_'+e.ke);
            return subStreamProcess
        }catch(err){
            s.systemLog(err)
            return null
        }
    }
    const destroySubstreamProcess = async function(activeMonitor){
        // e = monitorConfig.details.substream
        const response = {
            hadSubStream: false,
            alreadyClosing: false
        }
        try{
            if(activeMonitor.subStreamProcessClosing){
                response.alreadyClosing = true
            }else if(activeMonitor.subStreamProcess){
                activeMonitor.subStreamProcessClosing = true
                activeMonitor.subStreamChannel = null;
                const closeResponse = await processKill(activeMonitor.subStreamProcess)
                response.hadSubStream = true
                response.closeResponse = closeResponse
                delete(activeMonitor.subStreamProcess)
                s.tx({
                    f: 'substream_end',
                    mid: activeMonitor.mid,
                    ke: activeMonitor.ke
                },'GRP_'+activeMonitor.ke);
                activeMonitor.subStreamProcessClosing = false
            }
        }catch(err){
            s.debugLog('destroySubstreamProcess',err)
        }
        return response
    }
    function attachStreamChannelHandlers(options){
        const fields = options.fields
        const number = options.number
        const ffmpegProcess = options.ffmpegProcess
        const activeMonitor = s.group[options.ke].activeMonitors[options.mid]
        const pipeNumber = number + config.pipeAddition;
        if(!activeMonitor.emitterChannel[pipeNumber]){
            activeMonitor.emitterChannel[pipeNumber] = new events.EventEmitter().setMaxListeners(0);
        }
       let frameToStreamAdded
       switch(fields.stream_type){
           case'mp4':
               delete(activeMonitor.mp4frag[pipeNumber])
               if(!activeMonitor.mp4frag[pipeNumber])activeMonitor.mp4frag[pipeNumber] = new Mp4Frag();
               ffmpegProcess.stdio[pipeNumber].pipe(activeMonitor.mp4frag[pipeNumber],{ end: false })
           break;
           case'mjpeg':
               frameToStreamAdded = function(d){
                   activeMonitor.emitterChannel[pipeNumber].emit('data',d)
               }
           break;
           case'flv':
               frameToStreamAdded = function(d){
                   if(!activeMonitor.firstStreamChunk[pipeNumber])activeMonitor.firstStreamChunk[pipeNumber] = d;
                   frameToStreamAdded = function(d){
                       activeMonitor.emitterChannel[pipeNumber].emit('data',d)
                   }
                   frameToStreamAdded(d)
               }
           break;
           case'h264':
               frameToStreamAdded = function(d){
                   activeMonitor.emitterChannel[pipeNumber].emit('data',d)
               }
           break;
        }
        if(frameToStreamAdded){
            ffmpegProcess.stdio[pipeNumber].on('data',frameToStreamAdded)
        }
    }
    function setActiveViewer(groupKey,monitorId,connectionId,isBeingAdded){
        const viewerList = s.group[groupKey].activeMonitors[monitorId].watch;
        if(isBeingAdded){
            if(viewerList.indexOf(connectionId) > -1)viewerList.push(connectionId);
        }else{
            viewerList.splice(viewerList.indexOf(connectionId), 1)
        }
        const numberOfViewers = viewerList.length
        s.tx({
            f: 'viewer_count',
            viewers: numberOfViewers,
            ke: groupKey,
            id: monitorId
        },'MON_' + groupKey + monitorId)
        return numberOfViewers;
    }
    function getActiveViewerCount(groupKey,monitorId){
        const viewerList = s.group[groupKey].activeMonitors[monitorId].watch;
        const numberOfViewers = viewerList.length
        return numberOfViewers;
    }
    function setTimedActiveViewerForHttp(req){
        const groupKey = req.params.ke
        const connectionId = req.params.auth
        const loggedInUser = s.group[groupKey].users[connectionId]
        if(!loggedInUser){
            const monitorId = req.params.id
            const viewerList = s.group[groupKey].activeMonitors[monitorId].watch
            const theViewer = viewerList[connectionId]
            if(!theViewer){
                setActiveViewer(groupKey,monitorId,connectionId,true)
            }
            clearTimeout(streamViewerCountTimeouts[req.originalUrl])
            streamViewerCountTimeouts[req.originalUrl] = setTimeout(() => {
                setActiveViewer(groupKey,monitorId,connectionId,false)
            },5000)
        }else{
            s.debugLog(`User is Logged in, Don't add to viewer count`);
        }
    }
    function attachMainProcessHandlers(e,fatalError){
        s.group[e.ke].activeMonitors[e.id].spawn_exit = function(){
            if(s.group[e.ke].activeMonitors[e.id].isStarted === true){
                if(e.details.loglevel!=='quiet'){
                    s.userLog(e,{type:lang['Process Unexpected Exit'],msg:{msg:lang.unexpectedExitText,cmd:s.group[e.ke].activeMonitors[e.id].ffmpeg}});
                }
                fatalError(e,'Process Unexpected Exit');
                scanForOrphanedVideos(e,{
                    forceCheck: true,
                    checkMax: 2
                })
                s.onMonitorUnexpectedExitExtensions.forEach(function(extender){
                    extender(Object.assign(s.group[e.ke].rawMonitorConfigurations[e.id],{}),e)
                })
            }
        }
        s.group[e.ke].activeMonitors[e.id].spawn.on('end',s.group[e.ke].activeMonitors[e.id].spawn_exit)
        s.group[e.ke].activeMonitors[e.id].spawn.on('exit',s.group[e.ke].activeMonitors[e.id].spawn_exit)
        s.group[e.ke].activeMonitors[e.id].spawn.on('error',function(er){
            s.userLog(e,{type:'Spawn Error',msg:er});fatalError(e,'Spawn Error')
        })
        s.userLog(e,{type:lang['Process Started'],msg:{cmd:s.group[e.ke].activeMonitors[e.id].ffmpeg}})
        // if(s.isWin === false){
            // var strippedHost = s.stripAuthFromHost(e)
            // var sendProcessCpuUsage = function(){
            //     s.getMonitorCpuUsage(e,function(percent){
            //         s.group[e.ke].activeMonitors[e.id].currentCpuUsage = percent
            //         s.tx({
            //             f: 'camera_cpu_usage',
            //             ke: e.ke,
            //             id: e.id,
            //             percent: percent
            //         },'MON_STREAM_'+e.ke+e.id)
            //     })
            // }
            // clearInterval(s.group[e.ke].activeMonitors[e.id].getMonitorCpuUsage)
            // s.group[e.ke].activeMonitors[e.id].getMonitorCpuUsage = setInterval(function(){
            //     if(e.details.skip_ping !== '1'){
            //         connectionTester.test(strippedHost,e.port,2000,function(err,response){
            //             if(response.success){
            //                 sendProcessCpuUsage()
            //             }else{
            //                 launchMonitorProcesses(e)
            //             }
            //         })
            //     }else{
            //         sendProcessCpuUsage()
            //     }
            // },1000 * 60)
        // }
    }
    async function deleteMonitorData(groupKey,monitorId){
        // deleteVideos
        // deleteFileBinFiles
        // deleteTimelapseFrames
        async function deletePath(thePath){
            try{
                await fs.promises.stat(thePath)
                await fs.promises.rm(thePath, {recursive: true})
            }catch(err){

            }
        }
        async function deleteFromTable(tableName){
            await s.knexQueryPromise({
                action: "delete",
                table: tableName,
                where: {
                    ke: groupKey,
                    mid: monitorId,
                }
            })
        }
        async function getSizeFromTable(tableName){
            const response = await s.knexQueryPromise({
                action: "select",
                columns: "size",
                table: tableName,
                where: {
                    ke: groupKey,
                    mid: monitorId,
                }
            })
            const rows = response.rows
            let size = 0
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i]
                size += row.size
            }
            return size
        }
        async function adjustSpaceCounterForTableWithAddStorage(tableName,storageType){
            // does normal videos and addStorage
            const response = await s.knexQueryPromise({
                action: "select",
                columns: "ke,mid,details,size",
                table: tableName || 'Videos',
                where: {
                    ke: groupKey,
                    mid: monitorId,
                }
            })
            const rows = response.rows
            for (let i = 0; i < rows.length; i++) {
                const video = rows[i]
                const storageIndex = s.getVideoStorageIndex(video)
                if(storageIndex){
                    s.setDiskUsedForGroupAddStorage(video.ke,{
                        size: -(video.size / 1048576),
                        storageIndex: storageIndex
                    },storageType)
                }else{
                    s.setDiskUsedForGroup(video.ke,-(video.size / 1048576),storageType)
                }
            }
        }
        async function adjustSpaceCounter(tableName,storageType){
            const amount = await getSizeFromTable(tableName)
            s.setDiskUsedForGroup(groupKey,-amount,storageType)
        }
        const videosDir = s.dir.videos + `${groupKey}/${monitorId}`
        const binDir = s.dir.fileBin + `${groupKey}/${monitorId}`

        // videos and addStorage
        await adjustSpaceCounterForTableWithAddStorage('Timelapse Frames','timelapeFrames')
        await adjustSpaceCounterForTableWithAddStorage('Videos')
        await deleteFromTable('Videos')
        await deletePath(videosDir)
        for (let i = 0; i < s.dir.addStorage.length; i++) {
            const storage = s.dir.addStorage[i]
            const addStorageDir = storage.path + groupKey + '/' + monitorId
            await deletePath(addStorageDir)
            await deletePath(addStorageDir + '_timelapse')
        }

        // timelapse frames
        await adjustSpaceCounter('Timelapse Frames','timelapeFrames')
        await deleteFromTable('Timelapse Frames')
        await deletePath(videosDir + '_timelapse')

        // fileBin
        await adjustSpaceCounter('Files','fileBin')
        await deleteFromTable('Files')
        await deletePath(binDir)
    }
    return {
        deleteMonitorData,
        cameraDestroy: cameraDestroy,
        createSnapshot: createSnapshot,
        processKill: processKill,
        addCredentialsToStreamLink: addCredentialsToStreamLink,
        monitorConfigurationMigrator: monitorConfigurationMigrator,
        spawnSubstreamProcess: spawnSubstreamProcess,
        destroySubstreamProcess: destroySubstreamProcess,
        attachStreamChannelHandlers: attachStreamChannelHandlers,
        setActiveViewer: setActiveViewer,
        getActiveViewerCount: getActiveViewerCount,
        setTimedActiveViewerForHttp: setTimedActiveViewerForHttp,
        attachMainProcessHandlers: attachMainProcessHandlers,
    }
}
