$(document).ready(function(e){
    var powerVideoWindow = $('#powerVideo')
    var powerVideoMonitorsListElement = $('#powerVideoMonitorsList')
    var powerVideoMonitorViewsElement = $('#powerVideoMonitorViews')
    var powerVideoTimelineStripsContainer = $('#powerVideoTimelineStrips')
    var dateSelector = $('#powerVideoDateRange')
    var powerVideoVideoLimitElement = $('#powerVideoVideoLimit')
    var powerVideoEventLimitElement = $('#powerVideoEventLimit')
    var powerVideoSet = $('#powerVideoSet')
    var powerVideoMuteIcon = powerVideoWindow.find('[powerVideo-control="toggleMute"] i')
    var objectTagSearchField = $('#powerVideo_tag_search')
    var powerVideoLoadedVideos = {}
    var powerVideoLoadedEvents = {}
    var powerVideoLoadedChartData = {}
    var loadedTableGroupIds = {}
    var eventsLabeledByTime = {}
    var monitorSlotPlaySpeeds = {}
    var currentlyPlayingVideos = {}
    var powerVideoMute = true
    var powerVideoCanAutoPlay = true
    var lastPowerVideoSelectedMonitors = []
    var extenders = {
        onVideoPlayerTimeUpdateExtensions: [],
        onVideoPlayerTimeUpdate: function(extender){
            extenders.onVideoPlayerTimeUpdateExtensions.push(extender)
        },
        onVideoPlayerCreateExtensions: [],
        onVideoPlayerCreate: function(extender){
            extenders.onVideoPlayerCreateExtensions.push(extender)
        },
    }
    var activeTimeline = null
    // fix utc/localtime translation (use timelapseJpeg as guide, it works as expected) >
    loadDateRangePicker(dateSelector,{
        startDate: moment().subtract(moment.duration("24:00:00")),
        endDate: moment().add(moment.duration("24:00:00")),
        timePicker24Hour: true,
        timePickerSeconds: true,
        onChange: function(start, end, label) {
            dateSelector.focus()
            $.each(lastPowerVideoSelectedMonitors,async function(n,monitorId){
                await requestTableData(monitorId)
            })
        }
    })
    // fix utc/localtime translation (use timelapseJpeg as guide, it works as expected) />
    function loadVideosToTimeLineMemory(monitorId,videos,events){
        videos.forEach((video) => {
            createVideoLinks(video,{
                hideRemote: true
            })
        })
        powerVideoLoadedVideos[monitorId] = videos
        powerVideoLoadedEvents[monitorId] = events
    }
    function drawMonitorsList(){
        // var monitorList = Object.values(loadedMonitors).map(function(item){
        //     return {
        //         value: item.mid,
        //         label: item.name,
        //     }
        // });
        var html = ``
        $.each(getLoadedMonitorsAlphabetically(),function(n,monitor){
            html += `<div class="flex-row d-flex">
                <div class="flex-grow-1 p-2">${monitor.name}</div>
                <div class="p-2 text-right"><small>${monitor.host}</small></div>
                <div class="p-2"><input name="${monitor.mid}" value="1" type="checkbox" class="form-check-input position-initial ml-0"></div>
            </div>`
        })
        powerVideoMonitorsListElement.html(html)
    }
    function getVideoSetSelected(){
        return powerVideoSet.val()
    }
    async function requestTableData(monitorId){
        var dateRange = getSelectedTime(dateSelector)
        var searchQuery = objectTagSearchField.val() || null
        var startDate = dateRange.startDate
        var endDate = dateRange.endDate
        var wantsCloudVideo = getVideoSetSelected() === 'cloud'
        var wantsArchivedVideo = getVideoSetSelected() === 'archive'
        var videos = (await getVideos({
            monitorId,
            startDate,
            endDate,
            searchQuery,
            archived: wantsArchivedVideo,
            customVideoSet: wantsCloudVideo ? 'cloudVideos' : 'videos',
        })).videos;
        var events = ([]).concat(...videos.map(row => row.events || []));
        loadVideosToTimeLineMemory(monitorId,videos,events)
        drawLoadedTableData()
    }
    function unloadTableData(monitorId,user){
        if(!user)user = $user
        delete(powerVideoLoadedVideos[monitorId])
        delete(powerVideoLoadedEvents[monitorId])
        delete(loadedTableGroupIds[monitorId])
        delete(loadedTableGroupIds[monitorId + '_events'])
        powerVideoMonitorViewsElement.find(`.videoPlayer[data-mid="${monitorId}"]`).remove()
        drawLoadedTableData()
    }
    function checkEventsAgainstVideo(video,events){
        var videoStartTime = new Date(video.time)
        var videoEndTime = new Date(video.end)
        var eventsToCheck = events
        video.detections = {}
        var newSetOfEventsWithoutChecked = {}
        $.each(eventsToCheck,function(n,event){
            var eventTime = new Date(event.time)
            var seekPosition = (eventTime - videoStartTime) / 1000
            if (videoStartTime <= eventTime && eventTime <= videoEndTime) {
                if(!video.details.confidence)video.details.confidence = 0
                video.detections[seekPosition] = event
                eventsLabeledByTime[video.mid][video.time][seekPosition] = event
            }else{
                newSetOfEventsWithoutChecked[n] = video
            }
        })
        eventsToCheck = newSetOfEventsWithoutChecked
    }
    function prepareVideosAndEventsForTable(monitorId,videos,events){
        var chartData = []
        eventsLabeledByTime[monitorId] = {}
        $.each(videos,function(n,video){
            eventsLabeledByTime[monitorId][video.time] = {}
            if(videos[n - 1])video.videoAfter = videos[n - 1]
            if(videos[n + 1])video.videoBefore = videos[n + 1]
            checkEventsAgainstVideo(video,events)
            chartData.push({
                group: loadedTableGroupIds[monitorId],
                content: `<div timeline-video-file="${video.mid}${video.time}">
                    ${formattedTime(video.time, 'hh:mm:ss AA, DD-MM-YYYY')}
                    <div class="progress">
                        <div class="progress-bar progress-bar-danger" role="progressbar" style="width:0%;"><span></span></div>
                    </div>
                </div>`,
                start: video.time,
                end: video.end,
                videoInfo: video
            })
        })
        $.each(events,function(n,event){
            var eventReason = event.details && event.details.reason ? event.details.reason.toUpperCase() : "UNKNOWN"
            var eventSlotTag = eventReason
            if(eventReason === 'OBJECT' && event.details.matrices && event.details.matrices[0]){
                eventSlotTag = []
                event.details.matrices.forEach(function(matrix){
                    eventSlotTag.push(matrix.tag)
                })
                eventSlotTag = eventSlotTag.join(', ')
            }
            chartData.push({
                group: loadedTableGroupIds[monitorId + '_events'],
                content: `<div timeline-event="${event.time}">${eventSlotTag}</div>`,
                start: event.time,
                eventInfo: event
            })
        })
        return chartData
    }
    function getMiniEventsChartConfig(video){
        var monitorId = video.mid
        var labels = []
        var chartData = []
        var events = video.detections || video.events
        $.each(events,function(n,v){
            if(!v.details.confidence){v.details.confidence=0}
            var time = moment(v.time).format('MM/DD/YYYY HH:mm:ss')
            labels.push(time)
            chartData.push(v.details.confidence)
        })
        var timeFormat = 'MM/DD/YYYY HH:mm:ss';
        Chart.defaults.global.defaultFontColor = '#fff';
        var config = {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    type: 'line',
                    label: 'Motion Confidence',
                    backgroundColor: window.chartColors.blue,
                    borderColor: window.chartColors.red,
                    data: chartData,
                }]
            },
            options: {
                maintainAspectRatio: false,
                title: {
                    fontColor: "white",
                    text:"Events in this video"
                },
                scales: {
                    xAxes: [{
                        type: "time",
                        display: true,
                        time: {
                            format: timeFormat,
                        }
                    }],
                },
            }
        };
        return config
    }
    function drawMiniEventsChart(video,chartConfig){
        var videoContainer = powerVideoMonitorViewsElement.find(`.videoPlayer[data-mid=${video.mid}]`)
        var canvas = videoContainer.find('canvas')
        var ctx = canvas[0].getContext("2d")
        var miniChart = new Chart(ctx, chartConfig)
        canvas.click(function(f) {
            var target = miniChart.getElementsAtEvent(f)[0];
            if(!target){return false}
            var event = video.detections[target._index]
            var video1 = videoContainer.find('video')[0]
            video1.currentTime = moment(event.time).diff(moment(video.time),'seconds')
            video1.play()
        })
    }
    function getAllChartDataForLoadedVideos(){
        var chartData = []
        Object.keys(powerVideoLoadedVideos).forEach(function(monitorId,n){
            var videos = powerVideoLoadedVideos[monitorId]
            var events = powerVideoLoadedEvents[monitorId]
            var parsedVideos = prepareVideosAndEventsForTable(monitorId,videos,events)
            powerVideoLoadedChartData[monitorId] = parsedVideos
            chartData = chartData.concat(parsedVideos)
        })
        return chartData
    }
    function visuallySelectItemInRow(video){
        powerVideoTimelineStripsContainer.find(`[timeline-video-file="${video.mid}${video.time}"]`).parents('.vis-item').addClass('vis-selected')
    }
    function visuallyDeselectItemInRow(video){
        powerVideoTimelineStripsContainer.find(`[timeline-video-file="${video.mid}${video.time}"]`).parents('.vis-item').removeClass('vis-selected')
    }
    var drawTableTimeout = null
    function drawLoadedTableData(){
        // destroy old
        try{
            if(activeTimeline && activeTimeline.destroy){
                activeTimeline.destroy()
            }
        }catch(err){

        }
        //
        powerVideoTimelineStripsContainer.html(`<div class="loading"><i class="fa fa-spinner fa-pulse"></i><div class="epic-text">${lang['Please Wait...']}</div></div>`)
        clearTimeout(drawTableTimeout)
        drawTableTimeout = setTimeout(function(){
            var container = powerVideoTimelineStripsContainer[0]
            var groupsDataSet = new vis.DataSet()
            var groups = []
            var groupId = 1
            Object.keys(powerVideoLoadedVideos).forEach(function(monitorId,n){
                var mon = Object.values(loadedMonitors).find(m => { return m.mid === monitorId });
                var name = mon.name;
                groups.push({
                    id: groupId,
                    content: name + " | " + lang.Videos
                })
                groupId += 1
                groups.push({
                    id: groupId,
                    content: name + " | " + lang.Events
                })
                groupId += 1
                loadedTableGroupIds[monitorId] = groupId - 2
                loadedTableGroupIds[monitorId + '_events'] = groupId - 1
            })
            groupsDataSet.add(groups)
            var chartData = getAllChartDataForLoadedVideos()
            if(chartData.length > 0){
                var items = new vis.DataSet(chartData)
                var options = {
                    selectable: false,
                    stack: false,
                    showCurrentTime: false,
                }
                // Create a Timeline
                var timeline = new vis.Timeline(container, items, groupsDataSet, options)
                powerVideoTimelineStripsContainer.find('.loading').remove()
                var timeChanging = false
                timeline.on('rangechange', function(properties){
                    timeChanging = true
                })
                timeline.on('rangechanged', function(properties){
                    setTimeout(function(){
                        timeChanging = false
                    },300)
                })
                timeline.on('click', function(properties){
                    if(!timeChanging){
                        var selectedTime = properties.time
                        var videosAtSameTime = findAllVideosAtTime(selectedTime)
                        powerVideoTimelineStripsContainer.find('.vis-item').removeClass('vis-selected')
                        $.each(videosAtSameTime,function(monitorId,videos){
                            var selectedVideo = videos[0]
                            if(selectedVideo){
                                loadVideoIntoMonitorSlot(selectedVideo,selectedTime)
                                visuallySelectItemInRow(selectedVideo)
                            }
                        })
                    }
                })
                activeTimeline = timeline
            }else{
                powerVideoTimelineStripsContainer.html(`<div class="loading"><i class="fa fa-exclamation-circle"></i><div class="epic-text">${lang['No Data']}</div></div>`)
            }
        },1000)
    }
    function drawMatrices(event,options){
        var streamObjectsContainer = options.streamObjectsContainer
        var height = options.height
        var width = options.width
        var monitorId = options.mid
        var widthRatio = width / event.details.imgWidth
        var heightRatio = height / event.details.imgHeight

        streamObjectsContainer.find('.stream-detected-object[name="'+event.details.name+'"]').remove()
        var html = ''
        $.each(event.details.matrices,function(n,matrix){
            html += `<div class="stream-detected-object" name="${event.details.name}" style="height:${heightRatio * matrix.height}px;width:${widthRatio * matrix.width}px;top:${heightRatio * matrix.y}px;left:${widthRatio * matrix.x}px;">`
            if(matrix.tag)html += `<span class="tag">${matrix.tag}</span>`
            html += '</div>'
        })
        streamObjectsContainer.append(html)
    }
    function attachEventsToVideoActiveElement(video){
        var monitorId = video.mid
        var videoPlayerContainer = powerVideoMonitorViewsElement.find(`.videoPlayer[data-mid=${monitorId}]`)
        var videoElement = videoPlayerContainer.find(`video.videoNow`)
        var streamObjectsContainer = videoPlayerContainer.find(`.videoPlayer-stream-objects`)
        var detectionInfoContainerMotion = videoPlayerContainer.find(`.videoPlayer-detection-info-motion`)
        var detectionInfoContainerObject = videoPlayerContainer.find(`.videoPlayer-detection-info-object`)
        var detectionInfoContainerRaw = videoPlayerContainer.find(`.videoPlayer-detection-info-raw`)
        var motionMeterProgressBar = videoPlayerContainer.find(`.videoPlayer-motion-meter .progress-bar`)
        var motionMeterProgressBarTextBox = videoPlayerContainer.find(`.videoPlayer-motion-meter .progress-bar span`)
        var videoCurrentTimeProgressBar = powerVideoTimelineStripsContainer.find(`[timeline-video-file="${video.mid}${video.time}"] .progress-bar`)[0]
        var preloadedNext = false
        var reinitializeStreamObjectsContainer = function(){
            height = videoElement.height()
            width = videoElement.width()
        }
        reinitializeStreamObjectsContainer()
        $(videoElement)
            .resize(reinitializeStreamObjectsContainer)
            // .off('loadeddata').on('loadeddata', function() {
            //     reinitializeStreamObjectsContainer()
            //     var allLoaded = true
            //     getAllActiveVideosInSlots().each(function(n,videoElement){
            //         if(!videoElement.readyState === 4)allLoaded = false
            //     })
            //     setTimeout(function(){
            //         if(allLoaded){
            //             playAllSlots()
            //         }
            //     },1500)
            // })
            // .off("pause").on("pause",function(){
            //     console.log(monitorId,'pause')
            // })
            // .off("play").on("play",function(){
            //     console.log(monitorId,'play')
            // })
            .off("loadedmetadata").on("loadedmetadata",function(){
                resetWidthForActiveVideoPlayers()
            })
            .off("pause").on("pause",function(){
                resetWidthForActiveVideoPlayers()
            })
            .off("play").on("play",function(){
                resetWidthForActiveVideoPlayers()
            })
            .off("timeupdate").on("timeupdate",function(){
                try{
                    var event = eventsLabeledByTime[monitorId][video.time][parseInt(this.currentTime)]
                    if(event){
                        if(event.details.matrices){
                            drawMatrices(event,{
                                streamObjectsContainer: streamObjectsContainer,
                                monitorId: monitorId,
                                height: height,
                                width: width,
                            })
                            detectionInfoContainerObject.html(jsonToHtmlBlock(event.details.matrices))
                        }
                        if(event.details.confidence){
                            motionMeterProgressBar.css('width',event.details.confidence+'%')
                            motionMeterProgressBarTextBox.text(event.details.confidence)
                            var html = `<div>${lang['Region']} : ${event.details.name}</div>
                                <div>${lang['Confidence']} : ${event.details.confidence}</div>
                                <div>${lang['Plugin']} : ${event.details.plug}</div>`
                            detectionInfoContainerMotion.html(html)
                            // detectionInfoContainerRaw.html(jsonToHtmlBlock({`${lang['Plug']}`:event.details.plug}))
                        }
                    }
                    var currentTime = this.currentTime;
                    var watchPoint = Math.floor((currentTime/this.duration) * 100)
                    if(!preloadedNext && watchPoint >= 75){
                        preloadedNext = true
                        var videoAfter = videoPlayerContainer.find(`video.videoAfter`)[0]
                        videoAfter.setAttribute('preload',true)
                    }
                    if(videoCurrentTimeProgressBar)videoCurrentTimeProgressBar.style.width = `${watchPoint}%`
                    extenders.onVideoPlayerTimeUpdateExtensions.forEach(function(extender){
                        extender(videoElement,watchPoint)
                    })
                }catch(err){
                    console.log(err)
                }
            })
            var onEnded = function() {
                visuallyDeselectItemInRow(video)
                if(video.videoAfter){
                    visuallySelectItemInRow(video.videoAfter)
                    loadVideoIntoMonitorSlot(video.videoAfter)
                }
            }
            videoElement[0].onended = onEnded
            videoElement[0].onerror = onEnded
    }
    function dettachEventsToVideoActiveElement(monitorId){
        var videoElement = powerVideoMonitorViewsElement.find(`.videoPlayer[data-mid=${monitorId}] video.videoNow`)
        $(videoElement)
            // .off('loadeddata')
            .off("pause")
            .off("play")
            .off("timeupdate")
    }
    function findAllVideosAtTime(selectedTime){
        var time = new Date(selectedTime)
        var parsedVideos = {}
        $.each(powerVideoLoadedVideos,function(monitorId,videos){
            var videosFilteredByTime = videos.filter(function(video){
                return (
                    (new Date(video.time)) <= time && time < (new Date(video.end))
                )
            });
            parsedVideos[monitorId] = videosFilteredByTime
        })
        return parsedVideos
    }
    function resetVisualDetectionDataForMonitorSlot(monitorId){
        var videoPlayerContainer = powerVideoMonitorViewsElement.find(`.videoPlayer[data-mid=${monitorId}]`)
        var streamObjectsContainer = videoPlayerContainer.find(`.videoPlayer-stream-objects`)
        var detectionInfoContainerObject = videoPlayerContainer.find(`.videoPlayer-detection-info-object`)
        var detectionInfoContainerMotion = videoPlayerContainer.find(`.videoPlayer-detection-info-motion`)
        var motionMeterProgressBar = videoPlayerContainer.find(`.videoPlayer-motion-meter .progress-bar`)
        var motionMeterProgressBarTextBox = videoPlayerContainer.find(`.videoPlayer-motion-meter .progress-bar span`)
        detectionInfoContainerObject.empty()
        detectionInfoContainerMotion.empty()
        streamObjectsContainer.empty()
        motionMeterProgressBar.css('width','0')
        motionMeterProgressBarTextBox.text('0')
    }
    function resetWidthForActiveVideoPlayers(){
        var numberOfMonitors = 0
        powerVideoMonitorViewsElement.find(`.videoPlayer .videoNow`).each(function(n,videoEl){
            if(videoEl.currentTime > 0)numberOfMonitors += 1
        })
        var widthOfBlock = 100 / numberOfMonitors
        powerVideoMonitorViewsElement.find('.videoPlayer').css('width',`${widthOfBlock}%`)
    }
    function loadVideoIntoMonitorSlot(video,selectedTime){
        if(!video)return
        resetVisualDetectionDataForMonitorSlot(video.mid)
        currentlyPlayingVideos[video.mid] = video
        var timeToStartAt = selectedTime - new Date(video.time)
        var numberOfMonitors = Object.keys(powerVideoLoadedVideos).length
        // if(numberOfMonitors > 3)numberOfMonitors = 3 //start new row after 3
        if(numberOfMonitors == 1)numberOfMonitors = 2 //make single monitor not look like a doofus
        if(timeToStartAt < 0)timeToStartAt = 0
        var widthOfBlock = 100 / numberOfMonitors
        var videoContainer = powerVideoMonitorViewsElement.find(`.videoPlayer[data-mid=${video.mid}] .videoPlayer-buffers`)
        if(videoContainer.length === 0){
            if(!monitorSlotPlaySpeeds)monitorSlotPlaySpeeds[video.mid] = {}
            powerVideoMonitorViewsElement.append(`<div class="videoPlayer" style="width:${widthOfBlock}%;max-width:500px" data-mid="${video.mid}">
                <div class="videoPlayer-detection-info">
                    <canvas style="height:400px"></canvas>
                </div>
                <div class="videoPlayer-stream-objects"></div>
                <div class="videoPlayer-buffers"></div>
                <div class="videoPlayer-motion-meter progress" title="${lang['Motion Meter']}">
                    <div class="progress-bar progress-bar-danger" role="progressbar" style="width:0%;"><span></span></div>
                </div>
            </div>`)
            videoContainer = powerVideoMonitorViewsElement.find(`.videoPlayer[data-mid=${video.mid}] .videoPlayer-buffers`)
        }else{
            powerVideoMonitorViewsElement.find('.videoPlayer').css('width',`${widthOfBlock}%`)
        }
        var videoCurrentNow = videoContainer.find('.videoNow')
        var videoCurrentAfter = videoContainer.find('.videoAfter')
        // var videoCurrentBefore = videoContainer.find('.videoBefore')
        dettachEventsToVideoActiveElement(video.mid)
        videoContainer.find('video').each(function(n,v){
            v.pause()
        })
        var videoIsSame = (video.href == videoCurrentNow.attr('video'))
        var videoIsAfter = (video.href == videoCurrentAfter.attr('video'))
        // var videoIsBefore = (video.href == videoCurrentBefore.attr('video'))
        var drawVideoHTML = function(position){
            var videoData
            var exisitingElement = videoContainer.find('.' + position)
            if(position){
                videoData = video[position]
            }else{
                position = 'videoNow'
                videoData = video
            }
            if(videoData){
               videoContainer.append('<video class="video_video '+position+'" video="'+videoData.href+'" playsinline><source src="'+videoData.href+'" type="video/'+videoData.ext+'"></video>')
            }
        }
        if(
            videoIsSame ||
            videoIsAfter
            // || videoIsBefore
        ){
            switch(true){
                case videoIsSame:
                    var videoNow = videoContainer.find('video.videoNow')[0]
                    if(!videoNow.paused)videoNow.pause()
                    videoNow.currentTime = timeToStartAt / 1000
                    if(videoNow.paused)videoNow.play()
                    attachEventsToVideoActiveElement(video)
                    return
                break;
                case videoIsAfter:
                    // videoCurrentBefore.remove()
                    videoCurrentNow.remove()
                    videoCurrentAfter.removeClass('videoAfter').addClass('videoNow')
                    // videoCurrentNow.removeClass('videoNow').addClass('videoBefore')
                    drawVideoHTML('videoAfter')
                break;
                // case videoIsBefore:
                //     videoCurrentAfter.remove()
                //     videoCurrentBefore.removeClass('videoBefore').addClass('videoNow')
                //     videoCurrentNow.removeClass('videoNow').addClass('videoAfter')
                //     drawVideoHTML('videoBefore')
                // break;
            }
        }else{
            videoContainer.empty()
            drawVideoHTML()//videoNow
            // drawVideoHTML('videoBefore')
            drawVideoHTML('videoAfter')
        }
        var videoNow = videoContainer.find('video.videoNow')[0]
        attachEventsToVideoActiveElement(video)
        //
        videoNow.setAttribute('preload',true)
        videoNow.muted = true
        videoNow.playbackRate = monitorSlotPlaySpeeds[video.mid] || 1
        try{
            videoNow.currentTime = timeToStartAt / 1000
        }catch(err){
            console.log(err)
        }
        videoNow.play()
        setTimeout(function(){
            resetWidthForActiveVideoPlayers()
        },1400)
        extenders.onVideoPlayerCreateExtensions.forEach(function(extender){
            extender(videoElement,watchPoint)
        })
        drawMiniEventsChart(video,getMiniEventsChartConfig(video))
    }
    function getSelectedMonitors(){
        var form = powerVideoMonitorsListElement.serializeObject()
        var selectedMonitors = Object.keys(form).filter(key => form[key] == '1')
        return selectedMonitors
    }
    function getAllActiveVideosInSlots(){
        return powerVideoMonitorViewsElement.find('video.videoNow')
    }
    function pauseAllSlots(){
        getAllActiveVideosInSlots().each(function(n,video){
            if(!video.paused)video.pause()
        })
    }
    function toggleZoomAllSlots(){
        powerVideoMonitorViewsElement.find(`.videoPlayer`).each(function(n,videoContainer){
            var streamWindow = $(videoContainer)
            var monitorId = streamWindow.attr('data-mid')
            var enabled = streamWindow.attr('zoomEnabled')
            if(enabled === '1'){
                streamWindow
                    .attr('zoomEnabled','0')
                    .off('mouseover')
                    .off('mouseout')
                    .off('mousemove')
                    .off('touchmove')
                    .find('.zoomGlass').remove()
            }else{
                const magnifyStream = function(e){
                    var videoElement = streamWindow.find('video.videoNow')
                    console.log(videoElement[0].currentTime)
                    magnifyStream({
                        p: streamWindow,
                        videoUrl: streamWindow.find('video.videoNow').find('source').attr('src'),
                        setTime: videoElement[0].currentTime,
                        monitor: loadedMonitors[monitorId],
                        targetForZoom: 'video.videoNow',
                        magnifyOffsetElement: '.videoPlayer-buffers',
                        zoomAmount: 1,
                        auto: false,
                        animate: false,
                        pageX: e.pageX,
                        pageY:  e.pageY
                    },$user)
                }
                streamWindow
                    .attr('zoomEnabled','1')
                    .on('mouseover', function(){
                        streamWindow.find(".zoomGlass").show()
                    })
                    .on('mouseout', function(){
                        streamWindow.find(".zoomGlass").hide()
                    })
                    .on('mousemove', magnifyStream)
                    .on('touchmove', magnifyStream)
            }
        })
    }
    function playAllSlots(){
        getAllActiveVideosInSlots().each(function(n,video){
            if(video.paused)video.play()
        })
    }
    function toggleMute(){
        powerVideoMute = !powerVideoMute
        getAllActiveVideosInSlots().each(function(n,video){
            if(powerVideoMute){
                powerVideoMuteIcon.removeClass('fa-volume-up').addClass('fa-volume-off')
                video.muted = true
            }else{
                powerVideoMuteIcon.removeClass('fa-volume-off').addClass('fa-volume-up')
                video.muted = false
            }
        })
    }
    function setPlaySpeedOnAllSlots(playSpeed){
        Object.keys(powerVideoLoadedVideos).forEach(function(monitorId){
            monitorSlotPlaySpeeds[monitorId] = playSpeed
        })
        getAllActiveVideosInSlots().each(function(n,video){
            video.playbackRate = playSpeed
        })
    }
    function nextVideoAllSlots(){
        Object.keys(currentlyPlayingVideos).forEach(function(monitorId){
            var video = currentlyPlayingVideos[monitorId]
            visuallyDeselectItemInRow(video)
            visuallySelectItemInRow(video.videoAfter)
            loadVideoIntoMonitorSlot(video.videoAfter,0)
        })
    }
    function previousVideoAllSlots(){
        Object.keys(currentlyPlayingVideos).forEach(function(monitorId){
            var video = currentlyPlayingVideos[monitorId]
            visuallyDeselectItemInRow(video)
            visuallySelectItemInRow(video.videoBefore)
            loadVideoIntoMonitorSlot(video.videoBefore,0)
        })
    }
    function onPowerVideoSettingsChange(){
        var monitorIdsSelectedNow = getSelectedMonitors()
        lastPowerVideoSelectedMonitors.forEach((monitorId) => {
            unloadTableData(monitorId)
        })
        monitorIdsSelectedNow.forEach(async (monitorId) => {
            await requestTableData(monitorId)
        })
        lastPowerVideoSelectedMonitors = ([]).concat(monitorIdsSelectedNow || [])
    }
    powerVideoMonitorsListElement.on('change','input',onPowerVideoSettingsChange);
    powerVideoVideoLimitElement.change(onPowerVideoSettingsChange);
    powerVideoEventLimitElement.change(onPowerVideoSettingsChange);
    powerVideoSet.change(onPowerVideoSettingsChange);
    powerVideoWindow
        .on('dblclick','.videoPlayer',function(){
            var el = $(this)
            $('.videoPlayer-detection-info').addClass('hide')
            fullScreenInit(this)
        })
        .on('click','[powerVideo-control]',function(){
            var el = $(this)
            var controlType = el.attr('powerVideo-control')
            switch(controlType){
                case'toggleMute':
                    toggleMute()
                break;
                case'toggleZoom':
                    toggleZoomAllSlots()
                break;
                case'playAll':
                    powerVideoCanAutoPlay = true
                    playAllSlots()
                break;
                case'pauseAll':
                    powerVideoCanAutoPlay = false
                    pauseAllSlots()
                break;
                case'playSpeedAll':
                    var playSpeed = el.attr('data-speed')
                    setPlaySpeedOnAllSlots(playSpeed)
                break;
                case'previousVideoAll':
                    playAllSlots()
                    previousVideoAllSlots()
                break;
                case'nextVideoAll':
                    playAllSlots()
                    nextVideoAllSlots()
                break;
            }
        });

    addOnTabOpen('powerVideo', function () {
        drawMonitorsList()
    })
    addOnTabReopen('powerVideo', function () {
        if(powerVideoCanAutoPlay){
            powerVideoWindow.find('video').each(function(n,video){
                try{
                    video.play()
                }catch(err){
                    console.log(err)
                }
            })
        }
    })
    addOnTabAway('powerVideo', function () {
        powerVideoWindow.find('video').each(function(n,video){
            console.log(video)
            try{
                video.pause()
            }catch(err){
                console.log(err)
            }
        })
    })
    // addOnTabReopen('powerVideo', function () {
    //     drawMonitorsList()
    // })
    $.powerVideoViewer = {
        window: powerVideoWindow,
        drawMonitorsList: drawMonitorsList,
        activeTimeline: activeTimeline,
        monitorListElement: powerVideoMonitorsListElement,
        monitorViewsElement: powerVideoMonitorViewsElement,
        timelineStripsElement: powerVideoTimelineStripsContainer,
        dateRangeElement: dateSelector,
        loadedVideos: powerVideoLoadedVideos,
        loadedEvents: powerVideoLoadedEvents,
        loadedChartData: powerVideoLoadedChartData,
        loadedTableGroupIds: loadedTableGroupIds,
        extenders: extenders
    }
})
