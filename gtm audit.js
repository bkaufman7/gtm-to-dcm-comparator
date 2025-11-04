/*******************************************************
 * Unified GTM ↔ CM360 Auditor
 * - GTM-only “Run It All” builds: GTM – Tags/Triggers/Variables/
 *   BuiltInVariables/Folders/Templates/Errors (original format)
 * - CM360-only “Run It All” pulls floodlights + default/publisher
 *   tags + 30-day activity; summarizes and annotates Floodlights;
 *   builds Compare tabs (best-effort on src/type/cat)
 * - RAW_JSON loader safely escapes (= + - @) at chunk start
 *******************************************************/

/** ======= Names & Constants ======= */
const RAW_SHEET            = "RAW_JSON";
const README_SHEET         = "Read Me";
const RUN_DETAILS_SHEET    = "Run Details";

/** GTM tab names (prefixed, original structure) */
const GTM_TAGS             = "GTM – Tags";
const GTM_TRIGGERS         = "GTM – Triggers";
const GTM_VARIABLES        = "GTM – Variables";
const GTM_BUILTINS         = "GTM – BuiltInVariables";
const GTM_FOLDERS          = "GTM – Folders";
const GTM_TEMPLATES        = "GTM – Templates";
const GTM_ERRORS           = "GTM – Errors";

/** DCM tabs */
const DCM_FLOODLIGHTS      = "DCM – Floodlights";
const DCM_DEFAULT_TAGS     = "DCM – Default Tags";
const DCM_PUBLISHER_TAGS   = "DCM – Publisher Tags";
const DCM_ACTIVITY_RAW     = "DCM – Activity (Raw)";
const DCM_ACTIVITY_SUM     = "DCM – Activity (Summary)";

/** Compare tabs */
const COMP_MATCHES         = "Compare – Matches";
const COMP_ONLY_DCM        = "Compare – Only in DCM";
const COMP_ONLY_GTM        = "Compare – Only in GTM";

/** Colors */
const COLOR_GTM            = "#DCE8FF"; // light blue
const COLOR_DCM            = "#DFF5DD"; // light green
const COLOR_ACTIVITY       = "#FFE8CC"; // light orange
const COLOR_COMPARE        = "#EAD9FF"; // light purple

/** Dfareporting alias for any legacy code */
const DoubleClickCampaigns = (typeof Dfareporting !== 'undefined') ? Dfareporting : undefined;

/** Script properties keys */
const SCRIPT_PROP_NS       = "unified_audit";
const SP_KEY_REPORT_ID     = "cm360_floodlight_report_id";


/** ======= Safe Workspace Reset ======= */
function resetWorkspace() {
  const ss = SpreadsheetApp.getActive();
  const mustHave = new Set([README_SHEET, RUN_DETAILS_SHEET, RAW_SHEET]);

  // Ensure the three core sheets exist
  [README_SHEET, RUN_DETAILS_SHEET, RAW_SHEET].forEach(n => {
    if (!ss.getSheetByName(n)) ss.insertSheet(n);
  });

  // Delete everything else
  ss.getSheets().forEach(sh => { if (!mustHave.has(sh.getName())) safeDeleteSheet_(sh); });

  // Rebuild “Read Me” (your existing builder)
  try { ensureReadMe_(); } catch (e) { Logger.log(e); }

  // Rebuild “Run Details” using your utilities layout (C5/C6)
  try { 
    if (typeof _setupSetupSheet === 'function') {
      _setupSetupSheet();                 // <-- your utilities formatter
    } else if (typeof ensureRunDetails_ === 'function') {
      ensureRunDetails_();                // fallback to your other builder if present
    }
  } catch (e) { Logger.log(e); }

  // Prepare RAW sheet for JSON loader
  const raw = getSheet_(RAW_SHEET);
  raw.clear();
  raw.getRange("A:A").setNumberFormat("@");

  // Order tabs
  setSheetOrder_(getSheet_(README_SHEET), 1);
  setSheetOrder_(getSheet_(RUN_DETAILS_SHEET), 2);
  setSheetOrder_(getSheet_(RAW_SHEET), 3);

  // Toast instead of blocking alert
  SpreadsheetApp.getActive().toast(
    'Workspace reset. Next: GTM → Open Loader → paste JSON; then GTM → Run It All; then fill C5/C6 and run CM360 → Run It All.',
    'Reset complete',
    8
  );
}


function safeDeleteSheet_(sheet) {
  const ss = SpreadsheetApp.getActive();
  if (ss.getSheets().length <= 1) return;
  ss.deleteSheet(sheet);
}

/** ======= Base helpers ======= */
function getSheet_(name) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}
function setSheetOrder_(sheet, pos1) {
  const ss = SpreadsheetApp.getActive();
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(pos1);
}
function ensureRawSheet_() {
  const sh = getSheet_(RAW_SHEET);
  sh.getRange("A:A").setNumberFormat("@");
}






function ensureReadMe_() {
  // --- Names / palette (safe fallbacks; read any globals via `this`) ---
  const READMESHEET_NAME = (typeof this.README_SHEET !== 'undefined' && this.README_SHEET) ? this.README_SHEET : 'Read Me';
  const COLOR_GTM_MAIN   = (typeof this.COLOR_GTM_MAIN !== 'undefined')   ? this.COLOR_GTM_MAIN   : '#8ab4f8';
  const COLOR_DCM        = (typeof this.COLOR_DCM !== 'undefined')        ? this.COLOR_DCM        : '#4285F4';
  const AUTO_POP_HEADER_COLOR   = (typeof this.AUTO_POP_HEADER_COLOR !== 'undefined')   ? this.AUTO_POP_HEADER_COLOR   : '#a4c2f4';
  const USER_INPUT_HEADER_COLOR = (typeof this.USER_INPUT_HEADER_COLOR !== 'undefined') ? this.USER_INPUT_HEADER_COLOR : '#b6d7a8';
  const AUTO_POP_CELL_COLOR     = (typeof this.AUTO_POP_CELL_COLOR !== 'undefined')     ? this.AUTO_POP_CELL_COLOR     : '#d9d9d9';

  const CARD_BG = '#f5f7fb';
  const CARD_BORDER = '#dde3ee';
  const TITLE_BG = '#1b2735';
  const TITLE_FG = '#ffffff';

  // --- Sheet bootstrapping ---
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(READMESHEET_NAME) || ss.insertSheet(READMESHEET_NAME);

  // Clean values, formats, and any previous merges (defensive)
  sh.clear();
  try { sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart(); } catch (_) {}

  sh.setTabColor('#6e7cff');
  sh.activate();

  // Layout
  sh.setColumnWidths(1, 1, 34);   // A gutter
  sh.setColumnWidths(2, 1, 360);  // B
  sh.setColumnWidths(3, 1, 260);  // C
  sh.setColumnWidths(4, 1, 320);  // D
  sh.setColumnWidths(5, 1, 260);  // E
  sh.setColumnWidths(6, 1, 34);   // F gutter
  sh.setRowHeights(1, 1, 44);
  sh.getRange('A:Z').setVerticalAlignment('top').setWrap(true);

  // ---- Title banner (no merge; style A1:F2, put text in A1) ----
  sh.getRange('A1:F2').setBackground(TITLE_BG);
  sh.getRange('B1').setFontColor(TITLE_FG).setFontSize(18).setFontWeight('bold')
    .setHorizontalAlignment('left').setVerticalAlignment('middle')
    .setValue('Unified GTM ↔ CM360 Auditor');

  // ---- Quick Actions header (no merge; header in B4, shade B4:D4) ----
  sh.getRange('B4:D4').setBackground('#eef3fe');
  sh.getRange('B4').setFontWeight('bold').setValue('⚡ Quick Actions');

  // ---- Quick Actions table (B5:C...) ----
  const qa = [
    ['Open Loader (paste GTM JSON)',            'Menu → GTM → Open Loader (paste JSON)'],
    ['Run all GTM builds',                      'Menu → GTM → Run It All (build GTM tabs)'],
    ['Setup DCM Sheets',                        'Menu → DCM / Floodlight → Setup DCM Sheets'],
    ['Get Floodlight Activities',               'Menu → DCM / Floodlight → Get Floodlight Activities'],
    ['Audit Default Tags',                      'Menu → DCM / Floodlight → Audit Default Tags'],
    ['Audit Publisher Tags',                    'Menu → DCM / Floodlight → Audit Publisher Tags'],
    ['Fetch Activity (last 30 days)',           'Menu → DCM / Floodlight → Fetch Floodlight Activity (last 30 days)'],
    ['Build Activity Summary & annotate',       'Menu → DCM / Floodlight → Build Activity Summary & annotate Floodlights'],
    ['Run CM360 – end-to-end',                  'Menu → DCM / Floodlight → Run It All (CM360 flow)'],
    ['Reset Workspace (safe)',                  'Menu → Reset Workspace']
  ];
  const qaStartRow = 5;
  const qaEndRow = qaStartRow + qa.length - 1;
  sh.getRange(qaStartRow, 2, qa.length, 2).setValues(qa);
  sh.getRange('B5:C' + qaEndRow)
    .setBackground('#ffffff')
    .setBorder(true, true, true, true, true, true, '#dfe3ec', SpreadsheetApp.BorderStyle.SOLID)
    .setFontColor('#111');
  sh.getRange('B5:B' + qaEndRow).setFontWeight('bold');

  // ---- Card helper (no merges; title in first cell, shade full block, border box) ----
  function card_(topLeftA1, widthCols, heightRows, title, titleColor, lines) {
    const start = sh.getRange(topLeftA1);
    const r = start.getRow();
    const c = start.getColumn();
    const rows = heightRows;
    const cols = widthCols;

    // Card box + bg
    sh.getRange(r, c, rows, cols).setBackground(CARD_BG)
      .setBorder(true,true,true,true,true,true, CARD_BORDER, SpreadsheetApp.BorderStyle.SOLID);

    // Title row
    sh.getRange(r, c, 1, cols).setBackground(titleColor);
    sh.getRange(r, c).setFontWeight('bold').setFontColor('#000').setFontSize(12).setValue('  ' + title);

    // Body text (first column only for simplicity)
    const body = Array.isArray(lines) ? lines : [];
    for (let i = 0; i < Math.min(body.length, rows - 1); i++) {
      sh.getRange(r + 1 + i, c).setFontSize(10).setValue(body[i]);
    }
  }

  // ---- GTM Flow card (B16:D24 => width 3 cols, height 9 rows) ----
  card_('B16', 3, 9, '🧱 GTM Flow', COLOR_GTM_MAIN, [
    '1) Export Container Version JSON from GTM.',
    '2) Menu → GTM → Open Loader (paste JSON).',
    '3) Menu → GTM → Run It All (build GTM tabs).',
    '   • Builds Tags, Triggers, Variables, Folders, Templates, Errors, External Destinations, Built-ins.',
    '4) (Optional) Reset Workspace to clean outputs (keeps Read Me / Run Details / RAW_JSON).',
    '',
    'Tips:',
    '• If JSON is huge (>1–2M chars), the loader auto-chunks it to RAW_JSON.',
    '• Avoid editing generated GTM tabs; re-run on new exports instead.'
  ]);

  // ---- CM360 Flow card (D4:E16 => width 2 cols, height 13 rows) ----
  card_('D4', 2, 13, '📊 CM360 Flow', COLOR_DCM, [
    'Before you start:',
    '• In “Run Details”: C5 = User Profile ID,  C6 = Advertiser ID (numeric).',
    '',
    'Typical run:',
    '1) Setup DCM Sheets (creates/clears tabs; color-codes).',
    '2) Get Floodlight Activities.',
    '3) Audit Default Tags & Publisher Tags.',
    '4) Fetch Floodlight Activity (last 30 days).',
    '5) Build Activity Summary & annotate Floodlights.',
    '6) Run It All (CM360 flow) to do steps 2–5 automatically.',
    '',
    'Creation:',
    '• Use Create/Generate Floodlights to scaffold tags when needed.'
  ]);

  // ---- Compare card (D18:E24 => width 2 cols, height 7 rows) ----
  card_('D18', 2, 7, '🧮 Compare GTM ↔ CM360', '#ffd666', [
    'Purpose: highlight Matches, Only-in-DCM, and Only-in-GTM.',
    'Match keys include source/type/category heuristics; review edge cases.',
    'Run: Menu → Compare → Build Matches/Only-in-DCM/Only-in-GTM.',
    'After review, resolve mismatches in GTM or CM360 as appropriate.'
  ]);

  // ---- Legends (header in B26, band B26:E26) ----
  sh.getRange('B26:E26').setBackground('#eef7f0');
  sh.getRange('B26').setFontWeight('bold').setValue('🎨 Legends');

  const legends = [
    ['User input (edit me)', USER_INPUT_HEADER_COLOR],
    ['Auto-populated header', AUTO_POP_HEADER_COLOR],
    ['Auto-populated cells', AUTO_POP_CELL_COLOR],
    ['GTM section color', COLOR_GTM_MAIN],
    ['CM360 section color', COLOR_DCM]
  ];
  let rr = 27;
  legends.forEach(([label, color]) => {
    sh.getRange(rr, 2, 1, 2).setBorder(true,true,true,true,true,true, CARD_BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(rr, 2).setValue(label);
    sh.getRange(rr, 3).setBackground(color).setValue(' ');
    rr++;
  });

  // ---- Help / notes (header B33, band B33:E36) ----
  sh.getRange('B33:E36').setBackground('#fff6e5')
    .setBorder(true,true,true,true,true,true, '#ffdf9e', SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange('B33').setValue('Help & Notes:').setFontWeight('bold');
  sh.getRange('B34').setFontSize(10).setValue('• Advanced Services: enable “DCM/DFA Reporting and Trafficking API”.');
  sh.getRange('B35').setFontSize(10).setValue('• Large runs? Consider chunking/caching or time-driven triggers for long CM360 scans.');
  sh.getRange('B36').setFontSize(10).setValue('• For questions, ping Platform Solutions or the sheet owner. Use filter views & rebuild tabs.');

  // Freeze
  sh.setFrozenRows(3);
  sh.setFrozenColumns(1);
}








function ensureRunDetails_() {
  // Safe fallbacks if globals aren’t defined
  const USER_INPUT_HEADER_COLOR = (typeof this.USER_INPUT_HEADER_COLOR !== 'undefined') ? this.USER_INPUT_HEADER_COLOR : '#b6d7a8';
  const AUTO_POP_HEADER_COLOR   = (typeof this.AUTO_POP_HEADER_COLOR   !== 'undefined') ? this.AUTO_POP_HEADER_COLOR   : '#a4c2f4';

  // Create / get the sheet
  const sheet = getSheet_(RUN_DETAILS_SHEET);
  sheet.clear();
  try { sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart(); } catch (_) {}

  // Basic layout
  sheet.setTabColor('#69c0ff');
  sheet.setColumnWidths(1, 1, 24);   // A gutter
  sheet.setColumnWidths(2, 1, 260);  // B
  sheet.setColumnWidths(3, 1, 260);  // C
  sheet.setColumnWidths(4, 1, 260);  // D
  sheet.setFrozenRows(2);

  // Title
  sheet.getRange('B2').setValue('DCM Floodlight Tools')
    .setFontWeight('bold').setFontSize(12).setBackground(AUTO_POP_HEADER_COLOR);
  sheet.getRange('C2').setValue('Enter your CM360 Profile & Advertiser IDs below.')
    .setFontSize(10).setWrap(true);

  // Inputs (C5/C6 to match getRunIds_)
  sheet.getRange('B5').setValue('User Profile ID').setFontWeight('bold').setWrap(true)
    .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('B6').setValue('Advertiser ID').setFontWeight('bold').setWrap(true)
    .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('C5:C6').setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('B5:C6').setFontSize(11);

  // Legends
  sheet.getRange('B9').setValue('Legends').setFontWeight('bold').setFontSize(12)
    .setBackground('#f9cb9c');
  sheet.getRange('B10').setValue('Green cells are for input')
    .setBackground(USER_INPUT_HEADER_COLOR);
  sheet.getRange('B11').setValue('Blue cells are auto-populated (do not edit)')
    .setBackground(AUTO_POP_HEADER_COLOR);

  // Help notes
  sheet.getRange('B13').setValue('Notes').setFontWeight('bold').setBackground('#fff6e5');
  sheet.getRange('B14').setValue('• Enable the “DCM/DFA Reporting and Trafficking API” under Advanced Services.')
    .setBackground('#fff6e5');
  sheet.getRange('B15').setValue('• After entering C5/C6, use the DCM / Floodlight menu to pull data.')
    .setBackground('#fff6e5');

  return sheet;
}







// If you prefer C5/C6 instead of C5/C6:
function getRunIds_() {
  const sh = getSheet_(RUN_DETAILS_SHEET);
  const profileId    = parseInt(String(sh.getRange("C5").getValue()).trim(), 10);
  const advertiserId = parseInt(String(sh.getRange("C6").getValue()).trim(), 10);
  if (!profileId || !advertiserId) {
    throw new Error("Enter numeric values in Run Details → C5 (User Profile ID) and C6 (Advertiser ID).");
  }
  return [profileId, advertiserId];
}


/** ======= Loader UI (safe-escape = + - @) ======= */
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

/** =========================
 *  GTM – BUILD (original)
 * ========================= */
function runGtmAll() {
  const started = new Date();
  const parse = tryParseJson_(getRawJsonText_());
  if (!parse.ok) {
    writeErrors_([`JSON parse failed: ${parse.error}`]);
    throw new Error(`JSON parse failed: ${parse.error}`);
  }
  const root = parse.data;
  const cv = root && root.containerVersion ? root.containerVersion : root;
  if (!cv || typeof cv !== 'object') {
    writeErrors_(['Could not find containerVersion object at root. Verify a Container Version export.']);
    throw new Error('Missing containerVersion');
  }

  // Arrays
  const tags      = asArray_(cv.tag);
  const triggers  = asArray_(cv.trigger);
  const variables = asArray_(cv.variable);
  const folders   = asArray_(cv.folder);
  const builtIns  = asArray_(cv.builtInVariable);
  const templates = asArray_(cv.template);

  const idMaps = buildIdMaps_(tags, triggers, variables, folders);
  const varUsage = scanVariableUsage_(tags, triggers, variables);
  const tagTrigMap = mapTagTriggerRelations_(tags, triggers);

  // Build sheets in original-like format (prefixed)
  writeGtm_Tags_(tags, idMaps, tagTrigMap);
  writeGtm_Triggers_(triggers, idMaps, tagTrigMap);
  writeGtm_Variables_(variables, idMaps, varUsage);
  writeGtm_Folders_(folders, tags, triggers, variables);
  writeGtm_BuiltIns_(builtIns);
  writeGtm_Templates_(templates);
  if (globalErrors_.length) writeErrors_(globalErrors_);

  // Format & colors
  autoFormatAndColor_(GTM_TAGS, COLOR_GTM);
  autoFormatAndColor_(GTM_TRIGGERS, COLOR_GTM);
  autoFormatAndColor_(GTM_VARIABLES, COLOR_GTM);
  autoFormatAndColor_(GTM_FOLDERS, COLOR_GTM);
  autoFormatAndColor_(GTM_BUILTINS, COLOR_GTM);
  autoFormatAndColor_(GTM_TEMPLATES, COLOR_GTM);
  autoFormatAndColor_(GTM_ERRORS, COLOR_GTM);

  Logger.log(`GTM build completed in ${(new Date() - started)/1000}s`);
}

/** ====== GTM writers (original columns) ====== */
let globalErrors_ = [];
function writeGtm_Tags_(tags, idMaps, tagTrigMap) {
  const sh = getSheet_(GTM_TAGS);
  sh.clear();
  const header = [
    "Tag ID","Name","Type","Folder","Firing Triggers","Blocking Triggers",
    "Consent Status","Parameters (flattened JSON)","Notes","Vendor Summary","Violations"
  ];
  const rows = tags.map(t => {
    const folder = idMaps.folderNameById[t.parentFolderId] || "";
    const firingNames = asArray_(t.firingTriggerId).map(id => (idMaps.trigById[id] && idMaps.trigById[id].name) || id).join(", ");
    const blockingNames = asArray_(t.blockingTriggerId).map(id => (idMaps.trigById[id] && idMaps.trigById[id].name) || id).join(", ");
    const consent = t.consentSettings && t.consentSettings.consentStatus || "";
    const params = flattenParams_(t.parameter);
    const vendor = vendorSummaryForTag_(t);
    const notes = t.notes || "";
    const viol  = violationsForTag_(t, tagTrigMap);
    return [t.tagId||"", t.name||"", t.type||"", folder, firingNames, blockingNames, consent, safeJson_(params), notes, vendor, viol];
  });
  writeTable_(sh, header, rows);
}
function writeGtm_Triggers_(triggers, idMaps, tagTrigMap) {
  const sh = getSheet_(GTM_TRIGGERS);
  sh.clear();
  const header = ["Trigger ID","Name","Type","Event Name","Conditions (flattened)","Used By Tags","Folder","Violations"];
  const rows = triggers.map(tr => {
    const folder = idMaps.folderNameById[tr.parentFolderId] || "";
    const usedBy = (tagTrigMap.usedBy[tr.triggerId] ? Array.from(tagTrigMap.usedBy[tr.triggerId]).map(tid => tid).join(", ") : "");
    const conds  = flattenTriggerConditions_(tr);
    const eventName = (tr.type && tr.type.toLowerCase() === 'custom_event') ? (getParamValue_(tr, 'eventName') || "") : "";
    const viol = violationsForTrigger_(tr, tagTrigMap);
    return [tr.triggerId||"", tr.name||"", tr.type||"", eventName, conds, usedBy, folder, viol];
  });
  writeTable_(sh, header, rows);
}
function writeGtm_Variables_(variables, idMaps, varUsage) {
  const sh = getSheet_(GTM_VARIABLES);
  sh.clear();
  const header = ["Variable ID","Name","Type","Default Value","Parameters (flattened)","Used By Tags","Used By Triggers","Folder","Violations"];
  const rows = variables.map(v => {
    const folder = idMaps.folderNameById[v.parentFolderId] || "";
    const p = flattenParams_(v.parameter);
    const defVal = ('defaultValue' in p) ? p.defaultValue : (p.value || "");
    const use = varUsage.byVarId[v.variableId] || {inTags:new Set(), inTriggers:new Set()};
    const usedTags = Array.from(use.inTags).join(", ");
    const usedTriggers = Array.from(use.inTriggers).join(", ");
    const viol = violationsForVariable_(v, varUsage);
    return [v.variableId||"", v.name||"", v.type||"", defVal||"", safeJson_(p), usedTags, usedTriggers, folder, viol];
  });
  writeTable_(sh, header, rows);
}
function writeGtm_Folders_(folders, tags, triggers, variables) {
  const sh = getSheet_(GTM_FOLDERS);
  sh.clear();
  const header = ["Folder ID","Folder Name","Tags","Triggers","Variables"];
  const rows = folders.map(f => {
    const t = tags.filter(x => x.parentFolderId === f.folderId).map(x => x.name||x.tagId).join(", ");
    const tr= triggers.filter(x => x.parentFolderId === f.folderId).map(x => x.name||x.triggerId).join(", ");
    const va= variables.filter(x => x.parentFolderId === f.folderId).map(x => x.name||x.variableId).join(", ");
    return [f.folderId||"", f.name||"", t, tr, va];
  });
  writeTable_(sh, header, rows);
}
function writeGtm_BuiltIns_(builtIns) {
  const sh = getSheet_(GTM_BUILTINS);
  sh.clear();
  const header = ["Type/Name","Enabled"];
  const rows = builtIns.map(b => [b.type || b.name || "", true]);
  writeTable_(sh, header, rows);
}
function writeGtm_Templates_(templates) {
  const sh = getSheet_(GTM_TEMPLATES);
  sh.clear();
  const header = ["Template Name","Description","Permissions/Info (raw)"];
  const rows = templates.map(t => [t.name || t.displayName || "", t.description || "", safeJson_(t.permissions || t)]);
  writeTable_(sh, header, rows);
}
function writeErrors_(errors) {
  const sh = getSheet_(GTM_ERRORS);
  if (sh.getLastRow() === 0) {
    writeTable_(sh, ["Error"], errors.map(e => [e]));
  } else {
    sh.insertRowsAfter(sh.getLastRow() || 1, errors.length);
    sh.getRange(sh.getLastRow() - errors.length + 1, 1, errors.length, 1).setValues(errors.map(e => [e]));
  }
}

/** Formatting helpers */
function writeTable_(sheet, header, rows) {
  const totalRows = Math.max(1, rows.length + 1);
  const totalCols = Math.max(1, header.length);
  sheet.clear();
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,totalCols).setValues([header]).setFontWeight("bold").setBackground("#f1f3f4");
  if (rows.length) sheet.getRange(2,1,rows.length,totalCols).setValues(rows);
  const lr = sheet.getLastRow(), lc = sheet.getLastColumn();
  if (lr > 1 && lc > 0) sheet.getRange(1,1,lr,lc).createFilter();
}
function autoFormatAndColor_(name, color) {
  const sh = getSheet_(name);
  const lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (lr && lc) {
    sh.getRange(1,1,1,lc).setFontWeight("bold").setBackground("#f1f3f4");
    sh.autoResizeColumns(1, Math.min(lc, 50));
  }
  sh.setTabColor(color);
}

/** Utility parsing for GTM */
function tryParseJson_(text) { try { return { ok:true, data: JSON.parse(text) }; } catch(e){ return { ok:false, error: e && e.message || String(e)}; } }
function asArray_(v) { return Array.isArray(v) ? v : (v ? [v] : []); }
function buildIdMaps_(tags,triggers,variables,folders){
  const trigById={}, folderNameById={};
  triggers.forEach(tr=>trigById[tr.triggerId]=tr);
  folders.forEach(f=>folderNameById[f.folderId]=f.name||"");
  return { trigById, folderNameById };
}
function scanVariableUsage_(tags,triggers,variables){
  const usageByVarId = {};
  const pat = /\{\{\s*([^}|]+)\s*(?:\|[^}]*)?\}\}/g;
  const scan = (obj, acc) => {
    if (obj==null) return;
    if (typeof obj === 'string') { let m; while((m=pat.exec(obj))!==null){acc.add(m[1]);} }
    else if (Array.isArray(obj)) obj.forEach(x=>scan(x,acc));
    else if (typeof obj === 'object') Object.values(obj).forEach(v=>scan(v,acc));
  };
  variables.forEach(v=>{
    const inTags=new Set(), inTriggers=new Set();
    tags.forEach(t=>{ const s=new Set(); scan(t,s); if (s.has(v.name)) inTags.add(t.tagId);});
    triggers.forEach(tr=>{ const s=new Set(); scan(tr,s); if (s.has(v.name)) inTriggers.add(tr.triggerId);});
    usageByVarId[v.variableId]={inTags,inTriggers};
  });
  return { byVarId: usageByVarId };
}
function mapTagTriggerRelations_(tags,triggers){
  const firing={}, blocking={}, usedBy={};
  tags.forEach(t=>{
    firing[t.tagId] = new Set(asArray_(t.firingTriggerId));
    blocking[t.tagId]= new Set(asArray_(t.blockingTriggerId));
  });
  Object.entries(firing).forEach(([tid,set])=>set.forEach(tri=>{
    if(!usedBy[tri]) usedBy[tri]=new Set();
    usedBy[tri].add(tid);
  }));
  return { firing, blocking, usedBy };
}
function flattenParams_(params){
  const out={};
  asArray_(params).forEach(p=>{
    if(!p||!p.key) return;
    if('value' in p) out[p.key]=p.value;
    else if('list' in p) out[p.key]=asArray_(p.list).map(it=>{
      if(it && it.map) return flattenParams_(it.map);
      if(it && 'value' in it) return it.value;
      return it;
    });
    else if('map' in p) out[p.key]=flattenParams_(p.map);
  });
  return out;
}
function vendorSummaryForTag_(tag){
  const type = (tag.type||"").toLowerCase();
  const p = flattenParams_(tag.parameter);
  if (type.includes("ga4") || p.measurementId || p.eventName) {
    return `GA4 | MID=${p.measurementId||""} | Event=${p.eventName||""}`;
  }
  if (type.includes("dcf") || type.includes("floodlight") || p.cat || p.type || p.src) {
    const src=p.src||"", ft=p.type||"", cat=p.cat||"";
    const u = Object.keys(p).filter(k=>/^u\d+$/i.test(k)).map(k=>`${k}=${p[k]}`).join("&");
    return `Floodlight | src=${src} type=${ft} cat=${cat}${u? " | "+u:""}`;
  }
  if (type.includes("facebook") || type.includes("meta") || p.pixelId) {
    return `Meta | PixelID=${p.pixelId||""} Event=${p.eventName||""}`;
  }
  return "";
}
function violationsForTag_(tag, tagTrigMap){
  const flags=[];
  const hasFiring = tagTrigMap.firing[tag.tagId] && tagTrigMap.firing[tag.tagId].size>0;
  if(!hasFiring) flags.push("No Firing Triggers");
  if (!tag.consentSettings || !tag.consentSettings.consentStatus) flags.push("No Consent Settings");
  return flags.join(" | ");
}
function getParamValue_(node,key){ return flattenParams_(node && node.parameter)[key]; }
function flattenTriggerConditions_(tr){
  const filters = asArray_(tr.filter);
  return filters.map(f=>{
    const type=f.type||"";
    const p=flattenParams_(f.parameter);
    const k=p.arg0||p.key||"";
    const op = type.replace(/^MATCH_|^IN_/, "") || type;
    const v=p.arg1||p.value||p.pattern||JSON.stringify(p);
    return `${k} ${op} ${v}`;
  }).join(" AND ");
}
function violationsForTrigger_(tr, tagTrigMap){
  const flags=[];
  const used = tagTrigMap.usedBy[tr.triggerId];
  if(!used || used.size===0) flags.push("Unused Trigger");
  if (!asArray_(tr.filter).length && !tr.customEventFilter && tr.type !== 'ALWAYS') flags.push("No Conditions");
  return flags.join(" | ");
}
function violationsForVariable_(v, varUsage){
  const u=varUsage.byVarId[v.variableId];
  if(!u || (u.inTags.size===0 && u.inTriggers.size===0)) return "Unused Variable";
  return "";
}
function safeJson_(o){ try{return JSON.stringify(o);}catch(e){return String(o);} }

/** =========================
 *  CM360 – PULLS & REPORTS
 * ========================= */
function runCm360All() {
  dcmGetFloodlightActivities();
  dcmGetDefaultTags();
  dcmGetPublisherTags();
  fetchFloodlightActivityLast30();
  buildActivitySummaryAndAnnotate();
  runCompare();
}

/** Floodlight Activities (Advertiser) */
function dcmGetFloodlightActivities() {
  const [profileId, advertiserId] = getRunIds_();
  const sh = getSheet_(DCM_FLOODLIGHTS);
  sh.clear();

  const header = [
    "ID","Name","uVariables","Active",
    "Counting Method","Group Name","Group ID",
    "Activity Tag String (cat)","Group Tag String (type)",
    "Expected URL","CacheBustingType",
    "Has Default Tags?","Has Publisher Tags?",
    "Last Active Date","Total Imps (30d)","Total Clicks (30d)","Days Since Last Activity","Notes"
  ];
  sh.getRange(1,1,1,header.length).setValues([header]).setFontWeight("bold").setBackground("#f1f3f4");

  let pageToken, row=2;
  do {
    const resp = Dfareporting.FloodlightActivities.list(profileId, { advertiserId, maxResults: 200, pageToken });
    const list = resp.floodlightActivities || [];
    const rows = list.map(fa => {
      const id = fa.id;
      const name = fa.name || "";
      const active = fa.hidden ? "Archived" : "Active";
      const counter = fa.countingMethod || "";
      const group = fa.floodlightActivityGroupName || "";
      const groupId = fa.floodlightActivityGroupId || "";
      const tagString = fa.tagString || "";           // cat
      const groupTagString = fa.groupTagString || ""; // type
      const url = fa.expectedUrl || "";
      const cache = fa.cacheBustingType || "";
      let joinedU = "";
      try {
        const full = Dfareporting.FloodlightActivities.get(profileId, id);
        const uvars = full && full.userDefinedVariableTypes ? full.userDefinedVariableTypes : null;
        joinedU = uvars ? uvars.join(",") : "";
      } catch(e){}
      const hasDefault = (fa.defaultTags && fa.defaultTags.length) ? "Yes" : "No";
      const hasPublisher = (fa.publisherTags && fa.publisherTags.length) ? "Yes" : "No";
      return [id, name, joinedU, active, counter, group, groupId, tagString, groupTagString, url, cache, hasDefault, hasPublisher, "", "", "", "", ""];
    });

    if (rows.length) { sh.getRange(row,1,rows.length,header.length).setValues(rows); row+=rows.length; }
    pageToken = resp.nextPageToken;
  } while (pageToken);

  colorizeTab_(sh, COLOR_DCM);
  autoFormat_(sh);
  SpreadsheetApp.getUi().alert(`Loaded CM360 Floodlight Activities → "${DCM_FLOODLIGHTS}".`);
}

/** Default Tags */
function dcmGetDefaultTags() {
  const [profileId, advertiserId] = getRunIds_();
  const sh = getSheet_(DCM_DEFAULT_TAGS);
  sh.clear();
  const header = ["FL ID","FL Name","Default Tag Name","Default Tag ID","Tag Snippet"];
  sh.getRange(1,1,1,header.length).setValues([header]).setFontWeight("bold").setBackground("#f1f3f4");

  let pageToken, row=2;
  do {
    const resp = Dfareporting.FloodlightActivities.list(profileId, { advertiserId, maxResults: 200, pageToken });
    const list = resp.floodlightActivities || [];
    const rows = [];
    list.forEach(fa => {
      const defTags = fa.defaultTags || [];
      defTags.forEach(dt => {
        rows.push([fa.id, fa.name||"", dt.name||"", dt.id||"", dt.tag||""]);
      });
    });
    if (rows.length) { sh.getRange(row,1,rows.length,header.length).setValues(rows); row+=rows.length; }
    pageToken = resp.nextPageToken;
  } while (pageToken);

  colorizeTab_(sh, COLOR_DCM);
  autoFormat_(sh);
  SpreadsheetApp.getUi().alert(`Loaded Default Tags → "${DCM_DEFAULT_TAGS}".`);
}

/** Publisher Tags */
function dcmGetPublisherTags() {
  const [profileId, advertiserId] = getRunIds_();
  const sh = getSheet_(DCM_PUBLISHER_TAGS);
  sh.clear();
  const header = ["FL ID","FL Name","Pub Tag ID","Publisher Site Name","Publisher Site ID","Tag Snippet","Conversion Type"];
  sh.getRange(1,1,1,header.length).setValues([header]).setFontWeight("bold").setBackground("#f1f3f4");

  let pageToken, row=2;
  do {
    const resp = Dfareporting.FloodlightActivities.list(profileId, { advertiserId, maxResults: 200, pageToken });
    const list = resp.floodlightActivities || [];
    const rows = [];
    list.forEach(fa => {
      const pubTags = fa.publisherTags || [];
      pubTags.forEach(pt => {
        let siteName = "", siteId = pt.siteId || "";
        try {
          const site = Dfareporting.Sites.get(profileId, siteId);
          siteName = site && site.name || "";
        } catch(e){}
        const cType = (pt.clickThrough && pt.viewThrough) ? "Both" : (pt.viewThrough ? "ViewThrough" : "ClickThrough");
        const tagId = pt.dynamicTag && pt.dynamicTag.id || "";
        const code  = pt.dynamicTag && pt.dynamicTag.tag || "";
        rows.push([fa.id, fa.name||"", tagId, siteName, siteId, code, cType]);
      });
    });
    if (rows.length) { sh.getRange(row,1,rows.length,header.length).setValues(rows); row+=rows.length; }
    pageToken = resp.nextPageToken;
  } while (pageToken);

  colorizeTab_(sh, COLOR_DCM);
  autoFormat_(sh);
  SpreadsheetApp.getUi().alert(`Loaded Publisher Tags → "${DCM_PUBLISHER_TAGS}".`);
}


// Put this near the top of a shared file ONCE:
function assertCampaignManagerApi_() {
  if (!(this.Dfareporting || this.DoubleClickCampaigns)) {
    throw new Error('Enable "DCM/DFA Reporting and Trafficking API" under Services, and the CM360 API in Cloud Console.');
  }
}
function cm360_() {  // unified alias
  assertCampaignManagerApi_();
  return this.Dfareporting || this.DoubleClickCampaigns;
}






/** 30-day Activity report: create/run, download CSV, write raw */
/** 30-day Activity report: create/run, download CSV, write raw */
function fetchFloodlightActivityLast30() {
  const [profileId, advertiserId] = getRunIds_();
  const DCM = cm360_();

  const flConfId = findFloodlightConfigurationId_(profileId, advertiserId);
  if (!flConfId) throw new Error("Could not find Floodlight Configuration ID (create at least one Floodlight first).");

  const reportId = getOrCreateFloodlightReport_(profileId, advertiserId, flConfId);
  // Start the report run (async)
  const file = DCM.Reports.run(profileId, reportId, { synchronous: false });
  // Poll until ready
  pollReportFileReady_(reportId, file.id);

  // Download CSV
  const csv = DCM.Files.getMedia(reportId, file.id).getBlob().getDataAsString();
  const rows = Utilities.parseCsv(csv);
  writeActivityRaw_(rows);

  SpreadsheetApp.getUi().alert(`Fetched 30-day activity → "${DCM_ACTIVITY_RAW}".`);
}

function writeActivityRaw_(rows){
  const sh = getSheet_(DCM_ACTIVITY_RAW);
  sh.clear();
  if (!rows || !rows.length) {
    sh.getRange(1,1).setValue("No data");
    colorizeTab_(sh, COLOR_ACTIVITY);
    return;
  }
  sh.getRange(1,1,rows.length, rows[0].length).setValues(rows);
  colorizeTab_(sh, COLOR_ACTIVITY);
  autoFormat_(sh);
}

/** Build summary + annotate Floodlights (unchanged if you already have it) */
// Keep your existing buildActivitySummaryAndAnnotate() here

function findFloodlightConfigurationId_(profileId, advertiserId) {
  const DCM = cm360_();
  let pageToken, found=null;
  do {
    const resp = DCM.FloodlightActivities.list(profileId, { advertiserId, maxResults: 50, pageToken });
    (resp.floodlightActivities || []).some(fa => {
      if (fa.floodlightConfigurationId) { found = fa.floodlightConfigurationId; return true; }
      return false;
    });
    pageToken = resp.nextPageToken;
  } while (!found && pageToken);
  return found;
}

function getOrCreateFloodlightReport_(profileId, advertiserId, flConfId) {
  const DCM = cm360_();
  const props = PropertiesService.getScriptProperties();
  const key = `${SCRIPT_PROP_NS}.${SP_KEY_REPORT_ID}`;
  const existing = props.getProperty(key);
  if (existing) return existing;

  const body = {
    name: "Floodlight – 30d Activity (Auto)",
    type: "FLOODLIGHT",
    format: "CSV",
    floodlightCriteria: {
      floodlightConfigId: flConfId,
      dateRange: { relativeDateRange: "LAST_30_DAYS" },
      dimensions: [
        { name: "dfa:date" },
        { name: "dfa:floodlightActivityId" },
        { name: "dfa:floodlightActivity" }
      ],
      metricNames: ["dfa:floodlightImpressions","dfa:floodlightClicks"],
      dimensionFilters: [{ dimensionName: "dfa:advertiser", value: String(advertiserId) }]
    },
    schedule: { active: false }
  };
  const report = DCM.Reports.insert(body, profileId);
  props.setProperty(key, report.id);
  return report.id;
}

function pollReportFileReady_(reportId, fileId) {
  const DCM = cm360_();
  const maxWaitMs = 5*60*1000;
  let sleep=1000, start=Date.now();
  while (true) {
    const f = DCM.Files.get(reportId, fileId);
    if (f.status === "REPORT_AVAILABLE") return f;
    if (f.status === "FAILED") throw new Error("CM360 report failed to generate.");
    if (Date.now() - start > maxWaitMs) throw new Error("Timed out waiting for CM360 report.");
    Utilities.sleep(sleep);
    sleep = Math.min(sleep*1.5, 8000);
  }
}





function writeActivityRaw_(rows){
  const sh = getSheet_(DCM_ACTIVITY_RAW);
  sh.clear();
  if (!rows || !rows.length) {
    sh.getRange(1,1).setValue("No data");
    colorizeTab_(sh, COLOR_ACTIVITY);
    return;
  }
  sh.getRange(1,1,rows.length, rows[0].length).setValues(rows);
  colorizeTab_(sh, COLOR_ACTIVITY);
  autoFormat_(sh);
}

/** Build summary + annotate Floodlights */
function buildActivitySummaryAndAnnotate() {
  const raw = getSheet_(DCM_ACTIVITY_RAW);
  if (raw.getLastRow() < 2) throw new Error(`"${DCM_ACTIVITY_RAW}" is empty. Fetch it first.`);
  const data = raw.getDataRange().getValues();
  const header = data[0].map(x=>String(x).trim());
  const idx = {
    id: header.indexOf("Floodlight Activity ID"),
    name: header.indexOf("Floodlight Activity"),
    date: header.indexOf("Date"),
    imps: header.indexOf("Floodlight Impressions"),
    clicks: header.indexOf("Floodlight Clicks")
  };
  if (idx.id<0 || idx.date<0 || idx.imps<0 || idx.clicks<0) {
    throw new Error("Unexpected headers in CM360 CSV; need Date, Floodlight Activity, Floodlight Activity ID, Impressions, Clicks.");
  }

  // Aggregate per activity
  const agg = new Map(); // id -> {name, imps, clicks, lastDate}
  for (let r=1;r<data.length;r++) {
    const row = data[r];
    if (!row || String(row[idx.id]).toLowerCase().includes("total")) continue;
    const id = String(row[idx.id]||"").trim();
    const nm = (idx.name>=0 ? String(row[idx.name]||"").trim() : "");
    const date = String(row[idx.date]||"").trim();
    const imps = Number(row[idx.imps]||0);
    const clicks = Number(row[idx.clicks]||0);
    if (!id) continue;
    if (!agg.has(id)) agg.set(id, { name: nm, imps:0, clicks:0, lastDate:null });
    const a = agg.get(id);
    a.imps += imps;
    a.clicks += clicks;
    if (date && (!a.lastDate || date > a.lastDate)) a.lastDate = date;
  }

  // Write summary tab
  const sumSh = getSheet_(DCM_ACTIVITY_SUM);
  sumSh.clear();
  const sumHeader = ["Activity ID","Activity Name","Total Imps (30d)","Total Clicks (30d)","Days Since Last Activity"];
  const today = new Date();
  const rows = [];
  agg.forEach((v,id)=>{
    const days = v.lastDate ? Math.floor((today - new Date(v.lastDate)) / (1000*60*60*24)) : "";
    rows.push([id, v.name||"", v.imps, v.clicks, days]);
  });
  rows.sort((a,b)=>String(a[1]).localeCompare(String(b[1])));
  sumSh.getRange(1,1,1,sumHeader.length).setValues([sumHeader]).setFontWeight("bold").setBackground("#f1f3f4");
  if (rows.length) sumSh.getRange(2,1,rows.length,sumHeader.length).setValues(rows);
  colorizeTab_(sumSh, COLOR_ACTIVITY);
  autoFormat_(sumSh);

  // Annotate Floodlights sheet (write values, not formulas)
  const fl = getSheet_(DCM_FLOODLIGHTS);
  if (fl.getLastRow() >= 2) {
    const flData = fl.getRange(1,1,fl.getLastRow(), fl.getLastColumn()).getValues();
    const h = flData[0].map(x=>String(x).trim());
    const colMap = Object.fromEntries(h.map((name,i)=>[name,i]));
    const out = [];
    for (let r=1;r<flData.length;r++) {
      const row = flData[r];
      const id  = String(row[colMap["ID"]]||"");
      const a = agg.get(id);
      if (a) {
        row[colMap["Last Active Date"]] = a.lastDate || "";
        row[colMap["Total Imps (30d)"]] = a.imps || 0;
        row[colMap["Total Clicks (30d)"]] = a.clicks || 0;
        row[colMap["Days Since Last Activity"]] = a.lastDate ? Math.floor((today - new Date(a.lastDate)) / (1000*60*60*24)) : "";
        // Notes: simple flags
        const notesIdx = colMap["Notes"];
        let notes = row[notesIdx] || "";
        if (!a.lastDate) notes = addNote_(notes, "No activity in 30d");
        out.push(row);
      } else {
        out.push(row);
      }
    }
    fl.getRange(1,1,out.length+1, fl.getLastColumn()).setValues([flData[0]].concat(out));
  }
  SpreadsheetApp.getUi().alert(`Summary built & Floodlights annotated.`);
}
function addNote_(orig, add){ return String([orig, add].filter(Boolean).join(" | ")); }

function findFloodlightConfigurationId_(profileId, advertiserId) {
  let pageToken, found=null;
  do {
    const resp = Dfareporting.FloodlightActivities.list(profileId, { advertiserId, maxResults: 50, pageToken });
    (resp.floodlightActivities || []).some(fa => {
      if (fa.floodlightConfigurationId) { found = fa.floodlightConfigurationId; return true; }
      return false;
    });
    pageToken = resp.nextPageToken;
  } while (!found && pageToken);
  return found;
}
function getOrCreateFloodlightReport_(profileId, advertiserId, flConfId) {
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty(`${SCRIPT_PROP_NS}.${SP_KEY_REPORT_ID}`);
  if (existing) return existing;

  const body = {
    name: "Floodlight – 30d Activity (Auto)",
    type: "FLOODLIGHT",
    format: "CSV",
    floodlightCriteria: {
      floodlightConfigId: flConfId,
      dateRange: { relativeDateRange: "LAST_30_DAYS" },
      dimensions: [
        { name: "dfa:date" },
        { name: "dfa:floodlightActivityId" },
        { name: "dfa:floodlightActivity" }
      ],
      metricNames: ["dfa:floodlightImpressions","dfa:floodlightClicks"],
      dimensionFilters: [{ dimensionName: "dfa:advertiser", value: String(advertiserId) }]
    },
    schedule: { active: false }
  };
  const report = Dfareporting.Reports.insert(body, profileId);
  props.setProperty(`${SCRIPT_PROP_NS}.${SP_KEY_REPORT_ID}`, report.id);
  return report.id;
}
function pollReportFileReady_(reportId, fileId) {
  const maxWaitMs = 5*60*1000;
  let sleep=1000, start=Date.now();
  while (true) {
    const f = Dfareporting.Files.get(reportId, fileId);
    if (f.status === "REPORT_AVAILABLE") return f;
    if (f.status === "FAILED") throw new Error("CM360 report failed to generate.");
    if (Date.now() - start > maxWaitMs) throw new Error("Timed out waiting for CM360 report.");
    Utilities.sleep(sleep);
    sleep = Math.min(sleep*1.5, 8000);
  }
}

/** =========================
 *  Compare – src/type/cat
 * ========================= */
function runCompare() {
  const dcm = readDcmFloodlights_(); // {rows: [...]}
  const gtm = readGtmFloodlightLike_(); // from GTM – Tags params

  const key = (src,type,cat)=>`${src}|||${type}|||${cat}`;

  // Index DCM
  const dcmByKey = new Map();
  dcm.rows.forEach(r=>{
    if (!r.src || !r.type || !r.cat) return;
    const k = key(r.src, r.type, r.cat);
    const arr = dcmByKey.get(k) || [];
    arr.push(r);
    dcmByKey.set(k, arr);
  });

  // Index GTM
  const gtmByKey = new Map();
  gtm.rows.forEach(t=>{
    const k = key(t.src, t.type, t.cat);
    const arr = gtmByKey.get(k) || [];
    arr.push(t);
    gtmByKey.set(k, arr);
  });

  const matches = [];
  const onlyDcm = [];
  const onlyGtm = [];

  // Walk DCM → matches or only in DCM
  for (const [k, dRows] of dcmByKey.entries()) {
    const gRows = gtmByKey.get(k) || [];
    if (gRows.length) {
      dRows.forEach(d=>{
        gRows.forEach(g=>{
          const nameMismatch = (d.name||"") === (g.name||"") ? "" : "Name mismatch";
          const dupNote = gRows.length > 1 ? `GTM duplicates=${gRows.length}` : "";
          const notes = [
            d.hasDefault ? "Has Default Tags" : "",
            d.hasPublisher ? "Has Publisher Tags" : "",
            g.anomalies || "",
            nameMismatch,
            dupNote
          ].filter(Boolean).join(" | ");

          matches.push([
            d.src, d.type, d.cat,
            d.name, g.name,
            d.active, (g.active ? "Active" : "Inactive"),
            notes
          ]);
        });
      });
    } else {
      dRows.forEach(d=>{
        onlyDcm.push([
          d.src, d.type, d.cat,
          d.name, d.active, d.url,
          (d.hasDefault ? "Has Default Tags" : ""),
          (d.hasPublisher ? "Has Publisher Tags" : "")
        ]);
      });
    }
  }

  // Walk GTM → only in GTM
  for (const [k, gRows] of gtmByKey.entries()) {
    if (!dcmByKey.has(k)) {
      gRows.forEach(g=>{
        onlyGtm.push([
          g.src, g.type, g.cat,
          g.name, g.active ? "Active" : "Inactive",
          g.typeLabel || "", g.anomalies || ""
        ]);
      });
    }
  }

  // Write Compare tabs
  writeCompareSheet_(COMP_MATCHES,
    ["src","type","cat","DCM Name","GTM Name","DCM Active","GTM Active","Notes"],
    matches, COLOR_COMPARE);

  writeCompareSheet_(COMP_ONLY_DCM,
    ["src","type","cat","DCM Name","DCM Active","Expected URL","Default Tags?","Publisher Tags?"],
    onlyDcm, COLOR_COMPARE);

  writeCompareSheet_(COMP_ONLY_GTM,
    ["src","type","cat","GTM Name","GTM Active","GTM Tag Type","GTM Anomalies"],
    onlyGtm, COLOR_COMPARE);

  SpreadsheetApp.getUi().alert("Compare tabs rebuilt.");
}


/** ===== Read DCM – Floodlights → normalized rows for compare ===== */
function readDcmFloodlights_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(DCM_FLOODLIGHTS);
  if (!sh) return { rows: [] };
  const lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (lr < 2 || lc < 1) return { rows: [] };

  const values = sh.getRange(1,1,lr,lc).getValues();
  const header = values[0].map(h => String(h).trim());
  const col = Object.fromEntries(header.map((h,i)=>[h,i]));

  const rows = [];
  for (let r=1; r<values.length; r++) {
    const row = values[r];
    if (!row || row.every(v => v === "")) continue;

    const name = row[col["Name"]] || "";
    const url  = row[col["Expected URL"]] || "";
    // In CM360 sheet we store "Group Tag String (type)" and "Activity Tag String (cat)"
    const type = row[col["Group Tag String (type)"]] || "";
    const cat  = row[col["Activity Tag String (cat)"]] || "";
    const src  = extractQueryParam_(String(url), "src") || ""; // best-effort
    const active = row[col["Active"]] || "";
    const hasDefault   = (row[col["Has Default Tags?"]]   || "").toString().toLowerCase() === "yes";
    const hasPublisher = (row[col["Has Publisher Tags?"]] || "").toString().toLowerCase() === "yes";

    rows.push({ name, url, type, cat, src, active, hasDefault, hasPublisher });
  }
  return { rows };
}

/** ===== Read GTM – Tags → floodlight-like rows for compare ===== */
function readGtmFloodlightLike_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(GTM_TAGS);
  if (!sh) return { rows: [] };
  const lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (lr < 2 || lc < 1) return { rows: [] };

  const values = sh.getRange(1,1,lr,lc).getValues();
  const header = values[0].map(h => String(h).trim());
  const col = Object.fromEntries(header.map((h,i)=>[h,i]));

  const rows = [];
  for (let r=1; r<values.length; r++) {
    const row = values[r];
    if (!row || row.every(v => v === "")) continue;

    const name       = row[col["Name"]] || "";
    const typeLabel  = row[col["Type"]] || "";
    const paramsJson = row[col["Parameters (flattened JSON)"]] || "{}";
    const firing     = row[col["Firing Triggers"]] || "";
    const viol       = row[col["Violations"]] || "";

    let params = {};
    try { params = JSON.parse(paramsJson); } catch(e) {}

    const src  = String(params.src || params.u0 || params.advertiserId || "");
    const type = String(params.type || params.groupTagString || params.fl_type || "");
    const cat  = String(params.cat || params.activityTagString || params.fl_cat || "");
    const active = String(firing || "").trim() !== "";

    // keep best-effort rows even if any piece is missing; annotate in anomalies
    const missingBits = [];
    if (!src)  missingBits.push("src missing");
    if (!type) missingBits.push("type missing");
    if (!cat)  missingBits.push("cat missing");
    const anomalies = [viol, missingBits.join(", ")].filter(Boolean).join(" | ");

    rows.push({ name, typeLabel, active, src, type, cat, anomalies });
  }
  return { rows };
}

/** ===== Compare helpers ===== */
function writeCompareSheet_(name, header, rows, color) {
  const sh = getSheet_(name);
  sh.clear();
  sh.getRange(1,1,1,header.length)
    .setValues([header])
    .setFontWeight("bold")
    .setBackground("#f1f3f4");
  if (rows && rows.length) {
    sh.getRange(2,1,rows.length,header.length).setValues(rows);
  }
  colorizeTab_(sh, color);
  autoFormat_(sh);
}

/** ===== Small utility helpers used above ===== */
function extractQueryParam_(url, key) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.searchParams.get(key) || "";
  } catch(e) {
    const qi = url.indexOf("?");
    if (qi < 0) return "";
    const q = url.slice(qi+1).split("&");
    for (const p of q) {
      const [k,v] = p.split("=");
      if (decodeURIComponent((k||"").trim()) === key) {
        return decodeURIComponent((v||"").trim());
      }
    }
    return "";
  }
}
function colorizeTab_(sheet, color) {
  try { sheet.setTabColor(color); } catch(e) {}
}
function autoFormat_(sheet) {
  const lr = sheet.getLastRow(), lc = sheet.getLastColumn();
  if (lr && lc) {
    sheet.getRange(1,1,1,lc).setFontWeight("bold").setBackground("#f1f3f4");
    try {
      if (!sheet.getFilter() && lr > 1 && lc > 0) sheet.getRange(1,1,lr,lc).createFilter();
    } catch(e) {}
    sheet.autoResizeColumns(1, Math.min(lc, 50));
  }
}

