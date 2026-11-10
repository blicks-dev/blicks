/** @type {import('stylelint').Config} */
export default {
	extends: 'stylelint-config-standard-scss',
	ignoreFiles: [
		'build/**',
		'vendor/**',
		'node_modules/**',
		// Written by `scripts/gen-engine.mjs` from resources/engine/schema.json and
		// guarded by `gen:engine --check`; a hand fix here is undone by the next
		// regeneration and fails that check.
		'resources/runtime/_engine.scss',
	],
	rules: {
		'selector-class-pattern': null,
		'custom-property-pattern': null,
		'keyframes-name-pattern': null,
		'scss/dollar-variable-pattern': null,
		'no-descending-specificity': null,
		'property-no-vendor-prefix': null,
		'value-no-vendor-prefix': null,
		'at-rule-no-unknown': null,
		'scss/at-rule-no-unknown': true,
		'declaration-block-no-redundant-longhand-properties': null,
		'scss/comment-no-empty': null,
		'scss/at-if-no-null': null,
		'declaration-block-single-line-max-declarations': null,
		// Every unspaced `/` in this codebase is the CSS `font` shorthand's
		// size/line-height separator (`font: 500 var(--x)/1 var(--font-mono)`),
		// not Sass division: Sass math goes through `math.div()`, and a `/`
		// next to `var()` cannot be division anyway. Spacing it would only
		// make the shorthand read like arithmetic.
		'scss/operator-no-unspaced': null,
		// Both `:not()` notations are in use here and they are not interchangeable: a
		// selector list inside one `:not()` weighs as its most specific argument, while
		// chained `:not()`s add their weights up. Either setting of this rule would
		// have its autofix rewrite one form into the other and quietly move the rule
		// in the cascade, so the choice stays with the author of each selector.
		'selector-not-notation': null,
	},
};
