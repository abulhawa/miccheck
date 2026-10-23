import test from "node:test";
import assert from "node:assert/strict";
import { assessAudit, EXPECTED_CHAIN } from "./check-npm-audit.mjs";

const empty = () => ({
  metadata: { vulnerabilities: { total: 0 } },
  vulnerabilities: {}
});
const known = () => ({
  metadata: { vulnerabilities: { total: 5 } },
  vulnerabilities: Object.fromEntries(
    [...EXPECTED_CHAIN].map((name) => [
      name,
      { via: name === "braces"
          ? [{ name: "braces", url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm" }]
          : ["braces"] }
    ])
  )
});

test("passes a fully clean audit", () => {
  assert.equal(assessAudit(empty(), empty(), "2026-12-01").allowed, true);
});
test("temporarily allows only the known development-only braces chain", () => {
  assert.equal(assessAudit(known(), empty(), "2026-10-23").allowed, true);
});
test("fails when an additional vulnerable package appears", () => {
  const full = known();
  full.vulnerabilities["unexpected-package"] = { via: ["braces"] };
  assert.equal(assessAudit(full, empty(), "2026-10-23").allowed, false);
});
test("fails when a new advisory appears inside an allowed package", () => {
  const full = known();
  full.vulnerabilities.braces.via.push({ name: "braces", url: "https://github.com/advisories/GHSA-test-new" });
  assert.equal(assessAudit(full, empty(), "2026-10-23").allowed, false);
});
test("fails if a production package is vulnerable", () => {
  const prod = empty();
  prod.vulnerabilities.braces = { via: ["braces"] };
  prod.metadata.vulnerabilities.total = 1;
  assert.equal(assessAudit(known(), prod, "2026-10-23").allowed, false);
});
test("fails after the exception expires", () => {
  assert.equal(assessAudit(known(), empty(), "2026-11-16").allowed, false);
});
test("fails safely on invalid npm audit responses", () => {
  assert.equal(assessAudit({ error: "network" }, empty(), "2026-10-23").allowed, false);
});

test("fails closed when npm reports findings without details", () => {
  const full = known();
  full.vulnerabilities = {};
  assert.equal(assessAudit(full, empty(), "2026-10-23").allowed, false);
});
