#!/usr/bin/env node

/**
 * Fail if a release zip carries any Pro module code.
 *
 * Pro features are built in this repository under `modules/` until the v2 release moves them to
 * Blicks Pro, and WordPress.org does not take locked or Pro code in a free plugin. `bundle.js`
 * never packages `modules/`; this checks the zip it actually wrote, so a later change to the
 * allowlist cannot ship one by accident.
 *
 * Fails on any path with a `modules/` segment or `BlicksPro` in it, and on any PHP, JavaScript or
 * JSON file that mentions `BlicksPro` — a module's namespace, which nothing in the free plugin names.
 *
 *     node scripts/check-release-zip.js dist/blicks.zip
 */

const { execFileSync } = require('child_process');

const TEXT = /\.(php|js|mjs|json)$/;

/** What is wrong with the zip's entries, as messages. `read` returns a file's contents by name. */
function problems(names, read) {
    const found = [];

    for (const name of names) {
        if (/(^|\/)modules\//.test(name) || /BlicksPro/.test(name)) {
            found.push(`${name}: a Pro module path`);
            continue;
        }

        if (TEXT.test(name) && read(name).includes('BlicksPro')) {
            found.push(`${name}: names BlicksPro`);
        }
    }

    return found;
}

function check(zip) {
    const names = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter((n) => n && !n.endsWith('/'));
    const read = (name) => execFileSync('unzip', ['-p', zip, name], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

    return problems(names, read);
}

module.exports = { problems, check };

if (require.main === module) {
    const zip = process.argv[2];

    if (!zip) {
        console.error('Usage: node scripts/check-release-zip.js <zip>');
        process.exit(2);
    }

    const found = check(zip);

    if (found.length > 0) {
        console.error(`\n✗ ${zip} carries Pro module code:\n${found.map((f) => `  ${f}`).join('\n')}\n`);
        process.exit(1);
    }

    console.log(`✓ ${zip}: no modules/ or BlicksPro`);
}
