// Turning what an author writes into instants.
//
// An author writes `2026-03-14` or `2026-03-14 16:00`. A bare date covers the
// whole day; a time is their local wall clock, in TIME_ZONE. Everything here
// resolves those to absolute instants so nothing downstream has to guess.

/** The timezone an author writes times in. */
export const TIME_ZONE = 'America/Los_Angeles'

/** What an author may write for `starts` and `expires`. */
export const SCHEDULE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}( \\d{2}:\\d{2})?$'

// Expired announcements are dropped from the feed rather than shipped for every
// consumer to filter out. Git keeps the file; the feed is only what is live.
//
// Two days of slack: a bare date means "end of that day" in the *viewer's* own
// timezone, and local dates around the world span 26 hours, so anything less
// risks dropping something a consumer would still be showing.
export const EXPIRY_SLACK_MS = 48 * 60 * 60 * 1000

/** How far TIME_ZONE is from UTC, in ms, at a given instant. */
function zoneOffsetMs(instantMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs))

  const value = type => Number(parts.find(part => part.type === type).value)
  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour') % 24,
    value('minute'),
    value('second')
  )
  return asUtc - instantMs
}

/**
 * A wall-clock time in TIME_ZONE as an absolute instant.
 *
 * Converted twice, because the offset to apply depends on the instant being
 * converted — which is exactly what changes across a DST boundary.
 */
function instantFrom(year, month, day, hour, minute) {
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  let instant = wall - zoneOffsetMs(wall)
  instant = wall - zoneOffsetMs(instant)
  return instant
}

/**
 * The instant a schedule value refers to.
 *
 * `edge` matters only for a bare date, which covers the whole day: it starts at
 * midnight and ends at midnight the next day, so `expires: 2026-03-14` runs to
 * the end of the 14th.
 */
export function instantOf(value, edge) {
  const [date, time] = value.split(' ')
  const [year, month, day] = date.split('-').map(Number)

  if (time) {
    const [hour, minute] = time.split(':').map(Number)
    return instantFrom(year, month, day, hour, minute)
  }

  return instantFrom(year, month, edge === 'end' ? day + 1 : day, 0, 0)
}

/**
 * What goes in the feed. A bare date stays a date — consumers resolve it against
 * the viewer's own day, which is what "all day Friday" should mean. A time
 * becomes an instant, because 4pm Pacific is one moment everywhere.
 */
export function toFeedValue(value) {
  if (!value) return null
  return value.includes(' ') ? new Date(instantOf(value, 'start')).toISOString() : value
}

/** True once an announcement is far enough past its expiry to stop publishing. */
export function isLongExpired(expires, now = Date.now()) {
  if (!expires) return false
  return instantOf(expires, 'end') <= now - EXPIRY_SLACK_MS
}
