Components.utils.import("resource://gre/modules/FileUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

boxStatus = false;
operationType = window.location.href.slice(window.location.href.search("type=") + 5);

function bindElements() {
    mainTree = document.getElementById("databaseContents");
    pageTextbox = document.getElementById("desiredState");
    pageCheckbox = document.getElementById("showAllBox");
    pageButton = document.getElementById("confirmButton");
    pageButton.setAttribute("label", operationType);
    mainTree.view = treeDriver;
}
function textboxDriver(event) {
    var text = pageTextbox.value;
    if (text == ""){
        defaultState();
    }
    else {
        getEntry(text, updateRoot);
    }
}
function checkboxDriver() {
    boxStatus =! boxStatus;
    defaultState();
    textboxDriver();
}
function defaultState(){
    if (boxStatus){
        getEntry("", updateRoot);
    }
    else {
        treeDriver.rootTable = [];
        updateCurrent();
    }
}
function buttonDriver() {
    if (operationType == "save") {
        var currentTabs = getWindowState();
        currentTabs.forEach( function(entry) {
            storeEntry({name: pageTextbox.value, page: entry});
        });
    }
    else if (operationType == "open") {
        var selected = mainTree.currentIndex;
        var treeEntry = treeDriver.currentTable[selected]
        if (treeEntry.parent == null) {
            //instance name
            var textChildren = [];
            treeEntry.children.forEach(function(entry) {
                textChildren.push(entry.contents);
            });
            restoreState(textChildren);
        }
        else {
            //url name?
            restoreState([treeEntry.contents])
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
            if (row.parent = null) {
                return count
            }
            count += (tallyParents(row.parent) + 1);
        }
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
    entries = unpackResults(results)
    //Remove any old results from the table
    treeDriver.rootTable = [];
    //Add the results to the table
    for (entry in entries) {
        var inProgress = new tableEntry(entry, null);
        inProgress.addChildren(entries[entry]);
        treeDriver.rootTable.push(inProgress);
    }
    updateCurrent();
}

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
        handleResult: function(aResultSet){
            callback(aResultSet);
        },
        handleError: function(aError){
            Services.console.logStringMessage(aError.message);
        },
        handleCompletion: function(){}
    });
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

//Window Functions
function getWindowState() {
    var enumerator = Services.wm.getEnumerator(null);
    var tabList = [];
    for ( var current = enumerator.getNext(); enumerator.hasMoreElements(); current = enumerator.getNext()) {
        if (current.document.getElementById("content") !== null) {
            var browsers = current.document.getElementById("content").browsers;
            for (var i = 0; browsers[i]; i++) {
                tabList.push(browsers[i].currentURI.spec);
            }
        }
     }
    return tabList;
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

