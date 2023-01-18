$(document).ready(function(){
    var apiPrefix = getFullOrigin(true) + getAdminApiPrefix()
    var theWindow = $('#subAccountManager');
    var accountTable = $('#subAccountsList tbody');
    var theWindowForm = $('#monSectionAccountInformation');
    var permissionsSection = $('#monSectionAccountPrivileges');
    var permissionsMonitorSection = $('#sub_accounts_permissions');
    var currentlyActiveUsersList = $('#currently-active-users');
    var submitButtons = theWindow.find('.submit-form')
    var loadedSubAccounts = {}
    var clearTable = function(){
        accountTable.empty()
        loadedSubAccounts = {}
    }
    var getSubAccounts = function(callback){
        $.get(`${apiPrefix}accounts/${$user.ke}`,function(data){
            clearTable()
            $.each(data.accounts,function(n,account){
                loadedSubAccounts[account.uid] = account;
                drawSubAccountRow(account)
            })
            callback()
        })
    }
    var deleteSubAccount = function(email,uid){
        $.confirm.create({
            title: lang.deleteSubAccount,
            body: lang.deleteSubAccountText + '\n' + email,
            clickOptions: {
                class: 'btn-danger',
                title: lang.Delete,
            },
            clickCallback: function(){
                $.post(apiPrefix+'accounts/'+$user.ke+'/delete',{
                    uid: uid,
                    mail: email
                },function(data){
                    var notifyTitle = lang.accountDeleted
                    var notifyText = lang.accountDeletedText + '\n' + email
                    var notifyColor = 'info'
                    if(data.ok){
                        loadedSubAccounts[uid] = null;
                        accountTable.find('[uid="' + uid + '"]').remove()
                    }else{
                        notifyTitle = lang.accountActionFailed
                        notifyText = lang.contactAdmin
                        notifyColor = 'warning'
                    }
                    new PNotify({
                        title : notifyTitle,
                        text : notifyText,
                        type : notifyColor
                    })
                })
            }
        })
    }
    var addSubAccount = function(newAccount,callback){
        $.post(apiPrefix+'accounts/'+$user.ke+'/register',{
            data: JSON.stringify(newAccount)
        },function(data){
            var notifyTitle
            var notifyText
            var notifyColor
            if(!data.ok && data.msg){
                notifyTitle = lang.accountActionFailed
                notifyText = data.msg
                notifyColor = 'warning'
            }
            if(data.user){
                notifyTitle = lang.accountAdded
                notifyText = lang.accountAddedText + '\n' + data.user.mail
                notifyColor = 'success'
                if(data.user){
                    var account = data.user
                    loadedSubAccounts[account.uid] = account;
                    drawSubAccountRow(account)
                    theWindowForm.find('[name="uid"]').val(account.uid)
                    setSubmitButtonState(lang['Save Changes'],'check')
                }else{
                    notifyTitle = lang.accountActionFailed
                    notifyText = lang.contactAdmin
                    notifyColor = 'warning'
                }
            }
            new PNotify({
                title : notifyTitle,
                text : notifyText,
                type : notifyColor
            })
            callback(data)
        });
    }
    var editSubaccount = function(uid,form,callback){
        var account = loadedSubAccounts[uid]
        $.post(apiPrefix+'accounts/'+$user.ke+'/edit',{
            uid: uid,
            mail: form.mail,
            data: form
        },function(data){
            console.log(data)
            if(data.ok){
                $.each(form,function(n,v){
                    account[n] = v
                });
                accountTable.find(`[uid="${uid}"] .mail`).text(form.mail)
                new PNotify({
                    title : lang['Account Edited'],
                    text : '<b>' + account.mail + '</b> has been updated.',
                    type : 'success'
                })
            }else{
                new PNotify({
                    title : lang['Failed to Edit Account'],
                    text : data.msg,
                    type : 'error'
                })
            }
            callback(data)
        })
    }
    var drawSubAccountRow = function(account){
        var html = `<div class="card ${definitions.Theme.isDark ? 'btn-default text-white' : 'bg-light text-dark'} mb-3 shadow-sm p-2" uid="${account.uid}">
            <div>
                <span class="mail">${account.mail}</span><br>
                <small class="text-muted">${account.uid}</small><br>
            </div>
            <div>
                <a class="permission badge btn btn-dark"><i class="fa fa-gears"></i> ${lang.Edit}</a>
                <a class="delete badge btn btn-danger"><i class="fa fa-trash-o"></i> ${lang.Delete}</a>
            </div>
        </div>`;
        accountTable.prepend(html)
    }
    var permissionTypeNames = [
        {
            name: 'monitors',
            label: lang['Can View Monitor'],
        },
        {
            name: 'monitor_edit',
            label: lang['Can Edit Monitor'],
        },
        {
            name: 'video_view',
            label: lang['Can View Videos and Events'],
        },
        {
            name: 'video_delete',
            label: lang['Can Delete Videos and Events'],
        },
    ];
    var drawSelectableForPermissionForm = function(){
        var html = ''
        $.each(getLoadedMonitorsAlphabetically(),function(n,monitor){
            html += `<div class="form-group permission-view">`
                html += `<div><label class="mb-2">${monitor.name} (${monitor.mid})</label></div>`
                html += `<div><select class="form-control" multiple monitor="${monitor.mid}">`
                    $.each(permissionTypeNames,function(n,permission){
                        html += `<option value="${permission.name}">${permission.label}</option>`
                    })
                html += `</select></div>`
            html += `</div>`
        })
        permissionsMonitorSection.html(html)
    }
    var setPermissionSelectionsToFields = function(uid){
        var account = loadedSubAccounts[uid]
        var details = safeJsonParse(account.details)
        // load values to Account Information : email, password, etc.
        $.each(account,function(n,v){
            theWindowForm.find('[name="'+n+'"]').val(v)
        })
        // load base privileges
        permissionsSection.find('[detail]').each(function(n,v){
            var el = $(v)
            var key = el.attr('detail')
            var defaultValue = el.attr('data-default')
            el.val(details[key] || defaultValue)
        })
        permissionsSection.find('[detail="allmonitors"]').change()
        // load montior specific privileges
        $.each(loadedMonitors,function(m,monitor){
            $.each(permissionTypeNames,function(m,permission){
                if((details[permission.name] || []).indexOf(monitor.mid) > -1){
                    permissionsSection.find(`[monitor="${monitor.mid}"] option[value="${permission.name}"]`).attr("selected", "selected")
                }
            })
        })
    }
    var openSubAccountEditor = function(uid){
        var account = loadedSubAccounts[uid]
        drawSelectableForPermissionForm()
        setPermissionSelectionsToFields(uid)
        theWindowForm.find('[name="pass"],[name="password_again"]').val('')
        permissionsSection.show()
    }
    var writePermissionsFromFieldsToString = function(){
        var foundSelected = {}
        var detailsElement = theWindowForm.find('[name="details"]')
        var details = safeJsonParse(detailsElement.val())
        details = details ? details : {sub: 1, allmonitors: "1"}
        // base privileges
        permissionsSection.find('[detail]').each(function(n,v){
            var el = $(v)
            details[el.attr('detail')] = el.val()
        })
        // monitor specific privileges
        permissionsSection.find('.permission-view select').each(function(n,v){
            var el = $(v)
            var monitorId = el.attr('monitor')
            var value = el.val() // permissions selected
            $.each(value,function(n,permissionNameSelected){
                if(!foundSelected[permissionNameSelected])foundSelected[permissionNameSelected] = []
                foundSelected[permissionNameSelected].push(monitorId)
            })
        })
        details = Object.assign(details,{
            'monitors': [],
            'monitor_edit': [],
            'video_view': [],
            'video_delete': [],
        },foundSelected)
        detailsElement.val(JSON.stringify(details))
    }
    var getCompleteForm = function(){
        writePermissionsFromFieldsToString()
        return theWindowForm.serializeObject()
    }
    var setSubmitButtonState = function(text,icon){
        submitButtons.html(`<i class="fa fa-${icon}"></i> ${text}`)
    }
    function initiateSubAccountPage() {
        getSubAccounts(function(){
            if(theWindowForm.find('[name="uid"]').val() === '')drawSelectableForPermissionForm()
        })
    }
    function drawUserToActiveList(user){
        var rowId = `active-user-${user.uid}-${user.cnid}`
        if($(`#${rowId}`).length > 0)return;
        var html = `<div id="${rowId}" class="card shadow-lg mb-3 px-0 btn-default search-row">
            <div class="card-header">
                <small class="text-white">${user.mail}</small>
            </div>
            <div class="card-body">
                <div>${lang.Authenticated} ${formattedTime(user.logged_in_at)}</div>
            </div>
            <div class="card-footer">
                <small class="text-muted">${user.cnid}</small>
            </div>
        </div>`
        currentlyActiveUsersList.html(html)
    }
    function resetAccountForm(){
        permissionsSection.find('[detail]').each(function(n,v){
            var el = $(v)
            var key = el.attr('detail')
            var defaultValue = el.attr('data-default')
            el.val(defaultValue)
        })
        drawSelectableForPermissionForm()
        setSubmitButtonState(lang['Add New'],'plus')
        theWindowForm.find('input').val('')
    }
    //add new
    submitButtons.click(function(){
        theWindowForm.submit()
    })
    theWindowForm.submit(function(e){
        e.preventDefault();
        var formValues = getCompleteForm()
        var uid = formValues.uid
        if(formValues.uid){
            editSubaccount(uid,formValues,function(data){
                console.log(data)
            })
        }else{
            addSubAccount(formValues,function(data){
                if(data.ok){
                    resetAccountForm()
                }
            })
        }
        return false;
    });
    //sub simple lister
    theWindow.on('click','.delete',function(e){
        var el = $(this).parents('.card')
        var subAccountEmail = el.find('.mail').text()
        var subAccountUid = el.attr('uid')
        deleteSubAccount(subAccountEmail,subAccountUid)
    })
    theWindow.on('click','.permission',function(e){
        var el = $(this).parents('.card')
        var uid = el.attr('uid')
        openSubAccountEditor(uid)
        setSubmitButtonState(lang['Save Changes'],'check')
    })
    theWindow.on('click','.reset-form',resetAccountForm)

    permissionsSection.on('click','[check]',function(e){
        $(this).parents('.form-group-group').find('select').val($(this).attr('check')).first().change()
    })
    // permissionsSection.on('change','[monitor]',function(e){
    //     writePermissionsFromFieldsToString()
    // });

    permissionsSection.on('change','[detail="allmonitors"]',function(e){
        var value = $(this).val()
        var el = $('.permission-view')
        if(value === '1'){
            el.hide();
        }else{
            el.show()
        }
    })
    addOnTabOpen('subAccountManager', function () {
        resetAccountForm()
    })
    onWebSocketEvent(function(d){
        switch(d.f){
            case'users_online':
                console.log(d)
                // $.ccio.pm('user-row',d.users);
                $.each(d.user,function(n,user){
                    drawUserToActiveList(user)
                })
            break;
            case'user_status_change':
                console.log(d)
                var user = d.user
                if(d.status === 1){
                    drawUserToActiveList(user)
                }else{
                    $(`#active-user-${user.uid}-${user.cnid}`).remove()
                }
            break;
            case'delete_sub_account':
                var user = d.user
                accountTable.find(`[uid="${user.uid}"]`).remove()
            break;
        }
    })
    initiateSubAccountPage()
    drawSubMenuItems('subAccountManager',definitions['Sub-Account Manager'])
})
