#!/usr/bin/env node

const path     = require('path');
const fs       = require('fs');
const { execSync } = require('child_process');
const archiver = require('archiver');

const { name: slug } = require('../package.json');
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const zipPath = path.join(distDir, `${slug}.zip`);

// Allowlist, not a denylist. A denylist silently ships anything nobody remembered to exclude —
// that is how dev configs, agent docs, .DS_Store and the whole mockups/ directory ended up in
// release zips. Adding a file to the plugin now requires adding it here on purpose.
const include = [
    'blicks.php',
    'readme.txt',
    'LICENSE',
    'licenses.txt',
    'composer.json',
    'build',
    'src',
    'vendor',
];

// `templates/` is deliberately absent. It holds nothing but a .gitkeep, so listing it here
// bought no files and made the release fail outright if the empty directory were ever
// removed. Add it back the moment something actually ships from it.


// PHP reads these from resources/ at runtime by absolute path, so they must ship even though
// the rest of resources/ is build input. Keep in sync with:
//   src/Style/Tokens.php · src/Style/Breakpoints.php
//
// languages/ ships the .pot template only. Translations for a plugin hosted on wordpress.org are
// contributed through translate.wordpress.org and delivered by the standard translation update
// system, so bundling .po/.mo/.json catalogues would only ship a stale copy of that.
const runtimeResourceFiles = [
    'resources/design-system/tokens.json',
    'resources/design-system/breakpoints.json',
    'resources/framework/icons/names.gen.json',
    'languages/blicks.pot',
];

// 0. Preflight: the translation steps below shell out to wp-cli, which is a .phar and so
// needs a PHP that can map a phar from a real file path. A `php` that is a wrapper script
// (a version manager shim that streams the script into another PHP) cannot, and fails with
// `Phar::mapPhar(...): Failed to open stream`. Checking here turns a stack trace from the
// middle of a build into one actionable line.
function assertWpCliRuns() {
    try {
        execSync('wp --version', { stdio: 'pipe', cwd: rootDir });
        return;
    } catch (error) {
        const output = `${error.stdout || ''}${error.stderr || ''}`;

        if (/mapPhar|unable to open phar/i.test(output)) {
            const php = (() => {
                try {
                    return execSync('command -v php', { encoding: 'utf8' }).trim();
                } catch {
                    return '(not found)';
                }
            })();

            const wrapperDir = php.startsWith('/') ? path.dirname(php) : '<wrapper-dir>';

            console.error(
                `\nwp-cli cannot run: the \`php\` on PATH (${php}) is a wrapper script, not a real\n` +
                `PHP binary, so it cannot execute a .phar.\n\n` +
                `Bundle with that wrapper removed from PATH:\n\n` +
                `  PATH=$(echo "$PATH" | tr ':' '\\n' | grep -vF '${wrapperDir}' | tr '\\n' ':') pnpm bundle\n\n` +
                `CI is unaffected: it installs a real PHP.\n`
            );
            process.exit(1);
        }

        console.error('\nwp-cli is required to build the release zip, and `wp --version` failed:\n');
        console.error(output.trim() || error.message);
        console.error('\nInstall wp-cli: https://wp-cli.org/#installing\n');
        process.exit(1);
    }
}

assertWpCliRuns();

// 1. Build assets
console.log('Building assets...');
execSync('pnpm build', { stdio: 'inherit', cwd: rootDir });

// 2. Generate POT file
console.log('\nGenerating POT file...');
execSync('pnpm i18n:pot:from-build', { stdio: 'inherit', cwd: rootDir });

// 3. Install production PHP deps
console.log('\nInstalling production dependencies...');
execSync('composer install --no-dev --optimize-autoloader', { stdio: 'inherit', cwd: rootDir });

// 4. Create zip
fs.mkdirSync(distDir, { recursive: true });

const output  = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.on('error', err => { throw err; });
archive.pipe(output);

for (const entry of include) {
    const abs = path.join(rootDir, entry);
    if (!fs.existsSync(abs)) {
        throw new Error(`Missing required plugin entry: ${entry}`);
    }

    fs.statSync(abs).isDirectory()
        ? archive.directory(abs, `${slug}/${entry}`, entryData =>
            // Belt and braces: even inside an allowlisted directory, never ship OS cruft or
            // git placeholder files (.gitkeep) — wordpress.org's Plugin Check rejects any
            // dotfile in the zip.
            /(^|\/)\./.test(entryData.name) ? false : entryData)
        : archive.file(abs, { name: `${slug}/${entry}` });
}

for (const file of runtimeResourceFiles) {
    const abs = path.join(rootDir, file);
    if (!fs.existsSync(abs)) {
        throw new Error(`Missing required runtime resource: ${file}`);
    }
    archive.file(abs, { name: `${slug}/${file}` });
}

archive.finalize();

output.on('close', () => {
    const mb = (archive.pointer() / 1024 / 1024).toFixed(2);
    console.log(`\n✓ dist/${slug}.zip  (${mb} MB)`);

    // 5. Restore dev dependencies (local convenience; skip in CI — ephemeral runner).
    if (!process.env.CI) {
        console.log('\nRestoring dev dependencies...');
        execSync('composer install', { stdio: 'inherit', cwd: rootDir });
    }
});
