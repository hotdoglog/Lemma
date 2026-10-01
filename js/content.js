// Everything the club updates week to week lives in this file.
// Edit the values below, save, and the site updates. No build step needed.

window.LEMMA = {
  club: {
    name: "LeMMA",
    meeting: "Fridays 5:30-6:30 pm",
    location: "Warren Weaver Hall",
    // Leave a value empty ("") to hide its link.
    instagram: "https://www.instagram.com/lemma.courant.nyu/",
    email: "", // e.g. "lemmaclub@university.edu"
    // The calendar and the home page's upcoming events come from this Google
    // Calendar. See "Events from Google Calendar" in README.md.
    googleCalendar: {
      calendarId: "c_a4077f732a97d9bc85ab58b53fe693c251c0260f543a4281ae719fc7b33a5f9a@group.calendar.google.com", // e.g. "abc123@group.calendar.google.com"
      apiKey: "AIzaSyAnCUTlpg9vZnmVGsqwLKMHenMQC0SNSPA", // a browser API key restricted to the Calendar API
    },
    // Shows a "draft" note at the top of every page. Set to false once the
    // placeholder names and photos below have been replaced.
    draft: false,
  },

  // Board members, shown as circles on the Leadership page.
  // photo: path to a square-ish image, e.g. "assets/leaders/president.jpg".
  //        Leave it empty to show the glyph instead.
  // links: remove a line (or leave it "") to hide that button.
  leaders: [
    {
      name: "Leyla Sözen-Kohl",
      role: "President",
      details: "MS in Mathematics",
      photo: "assets/leaders/leyla.jpg",
      glyph: "∑",
      links: { website: "", cv: "", linkedin: "https://www.linkedin.com/in/leylasozen-kohl/" },
    },
    {
      name: "Juan Camilo Gonzalez",
      role: "Vice President",
      details: "MS in Mathematics",
      photo: "assets/leaders/juan.jpeg",
      glyph: "ε",
      links: { website: "https://juancagc.github.io/", cv: "", linkedin: "" },
    },
    {
      name: "Ashley Sobolewski",
      role: "Treasurer",
      details: "Master of Science",
      photo: "assets/leaders/ashley.jpeg",
      glyph: "∫",
      links: { website: "", cv: "", linkedin: "" },
    },
    {
      name: "Sage Harley",
      role: "Secretary",
      details: "MS in Scientific Computing",
      photo: "assets/leaders/sage.jpeg",
      glyph: "π",
      links: { website: "", cv: "", linkedin: "" },
    },
    {
      name: "Jose De Luna",
      role: "HR",
      details: "MS in Mathematics",
      photo: "assets/leaders/jose.jpg",
      glyph: "∂",
      links: { website: "", cv: "", linkedin: "" },
    },
  ],
};
