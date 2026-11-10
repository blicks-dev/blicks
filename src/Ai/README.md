# `src/Ai/` — what an agent sees of Blicks

Two layers, both plain PHP with no WordPress *configuration* in them (no options, no hooks, no
auth), so they run under the unit suite:

- **`Catalog/`** describes the plugin: every block from its `block.json` (`BlockCatalog`), every
  style control from the engine (`ControlCatalog`), and the design tokens (`TokenCatalog`). Nothing
  here is a copy — each reads the source the editor reads.
- **`Spec/`** turns a layout an agent describes (`BlockSpec`: `{ name, attributes, blicks,
  innerBlocks }`) into stored block markup and back.

## The rules that keep it honest

1. **Style judgement is the engine's.** `SpecValidator` asks `ElementStyle::problems()` whether a
   value would be applied, with the block's own `supports.blicks.controls`, and only adds the
   sentence that says what to write instead. A seventh copy of the style engine is the thing not to
   build.
2. **Markup is byte-for-byte or refused.** `SpecSerializer` + `BlockShapes` are a second
   implementation of every block's `save()`. That is only defensible because
   `tests/integration/tests/SerializerTest.php` holds them to the editor's own output: the goldens
   in `resources/blocks/__golden__/`, and the variants in `tests/fixtures/serializer-cases.json`,
   which `resources/blocks/serializer-cases.test.tsx` records from the real JavaScript. **Change a
   block's `save()` and that vitest fails first; re-record it deliberately, then make the PHP match.**
   What cannot be reproduced (a duotone image) is refused by name, never approximated.
3. **Blocks this plugin does not own travel as markup.** A page is a mix. Anything that is not
   `blicks/*` is read as its stored markup and written back verbatim, so an agent can change one
   Blicks section without dropping the paragraph above it. A Blicks block may not be sent as markup
   — that would skip every check here.
4. **Sizes are bounded** (`Limits`) before anything else runs.

Permissions are not checked in this directory. Who may call what is declared on each ability and
enforced by WordPress before the callback runs — see `Abilities/` and `src/Mcp/`.
