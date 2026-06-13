/**
 * All the volatile bits of yuc.wiki's markup live here, in ONE place.
 *
 * The site keeps renaming its CSS classes between seasons
 * (date_title -> date_title1/2 -> date_title_ -> date_title__,
 *  imgtext -> imgtext3_/imgtext4/imgtext5, ...). So the parser never matches
 * exact class names: it anchors on the things that have stayed stable across
 * versions, and uses *contains* matches for the classes that drift.
 *
 * Stable anchors (unchanged across 202407 / 202601 / 202604):
 *   - weekday headers carry `.date2` with literal names 周一…周日 + extra categories
 *   - the cover image is the only `<img width="120px">` in an entry
 *   - air time is text shaped like `HH:MM~`
 *
 * If the site ever changes drastically, this is the single file to tweak.
 */
export const parseRules = {
  // Weekday / category header cell. Its text is the display name.
  weekdaySelector: ".date2",
  // The cover image — width="120px" has been identical across every version.
  coverSelector: 'img[width="120px"]',
  // Title cell. Class drifts (date_title_, date_title__, ...) -> match by substring.
  titleSelector: '[class*="date_title"]',
  // First-air date cell (e.g. "4/6~"). Optional.
  epSelector: '[class*="imgep"]',
  // Broadcast region/platform label.
  areaSelector: ".area",
  // Air time, matched on CONTENT not class — survives any class rename.
  timeRegex: /(\d{1,2}):(\d{2})/,
  startDateRegex: /(\d{1,2}\/\d{1,2})/,
  // Known cover CDN hosts (kept in sync with capabilities http scope).
  imageHosts: ["hdslb.com", "imgs.ovh"],
};
