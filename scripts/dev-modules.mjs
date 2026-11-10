/**
 * The Pro modules named for this build, from `BLICKS_DEV_MODULES`.
 *
 * A module under `modules/` is Pro code built inside the free repo until the v2 release moves it
 * (docs: modules/README.md). It is built only when this variable names it, the same name the PHP
 * constant of that name takes, so a plain `pnpm build` and every release build skip it.
 */
const NAME = /^[a-z][a-z0-9-]*$/;

/** `"header-studio, dialog-studio"` → `[ 'header-studio', 'dialog-studio' ]`; invalid names dropped. */
export function devModules( raw = process.env.BLICKS_DEV_MODULES ) {
	return [ ...new Set( String( raw ?? '' ).split( ',' ).map( ( name ) => name.trim() ).filter( ( name ) => NAME.test( name ) ) ) ];
}
