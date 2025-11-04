/************************************
 * ONOPEN.gs – Unified Menu (GTM + CM360)
 * Copy–paste this whole file.
 ************************************/

// ===== Globals & safe defaults =====
const MENU_MAIN = 'CM360 × GTM Tools';   // Menu title shown in Sheets UI

/**
 * Optional no-op helpers so onOpen never explodes
 * Replace these with your real implementations elsewhere.
 */
function ensureRawSheet_() {}                    // e.g., ensures RAW_JSON exists
function refreshGtmContainersDropdown_() {}      // e.g., repopulates GTM container list
function resetWorkspace() { Logger.log('resetWorkspace stub'); }
function openLoaderSidebar() { Logger.log('openLoaderSidebar stub'); }
function runGtmAll() { Logger.log('runGtmAll stub'); }
function setupTabs() { Logger.log('setupTabs stub'); }
function getFloodlightActivities() { Logger.log('getFloodlightActivities stub'); }
function auditDefaultTags() { Logger.log('auditDefaultTags stub'); }
function auditPublisherTags() { Logger.log('auditPublisherTags stub'); }
function listGroupsToNewTab() { Logger.log('listGroupsToNewTab stub'); }
function createFloodlight() { Logger.log('createFloodlight stub'); }
function generateFloodlightTags() { Logger.log('generateFloodlightTags stub'); }
function pushFloodlightsToGtm() { Logger.log('pushFloodlightsToGtm stub'); }
function fetchFloodlightActivityLast30() { Logger.log('fetchFloodlightActivityLast30 stub'); }
function buildActivitySummaryAndAnnotate() { Logger.log('buildActivitySummaryAndAnnotate stub'); }
function runCm360All() { Logger.log('runCm360All stub'); }

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
  const ui = SpreadsheetApp.getUi();

  // Try to build the full menu; if any builder is missing, fall back to a minimal menu.
  try {
    ui.createMenu(MENU_MAIN)
      .addSubMenu(buildDcmMenu_(ui))
      .addSubMenu(buildGtmMenu_(ui))
      .addSubMenu(buildCompareMenu_(ui))
      .addSeparator()
      .addItem('Reset Workspace (keep Read Me / Run Details / RAW_JSON open loader)', 'resetWorkspace')
      .addToUi();
  } catch (err) {
    // Fallback menu so users still see something even if builders fail
    ui.createMenu(MENU_MAIN)
      .addItem('Reset Workspace', 'resetWorkspace')
      .addToUi();
    Logger.log('Menu build error (fallback shown): ' + (err && err.message));
  }

  // Ensure inputs exist / light bootstrap
  try { ensureRawSheet_ && ensureRawSheet_(); } catch (_) {}
  // Avoid crashing if Tag Manager Advanced Service isn’t enabled yet
  try { refreshGtmContainersDropdown_ && refreshGtmContainersDropdown_(); } catch (_) {}
}

function onInstall(e) { onOpen(e); }

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
    .addItem('Refresh GTM Containers', 'refreshGtmContainersDropdown_')
    .addItem('Push Floodlights to GTM', 'pushFloodlightsToGtm')
    .addSeparator()
    .addItem('Fetch Floodlight Activity (last 30 days)', 'fetchFloodlightActivityLast30')
    .addItem('Build Activity Summary & annotate Floodlights', 'buildActivitySummaryAndAnnotate')
    .addItem('Run It All (CM360 flow)', 'runCm360All');
}

/** -------------------------
 * GTM submenu builder
 * ------------------------- */
function buildGtmMenu_(ui) {
  return ui.createMenu('GTM')
    .addItem('Open Loader (paste JSON)', 'openLoaderSidebar')
    .addItem('Run It All (build GTM tabs)', 'runGtmAll');
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
