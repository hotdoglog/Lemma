// LeMMA — page behaviour. Content lives in js/content.js.
(function () {
  "use strict";

  const data = window.LEMMA || {};
  const club = data.club || {};
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const TYPE_LABEL = { meeting: "Meeting", talk: "Talk", social: "Social" };

  const ICONS = {
    website:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>',
    cv:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    linkedin:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V17M8 7.5v.01M11.5 17v-6.5M11.5 13.5c0-1.8 1-3 2.6-3s2.4 1.1 2.4 2.8V17"/></svg>',
  };
  const PERSON_LINKS = [
    ["website", "Website"],
    ["cv", "CV"],
    ["linkedin", "LinkedIn"],
  ];

  // ---------- Dates ----------

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parseDate = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monthLabel = (d) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function formatTime(hhmm) {
    if (!hhmm) return "";
    const [h, m] = hhmm.split(":").map(Number);
    const hour = h % 12 || 12;
    const suffix = h < 12 ? "am" : "pm";
    return (m ? `${hour}:${pad(m)}` : `${hour}`) + " " + suffix;
  }

  function timeRange(ev) {
    if (!ev.start) return "All day";
    const a = formatTime(ev.start);
    const b = formatTime(ev.end);
    if (!b) return a;
    // "6:30–8 pm" when both ends share am/pm
    return (a.slice(-2) === b.slice(-2) ? a.slice(0, -3) : a) + "–" + b;
  }

  const prepareEvents = (list) =>
    (list || [])
      .filter((ev) => ev && ev.date)
      .map((ev) => ({ ...ev, when: parseDate(ev.date) }))
      .sort((a, b) => a.when - b.when || String(a.start || "").localeCompare(String(b.start || "")));

  let events = [];
  let eventsFailed = false;

  // ---------- Google Calendar ----------

  // Reads events from a public Google Calendar. Put #talk, #social or
  // #meeting anywhere in an event's description to set its type.
  const gcal = club.googleCalendar || {};
  const useGoogle = Boolean(gcal.calendarId && gcal.apiKey);

  async function fetchGoogleEvents() {
    const from = new Date(today.getFullYear() - 1, today.getMonth(), 1);
    const to = new Date(today.getFullYear() + 1, today.getMonth() + 1, 1);
    const items = [];
    let pageToken = "";
    do {
      const params = new URLSearchParams({
        key: gcal.apiKey,
        singleEvents: "true",
        orderBy: "startTime",
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        maxResults: "2500",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(gcal.calendarId)}/events?${params}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Google Calendar returned ${res.status}`);
      const body = await res.json();
      items.push(...(body.items || []));
      pageToken = body.nextPageToken || "";
    } while (pageToken);
    return items.filter((item) => item.status !== "cancelled").map(fromGoogle);
  }

  function fromGoogle(item) {
    // Timed events come back as "2026-10-14T18:30:00-04:00" in the calendar's
    // own time zone, so the date and clock time can be read straight off.
    const start = item.start || {};
    const end = item.end || {};
    const timed = Boolean(start.dateTime);
    let description = htmlToText(item.description || "");
    let type = "meeting";
    const tag = description.match(/#(meeting|talk|social)\b/i);
    if (tag) {
      type = tag[1].toLowerCase();
      description = description.replace(tag[0], "").replace(/[ \t]{2,}/g, " ").trim();
    }
    return {
      date: timed ? start.dateTime.slice(0, 10) : start.date,
      start: timed ? start.dateTime.slice(11, 16) : "",
      end: timed && end.dateTime ? end.dateTime.slice(11, 16) : "",
      type,
      title: item.summary || "Untitled event",
      description,
      location: item.location || "",
    };
  }

  function htmlToText(html) {
    // DOMParser never runs scripts or loads images from the markup.
    const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n"), "text/html");
    return (doc.body.textContent || "").trim();
  }

  async function loadEvents() {
    if (!useGoogle) {
      console.error("No Google Calendar set up: fill in club.googleCalendar in js/content.js.");
      eventsFailed = true;
      return;
    }
    try {
      events = prepareEvents(await fetchGoogleEvents());
    } catch (err) {
      console.error("Could not load events from Google Calendar:", err);
      eventsFailed = true;
    }
  }

  const emptyMessage = (text) =>
    `<li class="ev-empty">${eventsFailed ? "Couldn't load the calendar right now. Please try again later." : text}</li>`;

  function eventItem(ev) {
    const d = ev.when;
    const type = TYPE_LABEL[ev.type] ? ev.type : "meeting";
    const meta = [timeRange(ev), ev.location || club.location].filter(Boolean).join(" · ");
    return `
      <li class="ev${d < today ? " is-past" : ""}" data-day="${dayKey(d)}" tabindex="-1">
        <time class="ev-date" datetime="${dayKey(d)}">
          <span class="ev-mon">${d.toLocaleDateString("en-US", { month: "short" })}</span>
          <span class="ev-day">${d.getDate()}</span>
          <span class="ev-dow">${d.toLocaleDateString("en-US", { weekday: "short" })}</span>
        </time>
        <div class="ev-body">
          <p class="tag" data-type="${type}">${TYPE_LABEL[type]}</p>
          <h3 class="ev-title">${esc(ev.title)}</h3>
          <p class="ev-meta">${esc(meta)}</p>
          ${ev.description ? `<p class="ev-desc">${esc(ev.description)}</p>` : ""}
        </div>
      </li>`;
  }

  // ---------- Header menu ----------

  const header = $(".site-header");
  const toggle = $(".nav-toggle");
  if (header && toggle) {
    toggle.addEventListener("click", () => {
      const open = header.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // ---------- Club details ----------

  const draftNote = $(".draft-note");
  if (draftNote) draftNote.hidden = !club.draft;

  $$("[data-club]").forEach((node) => {
    const value = club[node.dataset.club];
    if (value) node.textContent = value;
  });

  $$("[data-club-link]").forEach((link) => {
    const key = link.dataset.clubLink;
    const value = club[key];
    if (!value) {
      link.hidden = true;
      return;
    }
    link.hidden = false;
    link.href = key === "email" ? `mailto:${value}` : value;
    const text = $("[data-club-text]", link);
    if (text) text.textContent = value;
  });

  $$("[data-links]").forEach((group) => {
    const empty = $("[data-links-empty]", group);
    if (empty) empty.hidden = $$("a", group).some((a) => !a.hidden);
  });

  $$("[data-year]").forEach((node) => (node.textContent = new Date().getFullYear()));

  // ---------- Home: next events ----------

  function renderNextEvents() {
    const nextList = $("#next-events");
    if (!nextList) return;
    const count = Number(nextList.dataset.count) || 3;
    const upcoming = events.filter((ev) => ev.when >= today).slice(0, count);
    nextList.innerHTML = upcoming.length
      ? upcoming.map(eventItem).join("")
      : emptyMessage("Nothing on the calendar yet. Check back soon.");
  }

  // ---------- Leadership ----------

  const board = $("#board");
  if (board) {
    board.innerHTML = (data.leaders || []).map(personCard).join("");
  }

  function personCard(p) {
    const name = p.name || "";
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("");
    const links = PERSON_LINKS.map(([key, label]) => {
      const href = p.links && p.links[key];
      if (!href) return "";
      const external = /^https?:\/\//.test(href) ? ' target="_blank" rel="noopener"' : "";
      return `<a class="plink" href="${esc(href)}"${external} aria-label="${label}: ${esc(name)}" title="${label}">${ICONS[key]}</a>`;
    }).join("");

    return `
      <li class="person">
        <div class="avatar graph" data-photo>
          ${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(name)}" loading="lazy">` : ""}
          <span class="avatar-glyph" aria-hidden="true">${esc(p.glyph || initials)}</span>
        </div>
        <h3 class="person-name">${esc(name)}</h3>
        <p class="person-role">${esc(p.role)}</p>
        ${p.details ? `<p class="person-details">${esc(p.details)}</p>` : ""}
        ${links ? `<div class="person-links">${links}</div>` : ""}
      </li>`;
  }

  // ---------- Photos: show a placeholder until a real image exists ----------

  $$("[data-photo]").forEach((frame) => {
    const img = $("img", frame);
    const showPlaceholder = () => frame.classList.add("is-empty");
    if (!img || !img.getAttribute("src")) return showPlaceholder();
    if (img.complete && img.naturalWidth === 0) showPlaceholder();
    else img.addEventListener("error", showPlaceholder);
  });

  // ---------- Events: calendar ----------

  const needsEvents = $("#calendar") || $("#next-events");
  if (needsEvents) {
    loadEvents().then(() => {
      renderNextEvents();
      if ($("#calendar")) initCalendar();
    });
  }

  function initCalendar() {
    const grid = $("#cal-grid");
    const title = $("#cal-title");
    const list = $("#month-events");
    const listTitle = $("#month-title");

    const byDay = {};
    events.forEach((ev) => (byDay[dayKey(ev.when)] = byDay[dayKey(ev.when)] || []).push(ev));

    // Open on this month, or on the next month that has something coming up.
    const firstOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
    let view = firstOfMonth(today);
    const sameMonth = (d) => d.getFullYear() === view.getFullYear() && d.getMonth() === view.getMonth();
    const next = events.find((ev) => ev.when >= today);
    if (next && !sameMonth(next.when)) view = firstOfMonth(next.when);

    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    function render() {
      const y = view.getFullYear();
      const m = view.getMonth();
      const lead = new Date(y, m, 1).getDay();
      const days = new Date(y, m + 1, 0).getDate();
      const cells = Math.ceil((lead + days) / 7) * 7;

      title.textContent = monthLabel(view);

      let html = weekdays
        .map((w) => `<div class="cal-dow" aria-hidden="true"><span class="long">${w}</span><span class="short">${w[0]}</span></div>`)
        .join("");

      for (let i = 0; i < cells; i++) {
        const d = new Date(y, m, 1 - lead + i);
        const key = dayKey(d);
        const inMonth = d.getMonth() === m;
        const dayEvents = inMonth ? byDay[key] || [] : [];
        const cls = ["cal-cell", inMonth ? "" : "is-other", +d === +today ? "is-today" : ""].filter(Boolean).join(" ");
        const num = `<span class="cal-num">${d.getDate()}</span>`;

        if (dayEvents.length) {
          const chips = dayEvents
            .map((ev) => `<span class="chip" data-type="${esc(ev.type)}"><span class="dot"></span><span class="chip-label">${esc(ev.title)}</span></span>`)
            .join("");
          const label = `${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}: ${dayEvents.map((ev) => ev.title).join(", ")}`;
          html += `<button type="button" class="${cls}" data-day="${key}" aria-label="${esc(label)}">${num}<span class="chips">${chips}</span></button>`;
        } else {
          html += `<div class="${cls}">${num}</div>`;
        }
      }
      grid.innerHTML = html;

      const monthEvents = events.filter((ev) => sameMonth(ev.when));
      listTitle.textContent = `Events in ${view.toLocaleDateString("en-US", { month: "long" })}`;
      list.innerHTML = monthEvents.length
        ? monthEvents.map(eventItem).join("")
        : emptyMessage("Nothing scheduled this month yet.");
    }

    function shift(months) {
      view = new Date(view.getFullYear(), view.getMonth() + months, 1);
      render();
    }

    $("#cal-prev").addEventListener("click", () => shift(-1));
    $("#cal-next").addEventListener("click", () => shift(1));
    $("#cal-today").addEventListener("click", () => {
      view = firstOfMonth(today);
      render();
    });

    grid.addEventListener("click", (e) => {
      const cell = e.target.closest("button[data-day]");
      if (!cell) return;
      const items = $$(`.ev[data-day="${cell.dataset.day}"]`, list);
      if (!items.length) return;
      $$(".ev.is-highlight", list).forEach((n) => n.classList.remove("is-highlight"));
      items.forEach((n) => n.classList.add("is-highlight"));
      items[0].scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      items[0].focus({ preventScroll: true });
    });

    render();
  }
})();
