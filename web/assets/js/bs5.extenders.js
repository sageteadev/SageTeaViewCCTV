var accountSettings = {
    onLoadFieldsExtensions: [],
    onLoadFields: function(...extender){
        accountSettings.onLoadFieldsExtensions.push(...extender)
    },
    onSaveFieldsExtensions: [],
    onSaveFields: function(...extender){
        accountSettings.onSaveFieldsExtensions.push(...extender)
    },
}
var onToggleSideBarMenuHideExtensions = [];
function onToggleSideBarMenuHide(...extender){
    onToggleSideBarMenuHideExtensions.push(...extender)
}
