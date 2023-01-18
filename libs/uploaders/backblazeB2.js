const fs = require('fs');
const { Readable } = require('stream');
module.exports = function(s,config,lang){
    //Backblaze B2
    var beforeAccountSaveForBackblazeB2 = function(d){
        //d = save event
        d.formDetails.b2_use_global=d.d.b2_use_global
        d.formDetails.use_bb_b2=d.d.use_bb_b2
    }
    var cloudDiskUseStartupForBackblazeB2 = function(group,userDetails){
        group.cloudDiskUse['b2'].name = 'Backblaze B2'
        group.cloudDiskUse['b2'].sizeLimitCheck = (userDetails.use_bb_b2_size_limit === '1')
        if(!userDetails.bb_b2_size_limit || userDetails.bb_b2_size_limit === ''){
            group.cloudDiskUse['b2'].sizeLimit = 10000
        }else{
            group.cloudDiskUse['b2'].sizeLimit = parseFloat(userDetails.bb_b2_size_limit)
        }
    }
    var loadBackblazeB2ForUser = function(e){
        var userDetails = JSON.parse(e.details);
        try{
            if(userDetails.b2_use_global === '1' && config.cloudUploaders && config.cloudUploaders.BackblazeB2){
                // {
                //     bb_b2_accountId: "",
                //     bb_b2_applicationKey: "",
                //     bb_b2_bucket: "",
                //     bb_b2_dir: "",
                // }
                userDetails = Object.assign(userDetails,config.cloudUploaders.BackblazeB2)
            }
            if(!s.group[e.ke].bb_b2 &&
               userDetails.bb_b2_accountId &&
               userDetails.bb_b2_accountId !=='' &&
               userDetails.bb_b2_applicationKey &&
               userDetails.bb_b2_applicationKey !=='' &&
               userDetails.bb_b2_bucket &&
               userDetails.bb_b2_bucket !== '' &&
               userDetails.bb_b2_save === '1'
              ){
                var B2 = require('backblaze-b2')
                if(!userDetails.bb_b2_dir || userDetails.bb_b2_dir === '/'){
                  userDetails.bb_b2_dir = ''
                }
                if(userDetails.bb_b2_dir !== ''){
                  userDetails.bb_b2_dir = s.checkCorrectPathEnding(userDetails.bb_b2_dir)
                }
                var backblazeErr = function(err){
                    // console.log(err)
                    s.userLog({mid:'$USER',ke:e.ke},{type:lang['Backblaze Error'],msg:err.stack || err.data || err})
                }
                var createB2Connection = function(){
                    var b2 = new B2({
                        accountId: userDetails.bb_b2_accountId,
                        applicationKey: userDetails.bb_b2_applicationKey
                    })
                    b2.authorize().then(function(resp){
                        s.group[e.ke].bb_b2_downloadUrl = resp.downloadUrl
                        b2.listBuckets().then(function(resp){
                            var buckets = resp.buckets
                            var bucketN = -2
                            if(!buckets){
                                s.userLog({mid:'$USER',ke:e.ke},{type: lang['Backblaze Error'],msg: lang['Not Authorized']})
                                return
                            }
                            buckets.forEach(function(item,n){
                                if(item.bucketName === userDetails.bb_b2_bucket){
                                    bucketN = n
                                }
                            })
                            if(bucketN > -1){
                                s.group[e.ke].bb_b2_bucketId = buckets[bucketN].bucketId
                            }else{
                                b2.createBucket(
                                    userDetails.bb_b2_bucket,
                                    'allPublic'
                                ).then(function(resp){
                                    s.group[e.ke].bb_b2_bucketId = resp.bucketId
                                }).catch(backblazeErr)
                            }
                        }).catch(backblazeErr)
                    }).catch(backblazeErr)
                    s.group[e.ke].bb_b2 = b2
                }
                createB2Connection()
                s.group[e.ke].bb_b2_refreshTimer = setInterval(createB2Connection,1000 * 60 * 60)
            }
        }catch(err){
            s.debugLog(err)
        }
    }
    var unloadBackblazeB2ForUser = function(user){
        s.group[user.ke].bb_b2 = null
        clearInterval(s.group[user.ke].bb_b2_refreshTimer)
    }
    var deleteVideoFromBackblazeB2 = function(e,video,callback){
        // e = user
        try{
            var videoDetails = JSON.parse(video.details)
        }catch(err){
            var videoDetails = video.details
        }
        s.group[e.ke].bb_b2.deleteFileVersion({
            fileId: videoDetails.fileId,
            fileName: videoDetails.fileName
        }).then(function(resp){
            // console.log('deleteFileVersion',resp)
        }).catch(function(err){
            console.log('deleteFileVersion',err)
        })
    }
    var uploadVideoToBackblazeB2 = function(e,k){
        //e = video object
        //k = temporary values
        if(!k)k={};
        //cloud saver - Backblaze B2
        if(s.group[e.ke].bb_b2 && s.group[e.ke].init.use_bb_b2 !== '0' && s.group[e.ke].init.bb_b2_save === '1'){
            var backblazeErr = function(err){
                // console.log(err)
                s.userLog({mid:'$USER',ke:e.ke},{type:lang['Backblaze Error'],msg:err.data})
            }
            fs.readFile(k.dir+k.filename,function(err,data){
                var backblazeSavePath = s.group[e.ke].init.bb_b2_dir+e.ke+'/'+e.mid+'/'+k.filename
                var getUploadUrl = function(bucketId,callback){
                    s.group[e.ke].bb_b2.getUploadUrl(bucketId).then(function(resp){
                        callback(resp)
                    }).catch(backblazeErr)
                }
                getUploadUrl(s.group[e.ke].bb_b2_bucketId,function(req){
                    s.group[e.ke].bb_b2.uploadFile({
                        uploadUrl: req.uploadUrl,
                        uploadAuthToken: req.authorizationToken,
                        filename: backblazeSavePath,
                        data: data,
                        onUploadProgress: null
                    }).then(function(resp){
                        if(s.group[e.ke].init.bb_b2_log === '1' && resp.fileId){
                            var backblazeDownloadUrl = s.group[e.ke].bb_b2_downloadUrl + '/file/' + s.group[e.ke].init.bb_b2_bucket + '/' + backblazeSavePath
                            s.knexQuery({
                                action: "insert",
                                table: "Cloud Videos",
                                insert: {
                                    mid: e.mid,
                                    ke: e.ke,
                                    time: k.startTime,
                                    status: 1,
                                    details: s.s({
                                        type : 'b2',
                                        bucketId : resp.bucketId,
                                        fileId : resp.fileId,
                                        fileName : resp.fileName
                                    }),
                                    size: k.filesize,
                                    end: k.endTime,
                                    href: ''
                                }
                            })
                            s.setCloudDiskUsedForGroup(e.ke,{
                                amount : k.filesizeMB,
                                storageType : 'b2'
                            })
                            s.purgeCloudDiskForGroup(e,'b2')
                        }
                    }).catch(backblazeErr)
                })
            })
        }
    }
    function onGetVideoData(video){
        const videoDetails = s.parseJSON(video.details)
        const fileName = videoDetails.fileName
        const groupKey = video.ke
        const b2 = s.group[video.ke].bb_b2
        const bucketName = s.group[groupKey].init.bb_b2_bucket
        return new Promise((resolve, reject) => {
            b2.downloadFileByName({
                bucketName,
                fileName,
                responseType: 'stream',
                onDownloadProgress: (event) => {
                    s.debugLog(event)
                },
            }).then((response) => {
                const fileStream = Readable.from(response.data);
                resolve(fileStream)
            }).catch((err) => {
                reject(err)
            });
        })
    }
    //backblaze b2
    s.addCloudUploader({
        name: 'b2',
        loadGroupAppExtender: loadBackblazeB2ForUser,
        unloadGroupAppExtender: unloadBackblazeB2ForUser,
        insertCompletedVideoExtender: uploadVideoToBackblazeB2,
        deleteVideoFromCloudExtensions: deleteVideoFromBackblazeB2,
        cloudDiskUseStartupExtensions: cloudDiskUseStartupForBackblazeB2,
        beforeAccountSave: beforeAccountSaveForBackblazeB2,
        onAccountSave: cloudDiskUseStartupForBackblazeB2,
        onGetVideoData,
    })
    return {
       "evaluation": "details.use_bb_b2 !== '0'",
       "name": lang["Backblaze B2"],
       "color": "forestgreen",
       "info": [
           {
              "name": "detail=bb_b2_save",
              "selector":"autosave_bb_b2",
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
              "name": "detail=bb_b2_bucket",
              "placeholder": "Example : slippery-seal",
              "form-group-class": "autosave_bb_b2_input autosave_bb_b2_1",
              "description": "",
              "default": "",
              "example": "",
              "possible": ""
           },
           {
               "hidden": true,
              "field": lang.keyId,
              "name": "detail=bb_b2_accountId",
              "form-group-class": "autosave_bb_b2_input autosave_bb_b2_1",
              "description": "",
              "default": "",
              "example": "",
              "possible": ""
           },
           {
               "hidden": true,
              "name": "detail=bb_b2_applicationKey",
              "fieldType":"password",
              "placeholder": "XXXXXXXXXXXXXXXXXXXXXXXX.XXXXXXXXXXXXXXX_XXXXXXXXXXXXXXXXXX",
              "field": lang.applicationKey,
              "form-group-class":"autosave_bb_b2_input autosave_bb_b2_1",
              "description": "",
              "default": "",
              "example": "",
              "possible": ""
           },
           {
               "hidden": true,
              "name": "detail=bb_b2_log",
              "field": lang['Save Links to Database'],
              "fieldType": "select",
              "selector": "h_b2sld",
              "form-group-class":"autosave_bb_b2_input autosave_bb_b2_1",
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
             "name": "detail=use_bb_b2_size_limit",
             "field": lang['Use Max Storage Amount'],
             "fieldType": "select",
             "selector": "h_b2zl",
             "form-group-class":"autosave_bb_b2_input autosave_bb_b2_1",
             "form-group-class-pre-layer":"h_b2sld_input h_b2sld_1",
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
             "name": "detail=bb_b2_size_limit",
             "field": lang['Max Storage Amount'],
             "form-group-class":"autosave_bb_b2_input autosave_bb_b2_1",
             "form-group-class-pre-layer":"h_b2sld_input h_b2sld_1",
             "description": "",
             "default": "10000",
             "example": "",
             "possible": ""
          },
          {
              "hidden": true,
             "name": "detail=bb_b2_dir",
             "field": lang['Save Directory'],
             "form-group-class":"autosave_bb_b2_input autosave_bb_b2_1",
             "description": "",
             "default": "/",
             "example": "",
             "possible": ""
          },
       ]
    }
}
