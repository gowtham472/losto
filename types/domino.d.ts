/**
 * Minimal typings for the DOM implementation bundled with turndown. Its own
 * `index.d.ts` is not a module, so the shape Losto uses is declared here and
 * mapped onto the standard DOM interfaces.
 */
declare module "@mixmark-io/domino" {
  export function createDocument(html?: string, force?: boolean): Document;
  export function createWindow(html?: string, url?: string): Window & typeof globalThis;
  const domino: {
    createDocument: typeof createDocument;
    createWindow: typeof createWindow;
  };
  export default domino;
}
