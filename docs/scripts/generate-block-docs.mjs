import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mintRoot = path.resolve(__dirname, '..');
// The docs live inside the plugin repo, so block metadata is a sibling of this directory.
const repoRoot = path.resolve(mintRoot, '..');
const blocksRoot = path.join(repoRoot, 'resources/blocks');
const blocksOutputRoot = path.join(mintRoot, 'reference/blocks');
const docsJsonPath = path.join(mintRoot, 'docs.json');

function escapeYaml(value) {
	return String(value ?? '').replaceAll('"', '\\"');
}

function escapeMdxText(value) {
	return String(value ?? '')
		.replaceAll('{', '&#123;')
		.replaceAll('}', '&#125;');
}

function normalizeReadme(markdown) {
	return markdown
		.trim()
		.replace(/^# .+\n+/, '')
		.replaceAll('{', '&#123;')
		.replaceAll('}', '&#125;');
}

function summarizeReadme(markdown) {
	const description = markdown.match(/## Description\s+([\s\S]*?)(?=\n## |\n# |$)/);
	return description ? description[1].trim().replace(/\s+/g, ' ') : '';
}

function controlsList(blockJson) {
	const controls = blockJson?.supports?.blicks?.controls;
	return Array.isArray(controls) ? controls : [];
}

function statesList(blockJson) {
	const states = blockJson?.supports?.blicks?.states;
	return Array.isArray(states) ? states : ['default'];
}

function attributeRows(attributes = {}) {
	const entries = Object.entries(attributes).sort(([a], [b]) => a.localeCompare(b));
	return entries.map(([name, config]) => {
		const type = Array.isArray(config?.type) ? config.type.join(' | ') : config?.type ?? 'mixed';
		const fallback = Object.prototype.hasOwnProperty.call(config ?? {}, 'default')
			? JSON.stringify(config.default)
			: null;
		return { name, type, defaultValue: fallback };
	});
}

async function collectBlocks() {
	const entries = await readdir(blocksRoot, { withFileTypes: true });
	const blocks = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const dir = path.join(blocksRoot, entry.name);
		const blockJsonPath = path.join(dir, 'block.json');
		const readmePath = path.join(dir, 'readme.md');

		try {
			const [blockJsonRaw, readme] = await Promise.all([
				readFile(blockJsonPath, 'utf8'),
				readFile(readmePath, 'utf8'),
			]);
			const blockJson = JSON.parse(blockJsonRaw);
			blocks.push({
				slug: entry.name,
				title: blockJson.title || entry.name,
				name: blockJson.name || `blicks/${entry.name}`,
				description: blockJson.description || summarizeReadme(readme),
				blockJson,
				readme,
			});
		} catch (error) {
			if (error?.code !== 'ENOENT') throw error;
		}
	}

	return blocks.sort((a, b) => a.title.localeCompare(b.title));
}

function metaTable(items) {
	const rows = items.map((item) => `| ${item.label} | \`${escapeMdxText(item.value)}\` |`).join('\n');
	return `| Field | Value |\n|---|---|\n${rows}`;
}

function pillRow(items, empty) {
	if (!items.length) {
		return `<Info>${empty}</Info>`;
	}
	return items.map((value) => `\`${value}\``).join(' · ');
}

function attributeTable(rows) {
	if (!rows.length) {
		return '<Info>This block does not declare public attributes in block.json.</Info>';
	}
	const body = rows
		.map((row) => {
			const def = row.defaultValue === null ? '—' : `\`${escapeMdxText(row.defaultValue)}\``;
			return `| \`${row.name}\` | \`${escapeMdxText(row.type)}\` | ${def} |`;
		})
		.join('\n');
	return `| Attribute | Type | Default |\n|---|---|---|\n${body}`;
}

function blockPage(block) {
	const controls = controlsList(block.blockJson);
	const states = statesList(block.blockJson);
	const supports = block.blockJson.supports || {};

	const metadataItems = [
		{ label: 'Name', value: block.name },
		{ label: 'Category', value: block.blockJson.category ?? '-' },
		{ label: 'Text domain', value: block.blockJson.textdomain ?? '-' },
		{ label: 'Render callback', value: block.blockJson.render ?? '-' },
		{ label: 'Editor script', value: block.blockJson.editorScript ?? '-' },
		{ label: 'Front-end style', value: block.blockJson.style ?? '-' },
	];

	const supportItems = [
		{ label: 'HTML editing', value: String(supports.html ?? true) },
		{ label: 'Anchor', value: String(supports.anchor ?? false) },
		{
			label: 'Align',
			value: Array.isArray(supports.align)
				? supports.align.join(', ')
				: supports.align ?? '-',
		},
		{ label: 'Blicks states', value: states.join(', ') },
	];

	const title = block.title.replaceAll('"', '\\"');
	const description = (block.description || `Reference for ${block.title}.`).replaceAll('"', '\\"');

	return `---
title: "${title}"
description: "${description}"
---

<Info>
Generated from \`packages/blicks/resources/blocks/${block.slug}/block.json\` and \`readme.md\`. Do not hand-edit this page.
</Info>

## Metadata

${metaTable(metadataItems)}

## Editor support

${metaTable(supportItems)}

## Blicks controls

${pillRow(controls, 'No Blicks style controls are declared for this block.')}

## Attributes

${attributeTable(attributeRows(block.blockJson.attributes))}

## Help

${normalizeReadme(block.readme)}
`;
}

function indexPage(blocks) {
	const cards = blocks
		.map(
			(block) =>
				`	<Card title="${block.title.replaceAll('"', '\\"')}" icon="cube" href="/reference/blocks/${block.slug}">
		\`${block.name}\` — ${(block.description || '').replaceAll('`', '\\`').replaceAll('"', '\\"')}
	</Card>`,
		)
		.join('\n');

	return `---
title: "Block Reference"
description: "Generated reference for Blicks blocks."
---

Generated from \`packages/blicks/resources/blocks/*/block.json\` and each block \`readme.md\`.

<CardGroup cols={2}>
${cards}
</CardGroup>
`;
}

async function updateDocsJsonNav(blocks) {
	const raw = await readFile(docsJsonPath, 'utf8');
	const docsConfig = JSON.parse(raw);
	const tabs = docsConfig?.navigation?.tabs ?? [];
	const referenceTab = tabs.find((tab) => tab.tab === 'Reference');
	if (!referenceTab) return;

	const blocksGroup = referenceTab.groups?.find((group) => group.group === 'Blocks');
	if (!blocksGroup) return;

	blocksGroup.pages = [
		'reference/blocks/index',
		...blocks.map((block) => `reference/blocks/${block.slug}`),
	];

	await writeFile(docsJsonPath, `${JSON.stringify(docsConfig, null, '\t')}\n`);
}

async function main() {
	const blocks = await collectBlocks();
	await rm(blocksOutputRoot, { force: true, recursive: true });
	await mkdir(blocksOutputRoot, { recursive: true });

	await writeFile(path.join(blocksOutputRoot, 'index.mdx'), indexPage(blocks));
	await Promise.all(
		blocks.map((block) =>
			writeFile(path.join(blocksOutputRoot, `${block.slug}.mdx`), blockPage(block)),
		),
	);

	await updateDocsJsonNav(blocks);

	console.log(`Generated ${blocks.length} block reference pages and refreshed docs.json navigation.`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
