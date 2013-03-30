Components.utils.import("resource://gre/modules/FileUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

boxStatus = true;
operationType = window.location.href.slice(window.location.href.search("type=") + 5);

function bindElements() {
    mainTree = document.getElementById("databaseContents");
    pageTextbox = document.getElementById("desiredState");
    pageCheckbox = document.getElementById("showAllBox");
    pageButton = document.getElementById("confirmButton");
    typeButton = document.getElementById("typeButton");
    pageButton.setAttribute("label", operationType);
    mainTree.view = treeDriver;
    textboxDriver();
}
function textboxDriver() {
    var text = pageTextbox.value;
    treeDriver.rootTable = [];
    if (text == ""){
        defaultState();
    }
    else {
        getEntry(text, updateRoot);
    }
}
function checkboxDriver() {
    boxStatus =! boxStatus;
    treeDriver.rootTable = [];
    updateCurrent();
    textboxDriver();
}
function defaultState(){
    treeDriver.rootTable = [];
    if (boxStatus){
        getEntry("", updateRoot);
    }
    else {
        updateCurrent();
    }
}
function buttonDriver() {
    if (operationType == "save") {
        var currentTabs = getWindowState();
        if (mainTree.currentIndex == -1) { //use the textbox value
            var desiredName = pageTextbox.value
        }
        else { //use the selected value
            var desiredName = treeDriver.currentTable[mainTree.currentIndex].contents
        }
        currentTabs.forEach( function(entry) {
            storeEntry({name: desiredName, page: entry});
        });
        textboxDriver();
    }
    else if (operationType == "open") {
        iterateOverSelected(function (index) {
            var treeEntry = treeDriver.currentTable[index]
            if (treeEntry.parent == null) {
                //instance name
                var textChildren = [];
                treeEntry.children.forEach(function(entry) {
                    textChildren.push(entry.contents);
                });
                restoreState(textChildren);
            }
            else {
                //url name
                restoreState([treeEntry.contents])
            }
        });
    }
}
function deleteDriver() {
    iterateOverSelected(function (index) {
        var treeEntry = treeDriver.currentTable[index];
        var EntryParent = treeEntry.parent
        if (EntryParent == null) {
            //instance name
            removeEntry({state: treeEntry.contents});
            var itemIndex = treeDriver.rootTable.indexOf(treeEntry);
            treeDriver.rootTable.splice(itemIndex, 1);
        }
        else {
            //URLname
            removeEntry({state: EntryParent.contents, url: treeEntry.contents});
            var itemIndex = EntryParent.children.indexOf(treeEntry);
            EntryParent.children.splice(itemIndex, 1);
        }
    });
    updateCurrent();
}

function iterateOverSelected(callback) {
    var numRanges = mainTree.view.selection.getRangeCount();
    var startObj = new Object();
    var endObj = new Object();

    for (var i = 0; i < numRanges; i++) {
        mainTree.view.selection.getRangeAt(i, startObj, endObj)
        for (var j = startObj.value; j <= endObj.value; j++) {
            callback(j)
        }
    }
}



//tree........................................................................................................................................
//row elements for the table
function tableEntry(contents, parent) {
    this.contents = contents;
    this.children = [];
    this.open = false;
    if (typeof parent != "undefined") {
        this.parent = parent;
    }
    else {
        this.parent = null;
    }
}
tableEntry.prototype = {
    addChildren: function(contentsList) {
        for (var i = 0; i < contentsList.length; i++){
            var current = new tableEntry(contentsList[i], this);
            this.children.push(current);
        }
    }
}

treeDriver = {
    //
    treeBox: null,
    selection: null,
    setTree: function(treeBox) { this.treeBox = treeBox; },
    isSeparator: function(row) { return false; },
    isSorted: function() { return false; },
    getImageSrc: function(row,col) { return null; },
    getRowProperties: function(row,props) {},
    getCellProperties: function(row,col,props) {},
    getColumnProperties: function(colid,col,props) {},
    isEditable: function(row, column) {return false;},
    //
    rootTable: [],
    currentTable: [],
    get rowCount() {
        return this.currentTable.length;
    },
    getCellText: function(row, column) { 
        return this.currentTable[row].contents;
    },
    isContainer: function(row) {
        return (this.currentTable[row].children.length != 0);
    },
    isContainerEmpty: function(row) {
        return (this.currentTable[row].children.length == 0);
    },
    isContainerOpen: function(row) {
        return this.currentTable[row].open;
    },
    getLevel: function(row) {
        var rowiQ = this.currentTable[row];
        function tallyParents(row) {
            var count = 0;
            if (row == null) {
                return count
            }
            count += (tallyParents(row.parent) + 1);
        }
        return tallyParents(rowiQ);
    },
    getParentIndex: function(row) {
        if (this.currentTable[row].parent == null) {
            return -1;
        }
        else {
            return this.currentTable[row].parent;
        }
    },
    hasNextSibling: function(row, afterIndex) {
        var theParent = this.currentTable[row].parent;
        var theRow = this.currentTable[row]
        var nextSib = false
        for (var i = 0; i < theParent.children.length; i++) {
            if (theParent.children[i] === theRow) {
                if (i < theParent.children.length -1){
                    nextSib = true
                }
            }
        }
        return nextSib;
    },
    toggleOpenState: function(row) {
        if (this.currentTable[row].children.length > 0 && this.currentTable[row].open == false) {
            this.currentTable[row].open = true;
        }
        else {
            this.currentTable[row].open = false;
        }
        updateCurrent();
    }
}

function updateRoot(results) {
    entries = unpackResults(results);
    //Add the results to the table
    for (entry in entries) {
        var inProgress = new tableEntry(entry, null);
        inProgress.addChildren(entries[entry]);
        treeDriver.rootTable.push(inProgress);
    }
    Services.console.logStringMessage(treeDriver.rootTable)
    updateCurrent();
}

//driver for treeDriver.currentTable, the table which forms a layer between the tree of children and the displayed tree
function updateCurrent() {
    treeDriver.treeBox.rowCountChanged(0, -treeDriver.currentTable.length);
    var treeTable = treeDriver.currentTable = [];
    function pushChildren(table) {
        table.forEach(function(entry) {
            treeTable.push(entry);
            if (entry.children.length != 0 && entry.open == true) {
                pushChildren(entry.children);
            }
        });
    }
    pushChildren(treeDriver.rootTable);
    treeDriver.treeBox.rowCountChanged(0, treeTable.length);
}

//Database Functions..................................................................................................................

function storeEntry(params) {
    var DBfile = FileUtils.getFile("ProfD", ["saveStateDB.sqlite"]);
    var DBconnection =Services.storage.openDatabase(DBfile);
    var SQLstatement = DBconnection.createAsyncStatement("INSERT INTO StateData VALUES (:name, :page);");
    ["name", "page"].forEach(function(parameter){
        SQLstatement.params[parameter] = params[parameter];
    });
    SQLstatement.executeAsync({
        handleResult: function(){},
        handleError: function(aError){
            Services.console.logStringMessage(aError.message);
        },
        handleCompletion: function(){}
    });
}

function getEntry(lookup, callback) {
    var DBfile = FileUtils.getFile("ProfD", ["saveStateDB.sqlite"]);
    var DBconnection =Services.storage.openDatabase(DBfile);
    var SQLstatement = DBconnection.createAsyncStatement("SELECT StateName, TabContents FROM StateData WHERE (StateName LIKE :Lookup);");
    SQLstatement.params["Lookup"] = "%"+lookup+"%";
    SQLstatement.executeAsync({
        handleResult: function(aResultSet) {
            callback(aResultSet);
        },
        handleError: function(aError) {
            Services.console.logStringMessage(aError.message);
        },
        handleCompletion: function() {}
    });
}

function removeEntry(params) {
    var DBfile = FileUtils.getFile("ProfD", ["saveStateDB.sqlite"]);
    var DBconnection =Services.storage.openDatabase(DBfile);
    if (typeof params["url"] == "undefined") {
        //just a state name is given
        var SQLstatement = DBconnection.createAsyncStatement("DELETE FROM StateData WHERE (StateName = :state);");
        SQLstatement.params["state"] = params["state"]
    }
    else {
        var SQLstatement = DBconnection.createAsyncStatement("DELETE FROM StateData WHERE (StateName = :state AND TabContents = :url);");
        ["state", "url"].forEach(function(entry){
            SQLstatement.params[entry] = params[entry];
        });
    }
    SQLstatement.executeAsync({
        handleResult: function() {},
        handleError: function() {
            Services.console.logStringMessage(aError.message);
        },
        handleCompletion: function(){}
    })

}

function unpackResults(results) {
    var entries = {};
    for (var row = results.getNextRow(); row; row = results.getNextRow()) {
        var currentLabel = row.getResultByName("StateName");
        var currentChild = row.getResultByName("TabContents");
        if (typeof entries[currentLabel] == "undefined"){ entries[currentLabel] = []; }
        entries[currentLabel].push(currentChild);
    }
    return entries
}

//Window Functions............................................................................................................................

function getWindowState() {
    var tabList = [];
//Saves tabs in all windows (as opposed to the current window)
/*
    var enumerator = Services.wm.getEnumerator(null);
    for ( var current = enumerator.getNext(); enumerator.hasMoreElements(); current = enumerator.getNext()) {
        if (current.document.getElementById("content") !== null) {
            var browsers = current.document.getElementById("content").browsers;
            for (var i = 0; browsers[i]; i++) {
                tabList.push(browsers[i].currentURI.spec);
            }
        }
     }
*/
//Saves tabs in the current window (as opposed to all)
    var mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
               .getInterface(Components.interfaces.nsIWebNavigation)
               .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
               .rootTreeItem
               .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
               .getInterface(Components.interfaces.nsIDOMWindow);
    if (mainWindow.document.getElementById("content") !== null) {
        var browsers = mainWindow.document.getElementById("content").browsers;
        for (var i = 0; browsers[i]; i++) {
            if (browsers[i].currentURI.spec != "chrome://savestate/content/menu.xul?type=save")
            tabList.push(browsers[i].currentURI.spec);
        }
    }
    return tabList
}

function restoreState(urlList) {
    //this method gets around "security" measures which prevent window.open from opening non-chrome urls
    var mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIWebNavigation)
                   .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                   .rootTreeItem
                   .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                   .getInterface(Components.interfaces.nsIDOMWindow);
    var tabbrowser = mainWindow.document.getElementById("content")
    tabbrowser.loadTabs(urlList, true, false)
}

