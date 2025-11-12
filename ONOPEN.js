/************************************
 * ONOPEN.gs – Unified Menu (GTM + CM360)
 * Copy–paste this whole file.
 ************************************/

// ===== Globals & safe defaults =====
const MENU_MAIN = 'CM360 × GTM Tools';   // Menu title shown in Sheets UI
var RAW_SHEET = 'RAW_JSON';             // Sheet name for GTM JSON storage (var to allow redeclaration)

/**
 * Optional no-op helpers so onOpen never explodes
 * Replace these with your real implementations elsewhere.
 */
function ensureRawSheet_() {
  const ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(RAW_SHEET)) {
    const sh = ss.insertSheet(RAW_SHEET);
    sh.getRange("A:A").setNumberFormat("@");
  }
}

function getSheet_(name) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  return sh;
}

function refreshGtmContainersDropdown_() {}      // e.g., repopulates GTM container list
// resetWorkspace is in gtm audit.js - removed stub to avoid conflict
// resetWorkspace is in gtm audit.js - removed stub to avoid conflict
// openLoaderSidebar - real implementation below
// runGtmAll is in gtm audit.js - removed stub to avoid conflict
// setupTabs is in dcm fl utilities.js - removed stub to avoid conflict
// getFloodlightActivities is in dcm floodlight audit.js - removed stub to avoid conflict
// auditDefaultTags is in dcm floodlight audit.js - removed stub to avoid conflict
// auditPublisherTags is in dcm floodlight audit.js - removed stub to avoid conflict
// listGroupsToNewTab is in dcm floodlight audit.js - removed stub to avoid conflict
// createFloodlight is in dcm floodlight audit.js - removed stub to avoid conflict
// generateFloodlightTags is in dcm floodlight audit.js - removed stub to avoid conflict
// pushFloodlightsToGtm is in GTM get functions.js - removed stub to avoid conflict
// fetchFloodlightActivityLast30 is in gtm audit.js - removed stub to avoid conflict
// buildActivitySummaryAndAnnotate is in gtm audit.js - removed stub to avoid conflict
// runCm360All is in gtm audit.js - removed stub to avoid conflict

/**
 * When you create the "Create Floodlights" tab elsewhere, call this helper.
 * It safely attempts to refresh GTM containers after sheet setup.
 */
function _setupCreateFloodlightSheet() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('Create Floodlights') || ss.insertSheet('Create Floodlights');
  // TODO: add your column setup here
  try { refreshGtmContainersDropdown_ && refreshGtmContainersDropdown_(); } catch (_) {}
  return sheet;
}

/** =========================
 * Unified Menu (GTM + DCM)
 * ========================= */
function onOpen(e) {
  Logger.log('[onOpen] Starting menu build...');
  const ui = SpreadsheetApp.getUi();

  // Try to build the full menu; if any builder is missing, fall back to a minimal menu.
  try {
    Logger.log('[onOpen] Building DCM menu...');
    const dcmMenu = buildDcmMenu_(ui);
    Logger.log('[onOpen] DCM menu built successfully');
    
    Logger.log('[onOpen] Building GTM menu...');
    const gtmMenu = buildGtmMenu_(ui);
    Logger.log('[onOpen] GTM menu built successfully');
    
    Logger.log('[onOpen] Building Compare menu...');
    const compareMenu = buildCompareMenu_(ui);
    Logger.log('[onOpen] Compare menu built successfully');
    
    Logger.log('[onOpen] Adding menu to UI...');
    ui.createMenu(MENU_MAIN)
      .addSubMenu(dcmMenu)
      .addSubMenu(gtmMenu)
      .addSubMenu(compareMenu)
      .addSeparator()
      .addItem('Reset Workspace (keep Read Me / Run Details / RAW_JSON open loader)', 'resetWorkspace')
      .addToUi();
    Logger.log('[onOpen] Menu added successfully!');
  } catch (err) {
    Logger.log('[onOpen] ERROR: ' + err.message);
    Logger.log('[onOpen] Stack: ' + (err.stack || 'no stack'));
    // Fallback menu so users still see something even if builders fail
    ui.createMenu(MENU_MAIN)
      .addItem('Reset Workspace', 'resetWorkspace')
      .addItem('⚠️ Check Logs (menu error)', 'showMenuError')
      .addToUi();
    Logger.log('Menu build error (fallback shown): ' + (err && err.message));
  }

  // Ensure inputs exist / light bootstrap
  try { ensureRawSheet_ && ensureRawSheet_(); } catch (_) {}
  // Avoid crashing if Tag Manager Advanced Service isn't enabled yet
  try { refreshGtmContainersDropdown_ && refreshGtmContainersDropdown_(); } catch (_) {}
  
  Logger.log('[onOpen] Complete');
}

function onInstall(e) { onOpen(e); }

// Helper to show menu error details
function showMenuError() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Menu Build Error',
    'The menu failed to load. Check Apps Script logs:\n\n' +
    '1. Extensions → Apps Script\n' +
    '2. View → Executions\n' +
    '3. Look for onOpen errors\n\n' +
    'Common issues:\n' +
    '- Missing function definitions in other files\n' +
    '- Advanced Services not enabled (CM360, GTM)\n' +
    '- File loading order issue',
    ui.ButtonSet.OK
  );
}

/** -------------------------
 * DCM submenu builder
 * ------------------------- */
function buildDcmMenu_(ui) {
  return ui.createMenu('DCM / Floodlight')
    .addItem('Setup DCM Sheets', 'setupTabs')
    .addSeparator()
    .addItem('Get Floodlight Activities', 'getFloodlightActivities')
    .addItem('Audit Default Tags', 'auditDefaultTags')
    .addItem('Audit Publisher Tags', 'auditPublisherTags')
    .addItem('Floodlight Builder Key', 'listGroupsToNewTab')
    .addItem('Create Floodlights', 'createFloodlight')
    .addItem('Generate Floodlights', 'generateFloodlightTags')
    .addSeparator()
    .addItem('Push Floodlights to GTM', 'pushFloodlightsToGtm')
    .addSeparator()
    .addItem('Fetch Floodlight Activity (last 30 days)', 'fetchFloodlightActivityLast30')
    .addItem('Build Activity Summary & annotate Floodlights', 'buildActivitySummaryAndAnnotate')
    .addItem('Run It All (CM360 flow)', 'runCm360All')
    .addSeparator()
    .addItem('Apply Tab Colors', 'applyTabColorScheme_')
    .addItem('Organize Tab Order', 'organizeTabOrder_');
}

/** -------------------------
 * GTM submenu builder
 * ------------------------- */
function buildGtmMenu_(ui) {
  return ui.createMenu('GTM')
    .addItem('Open Loader (paste JSON)', 'openLoaderSidebar')
    .addItem('Run It All (build GTM tabs)', 'runGtmAll')
    .addSeparator()
    .addItem('Refresh GTM Containers', 'refreshGtmContainersDropdown_');
}

/** -------------------------
 * Compare submenu builder
 * ------------------------- */
function buildCompareMenu_(ui) {
  return ui.createMenu('Compare')
    .addItem('Setup DCM Impression Paste Tab', 'compareSetupActivityPasteTab')
    .addItem('Ingest DCM Activity (30d)', 'compareIngestActivityReportRun');
}

/** =======================================
 * Back-compat aliases (safe no-ops)
 * ======================================= */
function dcmGetFloodlightActivities() {
  if (typeof getFloodlightActivities === 'function') return getFloodlightActivities();
  throw new Error('getFloodlightActivities() not found');
}
function dcmGetDefaultTags() {
  if (typeof auditDefaultTags === 'function') return auditDefaultTags();
  throw new Error('auditDefaultTags() not found');
}
function dcmGetPublisherTags() {
  if (typeof auditPublisherTags === 'function') return auditPublisherTags();
  throw new Error('auditPublisherTags() not found');
}
function compareSetupActivityPasteTab() {
  if (typeof compareSetupActivityPasteTab_ === 'function') return compareSetupActivityPasteTab_();
  throw new Error('compareSetupActivityPasteTab_() not found (load COMPARATOR.gs)');
}

function compareIngestActivityReportRun() {
  if (typeof compareIngestActivityReport === 'function') return compareIngestActivityReport();
  throw new Error('compareIngestActivityReport() not found (load COMPARATOR.gs)');
}

/** =======================================
 * GTM JSON Loader Sidebar
 * ======================================= */
function openLoaderSidebar() {
  ensureRawSheet_();
  const html = HtmlService.createHtmlOutput(`
    <div style="font-family:Inter,Arial,sans-serif;padding:12px;max-width:640px;">
      <h2 style="margin:0 0 8px;">GTM JSON Loader</h2>
      <p>Paste your entire <b>Container Version</b> export JSON below. Click <b>Save to Sheet</b>.</p>
      <textarea id="json" style="width:100%;height:280px;font-family:monospace;"></textarea>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button onclick="save()" style="padding:8px 12px;">Save to Sheet</button>
        <button onclick="google.script.host.close()" style="padding:8px 12px;">Close</button>
      </div>
      <script>
        function save(){
          const text = document.getElementById('json').value || '';
          google.script.run.withSuccessHandler(() => {
            alert('Saved to RAW_JSON! Run GTM – Run It All next.');
          }).withFailureHandler(e => alert('Error: ' + e.message)).saveJsonToRawSheet(text);
        }
      </script>
    </div>
  `).setTitle("GTM JSON Loader");
  SpreadsheetApp.getUi().showSidebar(html);
}

function saveJsonToRawSheet(text) {
  ensureRawSheet_();
  const sh = getSheet_(RAW_SHEET);
  sh.clear();
  sh.getRange("A:A").setNumberFormat("@");

  if (!text || !text.trim()) return;
  const size = 40000; // safe chunk size per cell
  const rows = [];
  for (let i = 0; i < text.length; i += size) {
    let chunk = text.substring(i, i + size);
    if (/^[=\+\-@]/.test(chunk)) chunk = "'" + chunk; // force literal text
    rows.push([chunk]);
  }
  sh.getRange(1, 1, rows.length, 1).setValues(rows);
}

function getRawJsonText_() {
  const sh = getSheet_(RAW_SHEET);
  sh.getRange("A:A").setNumberFormat("@");
  const values = sh.getRange(1,1,Math.max(1, sh.getLastRow()),1).getValues().map(r => (r[0] || "").toString());
  const nonEmpty = values.map(s => s.replace(/^'/, "")).filter(s => s.trim() !== "");
  return nonEmpty.join("");
}
