import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUILD = join(HERE, 'build.mjs')
const SCHEMA = join(HERE, '..', 'schema.json')

let workspace

/** An announcement file, written the way an author writes one. */
const write = (name, frontmatter, body = 'Something happened.') => {
  const lines = Object.entries(frontmatter).map(([key, value]) => `${key}: ${value}`)
  writeFileSync(
    join(workspace, 'announcements', `${name}.md`),
    ['---', ...lines, '---', '', body, ''].join('\n')
  )
}

/** Runs the real build against the temp workspace. */
const build = () => {
  const result = spawnSync(process.execPath, [BUILD], {
    cwd: workspace,
    encoding: 'utf8',
  })
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    feed: () => JSON.parse(readFileSync(join(workspace, 'dist', 'announcements.json'), 'utf8')),
  }
}

const dayOffset = days => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'announcements-'))
  mkdirSync(join(workspace, 'announcements'))
  copyFileSync(SCHEMA, join(workspace, 'schema.json'))
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('publishing', () => {
  test('publishes an announcement with the defaults filled in', () => {
    write('2026-03-14-hello', { title: 'Hello', level: 'info' })

    const result = build()

    assert.equal(result.status, 0)
    assert.deepEqual(result.feed(), [
      {
        id: '2026-03-14-hello',
        title: 'Hello',
        level: 'info',
        type: 'announcement',
        pinned: false,
        testing: false,
        apps: ['landing-page', 'sae', 'vpe'],
        starts: null,
        expires: null,
        description: 'Something happened.',
        body: '<p>Something happened.</p>',
        descriptionUrl: null,
      },
    ])
  })

  test('skips the template', () => {
    write('_template', { title: 'Template', level: 'info' })
    write('2026-03-14-real', { title: 'Real', level: 'info' })

    assert.deepEqual(
      build()
        .feed()
        .map(a => a.id),
      ['2026-03-14-real']
    )
  })

  test('puts pinned first, then newest first', () => {
    write('2026-03-10-old', { title: 'Old', level: 'info', starts: '2026-03-10' })
    write('2026-03-12-new', { title: 'New', level: 'info', starts: '2026-03-12' })
    write('2026-03-11-pin', { title: 'Pin', level: 'info', starts: '2026-03-11', pinned: true })

    assert.deepEqual(
      build()
        .feed()
        .map(a => a.title),
      ['Pin', 'New', 'Old']
    )
  })
})

describe('times', () => {
  test('leaves a bare date for the consumer to resolve', () => {
    const tomorrow = dayOffset(1)
    write('2026-03-14-day', { title: 'All day', level: 'info', expires: tomorrow })

    assert.equal(build().feed()[0].expires, tomorrow)
  })

  test('turns a written time into an absolute instant', () => {
    write('2027-01-15-window', {
      title: 'Maintenance',
      level: 'danger',
      starts: '2027-01-15 16:00',
      expires: '2027-01-15 18:00',
    })

    const entry = build().feed()[0]
    // 4pm Pacific in January is midnight UTC.
    assert.equal(entry.starts, '2027-01-16T00:00:00.000Z')
    assert.equal(entry.expires, '2027-01-16T02:00:00.000Z')
  })

  test('reads an unquoted time as Pacific, not UTC', () => {
    write('2027-07-15-summer', {
      title: 'Summer window',
      level: 'info',
      starts: '2027-07-15 16:00',
    })

    assert.equal(build().feed()[0].starts, '2027-07-15T23:00:00.000Z')
  })
})

describe('expiry', () => {
  test('keeps one that expires today, because the day is not over', () => {
    write('2026-03-14-today', { title: 'Today', level: 'info', expires: dayOffset(0) })

    assert.equal(build().feed().length, 1)
  })

  test('keeps yesterday, since somewhere it is still yesterday', () => {
    write('2026-03-14-yesterday', { title: 'Yesterday', level: 'info', expires: dayOffset(-1) })

    assert.equal(build().feed().length, 1)
  })

  test('leaves out one that expired long ago', () => {
    write('2022-07-28-gone', { title: 'Gone', level: 'info', expires: '2022-07-29' })
    write('2026-03-14-live', { title: 'Live', level: 'info' })

    const result = build()

    assert.deepEqual(
      result.feed().map(a => a.title),
      ['Live']
    )
    assert.match(result.output, /Left out 1 expired announcement/)
    assert.match(result.output, /2022-07-28-gone/)
  })

  test('an expired file is left out, not treated as an error', () => {
    write('2022-07-28-gone', { title: 'Gone', level: 'info', expires: '2022-07-29' })

    assert.equal(build().status, 0)
  })
})

describe('rejecting what an author got wrong', () => {
  const expectRejected = (frontmatter, message) => {
    write('2026-03-14-bad', frontmatter)

    const result = build()

    assert.equal(result.status, 1)
    assert.match(result.output, message)
  }

  test('a date in the wrong shape', () => {
    expectRejected(
      { title: 'Bad', level: 'info', expires: '14/03/2026' },
      /"expires" must be a date written as YYYY-MM-DD/
    )
  })

  test('a time in the wrong shape', () => {
    expectRejected(
      { title: 'Bad', level: 'info', expires: '2026-03-14 4pm' },
      /add a 24-hour time after it/
    )
  })

  test('an expiry before the start', () => {
    expectRejected(
      { title: 'Bad', level: 'info', starts: '2026-03-14', expires: '2026-03-10' },
      /is before "starts"/
    )
  })

  test('an expiry before the start on the same day, by time', () => {
    expectRejected(
      { title: 'Bad', level: 'info', starts: '2026-03-14 18:00', expires: '2026-03-14 16:00' },
      /is before "starts"/
    )
  })

  test('an unknown app', () => {
    expectRejected(
      { title: 'Bad', level: 'info', apps: '[form]' },
      /must be one of: landing-page, sae, vpe/
    )
  })

  test('a level that is not a level', () => {
    expectRejected(
      { title: 'Bad', level: 'critical' },
      /"level" must be one of: info, success, warning, danger/
    )
  })

  test('a testing flag that is not true or false', () => {
    expectRejected({ title: 'Bad', level: 'info', testing: 'yes' }, /"testing" must be boolean/)
  })

  // The whole point of failing loudly: a bad commit must not take the banner down.
  test('leaves the announcements that were already published alone', () => {
    mkdirSync(join(workspace, 'dist'))
    const published = '[{"id":"already-live"}]\n'
    writeFileSync(join(workspace, 'dist', 'announcements.json'), published)
    write('2026-03-14-bad', { title: 'Bad', level: 'nope' })

    const result = build()

    assert.equal(result.status, 1)
    assert.equal(readFileSync(join(workspace, 'dist', 'announcements.json'), 'utf8'), published)
  })

  test('one bad file stops the whole publish, not just itself', () => {
    write('2026-03-14-good', { title: 'Good', level: 'info' })
    write('2026-03-14-bad', { title: 'Bad', level: 'nope' })

    assert.equal(build().status, 1)
  })
})
