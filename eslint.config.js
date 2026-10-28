const { defineConfig } = require("eslint/config");
const raycastConfig = require("@raycast/eslint-config");

module.exports = defineConfig([
  ...raycastConfig,
  {
    // Titel sind deutsch; englisches Title Case („Fach Ändern“) wäre falsch
    rules: { "@raycast/prefer-title-case": "off" },
  },
]);
