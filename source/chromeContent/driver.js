Components.utils.import("resource://gre/modules/FileUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

boxStatus = false;
operationType = window.location.href.slice(window.location.href.search("type=") + 5);

function checkboxDriver(){
    boxStatus =! boxStatus;
    if (boxStatus == true){
        getEntry("", addToTable);
    }
    else {
        treeDriver.rootTable = [];
        textboxDriver();
    }
}
function textboxDriver(event){
    var text = pageTextbox.value;
    if (text != ""){
        getEntry(text, addToTable);
    }
}
function buttonDriver(){
    Services.console.logStringMessage(operationType)
    if (operationType == "save"){
        var currentWindows = getWindowState();
    }
    else if (operationType == "open"){

    }
}

function bindElements(){
    mainTree = document.getElementById("databaseContents");
    pageTextbox = document.getElementById("desiredState");
    pageCheckbox = document.getElementById("showAllBox");
    pageButton = document.getElementById("confirmButton");
    pageButton.setAttribute("label", operationType);
    mainTree.view = treeDriver;
}

//tree........................................................................................................................................

//row elements for the table
function tableEntry(contents){
    this.contents = contents
}
tableEntry.prototype = {
    children: [],
    open: false,
    addChildren: function(contentsList){
        for (i = 0; i < contentsList.length; i++){
            var current = new tableEntry(contentsList[i]);
            this.children.push(current);
        }
    }
}

//main Tree
treeDriver = {
    rootTable:[],
    get rowCount(){
        var currentCount = 0;
        function rowCountHelper(table, currentCount){
            if (table.length == 0){
                return;
            }
            for (var row=0; row<table.length; row++){
                currentCount += 1;
                currentCount += rowCountHelper(table[row].children, 0);
            }
        }
        return rowCountHelper(this.rootTable, 0);
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
    rowFinder: function(row){
        var currentNum = 0;
        function rowFindHelper(row, table) {
            for (var i = 0; i<= table.length; i++){
                var currentObj = rootTable[i];
                currentNum += 1;
                if ((currentObj.children.length != 0) && (currentObj.open == true)) {
                    currentObj = rowFindHelper(row, currentObj, currentNum);
                }
                if (currentNum >= row){
                    return currentObj;
                }
            }
        }
        return rowFindHelper(row, this.rootTable);   //returns the entry object corresponding to the row
    }
}

function addToTable(results){
    var entries = {}
    for (var row = results.getNextRow(); row; row = results.getNextRow()){
        var currentLabel = row.getResultByName("StateName");
        var currentChild = row.getResultByName("TabContents");
        if (typeof entries[currentLabel] == "undefined"){ entries[currentLabel] = []; }
        entries[currentLabel].push(currentChild);
    }
    for (entry in entries){
        var inProgress = new tableEntry(entry);
        inProgress.addChildren(entries[entry]);
        rootTable.push(inProgress);
    }
}


//Database Functions..................................................................................................................

function storeEntry(param){
    var DBfile = FileUtils.getFile("ProfD", ["saveStateDB.sqlite"]);
    var DBconnection =Services.storage.openDatabase(DBfile);
    var SQLstatement = DBconnection.createAsyncStatement();
}

function getEntry(lookup, callback){
    var DBfile = FileUtils.getFile("ProfD", ["saveStateDB.sqlite"]);
    var DBconnection =Services.storage.openDatabase(DBfile);
    var SQLstatement = DBconnection.createAsyncStatement("SELECT (StateName TabContents) FROM StateData WHERE (StateName Like :Lookup);");
    SQLstatement.params["Lookup"] = lookup+"%";
    SQLstatement.executeAsync({
        handleResult: function(aResultSet){
            callback(aResultSet);
        },
        handleError: function(aError){
            Services.console.logStringMessage(aError);
        },
        handleCompletion: function(){}
    });
}

//window functions......................................................................................................................

function getWindowState(){
    var enumerator = Services.ww.getWindowEnumerator();
    for (current = enumerator.getNext(); enumerator.hasMoreElements(); enumerator.getNext()){
        Services.console.logStringMessage(typeof current);
    }
}

function restoreState(){

}

