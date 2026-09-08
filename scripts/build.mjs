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
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const SOURCE_DIR = 'announcements'
const OUTPUT_DIR = 'dist'
const OUTPUT_FILE = join(OUTPUT_DIR, 'announcements.json')
const ALL_APPS = ['landing', 'form', 'vpe']

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
    case 'format':
      return error.params.format === 'date'
        ? `"${field}" must be a date written as YYYY-MM-DD, for example 2026-03-14`
        : `"${field}" must be a full web address starting with https://`
    case 'type':
      return `"${field}" must be ${error.params.type}`
    default:
      return `"${field}" ${error.message}`
  }
}

// YAML turns an unquoted 2026-03-14 into a Date object, so the schema's string
// check would reject a perfectly good date. Put it back to YYYY-MM-DD before
// validating rather than making authors remember to quote their dates.
function normalizeDates(data) {
  for (const field of ['starts', 'expires']) {
    if (data[field] instanceof Date) {
      data[field] = data[field].toISOString().slice(0, 10)
    }
  }
  return data
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
    allowedAttributes: { a: ['href'] },
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

for (const file of files) {
  const path = join(SOURCE_DIR, file)
  const id = basename(file, '.md')
  const fileProblems = []

  let parsed
  try {
    parsed = matter(readFileSync(path, 'utf8'))
  } catch {
    problems.push([path, ['the block of settings at the top of the file could not be read — ' +
      'check that it starts and ends with a line of three dashes (---) and that every line ' +
      'looks like "name: value"']])
    continue
  }

  const { content } = parsed
  const data = normalizeDates(parsed.data)

  if (!validate(data)) {
    fileProblems.push(...validate.errors.map(explain))
  }

  if (data.starts && data.expires && data.expires < data.starts) {
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

  const firstParagraph = body.split(/\n\s*\n/)[0]

  announcements.push({
    id,
    title: data.title,
    level: data.level,
    apps: data.apps ?? ALL_APPS,
    starts: data.starts ?? null,
    expires: data.expires ?? null,
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

// Newest first. Files with no "starts" fall back to the date in their filename.
announcements.sort((a, b) => {
  const key = x => x.starts ?? (x.id.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '0000-00-00')
  return key(b).localeCompare(key(a))
})

mkdirSync(OUTPUT_DIR, { recursive: true })
writeFileSync(OUTPUT_FILE, JSON.stringify(announcements, null, 2) + '\n')

console.log(`Published ${announcements.length} announcement(s) to ${OUTPUT_FILE}`)
for (const a of announcements) {
  const window = [a.starts ?? 'now', a.expires ?? 'never'].join(' → ')
  console.log(`  ${a.level.padEnd(7)} ${window.padEnd(26)} ${a.title}`)
}
