var fs = require('fs')
module.exports = function(s,config){
    if(!config.language){
        config.language='en_CA'
    }
    var lang = {};
    function getLanguageData(choice){
        let gotLang = {}
        try{
            eval(`gotLang = ${fs.readFileSync(s.location.languages+'/'+choice+'.json','utf8')}`)
        }catch(er){
            console.error(er)
            console.log('There was an error loading your language file.')
            eval(`gotLang = ${fs.readFileSync(s.location.languages+'/en_CA.json','utf8')}`)
        }
        return gotLang
    }
    lang = getLanguageData(config.language)
    //load languages dynamically
    s.copySystemDefaultLanguage = function(){
        //en_CA
        return Object.assign({},getLanguageData(config.language))
    }
    s.listOfPossibleLanguages = []
    fs.readdirSync(s.mainDirectory + '/languages').forEach(function(filename){
        var name = filename.replace('.json','')
        s.listOfPossibleLanguages.push({
            "name": name,
            "value": name,
        })
    })
    s.loadedLanguages={}
    s.loadedLanguages[config.language] = s.copySystemDefaultLanguage()
    s.getLanguageFile = function(rule){
        if(rule && rule !== ''){
            var file = s.loadedLanguages[file]
            s.debugLog(file)
            if(!file){
                try{
                    let newLang = {}
                    eval(`newLang = ${fs.readFileSync(s.location.languages+'/'+rule+'.json','utf8')}`)
                    s.loadedLanguages[rule] = Object.assign(s.copySystemDefaultLanguage(),newLang)
                    file = s.loadedLanguages[rule]
                }catch(err){
                    console.error(err)
                    file = s.copySystemDefaultLanguage()
                }
            }
        }else{
            file = s.copySystemDefaultLanguage()
        }
        return file
    }
    s.reloadLanguages = function(){
        s.loadedLanguages = {};
        s.loadedLanguages[config.language] = s.copySystemDefaultLanguage()
    }
    return lang
}
