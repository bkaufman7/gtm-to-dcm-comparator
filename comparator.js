/*******************************************************
 * DCM Activity (30d) — Setup + Ingest + Health Tab
 * Sheets:
 *   - Source (auto-seeded):  "Compare - DCM Impression"
 *   - Writeback target:      "Get Floodlight Activities" (col L)
 *   - Output (new):          "Compare – DCM Activity Health"
 * Run Details:
 *   - B24: LOW_IMPS_THRESHOLD | C24: 20
 *******************************************************/

const SHEET_GFA = 'Get Floodlight Activities';
const SHEET_IMPRESS_PASTE = 'Compare - DCM Impression';
const SHEET_HEALTH = 'Compare – DCM Activity Health';

/** MENU HOOKS (called by ONOPEN wrappers) **/
function compareSetupActivityPasteTab_() {
  const ss = SpreadsheetApp.getActive();

  const gfa = ss.getSheetByName(SHEET_GFA);
  if (!gfa) throw new Error(`Sheet "${SHEET_GFA}" not found.`);

  const last = gfa.getLastRow();
  if (last < 2) throw new Error(`"${SHEET_GFA}" has no data rows.`);

  // Read GFA: IDs (col A) + Names (col C)
  const ids   = gfa.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0] || '').trim());
  const names = gfa.getRange(2, 3, last - 1, 1).getValues().map(r => r[0] || '');

  // Prepare paste sheet
  const sh = ss.getSheetByName(SHEET_IMPRESS_PASTE) || ss.insertSheet(SHEET_IMPRESS_PASTE);
  sh.clear();

  // Headers (A:B = seeded order from GFA, E:H = user paste area)
  const headers = [
    'Activity ID (from Get Floodlight Activities)',   // A
    'Activity Name (from Get Floodlight Activities)', // B
    '', '',                                           // C-D (spacer)
    'Activity',                                       // E (from DCM report)
    'Activity ID',                                    // F
    'Date',                                           // G
    'Floodlight Impressions'                          // H
  ];
  sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f1f3f4');
  try { sh.setFrozenRows(1); } catch (_) {}

  // Seed A/B in current GFA order
  if (ids.length) {
    const out = ids.map((id, i) => [id, names[i] || '']);
    sh.getRange(2, 1, out.length, 2).setValues(out);
  }

  // Visual hints for paste area
  sh.getRange('E1:H1').setBackground('#e8f0fe');
  sh.getRange('G:G').setNumberFormat('yyyy-mm-dd');
  sh.getRange('H:H').setNumberFormat('0');

  setTabColor_(SHEET_IMPRESS_PASTE, TAB_COLOR_COMPARE);
  SpreadsheetApp.getUi().toast('Paste tab ready. Paste your last-30-day DCM report into E:H.', 'Compare', 6);
}

function compareIngestActivityReport() {
  const ss = SpreadsheetApp.getActive();

  // Threshold from Run Details (B24:C24), default 20
  const threshold = ensureLowImpsThreshold_();

  // Sheets
  const gfa = ss.getSheetByName(SHEET_GFA);
  if (!gfa) throw new Error(`Sheet "${SHEET_GFA}" not found.`);
  const paste = ss.getSheetByName(SHEET_IMPRESS_PASTE);
  if (!paste) throw new Error(`Sheet "${SHEET_IMPRESS_PASTE}" not found. Run setup first.`);

  // GFA data for writeback + names (A = ID, C = Name)
  const gfaLast = gfa.getLastRow();
  if (gfaLast < 2) throw new Error(`"${SHEET_GFA}" has no data rows.`);
  const gfaIds   = gfa.getRange(2, 1, gfaLast - 1, 1).getValues().map(r => String(r[0] || '').trim());
  const gfaNames = gfa.getRange(2, 3, gfaLast - 1, 1).getValues().map(r => r[0] || '');

  // Ensure GFA column L header
  const L_COL = 12;
  const L_HEADER = 'Total DCM Impressions (30d)';
  if (String(gfa.getRange(1, L_COL).getValue()).trim() !== L_HEADER) {
    gfa.getRange(1, L_COL).setValue(L_HEADER).setFontWeight('bold').setBackground('#f1f3f4');
  }

  // Read raw E:H (E=Activity, F=Activity ID, G=Date, H=Imps)
  const pLast = paste.getLastRow();
  const raw = pLast >= 2 ? paste.getRange(2, 5, pLast - 1, 4).getValues() : [];

  // Aggregate by Activity ID
  /** id -> {sum:number, days:Set<string>, first:Date|null, last:Date|null, anyName:string} */
  const agg = new Map();
  for (let i = 0; i < raw.length; i++) {
    const activityName = raw[i][0];
    const id = String(raw[i][1] || '').trim();
    const dtVal = raw[i][2];
    const imps = Number(raw[i][3] || 0);
    if (!id) continue;

    // Normalize date to yyyy-MM-dd if present
    let dateKey = '';
    if (dtVal instanceof Date && !isNaN(dtVal)) {
      dateKey = Utilities.formatDate(dtVal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else if (dtVal) {
      const t = new Date(dtVal);
      if (!isNaN(t)) dateKey = Utilities.formatDate(t, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }

    if (!agg.has(id)) agg.set(id, { sum: 0, days: new Set(), first: null, last: null, anyName: String(activityName || '') });
    const o = agg.get(id);
    o.sum += imps;
    if (dateKey) {
      o.days.add(dateKey);
      const d = new Date(dateKey + 'T00:00:00');
      if (!o.first || d < o.first) o.first = d;
      if (!o.last  || d > o.last ) o.last  = d;
    }
    if (!o.anyName && activityName) o.anyName = String(activityName);
  }

// Write back totals to GFA col L (overwrite only that column)
// Use a fresh inner array per row to avoid shared-reference bug
const Lvals = gfaIds.map(() => [0]);  // <-- FIXED
for (let r = 0; r < gfaIds.length; r++) {
  const id = gfaIds[r];
  Lvals[r][0] = agg.has(id) ? (agg.get(id).sum || 0) : 0;
}
gfa.getRange(2, L_COL, Lvals.length, 1).setValues(Lvals);


  // Conditional formatting: zeroes in red
  applyZeroRedFormatting_(gfa, L_COL);

  // Build Health tab (includes Unknown FLs present in paste but not in GFA)
  buildActivityHealthTab_(gfaIds, gfaNames, agg, threshold);

  SpreadsheetApp.getUi().toast('Ingest complete: GFA column L updated and Activity Health built.', 'Compare', 6);
}

/** ========== Local helpers (scoped to Activity flow) ========== **/

function ensureLowImpsThreshold_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(RUN_DETAILS_SHEET) || ss.insertSheet(RUN_DETAILS_SHEET);

  // B24: key, C24: value
  const startRow = 24;
  const keyCell = sh.getRange(startRow, 2);
  const valCell = sh.getRange(startRow, 3);

  if (!keyCell.getValue()) keyCell.setValue('LOW_IMPS_THRESHOLD');
  if (valCell.getValue() === '' || valCell.getValue() == null) valCell.setValue('20');

  sh.getRange(startRow, 2, 1, 2).setFontWeight('bold').setBackground('#fffbe6');

  const n = Number(valCell.getValue());
  return isNaN(n) ? 20 : n;
}

function applyZeroRedFormatting_(sh, col) {
  const lr = Math.max(2, sh.getLastRow());
  const range = sh.getRange(2, col, lr - 1, 1);

  // Keep other rules; replace any rule that targets this exact column range
  const keep = sh.getConditionalFormatRules().filter(r => {
    const rgns = r.getRanges();
    return !rgns.some(rg => rg.getColumn() === col && rg.getNumColumns() === 1);
  });

  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberEqualTo(0)
    .setBackground('#fce8e6') // light red
    .setFontColor('#b00020')  // dark red
    .setRanges([range])
    .build();

  keep.push(rule);
  sh.setConditionalFormatRules(keep);
}

function buildActivityHealthTab_(gfaIds, gfaNames, agg, threshold) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_HEALTH) || ss.insertSheet(SHEET_HEALTH);
  sh.clear();

  const header = [
    'FL ID','FL Name','30d Imps','Days Seen','First Date','Last Date','Avg/Day (30d)','Status','Notes'
  ];
  sh.getRange(1,1,1,header.length).setValues([header]).setFontWeight('bold').setBackground('#f1f3f4');
  try { sh.setFrozenRows(1); } catch (_) {}

  const rows = [];

  // Known FLs (current GFA order)
  for (let i = 0; i < gfaIds.length; i++) {
    const id = gfaIds[i];
    const name = gfaNames[i] || '';
    const o = agg.get(id);
    const sum = o ? o.sum : 0;
    const daysSeen = o ? o.days.size : 0;
    const firstDate = o && o.first ? Utilities.formatDate(o.first, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
    const lastDate  = o && o.last  ? Utilities.formatDate(o.last , Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
    const avgPerDay30 = Math.round((sum / 30) * 100) / 100;

    let status = 'OK';
    let notes = '';
    if (sum === 0) {
      status = 'No Activity';
      notes = 'No impressions in last 30 days';
    } else if (sum < threshold) {
      status = 'Low impressions — check if still needed';
      notes = `Below threshold (${threshold})`;
    }
    rows.push([id, name, sum, daysSeen, firstDate, lastDate, avgPerDay30, status, notes]);
  }

  // Unknown FLs (present in paste, not in GFA)
  agg.forEach((o, id) => {
    if (!gfaIds.includes(id)) {
      const sum = o.sum;
      const daysSeen = o.days.size;
      const firstDate = o.first ? Utilities.formatDate(o.first, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
      const lastDate  = o.last  ? Utilities.formatDate(o.last , Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
      const avgPerDay30 = Math.round((sum / 30) * 100) / 100;

      rows.push([id, o.anyName || '', sum, daysSeen, firstDate, lastDate, avgPerDay30, 'Unknown FL', 'Not in Get Floodlight Activities']);
    }
  });

  if (rows.length) sh.getRange(2,1,rows.length,header.length).setValues(rows);

  // Conditional formatting on Status
  const statusCol = 8; // H
  const lr = Math.max(2, sh.getLastRow());
  const rng = sh.getRange(2, statusCol, lr - 1, 1);
  const rules = [];

  // No Activity -> red
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('No Activity')
      .setBackground('#fce8e6').setFontColor('#b00020')
      .setRanges([rng]).build()
  );
  // Low impressions -> yellow/amber
  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('Low impressions — check if still needed')
      .setBackground('#fff4ce').setFontColor('#8a6d00')
      .setRanges([rng]).build()
  );
  // OK -> no fill (no rule)

  sh.setConditionalFormatRules(rules);
  setTabColor_(SHEET_HEALTH, TAB_COLOR_COMPARE);
}
