# GTM 2PageView Event Pattern for Single Page Applications

A reusable Google Tag Manager implementation pattern to fire event tags on the second pageview in Single Page Applications (SPAs), with flexible options for consent, persistence, and environment control.

---

## Table of Contents

- [Overview](#overview)
- [Quick Start (Recommended Default)](#quick-start-recommended-default)
- [Placeholders You Must Replace](#placeholders-you-must-replace)
- [Core Build Steps (Required)](#core-build-steps-required)
  - [Step 1: Create Counter Increment Tag (Custom HTML)](#step-1-create-counter-increment-tag-custom-html)
  - [Step 2: Create Counter Read Variable (Custom JS)](#step-2-create-counter-read-variable-custom-js)
  - [Step 3: Create 2PageView Trigger (Custom Event)](#step-3-create-2pageview-trigger-custom-event)
  - [Step 4: Attach Your Event Tags (Generic)](#step-4-attach-your-event-tags-generic)
- [2PageView Definition Options](#2pageview-definition-options)
  - [Option A: 2nd Route Change After Initial Load](#option-a-2nd-route-change-after-initial-load)
  - [Option B: 2nd Pageview Including Initial Load](#option-b-2nd-pageview-including-initial-load)
- [Consent Strategy Options](#consent-strategy-options)
  - [Option A: Always Count, Gate Tags by Consent](#option-a-always-count-gate-tags-by-consent)
  - [Option B: Count Only After Consent](#option-b-count-only-after-consent)
- [Persistence Options](#persistence-options)
  - [Option A: Once Per Session (sessionStorage)](#option-a-once-per-session-sessionstorage)
  - [Option B: Once Per Day (localStorage)](#option-b-once-per-day-localstorage)
  - [Option C: Once Per User (flag)](#option-c-once-per-user-flag)
- [Environment Guard (Hostname Blocking)](#environment-guard-hostname-blocking)
- [Testing & Validation](#testing--validation)
- [Troubleshooting & Pitfalls](#troubleshooting--pitfalls)
- [Implementation Checklist](#implementation-checklist)

---

## Overview

In Single Page Applications, the initial page load is often distinct from subsequent route changes. Many marketing tags should fire only after a user has engaged with the site by navigating to a second page (route).

This pattern implements a pageview counter that increments on every SPA navigation event and fires a custom `INSERT.EVENT.NAME` event exactly once when the counter reaches 2. Event tags (analytics, conversion pixels, etc.) are then configured to fire on this custom event trigger.

**Benefits:**
- Reduces wasted tag fires on bounce visits
- Ensures conversion/engagement tags fire only for engaged users
- Fully customizable for consent, persistence, and environment rules
- No external dependencies; pure GTM + native browser storage

---

## Quick Start (Recommended Default)

**Default Configuration:**
- **Definition:** 2nd route change AFTER initial load (does not count the initial pageview)
- **Consent:** Always count; gate event tags by consent
- **Persistence:** Once per session (sessionStorage)
- **Environment:** Fire on all hostnames (add blocking later if needed)

Follow the [Core Build Steps](#core-build-steps-required) below using the baseline code samples. After basic implementation, customize using the options sections as needed.

---

## Placeholders You Must Replace

Throughout this document, the following placeholders appear in code samples. Replace them with your actual values:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `INSERT.SPA.EVENT.CHANGE` | The GTM event name for SPA route changes | `historyChange`, `historyChange-v2`, `gtm.historyChange-v2` |
| `INSERT.COUNTER.KEY` | Storage key for the pageview counter | `spa_pv_count`, `pv_counter` |
| `INSERT.EVENT.NAME` | Custom event name pushed to dataLayer when count==2 | `2PageView`, `secondPageview`, `engagedUser` |
| `INSERT.CONSENT.VAR` | GTM variable holding consent status (true/false or specific state) | `{{CMP - Consent Granted}}`, `{{DLV - consent_status}}` |
| `INSERT.ALLOWLIST.RULES` | Hostname/domain pattern for environment blocking | `/(www\\.)?example\\.com$/`, `example.com` |

**Action:** Use Find & Replace in your GTM workspace or text editor to swap placeholders with real values before publishing.

---

## Core Build Steps (Required)

### Step 1: Create Counter Increment Tag (Custom HTML)

**Goal:** Increment a counter in sessionStorage every time an SPA route change occurs.

**Where in GTM:** Tags → New → Custom HTML

**Instructions:**
1. In GTM, click **Tags** → **New**
2. Name: `Tag - SPA Counter Increment`
3. Tag Configuration: **Custom HTML**
4. Paste the code below
5. Triggering: **All Pages** + `INSERT.SPA.EVENT.CHANGE` (add both triggers)
6. Save

**Code:**

```html
<script>
  var KEY = 'INSERT.COUNTER.KEY';
  var pv = sessionStorage.getItem(KEY);
  if (!pv) { 
    sessionStorage.setItem(KEY, '1'); 
  } else { 
    sessionStorage.setItem(KEY, String(parseInt(pv, 10) + 1)); 
  }
</script>
```

**Explanation:**
This tag fires on the initial page load (All Pages) and every subsequent SPA route change. It reads the current count from sessionStorage, increments it, and writes it back. If no value exists, it initializes to 1.

**What to verify:**
- Tag fires on **All Pages** (initial load)
- Tag fires on **INSERT.SPA.EVENT.CHANGE** (route changes)
- No other triggers attached (unless using consent gating—see options below)

---

### Step 2: Create Counter Read Variable (Custom JS)

**Goal:** Create a GTM variable that returns the current counter value as an integer.

**Where in GTM:** Variables → New → Custom JavaScript

**Instructions:**
1. In GTM, click **Variables** → **New**
2. Name: `JS - SPA Counter Value`
3. Variable Configuration: **Custom JavaScript**
4. Paste the code below
5. Save

**Code:**

```js
function() {
  return parseInt(sessionStorage.getItem('INSERT.COUNTER.KEY') || '0', 10);
}
```

**Explanation:**
This variable reads the counter from sessionStorage and parses it as an integer. Returns 0 if the key doesn't exist. Use this variable in trigger conditions.

**What to verify:**
- Variable type is **Custom JavaScript**
- Variable returns a number (not a string)
- Variable name is easy to identify (prefix with `JS -` for clarity)

---

### Step 3: Create 2PageView Trigger (Custom Event)

**Goal:** Fire a trigger when the custom event `INSERT.EVENT.NAME` is pushed to the dataLayer and the counter equals 2.

**Where in GTM:** Triggers → New → Custom Event

**Instructions:**
1. In GTM, click **Triggers** → **New**
2. Name: `Trigger - 2PageView`
3. Trigger Configuration: **Custom Event**
4. Event name: `INSERT.EVENT.NAME`
5. Add condition: `{{JS - SPA Counter Value}}` equals `2`
6. Save

**Additional Tag Needed:**
You must push the custom event to the dataLayer when the counter increments. Update the increment tag code to include the push:

**Updated Increment Tag Code:**

```html
<script>
  var KEY = 'INSERT.COUNTER.KEY';
  var pv = sessionStorage.getItem(KEY);
  var newCount;
  
  if (!pv) { 
    newCount = 1;
    sessionStorage.setItem(KEY, '1'); 
  } else { 
    newCount = parseInt(pv, 10) + 1;
    sessionStorage.setItem(KEY, String(newCount)); 
  }
  
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    'event': 'INSERT.EVENT.NAME',
    'pageviewCount': newCount
  });
</script>
```

**Explanation:**
This updated code pushes a custom event to the dataLayer every time the counter increments. The trigger condition (`counter equals 2`) ensures tags fire only on the second pageview. The `pageviewCount` parameter is optional but helpful for debugging.

**What to verify:**
- Trigger type is **Custom Event**
- Event name matches the `event` key in the dataLayer push
- Condition checks `{{JS - SPA Counter Value}}` equals `2`
- Increment tag pushes the event on every fire

---

### Step 4: Attach Your Event Tags (Generic)

**Goal:** Configure event tags (analytics, pixels, conversion tags) to fire on the 2PageView trigger.

**Where in GTM:** Tags → (existing or new event tags)

**Instructions:**
1. Open an existing event tag or create a new one (e.g., GA4 Event, Meta Pixel, custom HTML)
2. In the **Triggering** section, add: `Trigger - 2PageView`
3. (Optional) Add consent conditions or blocking triggers
4. Save and repeat for all tags that should fire on the second pageview

**Generic Event Tag Example:**

```text
Tag Type: GA4 Event (or any vendor tag)
Event Name: engaged_user
Event Parameters:
  - pageview_count: {{JS - SPA Counter Value}}
  - engagement_type: second_pageview
Triggering: Trigger - 2PageView
```

**Explanation:**
Event tags configured this way will fire exactly once per session (or per day/user, depending on persistence option) when the user navigates to a second page. This reduces tag fires on single-page bounces and focuses measurement on engaged users.

**What to verify:**
- Tags fire on `Trigger - 2PageView` only
- Tags do not fire on All Pages or other triggers (unless intentional)
- Preview mode shows tags firing when counter reaches 2

---

## 2PageView Definition Options

Choose the definition that best fits your business logic.

### Option A: 2nd Route Change After Initial Load

**When it fires:** On the 2nd SPA navigation event (does NOT count the initial page load).

**Use case:** You want to measure engagement only after a user actively navigates within the SPA. The initial load is not counted as a "pageview" in this context.

**Configuration:**
- **Increment Tag Triggers:** `INSERT.SPA.EVENT.CHANGE` only (remove All Pages)
- **Counter starts at:** 0 (first route change increments to 1, second to 2)

**Updated Increment Tag Code:**

```html
<script>
  var KEY = 'INSERT.COUNTER.KEY';
  var pv = sessionStorage.getItem(KEY);
  var newCount;
  
  if (!pv) { 
    newCount = 1;
    sessionStorage.setItem(KEY, '1'); 
  } else { 
    newCount = parseInt(pv, 10) + 1;
    sessionStorage.setItem(KEY, String(newCount)); 
  }
  
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    'event': 'INSERT.EVENT.NAME',
    'pageviewCount': newCount
  });
</script>
```

**Triggering:** `INSERT.SPA.EVENT.CHANGE` only.

**Behavior:**
- Initial page load: counter = 0
- 1st route change: counter = 1
- 2nd route change: counter = 2 → tags fire

**What to verify:**
- All Pages is NOT a trigger for the increment tag
- Tags do not fire until after 2 route changes
- Preview mode shows counter incrementing only on SPA events

---

### Option B: 2nd Pageview Including Initial Load

**When it fires:** On the 1st SPA navigation event (counts the initial load as pageview 1).

**Use case:** You want to count the initial page load as the first pageview. The first route change is the second pageview.

**Configuration:**
- **Increment Tag Triggers:** `All Pages` + `INSERT.SPA.EVENT.CHANGE` (baseline configuration)
- **Counter starts at:** 1 on initial load

**Code:** Use the baseline increment tag code from Step 1 (already includes both triggers).

**Behavior:**
- Initial page load: counter = 1
- 1st route change: counter = 2 → tags fire
- 2nd route change: counter = 3 (tags already fired)

**What to verify:**
- Increment tag fires on All Pages
- Tags fire on the first route change (2nd pageview total)
- Counter reaches 2 faster than Option A

---

## Consent Strategy Options

Choose how to integrate consent management.

### Option A: Always Count, Gate Tags by Consent

**When it counts:** Pageview counter increments regardless of consent status.

**When tags fire:** Event tags check consent status via a blocking trigger or consent settings.

**Use case:** You want to track user navigation behavior (counter) even without consent, but only fire marketing tags when consent is granted. Simplest for debugging since the counter always increments.

**Configuration:**
- **Increment Tag:** No consent conditions (fires always)
- **Event Tags:** Add consent check via GTM's Consent Settings or a blocking trigger

**Event Tag Consent Blocking Trigger Example:**

Create a blocking trigger:

```text
Trigger Type: Custom Event
Event Name: INSERT.EVENT.NAME
Fire trigger when: {{INSERT.CONSENT.VAR}} does not equal true
Use as Blocking Trigger: Yes
```

Attach this blocking trigger to all event tags firing on `Trigger - 2PageView`.

**Explanation:**
The counter runs freely, so you can always debug and verify counts. Tags only fire when consent is granted. This approach separates counting logic from tag firing logic.

**What to verify:**
- Increment tag has no consent conditions
- Event tags have consent blocking triggers or consent settings
- Preview mode shows counter incrementing even when consent is denied
- Tags do not fire when `{{INSERT.CONSENT.VAR}}` is false

---

### Option B: Count Only After Consent

**When it counts:** Pageview counter increments only after consent is granted.

**When tags fire:** When counter reaches 2 (and consent is implicitly granted).

**Use case:** Strict privacy compliance where no user behavior is tracked without consent.

**Configuration:**
- **Increment Tag:** Add consent trigger condition
- **Event Tags:** No additional consent checks needed (counter only increments with consent)

**Updated Increment Tag Triggering:**

Original triggers: `All Pages` + `INSERT.SPA.EVENT.CHANGE`

Add condition to both triggers:
- Fire trigger when: `{{INSERT.CONSENT.VAR}}` equals `true`

**Explanation:**
The increment tag only fires when consent is granted. If a user lands on the site without consent and navigates, the counter stays at 0. Once consent is granted, counting begins. Tags fire normally when counter reaches 2.

**What to verify:**
- Increment tag does not fire without consent
- Counter stays at 0 until consent granted
- After consent, counter increments normally
- Tags fire when counter reaches 2 (after consent)

---

## Persistence Options

Choose how long the counter persists.

### Option A: Once Per Session (sessionStorage)

**Duration:** Counter resets when the browser tab/window closes.

**Use case:** Default behavior. Suitable for session-based engagement measurement.

**Configuration:**
Use the baseline increment and read variable code from Steps 1 and 2 (no changes needed).

**Code (already provided in Core Build Steps):**

Increment tag:

```html
<script>
  var KEY = 'INSERT.COUNTER.KEY';
  var pv = sessionStorage.getItem(KEY);
  var newCount;
  
  if (!pv) { 
    newCount = 1;
    sessionStorage.setItem(KEY, '1'); 
  } else { 
    newCount = parseInt(pv, 10) + 1;
    sessionStorage.setItem(KEY, String(newCount)); 
  }
  
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    'event': 'INSERT.EVENT.NAME',
    'pageviewCount': newCount
  });
</script>
```

Read variable:

```js
function() {
  return parseInt(sessionStorage.getItem('INSERT.COUNTER.KEY') || '0', 10);
}
```

**Behavior:**
- New session: counter starts at 0
- Counter increments across route changes within the session
- Browser tab closes: counter resets
- User returns: counter starts fresh at 0

**What to verify:**
- Counter persists across route changes in the same tab
- Counter resets when tab is closed and reopened
- No counter data in localStorage or cookies

---

### Option B: Once Per Day (localStorage)

**Duration:** Counter resets at midnight (daily).

**Use case:** Measure daily engagement. Tags fire once per user per day on their second pageview.

**Configuration:**
Replace sessionStorage with localStorage and add date-based reset logic.

**Updated Increment Tag Code:**

```html
<script>
  var KEY = 'INSERT.COUNTER.KEY';
  var DATE_KEY = KEY + '_date';
  var today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  var storedDate = localStorage.getItem(DATE_KEY);
  var pv = localStorage.getItem(KEY);
  var newCount;
  
  if (storedDate !== today) {
    newCount = 1;
    localStorage.setItem(KEY, '1');
    localStorage.setItem(DATE_KEY, today);
  } else if (!pv) {
    newCount = 1;
    localStorage.setItem(KEY, '1');
  } else {
    newCount = parseInt(pv, 10) + 1;
    localStorage.setItem(KEY, String(newCount));
  }
  
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    'event': 'INSERT.EVENT.NAME',
    'pageviewCount': newCount
  });
</script>
```

**Updated Read Variable Code:**

```js
function() {
  var KEY = 'INSERT.COUNTER.KEY';
  var DATE_KEY = KEY + '_date';
  var today = new Date().toISOString().split('T')[0];
  var storedDate = localStorage.getItem(DATE_KEY);
  
  if (storedDate !== today) {
    return 0;
  }
  return parseInt(localStorage.getItem(KEY) || '0', 10);
}
```

**Explanation:**
The increment tag checks if the stored date matches today's date (YYYY-MM-DD). If not, it resets the counter to 1 and updates the date. The read variable returns 0 if the date doesn't match, ensuring stale data doesn't affect triggers.

**Behavior:**
- Counter persists across sessions within the same day
- At midnight (browser time), counter resets
- Tags fire once per user per day on their second pageview

**What to verify:**
- Counter persists after closing and reopening the browser (same day)
- Counter resets when the date changes
- localStorage contains both `INSERT.COUNTER.KEY` and `INSERT.COUNTER.KEY_date`

---

### Option C: Once Per User (flag)

**Duration:** Fire once per user, forever (until localStorage is cleared).

**Use case:** Measure first-time engagement. Tags fire once per user, ever.

**Configuration:**
Use a boolean flag in localStorage instead of a counter.

**Flag Variable (replaces counter read variable):**

```js
function() {
  var FLAG_KEY = 'INSERT.COUNTER.KEY_fired';
  return localStorage.getItem(FLAG_KEY) === 'true';
}
```

Name: `JS - 2PageView Fired Flag`

**Set Flag Tag (replaces increment tag):**

```html
<script>
  var FLAG_KEY = 'INSERT.COUNTER.KEY_fired';
  var hasFired = localStorage.getItem(FLAG_KEY) === 'true';
  
  if (!hasFired) {
    localStorage.setItem(FLAG_KEY, 'true');
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      'event': 'INSERT.EVENT.NAME'
    });
  }
</script>
```

Name: `Tag - Set 2PageView Flag`

Triggering: Fire on the condition that defines "engaged user" (e.g., `INSERT.SPA.EVENT.CHANGE` after initial load, or a specific route).

**Updated 2PageView Trigger:**

```text
Trigger Type: Custom Event
Event Name: INSERT.EVENT.NAME
Fire trigger when: {{JS - 2PageView Fired Flag}} equals false
```

**Explanation:**
The flag tag checks if the flag has been set. If not, it sets the flag to `true` and pushes the custom event. Event tags fire on this event only if the flag is `false` (first time). After the first fire, the flag is `true` forever, preventing additional fires.

**Behavior:**
- First engagement: flag is set, tags fire
- All subsequent sessions: flag is `true`, tags do not fire
- Flag persists indefinitely (unless user clears browser storage)

**What to verify:**
- Flag is `false` on first visit
- Tags fire once on first engagement
- Flag is `true` after first fire
- Tags do not fire on subsequent visits

---

## Environment Guard (Hostname Blocking)

**Goal:** Prevent tags from firing on non-production hostnames (QA tools, staging, local dev).

**Use case:** Avoid polluting analytics with internal traffic or test environments.

**Configuration:**
Create a blocking trigger based on hostname and attach it to event tags (and optionally the increment tag).

**Blocking Trigger:**

```text
Trigger Type: Page View
Trigger Name: Trigger - Block Non-Production Hostnames
Fire trigger when: {{Page Hostname}} does not match RegEx INSERT.ALLOWLIST.RULES
Use as Blocking Trigger: Yes
```

**Example Allowlist RegEx:**

```text
^(www\.)?example\.com$
```

This matches `example.com` and `www.example.com` only.

**Attach to Event Tags:**
In each event tag's Exceptions section, add: `Trigger - Block Non-Production Hostnames`

**Optional: Block Increment Tag:**
If you don't want to count pageviews on non-production hostnames, add the blocking trigger to the increment tag as well.

**Explanation:**
The blocking trigger prevents tags from firing when the hostname doesn't match the allowlist pattern. This ensures only production traffic triggers your event tags.

**What to verify:**
- Tags do not fire on QA/staging/local hostnames
- Tags fire normally on production hostnames
- Preview mode shows blocking trigger activating on non-allowlisted hostnames

---

## Testing & Validation

**Goal:** Confirm the 2PageView pattern works correctly before publishing.

### GTM Preview Mode Steps

1. **Enter Preview Mode:**
   - In GTM, click **Preview** (top right)
   - Enter your site URL
   - Navigate to the site in the new tab

2. **Find the SPA Event Name:**
   - In the GTM debugger (left panel), look for events after navigating between routes
   - Common event names: `historyChange`, `historyChange-v2`, `gtm.historyChange-v2`
   - Note the exact event name and replace `INSERT.SPA.EVENT.CHANGE` in your configuration

3. **Verify Counter Increments:**
   - On initial load, open the **Variables** tab in the debugger
   - Find `{{JS - SPA Counter Value}}` and note the value (should be 1 if using baseline config)
   - Navigate to another route (click a link)
   - Check the counter again (should be 2)
   - Verify the increment tag fired on both events

4. **Verify 2PageView Trigger Fires:**
   - After the second pageview, look for `INSERT.EVENT.NAME` in the event list
   - Check that `Trigger - 2PageView` appears and event tags fire
   - Verify tags fire exactly once (counter should not increment further in this session)

5. **Verify Tags Do Not Fire Again:**
   - Navigate to a third route
   - Check the counter (should be 3 or higher)
   - Confirm event tags do NOT fire again (trigger condition `counter equals 2` is false)

### DevTools Console Checks

Open the browser console (F12) and run these commands:

**Check Counter Value:**

```js
sessionStorage.getItem('INSERT.COUNTER.KEY')
```

Expected: `"1"` after initial load, `"2"` after first route change (baseline config).

**Reset Counter (for testing):**

```js
sessionStorage.removeItem('INSERT.COUNTER.KEY')
```

Reload the page to start fresh.

**Check localStorage (for daily/user persistence):**

```js
localStorage.getItem('INSERT.COUNTER.KEY')
localStorage.getItem('INSERT.COUNTER.KEY_date')
localStorage.getItem('INSERT.COUNTER.KEY_fired')
```

**Clear All Storage (nuclear option):**

```js
sessionStorage.clear()
localStorage.clear()
```

### What to Verify Checklist

- [ ] Increment tag fires on initial load and route changes
- [ ] Counter variable returns correct integer values
- [ ] Custom event `INSERT.EVENT.NAME` is pushed to dataLayer when counter increments
- [ ] 2PageView trigger fires when counter equals 2
- [ ] Event tags fire exactly once per session (or per day/user, depending on persistence)
- [ ] Tags do not fire on subsequent route changes after firing once
- [ ] Consent checks work (if implemented)
- [ ] Hostname blocking works (if implemented)

---

## Troubleshooting & Pitfalls

### Wrong SPA Event String

**Symptom:** Counter doesn't increment on route changes.

**Cause:** The event name in the increment tag trigger doesn't match the actual SPA event pushed by the framework or GTM history change listener.

**Fix:**
- Use GTM Preview Mode to find the exact event name
- Common names: `historyChange`, `historyChange-v2`, `gtm.historyChange-v2`, or custom events
- Update the increment tag trigger to match

### Missing All Pages Trigger

**Symptom:** Counter never starts; stays at 0.

**Cause:** Using Option A (2nd route change after initial load) but expecting counter to start on initial load.

**Fix:**
- If you want to count the initial load, add `All Pages` trigger to the increment tag (Option B)
- If you only want to count route changes, remove `All Pages` (Option A)

### Multiple Containers Incrementing the Same Key

**Symptom:** Counter jumps unexpectedly (e.g., 1 → 3) or tags fire too early.

**Cause:** Multiple GTM containers on the same page increment the same `INSERT.COUNTER.KEY`.

**Fix:**
- Use unique counter keys per container (e.g., `spa_pv_count_container1`, `spa_pv_count_container2`)
- Or ensure only one container manages the counter

### Consent Inconsistencies

**Symptom:** Counter increments but tags don't fire (or vice versa).

**Cause:** Consent strategy mismatch (counter gated by consent but tags are not, or vice versa).

**Fix:**
- Choose one consent strategy (Option A or Option B) and apply consistently
- Verify consent variable returns the expected value in Preview Mode

### Storage Restrictions / Privacy Modes

**Symptom:** Counter resets unexpectedly or doesn't persist.

**Cause:** User is in private browsing mode, or browser blocks storage APIs.

**Fix:**
- Wrap storage calls in try/catch to handle errors gracefully
- Consider fallback to in-memory counter (resets on page reload) for privacy modes

**Example Error-Safe Increment Tag:**

```html
<script>
  var KEY = 'INSERT.COUNTER.KEY';
  var pv, newCount;
  
  try {
    pv = sessionStorage.getItem(KEY);
    if (!pv) { 
      newCount = 1;
      sessionStorage.setItem(KEY, '1'); 
    } else { 
      newCount = parseInt(pv, 10) + 1;
      sessionStorage.setItem(KEY, String(newCount)); 
    }
  } catch (e) {
    newCount = 1;
  }
  
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    'event': 'INSERT.EVENT.NAME',
    'pageviewCount': newCount
  });
</script>
```

### Tags Fire Multiple Times

**Symptom:** Event tags fire more than once per session.

**Cause:** Trigger condition is not strict enough (e.g., counter ≥ 2 instead of equals 2).

**Fix:**
- Ensure trigger condition is `{{JS - SPA Counter Value}}` **equals** `2` (not greater than or equal)
- For once-per-user persistence, use the flag approach (Option C)

### Counter Doesn't Reset (localStorage/daily)

**Symptom:** Counter persists across days when using daily persistence.

**Cause:** Date key is not being checked or updated correctly.

**Fix:**
- Verify the date key is stored in localStorage (`INSERT.COUNTER.KEY_date`)
- Ensure date format is consistent (YYYY-MM-DD)
- Test by manually changing the stored date in DevTools and reloading

---

## Implementation Checklist

Use this checklist to ensure a complete implementation:

- [ ] Replace all placeholders (`INSERT.SPA.EVENT.CHANGE`, `INSERT.COUNTER.KEY`, `INSERT.EVENT.NAME`, etc.) with real values
- [ ] Create increment tag (Custom HTML) with correct triggers
- [ ] Create counter read variable (Custom JavaScript)
- [ ] Update increment tag to push custom event to dataLayer
- [ ] Create 2PageView trigger (Custom Event) with counter condition
- [ ] Attach event tags to 2PageView trigger
- [ ] Choose and implement 2PageView definition option (A or B)
- [ ] Choose and implement consent strategy (A or B)
- [ ] Choose and implement persistence option (A, B, or C)
- [ ] (Optional) Create and attach hostname blocking trigger
- [ ] Test in GTM Preview Mode (verify counter, trigger, and tag firing)
- [ ] Test with DevTools console (check storage values)
- [ ] Verify tags fire exactly once per intended duration (session/day/user)
- [ ] Submit changes and publish GTM container
- [ ] Monitor live traffic to confirm tags fire as expected

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Maintained By:** Internal GTM Implementation Team  

For questions or issues, contact your GTM administrator or implementation team.
