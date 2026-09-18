// Builds announcements/*.md into dist/announcements.json.
//
// Exits non-zero on any invalid file. That is deliberate: the workflow's deploy
// step only runs when this succeeds, so a bad commit leaves the previously
// published announcements.json serving instead of taking the banner down.
//
// Error messages here are read by announcement authors in a GitHub email, not
// by developers. Keep them plain.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'
import matter from 'gray-matter'
import yaml from 'js-yaml'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { instantOf, isLongExpired, toFeedValue } from './schedule.mjs'

const SOURCE_DIR = 'announcements'
const OUTPUT_DIR = 'dist'
const OUTPUT_FILE = join(OUTPUT_DIR, 'announcements.json')
const ALL_APPS = ['landing-page', 'sae', 'vpe']
const DEFAULT_TYPE = 'announcement'

// YAML would turn an unquoted 2026-03-14 into a Date, and 2026-03-14 16:00:00
// into another one read as UTC — which is not the timezone the author meant.
// Parsing with the core schema keeps every value a plain string, so schedule.mjs
// is the only thing that interprets a date or a time.
const yamlEngine = source => yaml.load(source, { schema: yaml.CORE_SCHEMA })

const ajv = new Ajv({ allErrors: true })
addFormats(ajv)
const validate = ajv.compile(JSON.parse(readFileSync('schema.json', 'utf8')))

const problems = []

// Turn an Ajv error into something an author can act on.
function explain(error) {
  const field = error.instancePath.replace(/^\//, '') || error.params.additionalProperty
  switch (error.keyword) {
    case 'required':
      return `"${error.params.missingProperty}" is missing — every announcement needs one`
    case 'additionalProperties':
      return `"${error.params.additionalProperty}" is not a field you can use here — check it for typos`
    case 'enum':
      return `"${field}" must be one of: ${error.params.allowedValues.join(', ')}`
    case 'pattern':
      return `"${field}" must be a date written as YYYY-MM-DD, for example 2026-03-14 — ` +
        'add a 24-hour time after it for a specific moment, like 2026-03-14 16:00'
    case 'format':
      return `"${field}" must be a full web address starting with https://`
    case 'type':
      return `"${field}" must be ${error.params.type}`
    default:
      return `"${field}" ${error.message}`
  }
}

function toPlainText(markdown) {
  return sanitizeHtml(marked.parseInline(markdown), { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim()
}

function toSafeHtml(markdown) {
  return sanitizeHtml(marked.parse(markdown), {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote',
      'ul', 'ol', 'li', 'a', 'h3', 'h4', 'h5', 'h6', 'hr',
    ],
    // target/rel have to be allowed here as well as set in transformTags below —
    // sanitize-html applies the allowlist *after* the transform, so leaving them
    // out silently strips the attributes the transform just added.
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
    },
  }).trim()
}

const files = readdirSync(SOURCE_DIR)
  .filter(name => name.endsWith('.md') && !name.startsWith('_'))
  .sort()

const announcements = []
const expired = []

for (const file of files) {
  const path = join(SOURCE_DIR, file)
  const id = basename(file, '.md')
  const fileProblems = []

  let parsed
  try {
    parsed = matter(readFileSync(path, 'utf8'), { engines: { yaml: yamlEngine } })
  } catch {
    problems.push([path, ['the block of settings at the top of the file could not be read — ' +
      'check that it starts and ends with a line of three dashes (---) and that every line ' +
      'looks like "name: value"']])
    continue
  }

  const { content } = parsed
  const data = parsed.data

  if (!validate(data)) {
    fileProblems.push(...validate.errors.map(explain))
  }

  // Only worth checking once both parsed; a malformed value is already reported.
  if (
    typeof data.starts === 'string' &&
    typeof data.expires === 'string' &&
    !fileProblems.length &&
    instantOf(data.expires, 'end') <= instantOf(data.starts, 'start')
  ) {
    fileProblems.push(`"expires" (${data.expires}) is before "starts" (${data.starts}) — ` +
      'this announcement would never show')
  }

  const body = content.trim()
  if (!body) {
    fileProblems.push('there is no text below the settings block — write what the ' +
      'announcement should say')
  }

  if (fileProblems.length) {
    problems.push([path, fileProblems])
    continue
  }

  if (isLongExpired(data.expires)) {
    expired.push([id, data.expires])
    continue
  }

  const firstParagraph = body.split(/\n\s*\n/)[0]

  announcements.push({
    id,
    title: data.title,
    level: data.level,
    type: data.type ?? DEFAULT_TYPE,
    pinned: data.pinned ?? false,
    testing: data.testing ?? false,
    apps: data.apps ?? ALL_APPS,
    starts: toFeedValue(data.starts),
    expires: toFeedValue(data.expires),
    description: toPlainText(firstParagraph),
    body: toSafeHtml(body),
    descriptionUrl: data.descriptionUrl ?? null,
  })
}

if (problems.length) {
  console.error('\nThese announcements could not be published:\n')
  for (const [path, messages] of problems) {
    console.error(`  ${path}`)
    for (const message of messages) console.error(`      - ${message}`)
    console.error('')
  }
  console.error('Nothing was published. The announcements that were already live are still')
  console.error('showing — fix the problems above and commit again.\n')
  process.exit(1)
}

// Pinned first, then newest first. Files with no "starts" fall back to the date
// in their filename.
announcements.sort((a, b) => {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  const key = x => x.starts ?? (x.id.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '0000-00-00')
  return key(b).localeCompare(key(a))
})

mkdirSync(OUTPUT_DIR, { recursive: true })
writeFileSync(OUTPUT_FILE, JSON.stringify(announcements, null, 2) + '\n')

console.log(`Published ${announcements.length} announcement(s) to ${OUTPUT_FILE}`)
for (const a of announcements) {
  const window = [a.starts ?? 'now', a.expires ?? 'never'].join(' → ')
  const pin = a.pinned ? '📌 ' : '   '
  const where = a.testing ? ' [dev only]' : ''
  console.log(
    `  ${pin}${a.type.padEnd(12)} ${a.level.padEnd(7)} ${window.padEnd(26)} ${a.title}${where}`
  )
}

if (expired.length) {
  console.log(`\nLeft out ${expired.length} expired announcement(s):`)
  for (const [id, on] of expired) console.log(`     ${id} (expired ${on})`)
  console.log('\nThey stay in announcements/ — delete the files when you no longer want them.')
}
