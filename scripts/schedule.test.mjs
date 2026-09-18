import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  EXPIRY_SLACK_MS,
  SCHEDULE_PATTERN,
  instantOf,
  isLongExpired,
  toFeedValue,
} from './schedule.mjs'

const iso = ms => new Date(ms).toISOString()

describe('instantOf', () => {
  test('a bare date starts at midnight Pacific', () => {
    // January is PST, eight hours behind UTC.
    assert.equal(iso(instantOf('2026-01-15', 'start')), '2026-01-15T08:00:00.000Z')
  })

  test('a bare date ends at the end of that day, not the start', () => {
    assert.equal(iso(instantOf('2026-01-15', 'end')), '2026-01-16T08:00:00.000Z')
  })

  test('a whole day is exactly 24 hours long', () => {
    const day = instantOf('2026-01-15', 'end') - instantOf('2026-01-15', 'start')
    assert.equal(day, 24 * 60 * 60 * 1000)
  })

  test('a time is read as Pacific in winter', () => {
    assert.equal(iso(instantOf('2026-01-15 16:00', 'start')), '2026-01-16T00:00:00.000Z')
  })

  test('a time is read as Pacific in summer, an hour further ahead', () => {
    // July is PDT, seven hours behind UTC.
    assert.equal(iso(instantOf('2026-07-15 16:00', 'start')), '2026-07-15T23:00:00.000Z')
  })

  test('edge is ignored once a time is given', () => {
    assert.equal(
      instantOf('2026-01-15 16:00', 'end'),
      instantOf('2026-01-15 16:00', 'start')
    )
  })

  test('rolls into the next month at the end of the last day', () => {
    assert.equal(iso(instantOf('2026-01-31', 'end')), '2026-02-01T08:00:00.000Z')
  })

  test('rolls into the next year', () => {
    assert.equal(iso(instantOf('2026-12-31', 'end')), '2027-01-01T08:00:00.000Z')
  })

  // The hour that does not exist locally, and the hour that happens twice.
  describe('across a daylight saving change', () => {
    test('a day that is 23 hours long is still one day', () => {
      const start = instantOf('2026-03-08', 'start')
      const end = instantOf('2026-03-08', 'end')
      assert.equal(end - start, 23 * 60 * 60 * 1000)
    })

    test('a day that is 25 hours long is still one day', () => {
      const start = instantOf('2026-11-01', 'start')
      const end = instantOf('2026-11-01', 'end')
      assert.equal(end - start, 25 * 60 * 60 * 1000)
    })

    test('a time after the spring change is on the summer offset', () => {
      assert.equal(iso(instantOf('2026-03-08 12:00', 'start')), '2026-03-08T19:00:00.000Z')
    })
  })
})

describe('toFeedValue', () => {
  test('leaves a bare date alone, so consumers resolve it against their own day', () => {
    assert.equal(toFeedValue('2026-01-15'), '2026-01-15')
  })

  test('turns a time into an absolute instant', () => {
    assert.equal(toFeedValue('2026-01-15 16:00'), '2026-01-16T00:00:00.000Z')
  })

  test('passes null through', () => {
    assert.equal(toFeedValue(null), null)
    assert.equal(toFeedValue(undefined), null)
  })
})

describe('isLongExpired', () => {
  const now = Date.parse('2026-03-20T12:00:00Z')

  test('never expires without an expiry', () => {
    assert.equal(isLongExpired(null, now), false)
  })

  test('keeps one that expires today', () => {
    assert.equal(isLongExpired('2026-03-20', now), false)
  })

  test('keeps yesterday, because somewhere it is still yesterday', () => {
    assert.equal(isLongExpired('2026-03-19', now), false)
  })

  test('drops one that expired a week ago', () => {
    assert.equal(isLongExpired('2026-03-13', now), true)
  })

  test('holds a timed one for the full slack period', () => {
    const justInside = iso(now - EXPIRY_SLACK_MS + 60_000).slice(0, 16).replace('T', ' ')
    assert.equal(isLongExpired(justInside, now), false)
  })
})

describe('the schema and the parser agree', () => {
  test('schema.json validates exactly what instantOf can read', () => {
    const schema = JSON.parse(readFileSync('schema.json', 'utf8'))
    assert.equal(schema.properties.starts.pattern, SCHEDULE_PATTERN)
    assert.equal(schema.properties.expires.pattern, SCHEDULE_PATTERN)
  })

  test('the pattern accepts a date and a date with a time', () => {
    const pattern = new RegExp(SCHEDULE_PATTERN)
    assert.ok(pattern.test('2026-03-14'))
    assert.ok(pattern.test('2026-03-14 16:00'))
  })

  test('the pattern rejects what would be read wrong', () => {
    const pattern = new RegExp(SCHEDULE_PATTERN)
    assert.ok(!pattern.test('2026-3-14'))
    assert.ok(!pattern.test('14/03/2026'))
    assert.ok(!pattern.test('2026-03-14 4pm'))
    assert.ok(!pattern.test('2026-03-14T16:00'))
    assert.ok(!pattern.test('2026-03-14 16:00:00'))
  })
})
