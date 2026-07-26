// The screen shapes this app is judged against, shared by the layout spec (which
// asserts nothing clips at any of them) and tools/shots.mjs (which renders them).
// One list, so a device added for a bug is automatically covered by both.
//
// Heights are real Safari innerHeight with the browser chrome already subtracted —
// what a player actually gets, not the spec sheet. That distinction is the whole
// reason the landscape entries are so short: an iPhone 13 is 390px tall in landscape
// on paper and ~300px in a browser, and the missing 90px is where layout breaks.
// Installed as a PWA there is no chrome and the same device has the full height,
// which is why bugs here show up in the browser and not in the installed app.

/** @typedef {{name:string, w:number, h:number}} Device */

/** @type {Device[]} */
export const DEVICES = [
  { name: 'iPhone 13 portrait', w: 390, h: 664 },
  { name: 'iPhone 13 landscape', w: 844, h: 300 },
  { name: 'iPhone 13 landscape PWA', w: 844, h: 390 },
  { name: 'iPhone Pro Max portrait', w: 430, h: 752 },
  { name: 'iPhone Pro Max landscape', w: 932, h: 340 },
  { name: 'iPad Mini portrait', w: 744, h: 1053 },
  { name: 'iPad Mini landscape', w: 1133, h: 664 },
  { name: 'Desktop', w: 1440, h: 900 },
];
