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

function checkboxDriver() {
    boxStatus =! boxStatus;
    if (boxStatus == true){
        getEntry("", addToTable);
    }
    else {
        treeDriver.rootTable = [];
        textboxDriver();
    }
}
function textboxDriver(event) {
    var text = pageTextbox.value;
    if (text != ""){
        getEntry(text, addToTable);
    }
}
function buttonDriver() {
    Services.console.logStringMessage(operationType)
    if (operationType == "save"){
        var currentlyOpen = getWindowState();
        var newName = pageTextbox.value;
        for ( var i = 0; i < currentlyOpen.length; i++) {
            storeEntry({name: newName, page: currentlyOpen[i]});
        }
    }
    else if (operationType == "open"){
        getEntry(pageTextbox.value, function(results) {
            var urlList = [];
            for (var row = results.getNextRow(); row; row = results.getNextRow()){
                urlList.push(row.getResultByName("TabContents"));
            }
            restoreState(urlList);
        });
    }
    Services.console.logStringMessage(treeDriver.rowCount);
}

//tree........................................................................................................................................

//row elements for the table
function tableEntry(contents) {
    this.contents = contents;
    this.children = [];
    this.open = false;
}
tableEntry.prototype = {
    addChildren: function(contentsList) {
        for (var i = 0; i < contentsList.length; i++){
            var current = new tableEntry(contentsList[i]);
            this.children.push(current);
        }
    }
}

//main Tree
treeDriver = {
    treeBox: null,
    rootTable:[],
    currentTree: [],
    updateCurrentTree: function() {
        for (var i =0; i <= this.rowCount; i++){
            var rowObject = this.rowFinder(i);
            this.currentTree.push(rowObject.contents);
        }
    },
    get rowCount(){
        return rowCountHelper(this.rootTable, 0);
        function rowCountHelper(table) {
            var count = 0;
            if (table.length == 0){
                return count;
            }
            for (var row = 0; row < table.length; row++){
                count += 1;
                count += rowCountHelper(table[row].children);
            }
            return count;
        }
    },
    setTree: function(treeBox) { this.treeBox = treeBox; },
    getCellText: function(row, column) {
        theRow = rowFinder(row);
        return theRow.contents;
    },
    isContainer: function(row) {
        theRow = rowFinder(row);
        return (theRow.children == []);
    },
    isContainerEmpty: function(row) {
        theRow = rowFinder(row);
        return (theRow.children == []);
    },
    isContainerOpen: function(row) {
        theRow = rowFinder(row);
        return theRow.open;
    },
    toggleOpenState: function(row) {
        theRow = rowFinder(row);
        theRow.open = !(theRow.open)
    },
    rowFinder: function(row) {
        var currentNum = -1;
        function rowFindHelper(row, table) {
            for (var i = 0; i<= table.length; i++) {
                var currentObj = table[i];
                currentNum += 1
                if (currentNum >= row) {
                    return currentObj;
                }
                if ((currentObj.children.length != 0) && (currentObj.open == true)) {
                    rowFindHelper(row, currentObj.childrem);
                }
            }
        }
        return rowFindHelper(row, this.rootTable);   //returns the entry object corresponding to the row
    }
}

function addToTable(results) {
    var entries = {}
    for (var row = results.getNextRow(); row; row = results.getNextRow()) {
        var currentLabel = row.getResultByName("StateName");
        var currentChild = row.getResultByName("TabContents");
        if (typeof entries[currentLabel] == "undefined"){ entries[currentLabel] = []; }
        entries[currentLabel].push(currentChild);
    }

    for (entry in entries) {
        var inProgress = new tableEntry(entry);
        Services.console.logStringMessage(entries[entry]);
        inProgress.addChildren(entries[entry]);
        treeDriver.rootTable.push(inProgress);
    }
    treeDriver.updateCurrentTree();
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
    SQLstatement.params["Lookup"] = lookup+"%";
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

//window functions......................................................................................................................

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
    for ( var i = 0; i < urlList; i++ ) {
        window.document.getElementById("content").loadTabs(urlList, true, false);
    }
}

