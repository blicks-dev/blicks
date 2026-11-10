## Description

Dialog is a native `<dialog>` that opens over the page: a modal, a drawer from either side, a bottom sheet, or a full screen. Use it for size guides, details, sign-ups, confirmations, menus and notices. It holds any Blicks blocks except Section, Loop and another Dialog.

In the editor a dialog is a card in the post with **Edit**, so the blocks around it stay where you put them. On the page it is closed until something opens it, wherever it sits in the post.

## Opening it

- A **Button** with **On click › Open dialog**, choosing the dialog.
- Any **link** to its address, `#dialog-<address>`. A page loaded with that address opens it.
- A Button inside it with **On click › Close dialog** closes it, as do **Esc**, the close button and, when allowed, a click outside.

Buttons open dialogs with the browser's own invoker commands (`commandfor`, `command`). The `dialog` behavior, a small module on the WordPress Interactivity API, fills the gaps in browsers that do not have them yet and handles links; it loads only on pages with a dialog.

## Controls

### title

The dialog's name in the editor and in a Button's dialog picker. Not shown on the page.

### anchor

The address, `size-guide` for `#dialog-size-guide`. Set from the name when the dialog is added, and unique among the post's dialogs.

### kind

`Modal` is a centered card (or near the top, with **place**). `Drawer` slides in from the start or end **side** (left or right, flipped in right-to-left languages), the full height of the screen. `Sheet` rises from the bottom, the full width. `Full screen` covers the page.

### phone

For a modal: stay a card on phones, or become a bottom sheet or a full screen at phone width.

### modal

**Blocks the page**: on, the page behind is inert, darkened by the **backdrop** and does not scroll, and focus stays in the dialog. Off, there is no backdrop and the page stays usable; a modal sits in the bottom corner and a sheet along the bottom, for notices and offers.

### closeButton

A labeled close button in the top corner. Its name for screen readers is **closeLabel**.

### outsideCloses

Whether a click on the backdrop closes it. Esc always does. A dialog that does not block the page has no backdrop, and clicks on the page never close it.

### label

The dialog's name for screen readers. Left empty, the dialog is named by its first heading.

### focus

Where focus goes when it opens: the first field or button in it, or the close button. When it closes, focus returns to what opened it.

### motion

How a modal opens: rise, scale, fade, or none. Drawers and sheets always slide from their edge, and nothing moves when the visitor has asked for reduced motion.

## Tips

- Start the dialog with a Heading: it names the dialog for screen readers.
- Use a drawer for menus and filters, a sheet for short choices on phones, a modal for everything else.
- Size and surface (width, padding, fill, corners, shadow) are in the Style tab, as on a Box.
