/**
 * LeMMA calendar sync (Google Apps Script).
 *
 * Copies events from the members' calendar to the public calendar the website
 * reads, and tags each copy #meeting, #talk or #social so the site colours it.
 * Covers the past 12 months and next 6 months. Runs every 15 minutes once set up. See "Syncing from the members' calendar"
 * in README.md for setup.
 *
 * - Only events the script created are ever changed or removed on the public
 *   calendar. Events added there by hand are left alone.
 * - To keep an event off the website, delete its copy on the public calendar.
 *   The script remembers this and won't copy that event again.
 * - Edits made to a copy on the public calendar stay until the original event
 *   is edited, at which point the copy is refreshed from the original.
 * - Events marked "Private" in Google Calendar are never copied.
 */

// ---------- Settings ----------

const SOURCE_CALENDAR_ID = ""; // the members' calendar, e.g. "abc123@group.calendar.google.com"
const PUBLIC_CALENDAR_ID = ""; // the public calendar the website reads
const MONTHS_BACK = 12; // past events to copy (the website shows a year back)
const MONTHS_AHEAD = 6;

// Words in an event's title that set its type. A #meeting, #talk or #social
// tag already in the title or description always wins. Anything that matches
// neither list is a meeting.
const TALK_WORDS = ["talk", "seminar", "lecture", "colloquium", "speaker", "presentation"];
const SOCIAL_WORDS = ["social", "game", "games", "party", "poker", "trivia", "movie", "picnic", "dinner", "lunch", "hangout"];

// Events whose title contains any of these (ignoring case) are never copied,
// e.g. ["board meeting"]. Copies that already exist are removed.
const SKIP_TITLES = [];

// Used by restoreHidden(): bring back hidden events whose title contains this
// text. Leave empty to bring back all of them.
const RESTORE_TITLE = "";

// ---------- Run these from the Apps Script editor ----------

// Run once to start syncing every 15 minutes (and sync right away).
function setup() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "sync")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("sync").timeBased().everyMinutes(15).create();
  sync();
}

// Lists the events you've hidden by deleting their copy (see Execution log).
function listHidden() {
  const hidden = hiddenEntries();
  if (!hidden.length) Logger.log("No hidden events.");
  hidden.forEach((h) => Logger.log(`${h.title} (${h.end})`));
}

// Un-hides events (see RESTORE_TITLE above). They come back on the next sync.
function restoreHidden() {
  const props = PropertiesService.getScriptProperties();
  const match = RESTORE_TITLE.toLowerCase();
  hiddenEntries()
    .filter((h) => h.title.toLowerCase().includes(match))
    .forEach((h) => {
      props.deleteProperty(h.key);
      Logger.log(`Restored: ${h.title} (${h.end})`);
    });
  sync();
}

// ---------- Sync ----------

const COPY = "copy:"; // copy:<source event id> -> {id, updated, end}
const HIDDEN = "hidden:"; // hidden:<source event id> -> {title, end}
const SOURCE_KEY = "lemmaSource"; // stored on each copy: the source event id

function sync() {
  if (!SOURCE_CALENDAR_ID || !PUBLIC_CALENDAR_ID) {
    throw new Error("Fill in SOURCE_CALENDAR_ID and PUBLIC_CALENDAR_ID at the top of the script.");
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) return; // the previous run is still going
  try {
    runSync();
  } finally {
    lock.releaseLock();
  }
}

function runSync() {
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperties();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(today);
  from.setMonth(from.getMonth() - MONTHS_BACK);
  const to = new Date(today);
  to.setMonth(to.getMonth() + MONTHS_AHEAD);

  // Repeating events come back as one entry per date, each with its own id.
  const sources = listEvents(SOURCE_CALENDAR_ID, from, to).filter(shouldCopy);
  const copies = {};
  listEvents(PUBLIC_CALENDAR_ID, from, to).forEach((ev) => {
    const sourceId = ev.extendedProperties && ev.extendedProperties.private && ev.extendedProperties.private[SOURCE_KEY];
    if (sourceId) copies[sourceId] = ev;
  });

  const seen = {};
  sources.forEach((src) => {
    seen[src.id] = true;
    if (stored[HIDDEN + src.id]) return;

    const record = stored[COPY + src.id] ? JSON.parse(stored[COPY + src.id]) : null;
    // The copy may sit outside the date range if the original was moved.
    const copy = copies[src.id] || (record && getEvent(PUBLIC_CALENDAR_ID, record.id));

    if (copy) {
      if (!record || record.updated !== src.updated) {
        Calendar.Events.update(publicVersion(src), PUBLIC_CALENDAR_ID, copy.id);
      }
      props.setProperty(COPY + src.id, JSON.stringify({ id: copy.id, updated: src.updated, end: endOf(src) }));
    } else if (record) {
      // A copy was made before and is gone, so someone deleted it on the
      // public calendar. Remember that and don't copy this event again.
      props.setProperty(HIDDEN + src.id, JSON.stringify({ title: src.summary, end: endOf(src) }));
      props.deleteProperty(COPY + src.id);
    } else {
      const made = Calendar.Events.insert(publicVersion(src), PUBLIC_CALENDAR_ID);
      props.setProperty(COPY + src.id, JSON.stringify({ id: made.id, updated: src.updated, end: endOf(src) }));
      Utilities.sleep(150); // stay under Google's limit on creating events quickly
    }
  });

  // Remove copies whose original was deleted, moved out of range or is now skipped.
  Object.keys(copies).forEach((sourceId) => {
    if (seen[sourceId]) return;
    Calendar.Events.remove(PUBLIC_CALENDAR_ID, copies[sourceId].id);
    props.deleteProperty(COPY + sourceId);
  });

  forgetOldEntries(props, from);
}

function shouldCopy(src) {
  if (src.status === "cancelled" || !src.summary) return false;
  if (src.visibility === "private" || src.visibility === "confidential") return false;
  const title = src.summary.toLowerCase();
  return !SKIP_TITLES.some((t) => title.includes(t.toLowerCase()));
}

// What the public copy looks like. Guests and video-call links aren't copied.
function publicVersion(src) {
  const type = eventType(src);
  const title = removeTags(src.summary);
  const description = removeTags(src.description || "");
  return {
    summary: title || src.summary,
    location: src.location || "",
    description: (description ? description + "\n\n" : "") + "#" + type,
    start: src.start,
    end: src.end,
    extendedProperties: { private: { [SOURCE_KEY]: src.id } },
  };
}

function eventType(src) {
  const tag = `${src.summary || ""} ${src.description || ""}`.match(/#(meeting|talk|social)\b/i);
  if (tag) return tag[1].toLowerCase();
  const title = (src.summary || "").toLowerCase();
  if (hasWord(title, TALK_WORDS)) return "talk";
  if (hasWord(title, SOCIAL_WORDS)) return "social";
  return "meeting";
}

function hasWord(text, words) {
  return words.some((w) => new RegExp(`\\b${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text));
}

function removeTags(text) {
  return text.replace(/#(meeting|talk|social)\b/gi, "").replace(/[ \t]{2,}/g, " ").trim();
}

// ---------- Helpers ----------

function listEvents(calendarId, from, to) {
  const items = [];
  let pageToken;
  do {
    const page = Calendar.Events.list(calendarId, {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: true,
      maxResults: 2500,
      pageToken,
    });
    items.push(...(page.items || []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items;
}

// Returns the event, or null if it has been deleted.
function getEvent(calendarId, eventId) {
  try {
    const ev = Calendar.Events.get(calendarId, eventId);
    return ev && ev.status !== "cancelled" ? ev : null;
  } catch (err) {
    if (/not found|deleted|404|410/i.test(String(err && err.message))) return null;
    throw err;
  }
}

function endOf(ev) {
  return ev.end.dateTime || ev.end.date;
}

function hiddenEntries() {
  const all = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(all)
    .filter((key) => key.startsWith(HIDDEN))
    .map((key) => ({ key, ...JSON.parse(all[key]) }))
    .sort((a, b) => String(a.end).localeCompare(String(b.end)));
}

// Drops records of events that have fallen out of the date range, so storage
// stays small. (Records inside the range are what keep hidden events hidden.)
function forgetOldEntries(props, from) {
  const cutoff = new Date(from.getTime() - 7 * 24 * 60 * 60 * 1000);
  const all = props.getProperties();
  Object.keys(all).forEach((key) => {
    if (!key.startsWith(COPY) && !key.startsWith(HIDDEN)) return;
    const end = new Date(JSON.parse(all[key]).end);
    if (end < cutoff) props.deleteProperty(key);
  });
}
