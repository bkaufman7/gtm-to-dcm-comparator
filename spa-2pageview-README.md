# GTM 2PageView Event Pattern for Single Page Applications

A reusable Google Tag Manager implementation pattern to fire event tags on the second pageview in Single Page Applications (SPAs), with flexible options for consent, persistence, and environment control.

---

## Table of Contents

- [TLDR: 5-Minute Setup (For Non-Engineers)](#tldr-5-minute-setup-for-non-engineers)
- [Glossary: Where to Find Placeholder Values](#glossary-where-to-find-placeholder-values)
- [Overview](#overview)
- [Quick Start (Recommended Default)](#quick-start-recommended-default)
- [Placeholders You Must Replace](#placeholders-you-must-replace)
- [Core Build Steps (Required)](#core-build-steps-required)
  - [Step 1: Create Counter Increment Tag (Custom HTML)](#step-1-create-counter-increment-tag-custom-html)
  - [Step 2: Create Counter Read Variable (Custom JS)](#step-2-create-counter-read-variable-custom-js)
  - [Step 3: Create 2PageView Trigger (Custom Event)](#step-3-create-2pageview-trigger-custom-event)
  - [Step 4: Attach Your Event Tags (Generic)](#step-4-attach-your-event-tags-generic)
- [2PageView Definition](#2pageview-definition)
- [Persistence Behavior](#persistence-behavior)
- [Testing & Validation](#testing--validation)
- [Troubleshooting & Pitfalls](#troubleshooting--pitfalls)
- [Implementation Checklist](#implementation-checklist)

---

## TLDR: 5-Minute Setup (For Non-Engineers)

**What you're building:** A system that fires your marketing tags only when a visitor views their 2nd page, not on the 1st page.

### Before You Start: Get Your Values

Use the [Glossary](#glossary-where-to-find-placeholder-values) below to find these 3 values. Write them down:

| Value Name | What It Looks Like | Where to Find It |
|------------|-------------------|------------------|
| SPA Event Name | `historyChange-v2` | GTM Preview Mode (see glossary) |
| Counter Key | `spa_page_count` | Pick any short name (lowercase, no spaces) |
| Event Name | `secondPageview` | Pick any name (this is what you'll see in GTM) |

### Step-by-Step (15 Minutes)

**Step 1: Create the Counter Tag**
1. In GTM, click **Tags** → **New**
2. Name it: `Counter - Increment on Navigation`
3. Click **Tag Configuration** → Choose **Custom HTML**
4. Copy/paste this code (replace the 3 values with yours):

```html
<script>
  var KEY = 'YOUR_COUNTER_KEY_HERE';
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
    'event': 'YOUR_EVENT_NAME_HERE',
    'pageviewCount': newCount
  });
</script>
```

5. Click **Triggering** → Click **+** → Choose **Custom Event** → Type your SPA event name (e.g., `historyChange-v2`)
   - **Note:** If your SPA event doesn't fire on the landing page, also add **All Pages** trigger
6. Click **Save**

**Step 2: Create the Counter Variable**
1. In GTM, click **Variables** → Scroll to **User-Defined Variables** → Click **New**
2. Name it: `Counter - Page Count`
3. Click **Variable Configuration** → Choose **Custom JavaScript**
4. Copy/paste this code (replace YOUR_COUNTER_KEY_HERE):

```js
function() {
  return parseInt(sessionStorage.getItem('YOUR_COUNTER_KEY_HERE') || '0', 10);
}
```

5. Click **Save**

**Step 3: Create the 2PageView Trigger**
1. In GTM, click **Triggers** → **New**
2. Name it: `Event - Second Pageview`
3. Click **Trigger Configuration** → Choose **Custom Event**
4. In **Event name**, type your event name (e.g., `secondPageview`)
5. Under **This trigger fires on**, choose **Some Custom Events**
6. Add condition: Choose your counter variable (e.g., `Counter - Page Count`) **equals** `2`
7. Click **Save**

**Step 4: Connect Your Tags**
1. Find the tag you want to fire on the 2nd page (e.g., conversion pixel, Meta pixel, etc.)
2. Open that tag → Click **Triggering**
3. Click **+** → Find and select **Event - Second Pageview**
4. Remove other triggers (like "All Pages") if you ONLY want it on page 2
5. Click **Save**

**Step 5: Test It**
1. Click **Preview** (top right in GTM)
2. Enter your website URL
3. On your site, open DevTools (press F12) → Go to **Console** tab
4. Type this (replace YOUR_COUNTER_KEY_HERE) and press Enter:
   ```js
   sessionStorage.getItem('YOUR_COUNTER_KEY_HERE')
   ```
5. You should see `"1"` on the first page
6. Click a link to go to another page
7. Run the same command again – you should see `"2"`
8. Check GTM debugger – your tag should have fired!

**Step 6: Publish**
1. Close Preview mode
2. Click **Submit** (top right)
3. Add a version name like "Added 2nd pageview tracking"
4. Click **Publish**

Done! Your tags now fire only when users view a 2nd page.

---

## Glossary: Where to Find Placeholder Values

This section tells you exactly where to find or how to create each value you need.

### INSERT.SPA.EVENT.CHANGE (SPA Event Name)

**What it is:** The event name that GTM fires when users navigate between pages in your Single Page App.

**Where to find it:**
1. In GTM, click **Preview** (top right)
2. Enter your website URL
3. On your site, click any navigation link (e.g., go from Home to About page)
4. In the GTM debugger (left side panel), look at the event list
5. Look for events with names like:
   - `historyChange`
   - `historyChange-v2`
   - `gtm.historyChange-v2`
   - (or something similar with "history" or "route")
6. **That exact name is your SPA event name**

**Example:** If you see `historyChange-v2` in the event list, use `historyChange-v2` everywhere it says `INSERT.SPA.EVENT.CHANGE`

**If you don't see any events:** Your site might use a different navigation method. Contact your developer or use `historyChange-v2` as a starting guess.

---

### INSERT.COUNTER.KEY (Counter Storage Key)

**What it is:** A unique name for storing the page count in the browser. This is like a label on a storage box.

**Where to get it:** You make it up! Just follow these rules:
- Use lowercase letters only
- No spaces (use underscores instead)
- Keep it short and descriptive
- Make it unique to avoid conflicts with other scripts

**Good examples:**
- `spa_pv_count`
- `page_counter`
- `nav_count_v1`
- `visit_pageviews`

**Bad examples:**
- `My Counter` (has space and capital letters)
- `count` (too generic, might conflict)

**Recommendation:** Use `spa_pv_count` if you're not sure.

---

### INSERT.EVENT.NAME (Custom Event Name)

**What it is:** The name of the custom event that will fire when the counter reaches 2. You'll see this in GTM's debugger.

**Where to get it:** You make it up! Just follow these rules:
- Use letters and numbers only
- Can use camelCase (e.g., `secondPageview`) or underscores (e.g., `second_pageview`)
- Make it descriptive so you know what it means later

**Good examples:**
- `secondPageview`
- `2PageView`
- `engagedUser`
- `second_page_viewed`

**Bad examples:**
- `event` (too generic)
- `second page` (has space)

**Recommendation:** Use `secondPageview` if you're not sure.

---

### INSERT.CONSENT.VAR (Consent Variable)

**What it is:** A GTM variable that tells you if the user has given consent (approved cookies/tracking).

**Where to find it:**
1. Ask your team: "Do we have a consent management platform (CMP)?" Common ones:
   - OneTrust
   - Cookiebot
   - Google Consent Mode
2. In GTM, click **Variables** → Look in **User-Defined Variables**
3. Look for variables with names like:
   - `CMP - Consent Granted`
   - `Consent Status`
   - `Cookie Consent`
   - `ads_data_consent`
4. **The name with `{{` and `}}` around it is your consent variable**

**Example:** If you see a variable called "CMP - Marketing Consent", use `{{CMP - Marketing Consent}}`

**If you don't have one:** Skip the consent sections for now, or ask your privacy/compliance team.

---

### INSERT.ALLOWLIST.RULES (Hostname Pattern)

**What it is:** A pattern that matches your production website domain(s) only, blocking test/QA sites.

**Where to get it:** Use your website's domain name.

**How to create it:**
1. Look at your website URL, like `https://www.example.com/page`
2. Take just the domain part: `www.example.com`
3. Format it as: `^(www\.)?example\.com$`

**Examples:**

| Your Website | Pattern to Use |
|--------------|----------------|
| `www.example.com` | `^(www\.)?example\.com$` |
| `shop.mysite.com` | `^shop\.mysite\.com$` |
| `app.acme.io` | `^app\.acme\.io$` |

**Multiple domains?** Use the `|` symbol:
```
^(www\.)?example\.com$|^shop\.mysite\.com$
```

**If you're not sure:** Leave this blank and skip the hostname blocking section for now.

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
- **Definition:** The page that loads after the initial landing page
- **Persistence:** Counter resets when browser tab closes (sessionStorage)

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
5. Triggering: `INSERT.SPA.EVENT.CHANGE` (Custom Event trigger)
6. Save

**Alternative:** If the SPA event does NOT fire on the initial landing page (only on subsequent route changes), add **All Pages** (or **Container Loaded**) as an additional trigger to ensure the counter starts on the landing page.

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
- Tag fires on **INSERT.SPA.EVENT.CHANGE** (route changes)
- If SPA event doesn't fire on landing page, also add **All Pages** trigger
- No other triggers attached

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
3. Save and repeat for all tags that should fire on the second pageview

**Explanation:**
Event tags configured this way will fire exactly once per session (or per day/user, depending on persistence option) when the user navigates to a second page. This reduces tag fires on single-page bounces and focuses measurement on engaged users.

**What to verify:**
- Tags fire on `Trigger - 2PageView` only
- Tags do not fire on All Pages or other triggers (unless intentional)
- Preview mode shows tags firing when counter reaches 2

---

## 2PageView Definition

**What "2PageView" means:** The page that loads after the user's initial landing page.

**Behavior:**
- User lands on your site (landing page)
- User clicks a link and navigates to another page (route changes)
- This second page is when your tags fire

**How the counter works:**
- Landing page: counter starts (may be 0 or 1 depending on whether SPA event fires on landing)
- First route change: counter increments
- When counter reaches 2: tags fire
- Subsequent route changes: counter continues incrementing but tags don't fire again

**Important:** The increment tag fires on the SPA event (`INSERT.SPA.EVENT.CHANGE`). If your SPA framework fires this event on the landing page, the counter will start at 1. If it only fires on route changes (not landing), you may need to add the **All Pages** trigger to start the counter on landing.

---

## Persistence Behavior

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

- [ ] Increment tag fires on SPA route changes (and landing page if needed)
- [ ] Counter variable returns correct integer values
- [ ] Custom event `INSERT.EVENT.NAME` is pushed to dataLayer when counter increments
- [ ] 2PageView trigger fires when counter equals 2
- [ ] Event tags fire exactly once per session
- [ ] Tags do not fire on subsequent route changes after firing once
- [ ] Counter resets when browser tab is closed and reopened

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

---

## Implementation Checklist

Use this checklist to ensure a complete implementation:

- [ ] Replace all placeholders (`INSERT.SPA.EVENT.CHANGE`, `INSERT.COUNTER.KEY`, `INSERT.EVENT.NAME`) with real values
- [ ] Create increment tag (Custom HTML) with SPA event trigger
- [ ] Add All Pages trigger if SPA event doesn't fire on landing page
- [ ] Create counter read variable (Custom JavaScript)
- [ ] Verify increment tag pushes custom event to dataLayer
- [ ] Create 2PageView trigger (Custom Event) with counter condition equals 2
- [ ] Attach event tags to 2PageView trigger
- [ ] Test in GTM Preview Mode (verify counter, trigger, and tag firing)
- [ ] Test with DevTools console (check storage values)
- [ ] Verify tags fire exactly once per session
- [ ] Test that counter resets when tab is closed and reopened
- [ ] Submit changes and publish GTM container
- [ ] Monitor live traffic to confirm tags fire as expected

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Maintained By:** Internal GTM Implementation Team  

For questions or issues, contact your GTM administrator or implementation team.
