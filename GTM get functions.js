function assertTagManagerApi_() {
  if (!this.TagManager ||
      !TagManager.Accounts ||
      !TagManager.Containers ||
      !TagManager.Workspaces ||
      !TagManager.Tags) {
    toast_(
      'Tag Manager Advanced Service is not enabled for this script.\n' +
      'Apps Script → Services (+) → add “Tag Manager”.',
      'GTM', 8
    );
    throw new Error('Tag Manager Advanced Service not available.');
  }
}


// Use the global if it exists; otherwise default.
var CREATE_FLOODLIGHT_SHEET = this.CREATE_FLOODLIGHT_SHEET || 'Create Floodlights';



/** Hidden sheet name for GTM mapping */
const GTM_MAP_SHEET = '_GTM Containers (Mapping)';

/** Ensures mapping sheet exists (hidden) and cleared. Returns the sheet handle. */
function ensureGtmMapSheet_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(GTM_MAP_SHEET) || ss.insertSheet(GTM_MAP_SHEET);
  sh.clear();
  sh.getRange(1,1,1,2).setValues([['Label','Path']]).setFontWeight('bold');
  // Keep it out of the way
  if (!sh.isSheetHidden()) sh.hideSheet();
  return sh;
}

/** Fetch all GTM containers user can edit, and wire dropdowns into Create Floodlights (L/M). */
function refreshGtmContainersDropdown_() {
  assertTagManagerApi_();

  // Hidden mapping sheet
  const mapSheet = ensureGtmMapSheet_();
  const out = [['Label','Path']];

  // List GTM accounts
  var accResp, accounts;
  try {
    accResp = TagManager.Accounts.list();
    // Some script builds expose `accounts[]`, others `account[]`
    accounts = (accResp && (accResp.accounts || accResp.account)) || [];
  } catch (e) {
    toast_('Unable to list GTM accounts: ' + e, 'GTM', 8);
    return;
  }

  // For each account, list containers
  for (var a = 0; a < accounts.length; a++) {
    var acc = accounts[a];
    // Prefer acc.path if present; otherwise build from accountId
    var accountPath = acc.path || ('accounts/' + acc.accountId);

    var contResp, containers;
    try {
      contResp = TagManager.Containers.list(accountPath);
      // API returns `container[]`
      containers = (contResp && contResp.container) || [];
    } catch (e) {
      // Skip this account if containers listing fails
      console.warn('Containers.list failed for ' + accountPath + ': ' + e);
      continue;
    }

    for (var c = 0; c < containers.length; c++) {
      var ct = containers[c];
      var label = (ct.name || 'Container') + ' — ' + (ct.containerId || '');
      // Path looks like "accounts/{a}/containers/{c}"
      var path  = ct.path || ('accounts/' + acc.accountId + '/containers/' + ct.containerId);
      out.push([label, path]);
    }
  }

  // Write mapping
  mapSheet.clear();
  mapSheet.getRange(1,1,1,2).setValues([['Label','Path']]).setFontWeight('bold');
  if (out.length > 1) {
    mapSheet.getRange(2,1,out.length-1,2).setValues(out.slice(1));
  }
  if (!mapSheet.isSheetHidden()) mapSheet.hideSheet();

  // Bind validation to Create Floodlights!L
  const ss = SpreadsheetApp.getActive();
  const cf = ss.getSheetByName(CREATE_FLOODLIGHT_SHEET) || ss.insertSheet(CREATE_FLOODLIGHT_SHEET);

  const lastMapRow = mapSheet.getLastRow();
  const labelRange = (lastMapRow >= 2)
    ? mapSheet.getRange(2,1,lastMapRow-1,1)
    : mapSheet.getRange(2,1,1,1); // empty-safe

  const dv = SpreadsheetApp.newDataValidation()
    .requireValueInRange(labelRange, true)
    .setAllowInvalid(false)
    .build();

  cf.getRange('L2:L').setDataValidation(dv).setNumberFormat('@');
  cf.getRange('M2:M').setNumberFormat('@');

  toast_('GTM container list refreshed.', 'GTM', 4);
}



/** Find or create a workspace named "CM360 Push" in the given GTM container. Returns workspace.path */
function findOrCreateGtmWorkspace_(containerPath) {
  const wsList = TagManager.Workspaces.list(containerPath);
  const items = (wsList && wsList.workspace) || [];
  for (var i = 0; i < items.length; i++) {
    if ((items[i].name || '').toLowerCase() === 'cm360 push') return items[i].path;
  }
  // Create it
  const created = TagManager.Workspaces.create(
    { name: 'CM360 Push', description: 'Unpublished CM360 Floodlight imports' },
    containerPath
  );
  return created.path;
}

/** Map CM360 counting method -> GTM Floodlight tag countingMethod value */
function mapCountingMethodToGtm_(cm) {
  // CM360: ITEMS_SOLD_COUNTING, SESSION_COUNTING, STANDARD_COUNTING, TRANSACTIONS_COUNTING, UNIQUE_COUNTING
  // GTM expects: itemsSold, perSession, standard, transactions, unique
  const m = String(cm || '').toUpperCase();
  if (m.indexOf('ITEMS_SOLD') >= 0) return 'itemsSold';
  if (m.indexOf('SESSION') >= 0)     return 'perSession';
  if (m.indexOf('TRANSACTION') >= 0) return 'transactions';
  if (m.indexOf('UNIQUE') >= 0)      return 'unique';
  return 'standard';
}

/** Build a GTM Floodlight tag object (unpublished) from a Create Floodlights row. */
function buildGtmFloodlightTagObject_(row) {
  // Row schema: A Advertiser ID, B Name, C Expected URL, D Tag Type, E Group ID,
  // F Counting Method, G Activity Tag String, H Hidden, I Tag Format, J U-vars, K CM360 ID, L container label, M container path
  const advertiserId = String(row[0] || '');
  const name         = String(row[1] || '');
  const tagType      = String(row[3] || '').toUpperCase();
  const groupId      = String(row[4] || '');
  const counting     = mapCountingMethodToGtm_(row[5]);
  const activityTag  = String(row[6] || '');   // "type" in Floodlight terms

  // Resolve group "cat" (tag string) from CM360
  var groupTag = '';
  try {
    const [profileId] = _fetchProfileId();
    const grp = (DCM || this.Dfareporting || this.DoubleClickCampaigns)
      .FloodlightActivityGroups.get(profileId, groupId);
    groupTag = (grp && grp.tagString) ? String(grp.tagString) : '';
  } catch (e) {}

  // Determine GTM tag type id
  const gtmType = (tagType === 'SALE') ? 'dcFloodlightSales' : 'dcFloodlightCounter';

  // Minimal parameters to land in the workspace (approval queue)
  // Keys below are the GTM parameter keys for Floodlight tags.
  const params = [
    { key: 'advertiserId',     type: 'template', value: advertiserId },
    { key: 'activityGroupTag', type: 'template', value: groupTag     }, // "cat"
    { key: 'activityTag',      type: 'template', value: activityTag  }, // "type"
    { key: 'countingMethod',   type: 'template', value: counting     }
  ];

  // Optional: tag name in GTM
  const gtmName = '[CM360] ' + name;

  return {
    name: gtmName,
    type: gtmType,
    parameter: params
    // No triggers, no publish — per your requirement
  };
}

/** Push rows with CM360 ID (K) and Container selected (L) to GTM (workspace "CM360 Push"). */
function pushFloodlightsToGtm() {
  // Sheet
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CREATE_FLOODLIGHT_SHEET);
  if (!sh) {
    toast_('Create Floodlights sheet not found.', 'GTM', 6);
    return;
  }

  // Read all used rows
  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    toast_('No rows to push.', 'GTM', 4);
    return;
  }
  const data = sh.getRange(2, 1, lastRow - 1, Math.max(13, sh.getLastColumn())).getValues(); // up to M

  // Build a quick map from label -> path from the hidden mapping sheet
  const mapSh = ss.getSheetByName(GTM_MAP_SHEET);
  const map = Object.create(null);
  if (mapSh) {
    const mLast = mapSh.getLastRow();
    if (mLast >= 2) {
      const pairs = mapSh.getRange(2,1,mLast-1,2).getValues();
      for (var i = 0; i < pairs.length; i++) {
        map[String(pairs[i][0] || '').trim()] = String(pairs[i][1] || '').trim();
      }
    }
  }

  var pushed = 0, skipped = 0, errors = 0;

  for (var r = 0; r < data.length; r++) {
    const row = data[r];

    const cm360Id      = String(row[10] || ''); // K
    const containerLbl = String(row[11] || ''); // L
    var   containerPath= String(row[12] || ''); // M (may be blank; we’ll fill it)

    if (!cm360Id) { skipped++; continue; }         // not generated yet
    if (!containerLbl) { skipped++; continue; }    // no container selected

    if (!containerPath) {
      containerPath = map[containerLbl] || '';
      // Write back the path into column M for this row
      sh.getRange(r + 2, 13).setValue(containerPath).setNumberFormat('@'); // M
      SpreadsheetApp.flush();
    }

    if (!containerPath) { skipped++; continue; }

    try {
      const wsPath = findOrCreateGtmWorkspace_(containerPath);
      const tagObj = buildGtmFloodlightTagObject_(row);
      TagManager.Tags.create(tagObj, wsPath);   // create the tag (unpublished)
      pushed++;
    } catch (e) {
      errors++;
      console.warn('GTM push error on row ' + (r+2) + ': ' + e);
    }
  }

  toast_('GTM push complete — pushed: ' + pushed + ', skipped: ' + skipped + ', errors: ' + errors, 'GTM', 7);
}