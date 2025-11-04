// Prefer the modern service name; fall back to legacy if present
var DCM = this.Dfareporting || this.DoubleClickCampaigns;

function assertCampaignManagerApi_() {
  if (!DCM) {
    SpreadsheetApp.getUi().alert(
      'Campaign Manager 360 Advanced Service is not enabled for this script.\n\n' +
      'In the Apps Script editor, click Services ( + ) and add "Campaign Manager 360" (shows as Dfareporting).'
    );
    throw new Error('CM360 Advanced Service not available.');
  }
}

function toast_(message, title, seconds) {
  SpreadsheetApp.getActive().toast(String(message || ''), String(title || ''), Number(seconds || 5));
}

// Global variables/configurations
var DCMProfileID = 'DCMProfileID';
var AUTO_POP_HEADER_COLOR = '#a4c2f4';
var USER_INPUT_HEADER_COLOR = '#b6d7a8';
var AUTO_POP_CELL_COLOR = 'lightgray';
var AUTO_POP_FLOODLIGHT_COLOR = '#99ccff';


// Data range values
var DCMUserProfileID = 'DCMUserProfileID';

// sheet names
var SETUP_SHEET = 'Run Details';
var ACTIVITES_SHEET = 'Get Floodlight Activities';
var DEFAULT_SHEET = 'Audit Default Tags';
var PUBLISHER_SHEET = 'Audit Publisher Tags';
var UVARIABLE_SHEET = 'Patch U-Variables';
var REMARKETING_SHEET = 'Get Remarketing List';
var AUDIENCEQA_SHEET = 'Audience QA';
var BUILDAUDIENCE_SHEET = 'Build Audience';
var CREATE_FLOODLIGHT_SHEET = 'Create Floodlights';
var DOWNLOAD_FLOODLIGHTS_SHEET = 'Download Floodlights';
var FLOODLIGHT_TAGS_SHEET = 'Floodlight Tags';

/**
 * Helper function to get DCM Profile ID.
 * @return {object} DCM Profile ID.
 */
function _fetchProfileId() {
  const runSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Run Details');
  const profileId = String(runSheet.getRange(5, 3).setNumberFormat('@').getValue()).trim(); // C5
  const advertiserId = String(runSheet.getRange(6, 3).setNumberFormat('@').getValue()).trim(); // C6
  if (!profileId || !advertiserId) {
    SpreadsheetApp.getUi().alert('Enter Profile ID (C5) and Advertiser ID (C6) on "Run Details".');
    throw new Error('Missing Profile/Advertiser ID.');
  }
  return [profileId, advertiserId];
}



/**
 * Find and clear, or create a new sheet named after the input argument.
 * @param {string} sheetName The name of the sheet which should be initialized.
 * @param {boolean} lock To lock the sheet after initialization or not
 * @return {object} A handle to a sheet.
 */
function initializeSheet_(sheetName, lock) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (sheet == null) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clear();
  }
  if (lock) {
    sheet.protect().setWarningOnly(true);
  }
  return sheet;
}


/**
 * Initialize all tabs and their header rows
 */
function setupTabs() {
  _setupSetupSheet();
  _setupFloodlightActivitiesSheet();
  _setupDefaultTagsSheet();
  _setupPublisherTagsSheet();
 // _setupUVariablesSheet();
  //_setupRemarketingListSheet();
 // _setupAudienceQASheet();
 // _setupBuildAudienceSheet();
  _setupCreateFloodlightSheet();
  _setupDownloadFloodlightSheet();
  _setupFloodlightSheet();
}

/**
 * Initialize the Setup sheet and its header row
 * @return {object} A handle to the sheet.
*/
function _setupSetupSheet() {
  // --- 1) Capture existing values BEFORE we clear the sheet
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var existing = ss.getSheetByName(SETUP_SHEET);
  var savedProfile = '';
  var savedAdvertiser = '';

  if (existing) {
    // preserve as plain text
    savedProfile   = String(existing.getRange('C5').setNumberFormat('@').getValue()).trim();
    savedAdvertiser = String(existing.getRange('C6').setNumberFormat('@').getValue()).trim();
  }

  // --- 2) Create/clear the sheet
  var sheet = initializeSheet_(SETUP_SHEET, false);
  var cell;

  // --- 3) Rebuild header + instructions (your original content)
  sheet.getRange('B2').setValue("DCM Floodlight Tools");
  sheet.getRange('B2:C2')
      .setFontWeight('bold')
      .setWrap(true)
      .setBackground(AUTO_POP_HEADER_COLOR)
      .setFontSize(12);

  sheet.getRange('B3')
      .setValue('For any questions contact BrianKaufman7@gmail.com');

  var instructions = [
    "Initial setup:",
    "# Make a copy of this template trix",
    "# In Menu, Go to [Tools] > [Script editor]",
    "# [Browser tab of the appscript] [Resources] > "+
    "[Advanced Google Services]",
    "# [Advanced Google Services] Enable \"DCM/DFA Reporting And Trafficking API\"",
    "# Go back to appscript tab, select OK and close the [Advanced Google Services] window",
    null,
    null,
    "How to use:",
    "# Enter DCM Profile ID in C5, and Advertiser ID in C6 of this tab",
    "# All Functions are found under [Floodlight Tools]",
    "# [Get Floodlight Activies] Retrieve the list of Floodlight Activities for an advertiser [Get Floodlight Activities]",
    "# [Audit Default Tags] Retrieve the list of default tags applied to floodlights for an advertiser [Audit Default Tags]",
    //"# [Audit Default Tags] Update to remove applied default tags [Y/N] [Update Default Tags]",
    "# [Audit Publisher Tags] Retrieve the list of publisher tags applied to floodlights for an advertiser [Audit Publisher Tags]",
    //"# [Patch U-Variables]  Bulk apply or remove custom U-Variables to floodlights - will override any not included [Patch U-Variables]",
    //"# [Get Remarketing List] Retrieve the list of audiences created by DCM for an advertiser [Get Remarketing List]",
    //"# [Audience QA] Checks to ensure every floodlight has an audience. If not, missing audiences appear. [Audience QA]",
    //"# [Build Audience] Bulk create Audiences (60/time) by [Floodlight Tools] > [Build Audience]",
    "# [Create Floodlights] Bulk create Floodlights (60/time) by [Floodlight Tools] > [Create Floodlights]",
    "# [Floodlight Builder Key] Retrieve the list of Group Names/Ids and the U Variables and their Variable Name",
    "# [Download Floodlights] Enter in activity IDs under column A that you wish to See within the [Floodlight Tags] tab.",
    "# [Floodlight Tags] Shows the Floodlight tags for activity IDs listed on \"Download Floodlights\" [Generate Floodlights]",
    //"# Export and email floodlight tags to yourself [Email Floodlights]"
  ];

  for (var i = 0; i < instructions.length; i++) {
    cell = i + 2;
    var count = instructions[i] == null ? -1 : (i == 0 ? 0 : count + 1);
    var value = instructions[i] == null ? null : instructions[i].replace('#', count + ')');
    sheet.getRange('E' + cell).setValue(value);

    if (count == 0) {
      sheet.getRange('E' + cell + ':M' + cell)
        .setFontWeight("bold")
        .setWrap(true)
        .setBackground(AUTO_POP_HEADER_COLOR)
        .setFontSize(12);
    }
  }

  sheet.getRange('E' + (cell + 3)).setValue("Legends")
    .setFontWeight("bold")
    .setFontSize(12);
  sheet.getRange('E' + (cell + 4))
    .setValue("Green Cells / Columns are for input");
  sheet.getRange('E' + (cell + 5))
    .setValue("Blue Cells /Columns are for the script to populate (do not edit)");

  sheet.getRange('E' + (cell + 3) + ':M' + (cell + 3))
    .setBackground("#f9cb9c");
  sheet.getRange('E' + (cell + 4) + ':M' + (cell + 4))
    .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('E' + (cell + 5) + ':M' + (cell + 5))
    .setBackground(AUTO_POP_HEADER_COLOR);

  sheet.getRange('B5').setValue("User Profile ID")
    .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('B6').setValue("Advertiser ID")
    .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('C5').setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('C6').setBackground(USER_INPUT_HEADER_COLOR);

  sheet.getRange("B5:C6").setFontWeight("bold").setWrap(true);

  // --- 4) Restore the preserved values (as plain text)
  if (savedProfile) {
    sheet.getRange('C5').setNumberFormat('@').setValue(savedProfile);
  }
  if (savedAdvertiser) {
    sheet.getRange('C6').setNumberFormat('@').setValue(savedAdvertiser);
  }

  return sheet;
}




function _setupFloodlightActivitiesSheet() {
  var sheet = initializeSheet_(ACTIVITES_SHEET, false);

  sheet.getRange('A1').setValue('Floodlight ID').setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('B1').setValue('Name').setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('C1').setValue('uVariables').setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('D1').setValue('Status').setBackground(AUTO_POP_HEADER_COLOR); // was "Active"
  sheet.getRange('E1').setValue('Counting Method').setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('F1').setValue('Group Name').setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('G1').setValue('Group ID').setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('H1').setValue('Activity String').setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('I1').setValue('Tag Type').setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('J1').setValue('Expected URL').setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('K1').setValue('CacheBustingType').setBackground(AUTO_POP_HEADER_COLOR);

  sheet.getRange('A1:K1').setFontWeight('bold').setWrap(true);
  sheet.getRange('A2:A').setNumberFormat('@');
  sheet.getRange('G2:G').setNumberFormat('@');

  return sheet;
}



/**
 * Initialize the Default Tags sheet and its header row
 * @return {object} A handle to the sheet.
 */
function _setupDefaultTagsSheet() {
  var sheet = initializeSheet_(DEFAULT_SHEET, false);

  sheet.getRange('A1')
      .setValue('ID')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('B1')
      .setValue('Floodlight Name')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('C1')
      .setValue('Default Tag Names')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('D1')
      .setValue('Default Tag IDs')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('E1')
      .setValue('Tag Code')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('A1:E1')
      .setFontWeight('bold')
      .setWrap(true);
      
      
  return sheet;
}

/**
 * Initialize the Placements sheet and its header row
 * @return {object} A handle to the sheet.
 */
function _setupPublisherTagsSheet() {
  var sheet = initializeSheet_(PUBLISHER_SHEET, false);

  // Exact 8 headers including preview
  var headers = [
    'ID',
    'Floodlight Name',
    'Pub Tag ID',
    'Publisher Tag Site Names',
    'Publisher Site IDs',
    'Tag Code',
    'Conversion Type',
    'Tag Code (preview)'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Header style
  sheet.getRange('A1:H1')
    .setFontWeight('bold')
    .setWrap(false)
    .setBackground(AUTO_POP_HEADER_COLOR);

  // Column types / widths
  sheet.getRange('A2:A').setNumberFormat('@'); // IDs as text
  sheet.getRange('E2:E').setNumberFormat('@'); // Site IDs as text

  // Nice widths
  sheet.setColumnWidth(1, 140);
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidth(3, 140);
  sheet.setColumnWidth(4, 220);
  sheet.setColumnWidth(5, 140);
  sheet.setColumnWidth(6, 360);
  sheet.setColumnWidth(7, 120);
  sheet.setColumnWidth(8, 500);

  // Freeze header and keep rows compact
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 24);

  return sheet;
}



/**
 * Initialize the U-Variable sheet and its header row
 * @return {object} A handle to the sheet.
 */
//function _setupUVariablesSheet() {
//  var sheet = initializeSheet_(UVARIABLE_SHEET, false);
//
  //sheet.getRange('A1')
    //  .setValue('Floodlight Activity ID*')
      //.setBackground(USER_INPUT_HEADER_COLOR);
  //sheet.getRange('B1')
    //  .setValue('Floodlight Name')
    //  .setBackground(USER_INPUT_HEADER_COLOR);
  //sheet.getRange('C1')
    //  .setValue('Overwrite Custom U-Variables comma deliminated*')
     // .setBackground(USER_INPUT_HEADER_COLOR);
  //sheet.getRange('D1')
    //  .setValue('Updated Variables (do not edit; auto-filling)')
      //.setBackground(AUTO_POP_HEADER_COLOR);
  //sheet.getRange('A1:D1').setFontWeight('bold').setWrap(true);
  //return sheet;
//}

/**
 * Initialize the Remarketing List sheet and its header row
 * @return {object} A handle to the sheet.
 */
function _setupRemarketingListSheet() {
  var sheet = initializeSheet_(REMARKETING_SHEET, false);

  sheet.getRange('A1')
      .setValue('Audience ID')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('B1')
      .setValue('Audience Name')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('C1')
      .setValue('Active')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('D1')
      .setValue('List Size')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('E1')
      .setValue('Life Span')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('F1')
      .setValue('Audience Source')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('G1')
      .setValue('Floodlight Activity ID')
      .setBackground(AUTO_POP_HEADER_COLOR);

  sheet.getRange('A1:G1').setFontWeight('bold').setWrap(true).createFilter();
  return sheet;
}

/**
 * Initialize the Audience QA sheet and its header row
 * @return {object} A handle to the sheet.
 */
function _setupAudienceQASheet() {
  var sheet = initializeSheet_(AUDIENCEQA_SHEET, false);

  sheet.getRange('A1')
      .setValue('Floodlight ID')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('B1')
      .setValue('Floodlight Name')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('C1')
      .setValue('Audience Floodlight ID')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('D1')
      .setValue('Missing IDs')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('E1')
      .setValue('')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('F1')
      .setValue('No Audiences Floodlights')
      .setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('G1')
      .setValue('Missing Floodlight Names')
      .setBackground(AUTO_POP_HEADER_COLOR);
 
 sheet.hideColumns(4);
 sheet.hideColumns(5);
 
  sheet.getRange('A1:G1').setFontWeight('bold').setWrap(true);
  return sheet;
}

/**
 * Initialize the Audience Build sheet and its header row
 * @return {object} A handle to the sheet.
 */
function _setupBuildAudienceSheet() {
  var sheet = initializeSheet_(BUILDAUDIENCE_SHEET, false);

  sheet.getRange('A1')
      .setValue('Advertiser ID')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('B1')
      .setValue('Floodlight Activity ID')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('C1')
      .setValue('Floodlight Name')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('D1')
      .setValue('Audience Name')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('E1')
      .setValue('Active')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('F1')
      .setValue('Life Span')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('G1')
      .setValue('List Source')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('H1')
      .setValue('ID (do not edit; auto-filling)')
      .setBackground(AUTO_POP_HEADER_COLOR);
      
  sheet.getRange('A1:H1').setFontWeight('bold').setWrap(true);
  
  var advertiserRange = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Run Details").getRange(row=6, column=3)
  var advertiserIdRule = SpreadsheetApp.newDataValidation().setAllowInvalid(false).requireValueInRange(advertiserRange, true).build();
  sheet.getRange('A2:A').setDataValidation(advertiserIdRule).setNumberFormat("@");
  
  var hiddenRule = SpreadsheetApp.newDataValidation().setAllowInvalid(false).requireValueInList(['true','false'], true).build();
  sheet.getRange('E2:E').setDataValidation(hiddenRule).setNumberFormat("@");  
  
  var lifeSpanRule = SpreadsheetApp.newDataValidation().requireNumberBetween(1, 540).build();
  sheet.getRange('F2:F').setDataValidation(lifeSpanRule);

  var listSourceRule = SpreadsheetApp.newDataValidation().requireValueInList(['REMARKETING_LIST_SOURCE_DFA'], true).build();
  sheet.getRange('G2:G').setDataValidation(listSourceRule);  

  return sheet;
}

function _setupCreateFloodlightSheet() {
  var sheet = initializeSheet_(CREATE_FLOODLIGHT_SHEET, false);

  sheet.getRange('A1')
      .setValue('Advertiser ID*')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('B1')
      .setValue('Floodlight Name*')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('C1')
      .setValue('Expected URL*')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('D1')
      .setValue('Tag Type*')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('E1')
      .setValue('Activity Group ID*')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('F1')
      .setValue('Counting Method*')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('G1')
      .setValue('Activity Tag String')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('H1')
      .setValue('Hidden*')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('I1')
      .setValue('Tag Format*')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('J1')
      .setValue('Custom U-Variables')
      .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('K1')
      .setValue('ID (do not edit; auto-filling)')
      .setBackground(AUTO_POP_HEADER_COLOR);

  sheet.getRange('L1')
    .setValue('GTM Container (label)')
    .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('M1')
    .setValue('GTM Container Path')
    .setBackground(AUTO_POP_HEADER_COLOR);

  sheet.getRange('A1:L1').setFontWeight('bold').setWrap(true);
 
  var advertiserRange = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Run Details").getRange(row=6, column=3)
  var advertiserIdRule = SpreadsheetApp.newDataValidation().requireValueInRange(advertiserRange, true).setAllowInvalid(false).build();
  sheet.getRange('A2:A').setDataValidation(advertiserIdRule).setNumberFormat("@");
  

  var tagTypeRule = SpreadsheetApp.newDataValidation().requireValueInList(['COUNTER','SALE'], true).setAllowInvalid(false).build();
  sheet.getRange('D2:D').setDataValidation(tagTypeRule);
  
  var countingRule = SpreadsheetApp.newDataValidation().requireValueInList(['ITEMS_SOLD_COUNTING','SESSION_COUNTING','STANDARD_COUNTING','TRANSACTIONS_COUNTING','UNIQUE_COUNTING'], true).setAllowInvalid(false).build();
  sheet.getRange('F2:F').setDataValidation(countingRule);
  
  var hiddenRule = SpreadsheetApp.newDataValidation().requireValueInList(['true','false'], true).setAllowInvalid(true).build();
  sheet.getRange('H2:H').setDataValidation(hiddenRule);
  
  var tagformatRule = SpreadsheetApp.newDataValidation().requireValueInList(['GLOBAL_SITE_TAG','IFRAME','IMAGE'], true).setAllowInvalid(true).build();
  sheet.getRange('I2:I').setDataValidation(tagformatRule);

  var activityTagStringRule = SpreadsheetApp.newDataValidation().setAllowInvalid(false).requireFormulaSatisfied('=LEN(G2:G)<9').build();
  sheet.getRange('G2:G').setDataValidation(activityTagStringRule);

  try { refreshGtmContainersDropdown_ && refreshGtmContainersDropdown_(); } catch (_) {}

  return sheet;
}

function _setupDownloadFloodlightSheet() {
  var sheet = initializeSheet_(DOWNLOAD_FLOODLIGHTS_SHEET, false);

  sheet.getRange('A1')
      .setValue('Activity ID')
      .setBackground(USER_INPUT_HEADER_COLOR);
   
  sheet.getRange('A1').setFontWeight('bold').setWrap(true);
  return sheet;
}

function _setupFloodlightSheet() {
  var sheet = initializeSheet_(FLOODLIGHT_TAGS_SHEET, false);
  var instructions = [
  "How to Implement Iframe and Image Tags"+
  '\n'+
 "1. Insert the Floodlight tags between the <body> and </body> tags, as close to the top of the webpage and the opening tag as possible. This will help ensure that the Floodlight request is sent to Campaign Manager even if the user presses \"Stop\" or navigates away from the page."+
 '\n'+
 "2. To defeat caching and ensure accurate counts, you need to insert a numeric value for the ord= parameter. The value cannot contain semicolons or special characters."+
 "For standard Floodlight tags, use a random number. For unique user tags, use a constant value. For sales tags, use an order confirmation number."+
 "Unique user tags also require a random number as the value of the num= parameter."+
 '\n'+
 "3. Insert device IDs into dc_rdid to enable in-app conversion tracking."+
 '\n'+
 "4. Choose the \"Secure Servers Only (https)\" option if the Floodlight tag will be placed on a webpage hosted on a secure server. This option changes http:// to https:// in the Floodlight tag. If this change isn't made, Floodlight data will not be captured, and certain browsers will display a security warning."+
    '\n'+'\n'+
 "About the Global Site Tag"+
 '\n'+
 "The global site tag sets new cookies on your domain, which will store a unique identifier for a user or the ad click that brought the user to your site. You must install this tag on every page of your website. Learn more at https://support.google.com/dcm/partner/answer/7568534"+
    '\n'+'\n'+
 "How to Implement the Global Site Tag"+
 '\n'+
 "1. Insert the global site tag between the <head> and </head> tags."+
'\n'+
 "2. The global snippet should be placed on every page of your website. If you’ve already installed a global site tag on your website, just add the \“config\” command to the global snippet."+
 '\n'+
 "3. The event snippet should be placed on pages with events you’re tracking, after the global snippet."
  ];

  sheet.getRange('B2:F2')
      .setValue('How to Implement Floodlight Tags')
      .merge()
      .setFontSize(08)
      .setVerticalAlignment("bottom")
      .setFontWeight('bold')
      .setBackground(AUTO_POP_FLOODLIGHT_COLOR)
      .setBorder(true, true, true, true, true, true);
  sheet.getRange('B3:F3')
      .setValue(instructions)
      .merge()
      .setWrap(true)
      .setVerticalAlignment("bottom")
      .setFontSize(08)
      .setBorder(true, true, true, true, true, true); 
  sheet.getRange('B6')
      .setValue('Activity ID')
      .setBackground(AUTO_POP_FLOODLIGHT_COLOR);
  sheet.getRange('C6')
      .setValue('Activity Name')
      .setBackground(AUTO_POP_FLOODLIGHT_COLOR);
  sheet.getRange('D6')
      .setValue('Group Name')
      .setBackground(AUTO_POP_FLOODLIGHT_COLOR);
  sheet.getRange('E6')
      .setValue('Expected URL')
      .setBackground(AUTO_POP_FLOODLIGHT_COLOR);
  sheet.getRange('F6')
      .setValue('Tag')
      .setBackground(AUTO_POP_FLOODLIGHT_COLOR);
  sheet.getRange('G6')
      .setValue('Global Snippet')
      .setBackground(AUTO_POP_FLOODLIGHT_COLOR);
  sheet.getRange('H6')
      .setValue('Event Snippet')
      .setBackground(AUTO_POP_FLOODLIGHT_COLOR);
      
  sheet.getRange('B6:H6')
  .setWrap(true)
  .setBorder(true, true, true, true, true, true)
  .setFontSize(08)
  .setFontWeight('bold')
  .setVerticalAlignment("top")
  .setNumberFormat('@');
  return sheet;
}


function debugCm360Env_() {
  Logger.log('Has Dfareporting? ' + !!this.Dfareporting);
  Logger.log('Has DoubleClickCampaigns? ' + !!this.DoubleClickCampaigns);
  SpreadsheetApp.getUi().alert('Open View → Logs');
}