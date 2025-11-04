// Put this near the top of a shared utilities file (once):
var DCM = this.Dfareporting || this.DoubleClickCampaigns;

/**
 * Rebuilds "Get Floodlight Activities"
 * - Status is normalized to ACTIVE / ARCHIVED_AND_DISABLED / DISABLED_POLICY
 * - Falls back to `hidden` (ARCHIVED) if legacy behavior is encountered
 * - Also shows raw list+detail fields for easy debugging
 */
function getFloodlightActivities() {
  assertCampaignManagerApi_();
  const [profileId, advertiserId] = _fetchProfileId();

  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('Get Floodlight Activities') || ss.insertSheet('Get Floodlight Activities');

  // Avoid "already has a filter"
  const existingFilter = sh.getFilter && sh.getFilter();
  if (existingFilter) existingFilter.remove();

  sh.clear();

  // Headers (snippets removed)
  const headers = [
    'Floodlight ID','Status','Name','uVariables','Counting Method',
    'Group Name','Group string','Group ID',
    'Activity String','Tag Type','Expected URL'
  ];
  sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold');

  const out = [];
  const groupStringCache = Object.create(null);

  let pageToken = null;
  do {
    const resp = DCM.FloodlightActivities.list(profileId, {
      advertiserId: String(advertiserId),
      pageToken: pageToken,
      maxResults: 200
    });

    const items = (resp && resp.floodlightActivities) || [];
    for (let i = 0; i < items.length; i++) {
      const fa = items[i];

      // Status & uVars via detail.get()
      let status = fa.hidden ? 'ARCHIVED' : 'ACTIVE';
      let joinedUVars = '';
      try {
        const detail = DCM.FloodlightActivities.get(profileId, String(fa.id));
        const u = detail && detail.userDefinedVariableTypes;
        joinedUVars = Array.isArray(u) ? u.join(',') : '';
        if (typeof detail.status === 'string' && detail.status.length) {
          status = detail.status; // ACTIVE / ARCHIVED_AND_DISABLED / DISABLED_POLICY / etc.
        } else if (typeof detail.hidden === 'boolean') {
          status = detail.hidden ? 'ARCHIVED' : 'ACTIVE';
        }
      } catch (_) { /* keep defaults */ }

      // Group string (from Activity Group)
      const gid = fa.floodlightActivityGroupId || '';
      let groupString = '';
      if (gid) {
        if (groupStringCache[gid] === undefined) {
          try {
            const grp = DCM.FloodlightActivityGroups.get(profileId, String(gid));
            groupStringCache[gid] = grp && grp.tagString ? String(grp.tagString) : '';
          } catch (_) {
            groupStringCache[gid] = '';
          }
        }
        groupString = groupStringCache[gid] || '';
      }

      out.push([
        fa.id || '',
        status,
        fa.name || '',
        joinedUVars,
        fa.countingMethod || '',
        fa.floodlightActivityGroupName || '',
        groupString,
        gid,
        fa.tagString || '',
        fa.floodlightTagType || '',
        fa.expectedUrl || ''
      ]);
    }

    pageToken = (resp && resp.nextPageToken) || null;
  } while (pageToken);

  if (out.length) {
    sh.getRange(2,1,out.length,headers.length).setValues(out);
    // Keep rows tidy
    sh.getRange(2, 1, out.length, headers.length).setWrap(false).setNumberFormat('@');
    sh.setRowHeights(2, out.length, 21);
  }

  // Re-apply filter safely
  sh.getRange(1,1,Math.max(1,out.length+1),headers.length).createFilter();

  // after writing data
  const lastRow = sh.getLastRow();              // includes header
  const dataRows = Math.max(0, lastRow - 1);    // exclude header
  if (dataRows > 0) {
    sh.getRange(2, 1, dataRows, sh.getLastColumn()).setWrap(false);
    sh.setRowHeights(2, dataRows, 21);
  }
  sh.setRowHeights(1, 1, 24);

  toast_('Floodlights retrieved.', 'Get Floodlight Activities', 5);
}


function auditDefaultTags() {
  assertCampaignManagerApi_();

  var runValues   = _fetchProfileId();
  var profileId   = runValues[0];
  var advertiserId= runValues[1];

  var SHEET_NAME = "Audit Default Tags";
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var sh   = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  // Clear all content & formats, then rebuild header
  sh.clear();

  // Base headers (E holds original multi-line tag)
  var headers = ["ID", "Floodlight Name", "Default Tag Names", "Default Tag IDs", "Tag Code"];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

  // Pull activities
  var results = [headers];
  var resp = DCM.FloodlightActivities.list(profileId, { advertiserId: String(advertiserId) });
  var items = (resp && resp.floodlightActivities) || [];

  for (var i = 0; i < items.length; i++) {
    var fa = items[i];
    var defTags = fa.defaultTags || [];
    if (defTags.length === 0) {
      // If you only want rows when defaults exist, skip; otherwise uncomment next line:
      // results.push([fa.id || "", fa.name || "", "", "", ""]);
      continue;
    }
    for (var j = 0; j < defTags.length; j++) {
      var dt = defTags[j] || {};
      results.push([
        fa.id || "",
        fa.name || "",
        dt.name || "",
        dt.id || "",
        dt.tag || ""   // multi-line, untouched
      ]);
    }
  }

  // Write results (if only header, still write it)
  sh.getRange(1, 1, results.length, results[0].length).setValues(results);

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();

  // Add preview column F with single-line formula (no editing of E's content)
  var PREVIEW_COL = 6; // F
  sh.getRange(1, PREVIEW_COL).setValue("Tag Code (preview)").setFontWeight('bold');

  if (lastRow > 1) {
    // Use R1C1 so we can fill down easily; replaces CR/LF/TAB with spaces
    sh.getRange(2, PREVIEW_COL, lastRow - 1, 1).setFormulaR1C1(
      '=IF(LEN(RC[-1]),SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(RC[-1],CHAR(10)," "),CHAR(13),""),CHAR(9)," "), "")'
    );
  }

  // Formatting to keep everything skinny
  sh.setFrozenRows(1);

  // Turn off wrap on visible columns (A:F), then fix row heights
  sh.getRange(1, 1, Math.max(1, lastRow), Math.max(1, PREVIEW_COL)).setWrap(false);
  if (lastRow >= 1) {
    sh.setRowHeight(1, 24);                   // header
  }
  if (lastRow > 1) {
    sh.setRowHeights(2, lastRow - 1, 21);     // data rows
  }

  // Treat as text to avoid auto-formatting
  sh.getRange(1, 1, Math.max(1, lastRow), Math.max(1, PREVIEW_COL)).setNumberFormat('@');

  // Helpful widths
  sh.setColumnWidth(1, 140);  // ID
  sh.setColumnWidth(2, 260);  // Floodlight Name
  sh.setColumnWidth(3, 220);  // Default Tag Names
  sh.setColumnWidth(4, 160);  // Default Tag IDs
  sh.setColumnWidth(5, 360);  // Tag Code (original, multi-line)
  sh.setColumnWidth(6, 480);  // Tag Code (preview)

  // Hide the multi-line original column so it cannot force row height
  sh.hideColumn(sh.getRange("E1"));

  toast_('Finished retrieving default tags (with single-line preview).', 'Audit Default Tags', 5);
}






function patchDefaultTags() {
  runValues = _fetchProfileId();
  var profileId = values[0];
  var advertiserId = values[1];
  var ss = "Audit Default Tags"
  //rangeList = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ss); // Bringing in spreadsheet to clear prior execution
  //sheetList = rangeList.getRange(row=2, column=1, numRows=rangeList.getLastRow(), numColumns=rangeList.getLastColumn()).clearContent()
  results = [["ID", "Name", "Default Tag Names", "Default Tag IDs","Tag Code", ]];
   
 

  readFromSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name="Audit Default Tags");
  dataRange = readFromSheet.getDataRange();
  uploadData = dataRange.getValues();
  
  
  for (i=1; i < uploadData.length; i++){
  audienceData = uploadData[i];
  var currentRow = i + 1;
  var id = audienceData[0].toString();
 
  var response = DoubleClickCampaigns.FloodlightActivities.get(profileId, id)
  //list(profileId=profileId, optionalArgs={advertiserId: advertiserId});
  
  var floodlightActivity = response;
 // for (var j in floodlightActivitiesList){
   // floodlightActivity = floodlightActivitiesList[j];
    status = floodlightActivity.hidden;
    counter = floodlightActivity.countingMethod;
    tagType = floodlightActivity.floodlightTagType
    url = floodlightActivity.expectedUrl
    groupId = floodlightActivity.floodlightActivityGroupId;
    cache = floodlightActivity.cacheBustingType;
    uVariables = DoubleClickCampaigns.FloodlightActivities.get(profileId=profileId, id=id).userDefinedVariableTypes;
    if( typeof uVariables === 'undefined' || uVariables === null ){
      joinedUVariables = "";
    }
    else{
     joinedUVariables = uVariables.join(",");
    }; 
    pubTags = floodlightActivity.publisherTags;

  //Logger.log(pubTags) 

  var defaultTagsAssignment = [];
  dtUpdate = audienceData[5];
  

  if (dtUpdate === "N"){
      dtUpdate = defaultTagsAssignment.push({"name" : audienceData[2], "tag" : audienceData[4], "id" : audienceData[3]});
      var resource = {
	"kind": "dfareporting#floodlightActivity",  
    "defaultTags" : defaultTagsAssignment,
    "name" : audienceData[1],
    "id" : id,
    "floodlightTagType" : tagType,
    "floodlightActivityGroupId" : groupId,
    "countingMethod" : counter,
    "expectedUrl" : url,
    "userDefinedVariableTypes": joinedUVariables,
    "cacheBustingType" : cache,
    "publisherTags" : pubTags
  };
    };
    
    if (dtUpdate ==="Y"){
      dtR = "";
      var resource = {
	"kind": "dfareporting#floodlightActivity",  
    "name" : audienceData[1],
    "id" : id,
    "floodlightTagType" : tagType,
    "floodlightActivityGroupId" : groupId,
    "countingMethod" : counter,
    "expectedUrl" : url,
    "userDefinedVariableTypes": joinedUVariables,
    "cacheBustingType" : cache,
    "publisherTags" : pubTags
  };
  };
  //Logger.log(resource)

  var request = DoubleClickCampaigns.FloodlightActivities.update(resource, profileId);
  };


  SpreadsheetApp.getUi().alert('Finished Updating Default Tags!');
};






function auditPublisherTags() {
  assertCampaignManagerApi_();

  var runValues    = _fetchProfileId();
  var profileId    = runValues[0];
  var advertiserId = runValues[1];

  var SHEET_NAME = "Audit Publisher Tags";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  // Start clean
  sh.clear();

  // 8 headers, including the preview col at H
  var headers = [
    "ID",
    "Floodlight Name",
    "Pub Tag ID",
    "Publisher Tag Site Names",
    "Publisher Site IDs",
    "Tag Code",
    "Conversion Type",
    "Tag Code (preview)"
  ];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

  // Collect rows
  var rows = [headers];
  var resp = DCM.FloodlightActivities.list(profileId, { advertiserId: String(advertiserId) });
  var items = (resp && resp.floodlightActivities) || [];

  for (var i = 0; i < items.length; i++) {
    var fa = items[i];
    var faId = fa.id || "";
    var faName = fa.name || "";
    var pubTags = fa.publisherTags || [];
    if (pubTags.length === 0) continue;

    for (var j = 0; j < pubTags.length; j++) {
      var pt = pubTags[j] || {};
      var siteId = pt.siteId || "";

      // safe site lookup
      var siteName = "";
      try {
        var site = DCM.Sites.get(profileId, String(siteId));
        siteName = site && site.name ? String(site.name) : "";
      } catch (_) {}

      var dyn = pt.dynamicTag || {};
      var tagId   = dyn.id  || "";
      var tagCode = dyn.tag || "";

      var click = pt.clickThrough === true;
      var view  = pt.viewThrough === true;
      var convType = (click && view) ? "Both" : (view ? "ViewThrough" : "ClickThrough");

      rows.push([
        faId,
        faName,
        tagId,
        siteName,
        siteId,
        tagCode,   // E is the original multi-line tag (we’ll hide this)
        convType,
        ""         // H is the preview (formula inserted below)
      ]);
    }
  }

  // Write rows
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();

  // Put single-line preview formula in H (Col 8) based on F (Col 6)
  if (lastRow > 1) {
    sh.getRange(2, 8, lastRow - 1, 1).setFormulaR1C1(
      '=IF(LEN(RC[-2]),SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(RC[-2],CHAR(10)," "),CHAR(13),""),CHAR(9)," "), "")'
    );
  }

  // Formatting
  sh.setFrozenRows(1);
  sh.getRange(1, 1, Math.max(1, lastRow), 8).setWrap(false).setNumberFormat('@');

  if (lastRow >= 1) sh.setRowHeight(1, 24);        // header
  if (lastRow > 1)  sh.setRowHeights(2, lastRow - 1, 21);

  // Widths aligned to the 8 headers
  sh.setColumnWidth(1, 140); // ID
  sh.setColumnWidth(2, 260); // Floodlight Name
  sh.setColumnWidth(3, 140); // Pub Tag ID
  sh.setColumnWidth(4, 220); // Publisher Tag Site Names
  sh.setColumnWidth(5, 140); // Publisher Site IDs
  sh.setColumnWidth(6, 360); // Tag Code (original, multi-line)
  sh.setColumnWidth(7, 120); // Conversion Type
  sh.setColumnWidth(8, 500); // Tag Code (preview, single-line)

  // Hide the multi-line original so it never inflates row height
  sh.hideColumn(sh.getRange("F1"));

  toast_('Finished retrieving publisher tags (with single-line preview).', 'Audit Publisher Tags', 5);
}




function patchPublisherTags() {
  runValues = _fetchProfileId();
  var profileId = values[0];
  var advertiserId = values[1];
  var ss = "Audit Publisher Tags"
  //rangeList = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ss); // Bringing in spreadsheet to clear prior execution
  //sheetList = rangeList.getRange(row=2, column=1, numRows=rangeList.getLastRow(), numColumns=rangeList.getLastColumn()).clearContent()
  results = [["ID", "Name", "Pub Tag ID", "Publisher Tag Site Names", "Publisher Site IDs", "Tag Code", "Remove Publisher Tag (Y/N)"]];
   

  readFromSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name="Audit Publisher Tags");
  dataRange = readFromSheet.getDataRange();
  uploadData = dataRange.getValues();
  
  
  for (i=1; i < uploadData.length; i++){
  audienceData = uploadData[i];
  var currentRow = i + 1;
  var id = audienceData[0].toString();
 
  var response = DoubleClickCampaigns.FloodlightActivities.get(profileId, id)
  
  var floodlightActivity = response;

    status = floodlightActivity.hidden;
    counter = floodlightActivity.countingMethod;
    tagType = floodlightActivity.floodlightTagType
    url = floodlightActivity.expectedUrl
    groupId = floodlightActivity.floodlightActivityGroupId;
    cache = floodlightActivity.cacheBustingType;
    uVariables = DoubleClickCampaigns.FloodlightActivities.get(profileId=profileId, id=id).userDefinedVariableTypes;
    if( typeof uVariables === 'undefined' || uVariables === null ){
      joinedUVariables = "";
    }
    else{
     joinedUVariables = uVariables.join(",");
    }; 
    defaultTags = floodlightActivity.defaultTags;

  var pubTagsAssignment = [];
  var pubTagsConversion = [];
  
  ptUpdate = audienceData[7];
  conversions = audienceData[6];
  
  
  if (ptUpdate === "N"){

  if (conversions === "Both") {
  pubTagsAssignment.push({"clickThrough" : true, "viewThrough" : true, "siteId" : audienceData[4], "name" : audienceData[3], "tag" : audienceData[5], "id" : audienceData[2]})
   } else if (conversions === "ClickThrough") {
  pubTagsAssignment.push({"clickThrough" : true, "viewThrough" : false, "siteId" : audienceData[4], "name" : audienceData[3], "tag" : audienceData[5], "id" : audienceData[2]})
  } else {pubTagsAssignment.push({"clickThrough" : false, "viewThrough" : true, "siteId" : audienceData[4], "name" : audienceData[3], "tag" : audienceData[5], "id" : audienceData[2]})
  };  
      var resource = {
	"kind": "dfareporting#floodlightActivity",  
    "defaultTags" : defaultTags,
    "name" : audienceData[1],
    "id" : id,
    "floodlightTagType" : tagType,
    "floodlightActivityGroupId" : groupId,
    "countingMethod" : counter,
    "expectedUrl" : url,
    "userDefinedVariableTypes": joinedUVariables,
    "cacheBustingType" : cache,
    "publisherTags" : pubTagsAssignment    
    };
   } 
   else if (ptUpdate ==="Y"){
      ptR = "";
      var resource = {
	"kind": "dfareporting#floodlightActivity",  
    "name" : audienceData[1],
    "id" : id,
    "floodlightTagType" : tagType,
    "floodlightActivityGroupId" : groupId,
    "countingMethod" : counter,
    "expectedUrl" : url,
    "userDefinedVariableTypes": joinedUVariables,
    "cacheBustingType" : cache,
    "defaultTags" : defaultTags
  }
  };

  };
  //var request = DoubleClickCampaigns.FloodlightActivities.update(resource, profileId);

  //SpreadsheetApp.getUi().alert('Finished Updating Default Tags!');
};




function patchUVariables(){
  runValues = _fetchProfileId();
  profileId = values[0];
  advertiserId = values[1];
  var audienceSheet = "Patch U-Variables";
 // rangeList = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(audienceSheet); // Bringing in spreadsheet to clear prior execution
 // sheetList = rangeList.getRange(row=2, column=1, numRows=rangeList.getLastRow(), numColumns=rangeList.getLastColumn()).clearContent();
  results = [["Floodlight Activity ID", "Floodlight Name", "Overwrite Custom U-Variables comma deliminated"]];

readFromSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name="Patch U-Variables");
dataRange = readFromSheet.getDataRange();
uploadData = dataRange.getValues();

for (i=1; i < uploadData.length; i++){
  audienceData = uploadData[i];
  var currentRow = i + 1;

  resource = {
	"kind": "dfareporting#floodlightActivity",  
	"advertiserId": values[1],  
    "id": audienceData[0],
  "userDefinedVariableTypes": audienceData[2].split(",")
};

response = DoubleClickCampaigns.FloodlightActivities.patch(resource=resource, profileId=profileId, id=audienceData[0]);
    readFromSheet.getRange("D" + currentRow)
      .setValue(response.userDefinedVariableTypes.join(","))
      .setBackground(AUTO_POP_CELL_COLOR);
    };   
     SpreadsheetApp.getUi().alert('Finished Patching U-Variables!');
    };



function getRemarketingList(){
  runValues = _fetchProfileId();
  profileId = values[0];
  advertiserId = values[1];
  var remarketingSheet = "Get Remarketing List";
  rangeList = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(remarketingSheet); // Bringing in spreadsheet to clear prior execution
  sheetList = rangeList.getRange(row=2, column=1, numRows=rangeList.getLastRow(), numColumns=rangeList.getLastColumn()).clearContent();
  results = [["Audience ID", "Audience Name", "Active", "List Size", "Life Span", "Audience Source", "Floodlight Activity ID"]]
  var response;
  var pageToken;
 do {
   response = DoubleClickCampaigns.RemarketingLists.list(profileId=profileId, advertiserId=advertiserId, {'pageToken': pageToken});
   if (response.remarketingLists){
   for (var i in response.remarketingLists){
    remarketingList = response.remarketingLists[i];
    remarketingId = remarketingList.id
    remarketingName = remarketingList.name;
    remarketingStatus = remarketingList.active;
    remarketingListSize = remarketingList.listSize;
    remarketingLifeSpan = remarketingList.lifeSpan;
    remarketingSource = remarketingList.listSource;
    if (remarketingSource === "REMARKETING_LIST_SOURCE_DFA"){
    floodlightId = remarketingList.listPopulationRule.floodlightActivityId
    row = [remarketingId, remarketingName,  remarketingStatus, remarketingListSize, remarketingLifeSpan, remarketingSource, floodlightId];
    results.push(row);
     };
    };
   };
   pageToken = response.nextPageToken;
  } while (pageToken);
 var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(remarketingSheet);
 var range = sheet.getRange(row=1, column=1, numRows=results.length, numColumns=results[0].length);
  range.setValues(values=results);
  SpreadsheetApp.getUi().alert('Finished Retrieving Audience Lists!');
};

function qaAudienceList(){
  runValues = _fetchProfileId();
  profileId = values[0];
  advertiserId = values[1];
  var audienceSheet = "Audience QA";
  rangeList = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(audienceSheet); // Bringing in spreadsheet to clear prior execution
  sheetList = rangeList.getRange(row=2, column=1, numRows=rangeList.getLastRow(), numColumns=rangeList.getLastColumn()).clearContent();
  results = [["Floodlight ID", "Floodlight Name", "Audience Floodlight ID", "Missing IDs", "", "Missing Floodlight IDs", "Missing Floodlight Names"]];
var sheetFrom = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Get Floodlight Activities");
var sheetFromAudience = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Get Remarketing List");
var sheetTo = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Audience QA");
// Copy from 1st row, 1st column, all rows for one column 
var valuesToCopy = sheetFrom.getRange(2, 1, sheetFrom.getLastRow(), 1).getValues();
//Paste to another sheet from first cell onwards
sheetTo.getRange(2, 1, sheetFrom.getLastRow(), 1).setValues(valuesToCopy);
var valuesToCopyC = sheetFrom.getRange(2, 2, sheetFrom.getLastRow(), 1).getValues();
//Paste to another sheet from first cell onwards
sheetTo.getRange(2, 2, sheetFrom.getLastRow(), 1).setValues(valuesToCopyC);

// Copy from 1st row, 7th column, all rows for one column 
var valuesToCopyA = sheetFromAudience.getRange(2, 7, sheetFromAudience.getLastRow(), 1).getValues();
//Paste to another sheet from first cell onwards
sheetTo.getRange(2, 3, sheetFromAudience.getLastRow(), 1).setValues(valuesToCopyA);
var cell = sheetTo.getRange(2, 4, sheetTo.getLastRow(), 1).setFormula('=IFERROR(IF(LEN(VLOOKUP(A2,$C$2:$C$10000,1,FALSE))>1,"",A2),A2)');
var cellTwo = sheetTo.getRange(2, 5, sheetTo.getLastRow(), 1);
cellTwo.setFormula('=IF(AND(D2<>"", D2>0), 1, 0)+E1');
var cellThree = sheetTo.getRange(2, 6, sheetTo.getLastRow(), 1);
cellThree.setFormula('=IFERROR(INDEX(D:D, MATCH(ROW()-1, E:E,0)), "")');
var cellFour = sheetTo.getRange(2, 7, sheetTo.getLastRow(), 1).setFormula('=VLOOKUP(F2, A:B,2)');

//Concat FL ID = FL Name For Audience Build
SpreadsheetApp.getUi().alert('Finished Audience QA!');
};

function createAudienceList(){
  runValues = _fetchProfileId();
  profileId = values[0];
  advertiserId = values[1];
  var audienceSheet = "Build Audience";
  results = [["Advertiser ID", "Floodlight Activity ID", "Floodlight Name", "Audience Name", "Active", "Life Span", "List Source"]];

readFromSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name="Build Audience");
dataRange = readFromSheet.getDataRange();
uploadData = dataRange.getValues();

for (i=1; i < uploadData.length; i++){
  audienceData = uploadData[i];
  var currentRow = i + 1;
  resource = {
	"kind": "dfareporting#remarketingList",  
	"advertiserId": audienceData[0],  
	"advertiserIdDimensionValue": {    
		"kind": "dfareporting#dimensionValue",    
		"dimensionName": "dfareporting#dimensionValue",    
		"value": audienceData[0],  
		},  
	"listPopulationRule": {    
		"floodlightActivityId": audienceData[1], 
		},  
	"name": audienceData[3],
	"active": audienceData[4],
	"lifeSpan": audienceData[5],
	"listSource": audienceData[6],
    };
    response = DoubleClickCampaigns.RemarketingLists.insert(resource=resource, profileId=profileId);
     readFromSheet.getRange("H" + currentRow)
      .setValue(response.id)
      .setBackground(AUTO_POP_CELL_COLOR);
    }; 
    SpreadsheetApp.getUi().alert('Finished Creating Audience!');
};







function createFloodlight(){
  // Make sure the CM360 Advanced Service is enabled
  assertCampaignManagerApi_();

  // Use whichever service name exists in this script
  var SVC = this.DoubleClickCampaigns || this.Dfareporting;

  // Get profile + advertiser
  var runValues    = _fetchProfileId();
  var profileId    = runValues[0];
  var advertiserId = runValues[1];

  var floodlightSheet = "Create Floodlights";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var readFromSheet = ss.getSheetByName(floodlightSheet);
  if (!readFromSheet) {
    SpreadsheetApp.getUi().alert('Sheet "' + floodlightSheet + '" not found.');
    return;
  }

  // Determine last row using your helper
  var columnToCheck = readFromSheet.getRange("A:A").getValues();
  var lastRow = getLastRowSpecial(columnToCheck);
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('No input rows found in "' + floodlightSheet + '".');
    return;
  }

  var dataRange  = readFromSheet.getRange(1, 1, lastRow, 10);
  var uploadData = dataRange.getValues();

  for (var i = 1; i < uploadData.length; i++) {
    var floodlightData = uploadData[i];
    var currentRow = i + 1;

    var uVariables;
    if (floodlightData[9] && String(floodlightData[9]).length > 0) {
      uVariables = String(floodlightData[9]).split(",");
    }

    var resource = {
      "kind": "dfareporting#floodlightActivity",
      "advertiserId": floodlightData[0],
      "name": floodlightData[1],
      "expectedUrl": floodlightData[2],
      "floodlightActivityGroupType": floodlightData[3],
      "floodlightActivityGroupId": floodlightData[4],
      "countingMethod": floodlightData[5],
      "tagString": floodlightData[6],
      "hidden": floodlightData[7],
      "floodlightTagType": floodlightData[8]
    };
    if (uVariables) resource.userDefinedVariableTypes = uVariables;

    // Use the service alias
    var response = SVC.FloodlightActivities.insert(resource, profileId);

    readFromSheet.getRange("K" + currentRow)
      .setValue(response.id)
      .setBackground(AUTO_POP_CELL_COLOR);
  }

  toast_('Finished Creating Floodlights!', 'Create Floodlights', 5);
}









function getLastRowSpecial(range){
  var rowNum = 0;
  var blank = false;
  for(var row = 0; row < range.length; row++){
 
    if(range[row][0] === "" && !blank){
      rowNum = row;
      blank = true;
    }else if(range[row][0] !== ""){
      blank = false;
    };
  };
  return rowNum;
};


function generateFloodlightTags(){

  runValues = _fetchProfileId();
  profileId = values[0];
  advertiserId = values[1];

  var ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Floodlight Tags");
  readFromSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Download Floodlights")

  clearList = ss.getRange(row=7, column=1, numRows=ss.getLastRow(), numColumns=ss.getLastColumn()).clearContent().clearFormat();

  var readActivityIDs = readFromSheet.getRange('A2:A').getValues();
  var activityIDs = readActivityIDs.reduce(function(ar, e){
  if (e[0]) ar.push(e[0])
  return ar;
  }, []);
 
  results = [["Activity ID", "Activity Name", "Group Name", "Expected URL", "Tag", "Global Snippet", "Event Snippet"]];

    // Generate the floodlight activity tag.
  for (var i = 0; i < activityIDs.length; i++){
  var ID = activityIDs[i];
 var response = DoubleClickCampaigns.FloodlightActivities.get(profileId, id=ID)
    activityID = response.id
    activityName = response.name;
    groupName = response.floodlightActivityGroupName;
    expectedURL = response.expectedUrl
    var request = DoubleClickCampaigns.FloodlightActivities.generatetag(profileId, optionalArgs={floodlightActivityId : ID})
    generateResponse = request
  
  globalSnippet = [""]
  eventSnippet = [""]
  tagSnippet = [""]
  if (generateResponse.getGlobalSiteTagGlobalSnippet() != null) {
      // This is a global site tag, display both the global snippet and event snippet.
      globalSnippet = generateResponse.getGlobalSiteTagGlobalSnippet();
      eventSnippet = generateResponse.getFloodlightActivityTag();
    } else {
      // This is an image or iframe tag.
      tagSnippet = generateResponse.getFloodlightActivityTag();
    };

    //globalSnippet = request.globalSiteTagGlobalSnippet
   // eventSnippet = request.floodlightActivityTag
    row = [activityID, activityName, groupName, expectedURL, tagSnippet, globalSnippet, eventSnippet]
     results.push(row);
  //};
  };

  ss.getRange(row=7, column=2, numRows=results.length, numColumns=results[0].length)
  .setWrap(true)
  .setBorder(true, true, true, true, true, true)
  .setFontSize(08)
  .setVerticalAlignment("top")
  .setNumberFormat('@');

  ss.getRange('B3:F3')
  .setWrap(true)
  .setVerticalAlignment("bottom")
  ss.getRange('B2:F2')
  .setVerticalAlignment("bottom")

  cell = ss.getRange('B2')
 Logger.log(cell.getBackground());
  
  var range = ss.getRange(row=6, column=2, numRows=results.length, numColumns=results[0].length);
  range.setValues(values=results);
  
  SpreadsheetApp.getUi().alert('Finished Generating Floodlight Tags!');  
};

function exportSpreadsheet() {
 
  //All requests must include id in the path and a format parameter
  //https://docs.google.com/spreadsheets/d/{SpreadsheetId}/export
 
  //FORMATS WITH NO ADDITIONAL OPTIONS
  //format=xlsx       //excel
  //format=ods        //Open Document Spreadsheet
  //format=zip        //html zipped          
  
  //CSV,TSV OPTIONS***********
  //format=csv        // comma seperated values
  //             tsv        // tab seperated values
  //gid=sheetId             // the sheetID you want to export, The first sheet will be 0. others will have a uniqe ID
  
  // PDF OPTIONS****************
  //format=pdf     
  //size=0,1,2..10             paper size. 0=letter, 1=tabloid, 2=Legal, 3=statement, 4=executive, 5=folio, 6=A3, 7=A4, 8=A5, 9=B4, 10=B5  
  //fzr=true/false             repeat row headers
  //portrait=true/false        false =  landscape
  //fitw=true/false            fit window or actual size
  //gridlines=true/false
  //printtitle=true/false
  //pagenum=CENTER/UNDEFINED      CENTER = show page numbers / UNDEFINED = do not show
  //attachment = true/false      dunno? Leave this as true
  //gid=sheetId                 Sheet Id if you want a specific sheet. The first sheet will be 0. others will have a uniqe ID. 
                               // Leave this off for all sheets. 
  // EXPORT RANGE OPTIONS FOR PDF
  //need all the below to export a range
  //gid=sheetId                must be included. The first sheet will be 0. others will have a uniqe ID
  //ir=false                   seems to be always false
  //ic=false                   same as ir
  //r1=Start Row number - 1        row 1 would be 0 , row 15 wold be 14
  //c1=Start Column number - 1     column 1 would be 0, column 8 would be 7   
  //r2=End Row number
  //c2=End Column number
  
// var flSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Floodlight Tags");
// var googleID2 = flSheet.getSheetId().toString();
 var googleID  = SpreadsheetApp.getActiveSheet().getSheetId().toString();
 var spreadsheetID = SpreadsheetApp.getActiveSpreadsheet().getId().toString();
 //var spreadsheetID2 = flSheet

  Logger.log(spreadsheetID)
  
  var ssID = spreadsheetID;
  var gid = googleID;
  var url = "https://docs.google.com/spreadsheets/d/"+ssID+"/export"+
                                                        "?gid="+gid+"&format=xlsx&"+
                                                        "size=0&"+
                                                        "fzr=false&"+
                                                        "portrait=false&"+
                                                        "fitw=true&"+
                                                        "gridlines=false&"+
                                                        "printtitle=true&"+
                                                        "sheetnames=true&"+
                                                        "pagenum=CENTER&"+
                                                        "attachment=true";
                                                        

                                                       
  var params = {method:"GET",headers:{"authorization":"Bearer "+ ScriptApp.getOAuthToken()}};
  
  var date = new Date()
  date.getTime();
  
  formatDate = Utilities.formatDate(date, "GMT-4", "yyyy_MM_dd")
  var response = UrlFetchApp.fetch(url, params).getBlob().setName("FloodlightTagsheet_"+formatDate)
  
  DriveApp.createFile(response);
  
  //or send as email

var currentEmail = Session.getActiveUser().getEmail();
var subject = "Floodlight Tagsheet_"+formatDate
var body = "Attached are your floodlight tags that you have generated!"

  MailApp.sendEmail(email=currentEmail, subject, body, {
        attachments: [{
            fileName: "FloodlightTagsheet_"+formatDate+".xlsx",
            content: response.getBytes(),
            mimeType: "application/xlsx"
        }]
    });
SpreadsheetApp.getUi().alert('Your floodlight tags have been emailed & saved to '+currentEmail+'!');    
   };


function listGroups(){
 runValues = _fetchProfileId();
  profileId = values[0];
  advertiserId = values[1];
 
 
var ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Create Floodlights");
sheetList = ss.getRange(row=2, column=12, numRows=ss.getLastRow(), numColumns=16).clearContent()



  resultsFinal = [["Group ID", "Group Name", "U-Variable Number", "U-Variable Name", "U-Variable Type"]];
  resultsOne = [["Group ID", "Group Name", "Group Type"]];
  resultsTwo = [["U-Variable Number", "U-Variable Name", "U-Variable Type"]];

request = DoubleClickCampaigns.FloodlightActivityGroups.list(profileId, optionalArgs={'advertiserId' : advertiserId});
response = request.floodlightActivityGroups;
  for (i=0; i < response.length; i++){
    groups = response[i]
      groupId = groups.id;
      groupName = groups.name;
      groupType = groups.type;
      configId = groups.floodlightConfigurationId;

      rowOne = [groupId, groupName, groupType];
      resultsOne.push(rowOne);
   // Logger.log(groups)

     };

response2 = DoubleClickCampaigns.FloodlightConfigurations.list(profileId, optionalArgs={'ids' : configId}).floodlightConfigurations;
  for (k=0; k < response2.length; k++){
    uVariables = response2[k]
    uVariablesConfig = uVariables.userDefinedVariableConfigurations;
    if (uVariablesConfig){
    for (j=0; j < uVariablesConfig.length; j++){
       config = uVariablesConfig[j];
         uVariableNumber =  config.variableType;
         uVariableName = config.reportName;;
         uVariableType = config.dataType;
      
      rowTwo = [uVariableNumber, uVariableName, uVariableType];
       resultsTwo.push(rowTwo);
};
     };
     };

//Logger.log(resultsTwo)
        var rangeOne = ss.getRange(row=1, column=13, numRows=resultsOne.length, numColumns=resultsOne[0].length);
      rangeOne.setValues(values=resultsOne);
        var rangeTwo = ss.getRange(row=1, column=16, numRows=resultsTwo.length, numColumns=resultsTwo[0].length);
      rangeTwo.setValues(values=resultsTwo);
      
      SpreadsheetApp.getUi().alert('Finished Creating Floodlight Legend!');    

};


/**
 * Floodlight Builder Key (A–C for group once; D–F per U-variable)
 * Columns:
 *   A: Group ID
 *   B: Group Name
 *   C: Group Type
 *   D: U-Variable Number
 *   E: U-Variable Name
 *   F: U-Variable Type
 */
function listGroupsToNewTab() {
  assertCampaignManagerApi_();
  const [profileId, advertiserId] = _fetchProfileId();

  const SHEET = 'Floodlight Builder Key';
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  sh.clear();

  // Headers: A–C (Groups) and D–F (U-vars) are independent lists
  const headers = [
    'Group ID', 'Group Name', 'Group Type',
    'U-Variable Number', 'U-Variable Name', 'U-Variable Type'
  ];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

  // 1) Get ALL groups (paginate)
  const groups = [];
  let pageToken = null;
  do {
    const resp = DCM.FloodlightActivityGroups.list(profileId, {
      advertiserId: String(advertiserId),
      pageToken: pageToken,
      maxResults: 200
    });
    if (resp && resp.floodlightActivityGroups) {
      groups.push.apply(groups, resp.floodlightActivityGroups);
    }
    pageToken = (resp && resp.nextPageToken) || null;
  } while (pageToken);

  // 2) Build the unique GROUPS list (A–C), no duplicates
  const seenGroupIds = new Set();
  const groupRows = [];
  for (var i = 0; i < groups.length; i++) {
    const g = groups[i];
    const gid = String(g.id || '');
    if (gid && !seenGroupIds.has(gid)) {
      seenGroupIds.add(gid);
      groupRows.push([gid, g.name || '', g.type || '']);
    }
  }

  // 3) Fetch U-variable definitions (unique across configs), build D–F once
  const cfgIds = Array.from(new Set(
    groups
      .map(g => g && g.floodlightConfigurationId ? String(g.floodlightConfigurationId) : null)
      .filter(Boolean)
  ));

  const seenUVarKey = new Set();     // dedupe by number+name+type
  const uvarRows = [];

  if (cfgIds.length) {
    const cfgResp = DCM.FloodlightConfigurations.list(profileId, { ids: cfgIds });
    const cfgs = (cfgResp && cfgResp.floodlightConfigurations) || [];
    for (var c = 0; c < cfgs.length; c++) {
      const cfg = cfgs[c];
      const uvList = cfg.userDefinedVariableConfigurations || [];
      for (var u = 0; u < uvList.length; u++) {
        const uv = uvList[u] || {};
        const num  = uv.variableType || '';
        const name = uv.reportName   || '';
        const type = uv.dataType     || '';
        const key  = [num, name, type].join('\u0001');
        if (!seenUVarKey.has(key)) {
          seenUVarKey.add(key);
          uvarRows.push([num, name, type]);
        }
      }
    }
  }

  // 4) Write the two lists side-by-side (pad the shorter one with blanks)
  const rows = Math.max(groupRows.length, uvarRows.length);
  const grid = [];
  for (var r = 0; r < rows; r++) {
    const left  = groupRows[r] || ['', '', ''];
    const right = uvarRows[r]  || ['', '', ''];
    grid.push(left.concat(right));
  }

  if (grid.length) {
    sh.getRange(2, 1, grid.length, headers.length).setValues(grid);
  } else {
    sh.getRange(2, 1).setValue('No data found for this advertiser.');
  }

  // Formatting
  sh.setFrozenRows(1);
  sh.getRange(1, 1, Math.max(1, grid.length + 1), headers.length)
    .setWrap(false)
    .setNumberFormat('@')

  sh.setRowHeight(1, 24);
  if (grid.length) sh.setRowHeights(2, grid.length, 21);

  // Helpful widths
  sh.setColumnWidth(1, 140); // Group ID
  sh.setColumnWidth(2, 260); // Group Name
  sh.setColumnWidth(3, 140); // Group Type
  sh.setColumnWidth(4, 130); // U-Variable Number
  sh.setColumnWidth(5, 260); // U-Variable Name
  sh.setColumnWidth(6, 160); // U-Variable Type

  toast_('Floodlight Builder Key created (A–C unique groups, D–F unique U-vars).', 'Floodlight Tools', 5);
}









