const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");


//called by the browser
function startup(data, reason){
    InitiateDB();
    windowListener = new windowObs();
}

function shutdown(data, reason){
    windowListener.unregister();
}

function install(data, reason){
    InitiateDB();
}

function uninstall(data, reason){
}


//..............................................................................................................................................................
function windowObs(){
    this.observe = function(aSubject, aTopic, aReason){
        if (aTopic == "domwindowopened"){
            aSubject.addEventListener("load", function(){
                aSubject.removeEventListener("load", arguments.callee, false);
                UIadder(aSubject);
            });
        }
        else if (aTopic == "domwindowclosed"){
            UIremover(aSubject);
        }
    };
    this.register = function(){
        Services.ww.registerNotification(this);
    };
    this.unregister = function(){
        Services.ww.unregisterNotification(this);
    };
    this.register();
}


function activateCallback(type, window){
    if (type == "save") {
        window.open("chrome://saveState/content/menu.xul?type=save");
    }
    else if (type == "open") {
        window.open("chrome://saveState/content/menu.xul?type=open");
    }
}

function InitiateDB(){
    //initiate DB fle if not already present
    var DBfile = FileUtils.getFile("ProfD", ["saveStateDB.sqlite"]);
    var DBconnection = Services.storage.openDatabase(DBfile);
    DBconnection.executeSimpleSQL("CREATE TABLE IF NOT EXISTS StateData (StateName TEXT, TabContents TEXT);");
}

//...............................................................................................................................................................

function UIadder(windowObj){
    var doc = windowObj.document
    var xmlns = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    var fileMenu = doc.getElementById("menu_FilePopup");
    var saveLocation = doc.getElementById("menu_sendLink");
    var openLocation = doc.getElementById("menu_close");

    var saveKey = doc.createElementNS(xmlns, "key");
    saveKey.setAttribute("id", "saveStateKey");
    saveKey.setAttribute("key", "S");
    saveKey.setAttribute("modifiers", "shift meta");
    saveKey.setAttribute("oncommand", "void(0);"); //all keys need an oncommand or command attribute
    saveKey.addEventListener("command", function(){activateCallback("save", windowObj)}, true); 

    var saveButton = doc.createElementNS(xmlns, "menuitem");
    saveButton.setAttribute("id", "saveStateButton");
    saveButton.setAttribute("label", "Save State");
    saveButton.setAttribute("key", "saveStateKey");
    saveButton.addEventListener("command", function(){activateCallback("save", windowObj)}, true);

    var openKey = doc.createElementNS(xmlns, "key");
    openKey.setAttribute("id", "openStateKey");
    openKey.setAttribute("key", "O");
    openKey.setAttribute("modifiers", "shift meta");
    openKey.setAttribute("oncommand", "void(0);");
    openKey.addEventListener("command", function(){activateCallback("open", windowObj)}, true);

    var openButton = doc.createElementNS(xmlns, "menuitem");
    openButton.setAttribute("id", "openStateButton");
    openButton.setAttribute("label", "Open State");
    openButton.setAttribute("key", "openStateKey");
    openButton.addEventListener("command", function(){activateCallback("open", windowObj)}, true);


    var extensionKeyset = doc.createElementNS(xmlns, "keyset");
    extensionKeyset.setAttribute("id", "saveSessionKeyset");
    extensionKeyset.appendChild(saveKey);
    extensionKeyset.appendChild(openKey);
    doc.getElementById("mainKeyset").appendChild(extensionKeyset);

    fileMenu.insertBefore(saveButton, saveLocation);
    fileMenu.insertBefore(openButton, openLocation);
}

function UIremover(windowObj){
    var doc = windowObj.document
    var fileMenu = doc.getElementById("menu_FilePopup");
    var saveButton = doc.getElementById("saveStateButton");
    var openButton = doc.getElementById("openStateButton");
    var keyset = doc.getElementById("saveSessionKeyset")
    doc.getElementById("mainKeyset").removeChild(keyset)
    fileMenu.removeChild(saveButton);
    fileMenu.removeChild(openButton);
}

