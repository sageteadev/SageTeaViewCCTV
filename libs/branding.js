module.exports = function(s,config,lang,app,io){
    if(config.showPoweredByShinobi === undefined){config.showPoweredByShinobi=true}
    if(config.poweredByShinobi === undefined){config.poweredByShinobi='Powered by SageTea (R)'}
    if(config.showLoginCardHeader === undefined){config.showLoginCardHeader=true}
    if(config.webFavicon === undefined){config.webFavicon = 'libs/img/icon/favicon.ico'}
    if(!config.logoLocationAppleTouchIcon)config.logoLocationAppleTouchIcon = 'libs/img/icon/apple-touch-icon.png';
    if(!config.logoLocation57x57)config.logoLocation57x57 = 'libs/img/icon/apple-touch-icon-57x57.png';
    if(!config.logoLocation72x72)config.logoLocation72x72 = 'libs/img/icon/apple-touch-icon-72x72.png';
    if(!config.logoLocation76x76)config.logoLocation76x76 = 'libs/img/icon/apple-touch-icon-76x76.png';
    if(!config.logoLocation114x114)config.logoLocation114x114 = 'libs/img/icon/apple-touch-icon-114x114.png';
    if(!config.logoLocation120x120)config.logoLocation120x120 = 'libs/img/icon/apple-touch-icon-120x120.png';
    if(!config.logoLocation144x144)config.logoLocation144x144 = 'libs/img/icon/apple-touch-icon-144x144.png';
    if(!config.logoLocation152x152)config.logoLocation152x152 = 'libs/img/icon/apple-touch-icon-152x152.png';
    if(!config.logoLocation196x196)config.logoLocation196x196 = 'libs/img/icon/favicon-196x196.png';
    if(config.logoLocation76x76Link === undefined){config.logoLocation76x76Link='https://shinobi.video'}
    if(config.logoLocation76x76Style === undefined){config.logoLocation76x76Style='border-radius:50%'}
    if(config.loginScreenBackground === undefined){config.loginScreenBackground='assets/img/splash.avif'}
    if(config.showLoginSelector === undefined){config.showLoginSelector=true}
    if(config.defaultTheme === undefined)config.defaultTheme = 'Ice-v3';
    if(config.socialLinks === undefined){
        config.socialLinks = [
            {
                icon: 'home',
                href: 'https://shinobi.video',
                title: 'Homepage'
            },
            {
                icon: 'facebook',
                href: 'https://www.facebook.com/ShinobiCCTV',
                title: 'Facebook'
            },
            {
                icon: 'twitter',
                href: 'https://twitter.com/ShinobiCCTV',
                title: 'Twitter'
            },
            {
                icon: 'youtube',
                href: 'https://www.youtube.com/channel/UCbgbBLTK-koTyjOmOxA9msQ',
                title: 'YouTube'
            }
        ]
    }
    s.getConfigWithBranding = function(domain){
        var configCopy = Object.assign({},config)
        if(config.brandingConfig && config.brandingConfig[domain]){
            return Object.assign(configCopy,config.brandingConfig[domain])
        }
        return config
    }
}
