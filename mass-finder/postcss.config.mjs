/**
 * Mass Finder styles are plain CSS with custom properties — no Tailwind, no
 * preprocessor. This file exists to stop PostCSS walking up the directory tree
 * and picking up the parent repository's Tailwind config, which is for a
 * different app.
 */
const config = { plugins: {} };

export default config;
