#!/usr/bin/env node
/**
 * WP-CLI's `wp i18n make-json` names JS translation files using the MD5 of the
 * source file path (e.g. build/admin.js). WordPress also accepts a file named
 * after the registered script handle. This script renames the generated admin
 * JSON from its MD5 name to the handle-based name so `wp_set_script_translations( 'blicks-admin' )`
 * loads it directly and the filename is human-readable.
 */

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

const LANG_DIR = 'languages';
const ADMIN_SOURCE = 'build/admin.js';
const ADMIN_HANDLE = 'blicks-admin';

const md5 = createHash('md5').update(ADMIN_SOURCE).digest('hex');

const files = fs.readdirSync(LANG_DIR).filter((name) => name.endsWith('.json'));

for (const file of files) {
    const match = file.match(new RegExp(`^([^-]+)-([^-]+)-${md5}\\.json$`));
    if (!match) continue;

    const [, domain, locale] = match;
    const target = `${domain}-${locale}-${ADMIN_HANDLE}.json`;
    const sourcePath = path.join(LANG_DIR, file);
    const targetPath = path.join(LANG_DIR, target);

    if (sourcePath === targetPath) continue;

    if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
    }

    fs.renameSync(sourcePath, targetPath);
    console.log(`Renamed ${file} -> ${target}`);
}
