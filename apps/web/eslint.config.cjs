const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");
const nextTypeScript = require("eslint-config-next/typescript");

module.exports = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: ["coverage/**", "eslint.config.cjs"]
  }
];
