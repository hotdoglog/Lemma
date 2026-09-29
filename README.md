# LeMMA website

A static website for LeMMA, with four pages:

| Page | File | What's on it |
| --- | --- | --- |
| Home | `index.html` | Group photo, the club name in the upper left, the next three events, how to join |
| About us | `about.html` | What the club is, what it does, who can join |
| Leadership | `leadership.html` | Board members in circles, each with a short description and Website / CV / LinkedIn links |
| Events | `events.html` | Month calendar plus a list of that month's events |

It is plain HTML, CSS and JavaScript, with no build step and no dependencies.

## Updating the content

Almost everything you'll change week to week is in **`js/content.js`**:

- **`club`**: meeting time, room, Instagram link, email and the Google Calendar settings. Leave a link empty to hide it.
- **`leaders`**: one entry per board member (name, role, details, photo and links).

Events aren't in this file. They come from Google Calendar (see below).

The site currently shows placeholder names and photos. Once you've replaced them, set `draft: false` in `js/content.js` to remove the "Draft site" note at the top of each page.

### Photos

- **Group photo:** save it as `assets/group-photo.jpg`. A wide landscape photo works best.
- **Board photos:** put them in `assets/leaders/`, e.g. `assets/leaders/president.jpg`, and set that path as the person's `photo` in `js/content.js`. Square photos with the face centred look best in the circles.

Until a photo is added, the site shows a graph-paper placeholder instead.

### Page text

The text on the home and about pages is written directly in `index.html` and `about.html`. Edit it there.

## Events from Google Calendar

The calendar and the "Next on the calendar" list can read their events from a Google Calendar, so board members can add events in Google Calendar and the site updates on its own.

### One-time setup

1. **Make the calendar.** In [Google Calendar](https://calendar.google.com), next to **Other calendars**, click **+ → Create new calendar** and name it (e.g. "LeMMA events").
2. **Make it public.** Open the calendar's **Settings and sharing**. Under **Access permissions for events**, tick **Make available to public** and choose **See all event details**. The site can only read public calendars.
3. **Share editing.** Under **Share with specific people or groups**, add each board member with **Make changes to events**.
4. **Copy the calendar ID.** Under **Integrate calendar**, copy the **Calendar ID** (it looks like `abc123@group.calendar.google.com`).
5. **Create an API key.** In the [Google Cloud console](https://console.cloud.google.com):
   - Create a project (any name).
   - Go to **APIs & Services → Library**, search for **Google Calendar API** and click **Enable**.
   - Go to **APIs & Services → Credentials → Create credentials → API key**.
   - Edit the key. Under **Application restrictions**, choose **Websites** and add the site's addresses, e.g. `http://localhost:8080/*` and `https://<your-username>.github.io/*`. Under **API restrictions**, choose **Restrict key** and select only **Google Calendar API**. Save.
6. **Fill in `js/content.js`.** Paste both values into `club.googleCalendar`:

   ```js
   googleCalendar: {
     calendarId: "abc123@group.calendar.google.com",
     apiKey: "AIza...",
   },
   ```

The API key is visible to anyone who views the page source. That's normal for this kind of key: the restrictions in step 5 mean it only works for reading calendars, and only from your site.

### Adding events

Add events in Google Calendar as usual. The site uses the event's title, time, location and description. If an event has no location, the club's `location` is shown.

To set an event's type (which sets its colour on the site), put one of these tags anywhere in the description: `#meeting`, `#talk` or `#social`. Events without a tag show as meetings. The tag itself is hidden on the site.

Repeating events, all-day events and cancelled events are all handled. The site shows events from a year back to a year ahead.

## Previewing locally

Open `index.html` in a browser, or run a small local server from this folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Publishing with GitHub Pages

1. Push this folder's contents to the root of the repository's `main` branch.
2. In the repository on GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

GitHub Pages is free for public repositories. Publishing Pages from a private repository needs a paid GitHub plan.
