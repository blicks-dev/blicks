#!/usr/bin/env node
/**
 * Tag-vs-declared version guard for the release workflow.
 *
 * Usage:  node scripts/check-version.mjs <version>
 *
 * The plugin declares its version in three places that must never drift apart:
 * the plugin header, the BLICKS_VERSION constant, and the WP.org stable tag.
 * Asserts all three equal <version>; exits non-zero with a report on mismatch.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const [, , version] = process.argv;

if (!version) {
	console.error('Usage: check-version.mjs <version>');
	process.exit(2);
}

const versionFiles = [
	{ file: 'blicks.php', pattern: 'Version:\\s*{V}' },
	{ file: 'blicks.php', pattern: "BLICKS_VERSION',\\s*'{V}'" },
	{ file: 'readme.txt', pattern: 'Stable tag:\\s*{V}' },
];

// Escape the version for safe insertion into each file's regex template.
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const failures = [];

for (const { file, pattern } of versionFiles) {
	const abs = path.join(root, file);

	if (!fs.existsSync(abs)) {
		failures.push(`${file}: file not found`);
		continue;
	}

	const re = new RegExp(pattern.replace('{V}', escaped));

	if (!re.test(fs.readFileSync(abs, 'utf8'))) {
		failures.push(`${file}: expected version "${version}" (pattern /${pattern.replace('{V}', escaped)}/ did not match)`);
	}
}

if (failures.length) {
	console.error(`✗ Version guard failed for v${version}:`);
	for (const f of failures) console.error(`  - ${f}`);
	console.error('\nUpdate the declared version(s) to match the tag, or fix the tag.');
	process.exit(1);
}

console.log(`✓ blicks declares version ${version} in all ${versionFiles.length} location(s).`);
