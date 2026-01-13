# GTM 2PageView Tracking with OneTrust Consent

Track per-session pageview count without consent, but only fire event tags after OneTrust consent is granted. Built for traditional multi-page websites (non-SPA).

---

## Table of Contents

- [Overview](#overview)
- [User Journey Diagram](#user-journey-diagram)
- [What We Built (Tags / Triggers / Variables)](#what-we-built-tags--triggers--variables)
- [Placeholders to Replace](#placeholders-to-replace)
- [Step-by-Step Implementation](#step-by-step-implementation)
  - [Step 1: Increment Counter Tag (runs without consent)](#step-1-increment-counter-tag-runs-without-consent)
  - [Step 2: Counter Read Variable](#step-2-counter-read-variable)
  - [Step 3: 2PageView Trigger (History Change) + Consent Gate](#step-3-2pageview-trigger-history-change--consent-gate)
  - [Step 4: Attach Event Tags (only fire with consent)](#step-4-attach-event-tags-only-fire-with-consent)
- [Consent Gating Options](#consent-gating-options)
  - [Option A (Recommended): Add consent condition directly in the 2PageView trigger](#option-a-recommended-add-consent-condition-directly-in-the-2pageview-trigger)
  - [Option B: Keep trigger count-only; gate consent at the tag level](#option-b-keep-trigger-count-only-gate-consent-at-the-tag-level)
- [Testing & QA](#testing--qa)
- [Common Pitfalls](#common-pitfalls)
- [How to Change the Threshold](#how-to-change-the-threshold)
- [Final Checklist](#final-checklist)

---

## Overview

This implementation solves a common measurement challenge: tracking engaged users (those who view 2+ pages) while respecting OneTrust consent requirements.

**Key Principles:**
- Pageview counting is **consent-agnostic** (happens before consent decision)
- Event tags only fire **after OneTrust consent is granted**
- Count persists for the session (resets when browser tab closes)
- Designed for traditional multi-page sites (full page reloads)

**Use Case:**
Fire conversion pixels, remarketing tags, or engagement events only when:
1. User has viewed at least 2 pages in their session
2. User has granted OneTrust consent

This reduces wasted tag fires on single-page bounces and ensures compliance with consent requirements.

---

## User Journey Diagram

### Scenario 1: User Consents Before 2nd Page

```
Page 1 (landing)
  ↓ count = 1
  ↓ User grants OneTrust consent
  ↓ No tags fire (count < 2)
  
Page 2
  ↓ count = 2
  ↓ consent = true
  ✓ Tags fire (count=2 AND consent=true)
  
Page 3+
  ↓ count = 3, 4, 5...
  ↓ consent = true
  ✗ Tags do NOT fire again (already fired at count=2)
```

### Scenario 2: User Reaches 2nd Page Without Consent

```
Page 1 (landing)
  ↓ count = 1
  ↓ No consent yet
  ↓ No tags fire
  
Page 2
  ↓ count = 2
  ↓ consent = false
  ✗ Tags do NOT fire (consent=false)
  
User grants consent
  ↓ count still = 2
  ✗ Tags do NOT fire retroactively
  
Page 3
  ↓ count = 3
  ↓ consent = true
  ✗ Tags do NOT fire (count > 2, trigger missed)
```

**Important Note:** If a user reaches `count=2` before consenting, this implementation does **NOT** fire retroactively after consent is granted. The trigger only evaluates when the count changes to 2, not continuously. To fire retroactively, you would need additional logic listening for consent state changes.

---

## What We Built (Tags / Triggers / Variables)

| Type | Name | Purpose |
|------|------|---------|
| **Tag** | `hmi - Tag - Increment Pageview Count (Session)` | Increments sessionStorage counter on every page load (no consent required) |
| **Variable** | `hmi - JS - Get Pageview Count (Session)` | Reads current count from sessionStorage as integer |
| **Trigger** | `hmi - Trigger - 2PageView (History Change)` | Fires when count=2 AND OneTrust consent=true |
| **Tag (Example)** | `hmi - Event - 2PageView` | Generic event tag that fires on the 2PageView trigger |

---

## Placeholders to Replace

Throughout this document, replace these placeholders with your actual values:

| Placeholder | Description | Recommended Default |
|-------------|-------------|---------------------|
| `INSERT.COUNTER.KEY` | sessionStorage key for the counter | `pageview_count` |
| `INSERT.HISTORY.CHANGE.EVENT` | DataLayer event name for trigger evaluation | `gtm.historyChange-v2` or custom event |
| `INSERT.EVENT.NAME` | Custom event name pushed when tags should fire | `2PageView` |
| `INSERT.ONETRUST.CONSENT.VAR` | GTM variable returning OneTrust consent status (boolean) | `{{OneTrust - Performance Cookies Consent}}` |
| `INSERT.ONETRUST.CONSENT.DESCRIPTION` | Human-readable description of consent category | `Performance Cookies` or `Targeting Cookies` |

**Finding Your OneTrust Consent Variable:**
1. In GTM, go to **Variables** → **User-Defined Variables**
2. Look for variables created by your OneTrust integration (often prefixed with "OneTrust" or "CMP")
3. The variable should return `true` when consent is granted, `false` otherwise
4. Common variable types: Data Layer Variable reading `OptanonActiveGroups` or Custom JavaScript parsing OneTrust SDK

---

## Step-by-Step Implementation

### Step 1: Increment Counter Tag (runs without consent)

**Goal:** Count every page load in sessionStorage, regardless of consent status.

**Where in GTM:** Tags → New → Custom HTML

**Instructions:**
1. In GTM, click **Tags** → **New**
2. Name: `hmi - Tag - Increment Pageview Count (Session)`
3. Tag Configuration: **Custom HTML**
4. Paste the code below
5. Triggering: **Window Loaded** (or **All Pages** if using GTM DOM Ready pattern)
6. **Do NOT add consent conditions** to this tag
7. Save

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
This tag fires on every page load and increments a counter in sessionStorage. On the first page of a session, it initializes to 1. On subsequent pages, it increments by 1. This counting happens **before and without** OneTrust consent, which is permitted for functional/session management purposes.

**What to verify:**
- Tag fires on every page load
- Tag has NO consent conditions or exceptions
- Tag uses a non-consent-gated trigger (Window Loaded / All Pages)

---

### Step 2: Counter Read Variable

**Goal:** Create a GTM variable that returns the current count as an integer.

**Where in GTM:** Variables → New → Custom JavaScript

**Instructions:**
1. In GTM, click **Variables** → **New**
2. Name: `hmi - JS - Get Pageview Count (Session)`
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
This variable reads the counter from sessionStorage and returns it as an integer. Returns 0 if the key doesn't exist. This variable will be used in the trigger condition to check if count equals 2.

**What to verify:**
- Variable type is **Custom JavaScript**
- Variable returns a number (not a string)
- Variable can be tested in GTM Preview Mode

---

### Step 3: 2PageView Trigger (History Change) + Consent Gate

**Goal:** Create a trigger that fires when count reaches 2 AND OneTrust consent is granted.

**Where in GTM:** Triggers → New → Custom Event

**Instructions:**
1. In GTM, click **Triggers** → **New**
2. Name: `hmi - Trigger - 2PageView (History Change)`
3. Trigger Configuration: **Custom Event**
4. Event name: `INSERT.HISTORY.CHANGE.EVENT`
5. Under **This trigger fires on**, select **Some Custom Events**
6. Add two conditions:
   - `{{hmi - JS - Get Pageview Count (Session)}}` equals `2`
   - `{{INSERT.ONETRUST.CONSENT.VAR}}` equals `true`
7. Save

**Trigger Configuration (visual representation):**

```text
Trigger Type: Custom Event
Event Name: INSERT.HISTORY.CHANGE.EVENT

Fire this trigger when:
  All of these conditions are true:
    - hmi - JS - Get Pageview Count (Session) equals 2
    - INSERT.ONETRUST.CONSENT.VAR equals true
```

**Explanation:**
This trigger evaluates on a specific dataLayer event (typically `gtm.historyChange-v2` or a custom event you push). It only fires when BOTH conditions are true: the count has reached exactly 2, and OneTrust consent is granted. This is the recommended approach (Option A) because it consolidates both requirements in one place.

**What to verify:**
- Trigger type is **Custom Event**
- Event name matches the event you want to evaluate against
- Both conditions are present (count AND consent)
- Trigger uses "All conditions" logic (AND, not OR)

---

### Step 4: Attach Event Tags (only fire with consent)

**Goal:** Configure your marketing/tracking tags to fire on the 2PageView trigger.

**Where in GTM:** Tags → (existing or new event tags)

**Instructions:**
1. Open an existing event tag or create a new one
2. Example tag name: `hmi - Event - 2PageView`
3. Configure your tag (GA4 Event, Meta Pixel, custom pixel, etc.)
4. In the **Triggering** section, add: `hmi - Trigger - 2PageView (History Change)`
5. Remove any other triggers like All Pages (unless the tag needs to fire elsewhere too)
6. Save

**Recommended Event Parameters (for analytics tags):**

```text
Event Name: 2pageview_engagement
Parameters:
  - event_name: 2PageView
  - page_url: {{Page URL}}
  - page_path: {{Page Path}}
  - pageview_count: {{hmi - JS - Get Pageview Count (Session)}}
  - consent_category: INSERT.ONETRUST.CONSENT.DESCRIPTION
```

**Explanation:**
Tags configured this way will fire exactly once per session when the user views their second page AND has granted consent. The trigger handles both the count check and consent check, so the tag doesn't need additional logic.

**What to verify:**
- Tag fires on `hmi - Trigger - 2PageView (History Change)` only
- Tag does not have additional consent conditions (already in trigger)
- Preview mode shows tag firing when count=2 and consent=true

---

## Consent Gating Options

There are two ways to integrate OneTrust consent requirements. Choose the approach that best fits your GTM setup.

### Option A (Recommended): Add consent condition directly in the 2PageView trigger

**Configuration:**
- Increment tag: No consent conditions
- Trigger: Includes both count=2 AND consent=true conditions
- Event tags: No additional consent logic needed

**Pros:**
- Centralized logic (all conditions in one trigger)
- Easier to maintain (change consent logic in one place)
- Clear trigger name indicates both count and consent requirements

**Cons:**
- If consent variable is unavailable or undefined, trigger won't fire even if count=2
- Requires careful testing of consent variable reliability

**When to use:**
- You have a reliable OneTrust consent variable that always returns true/false
- You want to keep tag configuration simple
- You prefer centralized trigger logic

**Implementation:**
Follow [Step 3](#step-3-2pageview-trigger-history-change--consent-gate) exactly as written.

---

### Option B: Keep trigger count-only; gate consent at the tag level

**Configuration:**
- Increment tag: No consent conditions
- Trigger: Only checks count=2 (no consent condition)
- Event tags: Add consent condition via Trigger Group or tag-level exception

**Trigger Configuration (count-only):**

```text
Trigger Type: Custom Event
Event Name: INSERT.HISTORY.CHANGE.EVENT

Fire this trigger when:
  hmi - JS - Get Pageview Count (Session) equals 2
```

**Tag Configuration (add consent exception):**

In each event tag:
1. In the **Triggering** section, add: `hmi - Trigger - 2PageView (History Change)`
2. In the **Exceptions** section, create or add a blocking trigger:
   - Trigger Type: Custom Event
   - Event Name: `INSERT.HISTORY.CHANGE.EVENT`
   - Fire when: `{{INSERT.ONETRUST.CONSENT.VAR}}` does not equal `true`

**Pros:**
- Trigger is reusable for consent-agnostic scenarios
- Consent logic is explicit at the tag level
- Easier to debug consent failures (tag shows as blocked)

**Cons:**
- Consent logic must be added to every tag individually
- More maintenance if consent variable changes
- More verbose GTM setup

**When to use:**
- You want to reuse the count trigger for multiple scenarios with different consent requirements
- You prefer explicit tag-level consent configuration
- You're using GTM Consent Mode and want consent declared in tag settings

**Implementation:**
Modify Step 3 trigger to remove consent condition, then add consent exception to each tag in Step 4.

---

## Testing & QA

### GTM Preview Mode Steps

1. **Enter Preview Mode:**
   - In GTM, click **Preview** (top right)
   - Enter your website URL
   - Navigate to the site in the new tab

2. **Test Page 1 (Landing Page):**
   - Grant OneTrust consent (if prompted)
   - In GTM debugger, find the event `INSERT.HISTORY.CHANGE.EVENT` (or Window Loaded)
   - Check the **Variables** tab:
     - `hmi - JS - Get Pageview Count (Session)` should show `1`
     - `INSERT.ONETRUST.CONSENT.VAR` should show `true` (if you consented)
   - Verify that `hmi - Trigger - 2PageView (History Change)` does NOT fire
   - Verify that event tags do NOT fire

3. **Test Page 2 (Second Page):**
   - Click a link to navigate to a second page (full page reload)
   - In GTM debugger, find the event `INSERT.HISTORY.CHANGE.EVENT`
   - Check the **Variables** tab:
     - `hmi - JS - Get Pageview Count (Session)` should show `2`
     - `INSERT.ONETRUST.CONSENT.VAR` should show `true`
   - Verify that `hmi - Trigger - 2PageView (History Change)` DOES fire
   - Verify that event tags fire exactly once

4. **Test Page 3+ (Subsequent Pages):**
   - Click another link to navigate to a third page
   - Check the count (should be 3 or higher)
   - Verify that `hmi - Trigger - 2PageView (History Change)` does NOT fire again
   - Verify that event tags do NOT fire again

### DevTools Console Testing

Open the browser console (F12 → Console tab) and run these commands:

**Check current count:**

```js
sessionStorage.getItem('INSERT.COUNTER.KEY')
```

**Expected values:**
- Page 1: `"1"`
- Page 2: `"2"`
- Page 3: `"3"`

**Reset counter (for testing):**

```js
sessionStorage.removeItem('INSERT.COUNTER.KEY')
```

Then reload the page to start fresh.

**Clear all storage:**

```js
sessionStorage.clear()
```

### Consent Testing Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| User consents on Page 1, navigates to Page 2 | Tags fire on Page 2 (count=2, consent=true) |
| User navigates to Page 2 without consent | Tags do NOT fire (count=2, consent=false) |
| User navigates to Page 2, then consents | Tags do NOT fire retroactively |
| User consents on Page 2, navigates to Page 3 | Tags do NOT fire on Page 3 (already fired) |

### What to Verify Checklist

- [ ] Increment tag fires on every page load (Pages 1, 2, 3+)
- [ ] Counter variable returns correct integer (1, 2, 3, ...)
- [ ] Counter persists across page loads in the same session
- [ ] Counter resets when browser tab is closed and reopened
- [ ] Trigger fires when count=2 AND consent=true
- [ ] Trigger does NOT fire when count=2 and consent=false
- [ ] Event tags fire exactly once per session (on Page 2 with consent)
- [ ] Event tags do NOT fire retroactively after consent is granted

---

## Common Pitfalls

### Trigger Evaluating Too Early

**Symptom:** Trigger fires before count reaches 2, or fires multiple times.

**Cause:** Wrong event name in trigger, or event firing multiple times per page.

**Fix:**
- Use GTM Preview to identify the correct event name (`INSERT.HISTORY.CHANGE.EVENT`)
- Common event names: `gtm.historyChange-v2`, `gtm.dom`, `gtm.load`
- Ensure the event fires once per page load, not multiple times

---

### Increment Tag Firing Multiple Times Per Page

**Symptom:** Counter jumps by 2 or more on a single page load.

**Cause:** Tag fires on multiple triggers, or trigger fires multiple times.

**Fix:**
- Verify increment tag has only ONE trigger (Window Loaded or All Pages)
- Check that trigger is not set to fire on "All" events (should fire once per page)
- Use GTM Preview to confirm tag fires only once per page

---

### Consent Variable Returning String vs Boolean

**Symptom:** Trigger doesn't fire even when consent is granted.

**Cause:** Consent variable returns `"true"` (string) instead of `true` (boolean), or returns other values like `"1"`, `"yes"`, etc.

**Fix:**
- Test your consent variable in GTM Preview Mode
- If it returns a string, normalize it in a Custom JavaScript variable:

```js
function() {
  var consentValue = {{INSERT.ONETRUST.CONSENT.VAR}};
  return consentValue === true || consentValue === 'true' || consentValue === '1';
}
```

- Use this normalized variable in your trigger condition

---

### Not Retroactively Firing After Consent

**Symptom:** User reaches Page 2 without consent, then grants consent, but tags don't fire.

**Cause:** This is **expected behavior**. The trigger only evaluates when the event fires (on page load), not continuously.

**Solution:**
If you need retroactive firing, you must implement additional logic:
1. Push a custom event when consent changes (`dataLayer.push({'event': 'consentGranted'})`)
2. Create a second trigger that fires on this event with conditions: count ≥ 2 AND consent just changed to true
3. This is more complex and requires OneTrust callback integration

**Recommendation:** Accept the non-retroactive behavior. Users who consent before or on their 2nd page will be tracked, which covers most scenarios.

---

### Counter Doesn't Persist Across Pages

**Symptom:** Counter resets to 1 on every page.

**Cause:** Storage key mismatch between increment tag and read variable, or sessionStorage is unavailable.

**Fix:**
- Verify both the tag and variable use the same `INSERT.COUNTER.KEY` value
- Check browser console for storage errors (some privacy modes block sessionStorage)
- Test in a normal browser window (not private/incognito) first

---

## How to Change the Threshold

To fire tags on a different page count (e.g., 3rd page instead of 2nd):

1. **Update the trigger condition:**
   - Open `hmi - Trigger - 2PageView (History Change)`
   - Change the condition from `equals 2` to `equals 3` (or any number)

2. **Update naming (optional):**
   - Rename trigger to reflect new threshold: `hmi - Trigger - 3PageView (History Change)`
   - Update event name placeholder if desired: `3PageView` instead of `2PageView`

3. **Test the new threshold:**
   - Clear sessionStorage: `sessionStorage.clear()`
   - Navigate through pages and verify tags fire on the Nth page

**Note:** The increment tag and read variable do not need to change. They continue counting all pages. Only the trigger condition needs to be updated.

---

## Final Checklist

Use this checklist before publishing your GTM container:

**Setup:**
- [ ] Replace all placeholders with actual values (`INSERT.COUNTER.KEY`, `INSERT.HISTORY.CHANGE.EVENT`, etc.)
- [ ] Verify OneTrust consent variable exists and returns boolean values
- [ ] Confirm the correct dataLayer event name for trigger evaluation

**Tags:**
- [ ] Create `hmi - Tag - Increment Pageview Count (Session)` (Custom HTML)
- [ ] Verify increment tag fires on Window Loaded or All Pages (no consent conditions)
- [ ] Create event tags that fire on the 2PageView trigger

**Variables:**
- [ ] Create `hmi - JS - Get Pageview Count (Session)` (Custom JavaScript)
- [ ] Test variable in Preview Mode (should return 0, 1, 2, 3, ...)

**Triggers:**
- [ ] Create `hmi - Trigger - 2PageView (History Change)` (Custom Event)
- [ ] Add both conditions: count equals 2 AND consent equals true
- [ ] Verify event name matches actual dataLayer event

**Testing:**
- [ ] Test in GTM Preview Mode across 3+ pages
- [ ] Verify counter increments correctly (1, 2, 3, ...)
- [ ] Verify trigger fires only when count=2 and consent=true
- [ ] Verify tags fire exactly once per session
- [ ] Test with and without consent to confirm gating works
- [ ] Test counter reset by closing and reopening tab

**Documentation:**
- [ ] Document which OneTrust consent category gates firing (`INSERT.ONETRUST.CONSENT.DESCRIPTION`)
- [ ] Note any custom event names or non-standard configurations
- [ ] Share this README with stakeholders for reference

**Deployment:**
- [ ] Submit changes with clear version name (e.g., "2PageView tracking with OneTrust consent")
- [ ] Publish container to production
- [ ] Monitor tags in GTM Dashboard to confirm live firing

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Implementation Type:** Non-SPA / Traditional Multi-Page Website  
**Consent Platform:** OneTrust

For questions or issues, contact your GTM administrator or implementation team.
