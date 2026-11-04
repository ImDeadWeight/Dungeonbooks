/**
 * @file PostCSS plugin that keeps the tabs' styles apart. Encounters and
 * Lorekeeper were separate apps, so their stylesheets reuse class names
 * (.sidebar, .tree-row, …). Every rule in src/encounters gets the prefix
 * :root[data-tab="encounters"], every rule in src/lorekeeper gets
 * :root[data-tab="lorekeeper"] (and src/assistant, the Assistant tab's,
 * :root[data-tab="assistant"]), and the shared styles get :root[data-tab], so
 * only the showing tab's rules apply (the shell sets data-tab on <html>).
 *
 * Every prefix weighs the same, so rules keep the strength they had against
 * each other in the separate apps. theme.css (element selectors and colour
 * tokens only) is left as written.
 */
import type { AtRule, Plugin } from 'postcss';

/** Folders under src/ whose styles belong to one tab. */
const TABS = ['encounters', 'lorekeeper', 'assistant'];
/** Stylesheets left unprefixed. */
const UNSCOPED = ['/src/styles/theme.css'];

/** `selector` limited to `scope`; selectors on the root element itself are merged into it. */
function scoped(selector: string, scope: string): string {
  const s = selector.trim();
  if (s.startsWith(':root')) return scope + s.slice(':root'.length);
  if (/^html(?![\w-])/.test(s)) return scope + s.slice('html'.length);
  return `${scope} ${s}`;
}

export function scopeTabCss(): Plugin {
  return {
    postcssPlugin: 'scope-tab-css',
    Once(root) {
      const file = (root.source?.input.file ?? '').replace(/\\/g, '/');
      if (UNSCOPED.some((path) => file.endsWith(path))) return;
      const tab = TABS.find((t) => file.includes(`/src/${t}/`));
      const scope = tab ? `:root[data-tab="${tab}"]` : ':root[data-tab]';
      root.walkRules((rule) => {
        // Keyframe steps (from, to, 50%) aren't selectors.
        if (rule.parent?.type === 'atrule' && /keyframes$/i.test((rule.parent as AtRule).name)) return;
        rule.selectors = rule.selectors.map((s) => scoped(s, scope));
      });
    },
  };
}
