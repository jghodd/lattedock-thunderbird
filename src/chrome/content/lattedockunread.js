'use strict';

var lattedockunread = {
	MSG_FOLDER_FLAG_INBOX: 0x1000,
	onLoad : function(e) {
		dump("Loading LatteDock Unread Count...\n");
		
		// read all the preferences
		const PREF_SERVICE = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
		this.prefs = PREF_SERVICE.getBranch("extensions.lattedock-unread.");
		this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch);
		this.prefs.addObserver("", this, false);
     
     	this.traverseDeep = this.prefs.getBoolPref("traverse-deep");
 
		// initialization code
		this.initialized = true;
	},
	
	onClose: function(e) {
		dump("Closing LatteDock Unread Count...\n");
		
		this.prefs.removeObserver("", this);
		
		this.initialized = true;
		this.resetUnreadCount();
	},
	
	resetUnreadCount: function() {
		dump("Resetting unread badge\n");
		this.updateUnreadCount(0, true);
	},
	
	updateUnreadCount: function(x, blockingProcess) {
		dump("Calling update count\n");
		dump("Finding path...\n");

		var fileUtils = Cu.import("resource://gre/modules/FileUtils.jsm").FileUtils;

		var homePath = "";

		// get the user's home directory
		const ENV_SERVICE = new Components.Constructor("@mozilla.org/file/directory_service;1","nsIProperties");
		try { 
			homePath = (new ENV_SERVICE()).get("Home", Components.interfaces.nsIFile).path; 
		} catch (e) {
			alert(e);
		}
		dump("HOME: " + homePath + "\n");

		var pySubDir = ".thunderbird-lattedockunread";
		var pyPath   = homePath + "/" + pySubDir + "/update-badge.py";

		dump("pyPath: " + pyPath + "\n");

		// create the extraction director for update-badge.py if it doesnt exist
		fileUtils.getDir("Home", [pySubDir], true);

		var pyFile = new fileUtils.File(pyPath);
		
		// check if update-badge.py has already been extracted
                if (pyFile.exists() == false) {
			dump("Extracting " + pyPath + "\n");

			var xpiPath = "";

			// find out where the xpi file was installed
			const DIR_SERVICE = new Components.Constructor("@mozilla.org/file/directory_service;1","nsIProperties");
			try { 
				xpiPath=(new DIR_SERVICE()).get("ProfD", Components.interfaces.nsIFile).path; 
			} catch (e) {
				alert(e);
			}
		
			xpiPath = xpiPath + "/extensions/{03ae01b6-6d68-11e7-842c-4af176302efd}.xpi";

			var xpiFile = new fileUtils.File(xpiPath);

                	if (xpiFile.exists() == false) {
                        	xpiPath = "/usr/lib/thunderbird/extensions/{03ae01b6-6d68-11e7-842c-4af176302efd}.xpi";
			}
			dump("xpiPath: " + xpiPath + "\n");

			var zipReader = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
			Cu.import('resource://gre/modules/osfile.jsm');

			var nsiFileXpi = new FileUtils.File(xpiPath);
    
			try {
				// extract update-badge.py from the xpi file
				zipReader.open(nsiFileXpi);
				zipReader.extract("chrome/content/update-badge.py", pyFile);
			} catch (ex) {
				alert(ex);
			} finally {
				zipReader.close();
			}
		}

		var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);		
		file.initWithPath("/usr/bin/env");
		
		var args = ["python", pyPath, x];
		var process = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
		process.init(file);
		
		dump("Initialising process with arguments " + args + " is blocking = " + blockingProcess + "\n");
		process.run(blockingProcess, args, args.length);
	},

	onItemCountChanged : function() {
                var that = this;
		dump("Item count changed...\n");
		if (this.timeoutId != -1) {
			window.clearTimeout(this.timeoutId);
		}
		// Schedule on the main thread
		this.timeoutId = window.setTimeout(function() { that.performUnreadCount(); }, 1000);
	},
	
	performUnreadCount: function() {
		dump("Counting unread messages...\n");
		var acctMgr = Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager);
		var accounts = acctMgr.accounts;
		var totalCount = 0;
		dump("Found " + accounts.length + " accounts\n");
		for (var i = 0; i < accounts.length; i++) {
			var account = accounts.queryElementAt(i, Components.interfaces.nsIMsgAccount);
			var rootFolder = account.incomingServer.rootFolder; // nsIMsgFolder            
				if (rootFolder.hasSubFolders) {
					totalCount += this.getTotalCount(rootFolder);
				}
		}
		dump("Found total : " + totalCount + "\n");
		this.updateUnreadCount(totalCount, false);
	},

	getTotalCount: function(rootFolder) {
		if (rootFolder.getAllFoldersWithFlag) {
			return this._getTotalCountTB2(rootFolder);
		} else {
			return this._getTotalCountTB3(rootFolder);
		}
	},
	
	_getTotalCountTB2: function(rootFolder) {
		dump("Using _getTotalCountTB2\n");
		var totalCount = 0;
		dump("Finding all folders with inbox flag : " + this.MSG_FOLDER_FLAG_INBOX + "\n");
		var subFolders = rootFolder.getAllFoldersWithFlag(this.MSG_FOLDER_FLAG_INBOX); //nsISupportsArray
		dump("Found " + subFolders.Count() + "folders\n");
		
		for(var i = 0; i < subFolders.Count(); i++) {
			var folder = subFolders.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgFolder);
			dump("Get Number of unread messages with travese deep = " +  this.traverseDeep + "\n");
			totalCount += folder.getNumUnread(this.traverseDeep);
		}
		
		dump("Found total " + totalCount + "in all subFolders\n");
		return totalCount;
	},

	_getTotalCountTB3: function(rootFolder) {
		dump("Using _getTotalCountTB3\n");
		var totalCount = 0;
		dump("Finding all folders with inbox flag : " + this.MSG_FOLDER_FLAG_INBOX + "\n");
		var subFolders = rootFolder.getFoldersWithFlags(this.MSG_FOLDER_FLAG_INBOX); //nsIArray
		var subFoldersEnumerator = subFolders.enumerate();
		
		while(subFoldersEnumerator.hasMoreElements()) {
			var folder = subFoldersEnumerator.getNext().QueryInterface(Components.interfaces.nsIMsgFolder);
			dump("Get Number of unread messages with travese deep = " +  this.traverseDeep + "\n");
			totalCount += folder.getNumUnread(this.traverseDeep);
		}
		
		dump("Found total " + totalCount + "in all subFolders\n");
		return totalCount;
	},

	folderListener : {
		OnItemAdded : function(parent, item, viewString) {
				lattedockunread.onItemCountChanged();
		},
		OnItemRemoved : function(parent, item, viewString) {
				lattedockunread.onItemCountChanged();
		},
		OnItemPropertyFlagChanged : function(item, property, oldFlag, newFlag) {
			if (property=="Status"){
				lattedockunread.onItemCountChanged();
			}
		},
		OnItemEvent : function(item, event) {
				lattedockunread.onItemCountChanged();
		},
		
		OnFolderLoaded : function(aFolder) {},
		OnDeleteOrMoveMessagesCompleted : function(aFolder) {},
		OnItemPropertyChanged : function(parent, item, viewString) {},
		OnItemIntPropertyChanged : function(item, property, oldVal, newVal) {},
		OnItemBoolPropertyChanged : function(item, property, oldValue, newValue) {},
		OnItemUnicharPropertyChanged : function(item, property, oldValue, newValue) {}
	},
	
	observe: function(subject, topic, data) {
		if (topic != "nsPref:changed") {
			return;
		}
 
		switch(data) {
			case "traverse-deep":
				this.traverseDeep = this.prefs.getBoolPref("traverse-deep");
				lattedockunread.onItemCountChanged();
			break;
		}
	},
	
	mailSession: '',
	notifyFlags: '',
	timeoutId: -1
};

window.addEventListener("load", function(e) { lattedockunread.onLoad(e); }, false);
window.addEventListener("close", function(e) { lattedockunread.onClose(e); }, false); 

lattedockunread.mailSession = Components.classes["@mozilla.org/messenger/services/session;1"].getService(Components.interfaces.nsIMsgMailSession);
lattedockunread.notifyFlags = Components.interfaces.nsIFolderListener.all;
lattedockunread.mailSession.AddFolderListener(lattedockunread.folderListener, lattedockunread.notifyFlags);
