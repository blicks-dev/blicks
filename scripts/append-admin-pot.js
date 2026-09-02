#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const sourceFile = 'build/admin.js';
const sourcePath = path.join(rootDir, sourceFile);
const potPath = path.join(rootDir, 'languages/blicks.pot');

if (!fs.existsSync(sourcePath)) {
    throw new Error('build/admin.js is missing. Run pnpm build before generating translation files.');
}

const source = fs.readFileSync(sourcePath, 'utf8');
const pot = fs.existsSync(potPath) ? fs.readFileSync(potPath, 'utf8') : '';
const messages = new Map();
const matcher = /wp\.i18n\.__\(\s*"((?:\\"|[^"])*)"\s*,\s*"blicks"\s*\)/g;

let match;
while ((match = matcher.exec(source)) !== null) {
    const msgid = match[1].replace(/\\"/g, '"');
    if (!messages.has(msgid)) {
        const line = source.slice(0, match.index).split('\n').length;
        messages.set(msgid, line);
    }
}

const existing = new Set();
const existingMatcher = /^msgid "((?:\\"|[^"])*)"$/gm;

while ((match = existingMatcher.exec(pot)) !== null) {
    existing.add(match[1].replace(/\\"/g, '"'));
}

const additions = [];

for (const [msgid, line] of messages) {
    if (existing.has(msgid)) continue;

    additions.push(
        `#: ${sourceFile}:${line}`,
        `msgid "${escapePotString(msgid)}"`,
        'msgstr ""',
        ''
    );
}

if (additions.length > 0) {
    fs.appendFileSync(potPath, `\n${additions.join('\n')}`);
}

console.log(`Admin build i18n strings scanned: ${messages.size}; added: ${additions.length / 4}.`);

function escapePotString(value) {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
