var fs = require('fs');
module.exports = function(s,config,lang){
    //Amazon S3
    function beforeAccountSave(d){
        //d = save event
        d.formDetails.aws_use_global=d.d.aws_use_global
        d.formDetails.use_aws_s3=d.d.use_aws_s3
    }
    function cloudDiskUseStartup(group,userDetails){
        group.cloudDiskUse['s3'].name = 'Amazon S3'
        group.cloudDiskUse['s3'].sizeLimitCheck = (userDetails.use_aws_s3_size_limit === '1')
        if(!userDetails.aws_s3_size_limit || userDetails.aws_s3_size_limit === ''){
            group.cloudDiskUse['s3'].sizeLimit = 10000
        }else{
            group.cloudDiskUse['s3'].sizeLimit = parseFloat(userDetails.aws_s3_size_limit)
        }
    }
    function loadGroupApp(e){
        // e = user
        var userDetails = JSON.parse(e.details)
        if(userDetails.aws_use_global === '1' && config.cloudUploaders && config.cloudUploaders.AmazonS3){
            // {
            //     aws_accessKeyId: "",
            //     aws_secretAccessKey: "",
            //     aws_region: "",
            //     aws_s3_bucket: "",
            //     aws_s3_dir: "",
            // }
            userDetails = Object.assign(userDetails,config.cloudUploaders.AmazonS3)
        }
        //Amazon S3
        if(!s.group[e.ke].aws &&
           !s.group[e.ke].aws_s3 &&
           userDetails.aws_s3 !== '0' &&
           userDetails.aws_accessKeyId !== ''&&
           userDetails.aws_secretAccessKey &&
           userDetails.aws_secretAccessKey !== ''&&
           userDetails.aws_region &&
           userDetails.aws_region !== ''&&
           userDetails.aws_s3_bucket !== ''
          ){
            if(!userDetails.aws_s3_dir || userDetails.aws_s3_dir === '/'){
                userDetails.aws_s3_dir = ''
            }
            if(userDetails.aws_s3_dir !== ''){
                userDetails.aws_s3_dir = s.checkCorrectPathEnding(userDetails.aws_s3_dir)
            }
            s.group[e.ke].aws = new require("aws-sdk")
            s.group[e.ke].aws.config = new s.group[e.ke].aws.Config({
                accessKeyId: userDetails.aws_accessKeyId,
                secretAccessKey: userDetails.aws_secretAccessKey,
                region: userDetails.aws_region
            })
            s.group[e.ke].aws_s3 = new s.group[e.ke].aws.S3();
        }
    }
    function unloadGroupApp(user){
        s.group[user.ke].aws = null
        s.group[user.ke].aws_s3 = null
    }
    function deleteVideo(e,video,callback){
        // e = user
        try{
            var videoDetails = JSON.parse(video.details)
        }catch(err){
            var videoDetails = video.details
        }
        if(!videoDetails.location){
            videoDetails.location = video.href.split('.amazonaws.com')[1]
        }
        if(videoDetails.type !== 's3'){
            return
        }
        try{
            s.group[video.ke].aws_s3.deleteObject({
                Bucket: s.group[video.ke].init.aws_s3_bucket,
                Key: videoDetails.location,
            }, function(err, data) {
                if (err) console.log(err);
                callback()
            });
        }catch(err){
            console.log('Amazon S3 DELETE Error',err)
            callback()
        }
    }
    function uploadVideo(e,k){
        //e = video object
        //k = temporary values
        if(!k)k={};
        //cloud saver - amazon s3
        if(s.group[e.ke].aws_s3 && s.group[e.ke].init.use_aws_s3 !== '0' && s.group[e.ke].init.aws_s3_save === '1'){
            var ext = k.filename.split('.')
            ext = ext[ext.length - 1]
            var fileStream = fs.createReadStream(k.dir+k.filename);
            fileStream.on('error', function (err) {
                console.error(err)
            })
            var saveLocation = s.group[e.ke].init.aws_s3_dir+e.ke+'/'+e.mid+'/'+k.filename
            s.group[e.ke].aws_s3.upload({
                Bucket: s.group[e.ke].init.aws_s3_bucket,
                Key: saveLocation,
                Body: fileStream,
                ContentType: 'video/'+ext
            },function(err,data){
                if(err){
                    s.userLog(e,{type:lang['Amazon S3 Upload Error'],msg:err})
                }
                if(s.group[e.ke].init.aws_s3_log === '1' && data && data.Location){
                    s.knexQuery({
                        action: "insert",
                        table: "Cloud Videos",
                        insert: {
                            mid: e.mid,
                            ke: e.ke,
                            time: k.startTime,
                            status: 1,
                            details: s.s({
                                type : 's3',
                                location : saveLocation
                            }),
                            size: k.filesize,
                            end: k.endTime,
                            href: ''
                        }
                    })
                    s.setCloudDiskUsedForGroup(e.ke,{
                        amount: k.filesizeMB,
                        storageType: 's3'
                    })
                    s.purgeCloudDiskForGroup(e,'s3')
                }
            })
        }
    }
    function onInsertTimelapseFrame(monitorObject,queryInfo,filePath){
        var e = monitorObject
        if(s.group[e.ke].aws_s3 && s.group[e.ke].init.use_aws_s3 !== '0' && s.group[e.ke].init.aws_s3_save === '1'){
            var fileStream = fs.createReadStream(filePath)
            fileStream.on('error', function (err) {
                console.error(err)
            })
            var saveLocation = s.group[e.ke].init.aws_s3_dir + e.ke + '/' + e.mid + '_timelapse/' + queryInfo.filename
            s.group[e.ke].aws_s3.upload({
                Bucket: s.group[e.ke].init.aws_s3_bucket,
                Key: saveLocation,
                Body: fileStream,
                ACL:'public-read',
                ContentType:'image/jpeg'
            },function(err,data){
                if(err){
                    s.userLog(e,{type:lang['Wasabi Hot Cloud Storage Upload Error'],msg:err})
                }
                if(s.group[e.ke].init.aws_s3_log === '1' && data && data.Location){
                    s.knexQuery({
                        action: "insert",
                        table: "Cloud Timelapse Frames",
                        insert: {
                            mid: queryInfo.mid,
                            ke: queryInfo.ke,
                            time: queryInfo.time,
                            filename: queryInfo.filename,
                            details: s.s({
                                type : 's3',
                                location : saveLocation
                            }),
                            size: queryInfo.size,
                            href: data.Location
                        }
                    })
                    s.setCloudDiskUsedForGroup(e.ke,{
                        amount : s.kilobyteToMegabyte(queryInfo.size),
                        storageType : 's3'
                    },'timelapseFrames')
                    s.purgeCloudDiskForGroup(e,'s3','timelapseFrames')
                }
            })
        }
    }
    function onDeleteTimelapseFrameFromCloud(e,frame,callback){
        // e = user
        try{
            var frameDetails = JSON.parse(frame.details)
        }catch(err){
            var frameDetails = frame.details
        }
        if(frameDetails.type !== 's3'){
            return
        }
        if(!frameDetails.location){
            frameDetails.location = frame.href.split(locationUrl)[1]
        }
        s.group[e.ke].aws_s3.deleteObject({
            Bucket: s.group[e.ke].init.aws_s3_bucket,
            Key: frameDetails.location,
        }, function(err, data) {
            if (err) console.log(err);
            callback()
        });
    }
    function onGetVideoData(video){
        const videoDetails = s.parseJSON(video.details)
        return new Promise((resolve, reject) => {
            const saveLocation = videoDetails.location
            var fileStream = s.group[video.ke].aws_s3.getObject({
                Bucket: s.group[video.ke].init.aws_s3_bucket,
                Key: saveLocation,
            }).createReadStream();
            resolve(fileStream)
        })
    }
    //amazon s3
    s.addCloudUploader({
        name: 's3',
        loadGroupAppExtender: loadGroupApp,
        unloadGroupAppExtender: unloadGroupApp,
        insertCompletedVideoExtender: uploadVideo,
        deleteVideoFromCloudExtensions: deleteVideo,
        cloudDiskUseStartupExtensions: cloudDiskUseStartup,
        beforeAccountSave: beforeAccountSave,
        onAccountSave: cloudDiskUseStartup,
        onInsertTimelapseFrame: onInsertTimelapseFrame,
        onDeleteTimelapseFrameFromCloud: onDeleteTimelapseFrameFromCloud,
        onGetVideoData
    })
    //return fields that will appear in settings
    return {
       "evaluation": "details.use_aws_s3 !== '0'",
       "name": lang["Amazon S3"],
       "color": "forestgreen",
       "info": [
           {
              "name": "detail=aws_s3_save",
              "selector":"autosave_aws_s3",
              "field": lang.Autosave,
              "description": "",
              "default": lang.No,
              "example": "",
              "fieldType": "select",
              "possible": [
                  {
                     "name": lang.No,
                     "value": "0"
                  },
                  {
                     "name": lang.Yes,
                     "value": "1"
                  }
              ]
           },
           {
              "hidden": true,
              "field": lang.Bucket,
              "name": "detail=aws_s3_bucket",
              "placeholder": "Example : slippery-seal",
              "form-group-class": "autosave_aws_s3_input autosave_aws_s3_1",
              "description": "",
              "default": "",
              "example": "",
              "possible": ""
           },
           {
               "hidden": true,
              "field": lang.aws_accessKeyId,
              "name": "detail=aws_accessKeyId",
              "form-group-class": "autosave_aws_s3_input autosave_aws_s3_1",
              "description": "",
              "default": "",
              "example": "",
              "possible": ""
           },
           {
               "hidden": true,
              "name": "detail=aws_secretAccessKey",
              "fieldType":"password",
              "placeholder": "",
              "field": lang.aws_secretAccessKey,
              "form-group-class":"autosave_aws_s3_input autosave_aws_s3_1",
              "description": "",
              "default": "",
              "example": "",
              "possible": ""
           },
           {
               "hidden": true,
              "name": "detail=aws_region",
              "field": lang.Region,
              "fieldType": "select",
              "form-group-class":"autosave_aws_s3_input autosave_aws_s3_1",
              "description": "",
              "default": "",
              "example": "",
              "possible": [
                   {
                      "name": "US West (N. California)",
                      "value": "us-west-1"
                   },
                   {
                      "name": "US West (Oregon)",
                      "value": "us-west-2"
                   },
                   {
                      "name": "US East (Ohio)",
                      "value": "us-east-2"
                   },
                   {
                      "name": "US East (N. Virginia)",
                      "value": "us-east-1"
                   },
                   {
                      "name": "Asia Pacific (Mumbai)",
                      "value": "ap-south-1"
                   },
                   {
                      "name": "Asia Pacific (Seoul)",
                      "value": "ap-northeast-2"
                   },
                   {
                      "name": "Asia Pacific (Osaka-Local)**",
                      "value": "ap-northeast-3"
                   },
                   {
                      "name": "Asia Pacific (Singapore)",
                      "value": "ap-southeast-1"
                   },
                   {
                      "name": "Asia Pacific (Sydney)",
                      "value": "ap-southeast-2"
                   },
                   {
                      "name": "Asia Pacific (Tokyo)",
                      "value": "ap-northeast-1"
                   },
                   {
                      "name": "Canada (Central)",
                      "value": "ca-central-1"
                   },
                   {
                      "name": "China (Beijing)",
                      "value": "cn-north-1"
                   },
                   {
                      "name": "China (Ningxia)",
                      "value": "cn-northwest-1"
                   },
                   {
                      "name": "EU (Frankfurt)",
                      "value": "eu-central-1"
                   },
                   {
                      "name": "EU (Ireland)",
                      "value": "eu-west-1"
                   },
                   {
                      "name": "EU (London)",
                      "value": "eu-west-2"
                   },
                   {
                      "name": "EU (Paris)",
                      "value": "eu-west-3"
                   },
                   {
                      "name": "South America (São Paulo)",
                      "value": "sa-east-1"
                   }
                ]
          },
          {
              "hidden": true,
             "name": "detail=aws_s3_log",
             "field": lang['Save Links to Database'],
             "fieldType": "select",
             "selector": "h_s3sld",
             "form-group-class":"autosave_aws_s3_input autosave_aws_s3_1",
             "description": "",
             "default": "",
             "example": "",
             "possible": [
                 {
                    "name": lang.No,
                    "value": "0"
                 },
                 {
                    "name": lang.Yes,
                    "value": "1"
                 }
             ]
         },
         {
             "hidden": true,
            "name": "detail=use_aws_s3_size_limit",
            "field": lang['Use Max Storage Amount'],
            "fieldType": "select",
            "selector": "h_s3zl",
            "form-group-class":"autosave_aws_s3_input autosave_aws_s3_1",
            "form-group-class-pre-layer":"h_s3sld_input h_s3sld_1",
            "description": "",
            "default": "",
            "example": "",
            "possible":  [
                {
                   "name": lang.No,
                   "value": "0"
                },
                {
                   "name": lang.Yes,
                   "value": "1"
                }
            ]
         },
         {
             "hidden": true,
            "name": "detail=aws_s3_size_limit",
            "field": lang['Max Storage Amount'],
            "form-group-class":"autosave_aws_s3_input autosave_aws_s3_1",
            "form-group-class-pre-layer":"h_s3sld_input h_s3sld_1",
            "description": "",
            "default": "10000",
            "example": "",
            "possible": ""
         },
         {
             "hidden": true,
            "name": "detail=aws_s3_dir",
            "field": lang['Save Directory'],
            "form-group-class":"autosave_aws_s3_input autosave_aws_s3_1",
            "description": "",
            "default": "/",
            "example": "",
            "possible": ""
         },
       ]
    }
}
