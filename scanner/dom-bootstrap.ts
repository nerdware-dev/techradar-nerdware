// The app's parseRadar sanitizes descriptions with DOMPurify, which needs a DOM.
// The scanner runs under plain Node (tsx) where there is no `window`, so we provide
// one via jsdom (a devDependency) BEFORE any module that pulls in DOMPurify is loaded.
// run.ts imports this first; import order is what makes the window available in time.
import { JSDOM } from 'jsdom'

const g = globalThis as Record<string, unknown>
if (!g.window) {
  const { window } = new JSDOM('')
  g.window = window
  g.document = window.document
}
