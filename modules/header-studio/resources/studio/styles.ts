/**
 * The header mode's own styles: its stage, the phone drawer preview, its tabs and its "+ New"
 * picker. Editor chrome only, so it is added to the editor's document when the mode registers,
 * not shipped in the blocks' stylesheet, which every visitor loads.
 *
 * The drawer preview: a Studio width is a box on a wide screen, so the blocks' media queries never
 * see a phone. Where the header uses its drawer at the width picked, the stage carries `is-drawer`
 * and these rules draw the phone form instead: a menu button in the bar, and the menu as an open
 * drawer beside it. The phone's On phones settings show the same way: Hide dimmed, Last last.
 */
const CSS = `
/* Short, so the Studio fits it by width and the header is drawn readable; an open mega menu hangs
   below it, as on the page. */
.bl-studio__sheet.bl-hs-stage { position: relative; min-height: 0; padding: 0; margin-inline: auto; overflow: visible; border-radius: 12px; background: #fff; box-shadow: 0 0 0 1px rgb(16 24 40 / 8%), 0 24px 60px -30px rgb(16 24 40 / 35%); }
/* Not clipped: the block toolbar of a selected block in the bar sits above the stage. */
.bl-studio__sheet.bl-hs-stage.is-drawer { min-height: 620px; overflow: visible; }
.bl-studio__sheet.bl-hs-stage.is-phone { min-height: 720px; border-radius: 28px; box-shadow: 0 0 0 8px #15171c, 0 24px 60px -30px rgb(16 24 40 / 35%); }
.bl-hs-page { display: grid; gap: 20px; padding: 32px 40px 40px; pointer-events: none; }
/*
 * Selecting never changes the layout: the ring is the only thing that moves. No appender takes room
 * in the bar or a panel (blocks are added from the Header and Item tabs), and the selection is drawn
 * inside the block's own box: an outline with a negative offset follows the block's corners and paints
 * over its fill without taking a pixel. Rows, areas, the menu and its items get the prototype's 8px
 * corners; anything with its own shape (a pill button, an image) keeps it.
 */
.bl-hs-stage .block-list-appender, .bl-hs-stage .bl-appender { display: none !important; }
.bl-hs-stage .block-editor-block-list__block::after { content: none !important; }
.bl-hs-stage .block-editor-block-list__block.is-selected, .bl-hs-stage .block-editor-block-list__block.is-multi-selected { outline: 2px solid #002bff !important; outline-offset: -2px; box-shadow: none; }
.bl-hs-stage .block-editor-block-list__block.is-hovered:not(.is-selected, .has-child-selected) { outline: 1px solid rgb(0 43 255 / 45%); outline-offset: -1px; }
.bl-hs-stage :is(.bl-header, .bl-header-row, .bl-header-area, .bl-nav, .bl-nav-item, .bl-text, .bl-heading, .wp-block-site-title, .wp-block-site-logo).is-selected { border-radius: 8px; }
.bl-hs-stage .bl-mega-panel.is-selected { outline-offset: 0; }
/* An empty area has no width of its own; while its row is being worked on it shows as a dashed line. */
.bl-hs-stage .bl-header-area:not(:has(> .block-editor-block-list__block)) { min-width: 0; padding: 0; }
.bl-hs-stage .bl-header-row:is(.is-selected, .has-child-selected) > .bl-header-area:not(:has(> .block-editor-block-list__block)):not(.is-selected) { outline: 1px dashed rgb(0 43 255 / 40%); outline-offset: -1px; }
.bl-hs-page__hero { display: grid; gap: 12px; }
.bl-hs-page__hero b { width: min(520px, 80%); height: 28px; border-radius: 6px; background: #d9dde5; }
.bl-hs-page__hero span { width: min(420px, 70%); height: 10px; border-radius: 5px; background: #e8ebf0; }
.bl-hs-page__cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.bl-hs-stage.is-phone .bl-hs-page__cards { grid-template-columns: minmax(0, 1fr); }
.bl-hs-page__cards span { height: 72px; border-radius: 12px; background: #f1f2f5; }

/* A mega menu shows while its item, or anything in it, is selected. */
.bl-hs-stage .bl-nav-item.has-panel:not(.is-selected, .has-child-selected) > .bl-mega-panel { display: none; }

/* The phone form. */
.bl-hs-stage.is-drawer .bl-header, .bl-hs-stage.is-drawer .bl-header-row, .bl-hs-stage.is-drawer .bl-header-area, .bl-hs-stage.is-drawer .bl-nav, .bl-hs-stage.is-drawer .block-editor-block-list__layout { position: static; }
.bl-hs-stage.is-drawer .bl-nav { position: static; display: flex; align-items: center; gap: 8px; }
.bl-hs-stage.is-drawer .bl-nav::before { content: ""; flex: none; width: 44px; height: 44px; background: linear-gradient(currentColor 0 0) center calc(50% - 6px) / 20px 2px no-repeat, linear-gradient(currentColor 0 0) center / 20px 2px no-repeat, linear-gradient(currentColor 0 0) center calc(50% + 6px) / 20px 2px no-repeat; }
/* As on the page: the menu's button is the bar's last thing, and the title takes the room. */
.bl-hs-stage.is-drawer .bl-header-row { display: flex; flex-wrap: nowrap; align-items: center; }
.bl-hs-stage.is-drawer .bl-header-area:has(> .bl-nav) { order: 2; }
.bl-hs-stage.is-drawer .bl-header-area--start:not(:has(> .bl-nav)), .bl-hs-stage.is-drawer .bl-header-row--centred .bl-header-area--centre { min-width: 0; margin-inline-end: auto; overflow-wrap: anywhere; }
/* The drawer opens under the bar, so the bar's own buttons stay in view and can be selected. */
.bl-hs-stage.is-drawer .bl-header { position: relative; }
.bl-hs-stage.is-drawer .bl-nav__list { position: absolute; z-index: 3; top: 100%; right: 0; height: auto; min-height: 520px; width: min(340px, 86%); box-sizing: border-box; flex-direction: column; flex-wrap: nowrap; align-items: stretch; gap: 0; padding: 16px 20px 20px; overflow: auto; background: #fff; box-shadow: -24px 0 60px -30px rgb(16 24 40 / 45%), 0 0 0 1px rgb(16 24 40 / 6%); }
.bl-hs-stage.is-drawer .bl-nav-item__link, .bl-hs-stage.is-drawer .bl-nav-item__toggle { display: flex; justify-content: space-between; width: 100%; min-height: 48px; }
.bl-hs-stage.is-drawer .bl-mega-panel { position: static; width: auto; margin: 0; padding: 4px 0 12px 8px; border-radius: 0; box-shadow: none; }
/* Next screen: a selected item's mega menu covers the drawer's list, as it does on the page, so
   selecting it moves nothing in the list. Expand in place opens it under the item, as on the page. */
.bl-hs-stage.is-drill .bl-nav__list > .bl-nav-item > .bl-mega-panel { position: absolute; inset: 0; z-index: 2; box-sizing: border-box; padding: 16px 20px 20px; overflow: auto; background: #fff; }
.bl-hs-stage.is-drawer .bl-mega-panel .bl-cols { grid-template-columns: minmax(0, 1fr) !important; }
.bl-hs-stage.is-drawer .bl-menu-link__desc { display: none; }
.bl-hs-stage__drawer-note { position: absolute; z-index: 4; bottom: 16px; right: 20px; margin: 0; font: 600 11px/1.4 system-ui, sans-serif; letter-spacing: .04em; text-transform: uppercase; color: #6b7080; pointer-events: none; }
.bl-hs-stage.is-phone .bl-eh-mobile, .bl-hs-stage.is-tablet .bl-eh-tablet { opacity: .45; outline: 1px dashed var(--wp-admin-theme-color, #3858e9); outline-offset: 2px; }
.bl-hs-stage.is-phone .bl-fco--mob { order: var(--bl-fco-mob); }
.bl-hs-stage.is-phone .bl-eh-base, .bl-hs-stage.is-tablet .bl-eh-base { opacity: 1; outline: 0; }

/* The tabs. */
.bl-hs-panel { display: grid; gap: 4px; padding: 0 16px; }
.bl-hs-panel__sec { display: grid; gap: 12px; padding: 14px 0; border-bottom: 1px solid #eceef2; }
.bl-hs-panel__sec:last-child { border-bottom: 0; }
.bl-hs-panel__sec h3 { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: #6b7080; }
.bl-hs-panel__note { margin: 0; font-size: 12px; line-height: 1.45; color: #5c6270; }
.bl-hs-seg { display: flex; padding: 2px; border-radius: 8px; background: #f1f2f5; }
.bl-hs-seg button { flex: 1; min-height: 32px; border: 0; border-radius: 6px; background: none; font: inherit; font-size: 12px; cursor: pointer; }
.bl-hs-seg button.is-on { background: #fff; box-shadow: 0 1px 2px rgb(16 24 40 / 12%); font-weight: 600; }
.bl-hs-add { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.bl-hs-add button { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 10px; border: 0; border-radius: 8px; background: #f1f2f5; font: inherit; font-size: 12px; color: #15171c; text-align: start; cursor: pointer; }
.bl-hs-add button:hover { background: #e6e8ee; }
.bl-hs-add button:focus-visible { outline: 2px solid var(--wp-admin-theme-color, #3858e9); outline-offset: 1px; }
.bl-hs-add svg { flex: none; color: #5c6270; }

/* "+ New › Header". */
.bl-hs-new { display: grid; gap: 12px; }
.bl-hs-new p { margin: 0; color: #5c6270; }
.bl-hs-new ul { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
.bl-hs-new__item { display: grid; gap: 10px; width: 100%; padding: 12px; border: 1px solid #dfe2e8; border-radius: 10px; background: #fff; text-align: start; font: inherit; cursor: pointer; }
.bl-hs-new__item:hover:not(:disabled), .bl-hs-new__item:focus-visible { border-color: var(--wp-admin-theme-color, #3858e9); }
.bl-hs-new__item small { display: block; margin-top: 2px; color: #5c6270; }
.bl-hs-new__thumb { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 10px; border-radius: 6px; background: #f4f5f7; }
.bl-hs-new__thumb i { height: 8px; border-radius: 4px; background: #c9ced8; }
.bl-hs-new__thumb i:nth-child(1) { width: 28px; background: #15171c; }
.bl-hs-new__thumb i:nth-child(2) { flex: 1; }
.bl-hs-new__thumb i:nth-child(3) { width: 36px; background: #002bff; }
.bl-hs-new__thumb.is-centred i:nth-child(1) { order: 2; }
.bl-hs-new__thumb.is-centred i:nth-child(2) { order: 1; flex: 1; }
.bl-hs-new__thumb.is-centred i:nth-child(3) { order: 3; }
.bl-hs-new__thumb.is-stacked { flex-direction: column; justify-content: center; gap: 5px; }
.bl-hs-new__thumb.is-stacked i:nth-child(2) { flex: none; width: 60%; }
.bl-hs-new__thumb.is-stacked i:nth-child(3) { display: none; }
.bl-hs-new__thumb.is-rows { flex-wrap: wrap; align-content: center; row-gap: 5px; }
.bl-hs-new__thumb.is-rows i:nth-child(1) { flex: 0 0 100%; height: 5px; background: #6b7280; }
.bl-hs-new__problem { color: #cc1818; }
`;

export function addStyles(): void {
	if ( 'undefined' === typeof document || document.getElementById( 'blicks-pro-header-studio-editor' ) ) return;
	const style = document.createElement( 'style' );
	style.id = 'blicks-pro-header-studio-editor';
	style.textContent = CSS;
	document.head.append( style );
}
