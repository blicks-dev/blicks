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

// A prerelease tag (v1.0.0-rc.1) is a build of the version that will ship as 1.0.0, so it is
// checked against 1.0.0. Nothing in the plugin ever declares an rc suffix: WordPress.org has
// no concept of a prerelease, `Stable tag` is a live pointer for every existing install, and
// bumping three files for a throwaway build is churn that has to be reverted. Tag an RC off
// main whenever one is wanted; only a real release moves the declared version.
const declared = version.split('-')[0];
const isPrerelease = declared !== version;

const versionFiles = [
	{ file: 'blicks.php', pattern: 'Version:\\s*{V}' },
	{ file: 'blicks.php', pattern: "BLICKS_VERSION',\\s*'{V}'" },
	{ file: 'readme.txt', pattern: 'Stable tag:\\s*{V}' },
];

// Escape the version for safe insertion into each file's regex template.
const escaped = declared.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const failures = [];

for (const { file, pattern } of versionFiles) {
	const abs = path.join(root, file);

	if (!fs.existsSync(abs)) {
		failures.push(`${file}: file not found`);
		continue;
	}

	const re = new RegExp(pattern.replace('{V}', escaped));

	if (!re.test(fs.readFileSync(abs, 'utf8'))) {
		failures.push(`${file}: expected version "${declared}" (pattern /${pattern.replace('{V}', escaped)}/ did not match)`);
	}
}

if (failures.length) {
	console.error(`✗ Version guard failed for v${version}:`);
	if (isPrerelease) {
		console.error(`  (prerelease tag — the declared version must be the base "${declared}", not "${version}")`);
	}
	for (const f of failures) console.error(`  - ${f}`);
	console.error('\nUpdate the declared version(s) to match the tag, or fix the tag.');
	process.exit(1);
}

console.log(
	isPrerelease
		? `✓ blicks declares version ${declared} in all ${versionFiles.length} location(s); releasing it as prerelease ${version}.`
		: `✓ blicks declares version ${version} in all ${versionFiles.length} location(s).`
);
