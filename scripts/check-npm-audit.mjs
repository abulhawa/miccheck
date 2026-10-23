import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// GHSA-vfj7-8cjw-p6xm: no patched braces release as of 2026-10-23.
// The only remaining dependency path is eslint-config-next -> @next/eslint-plugin-next
// -> fast-glob -> micromatch -> braces. Do not permit additional vulnerabilities.
// Review before the time-limited exception expires.
export const EXPECTED_CHAIN = new Set([
  "braces",
  "micromatch",
  "fast-glob",
  "@next/eslint-plugin-next",
  "eslint-config-next"
]);
export const EXPECTED_ADVISORY = "GHSA-vfj7-8cjw-p6xm";
export const EXCEPTION_EXPIRES = "2026-11-15";

export function assessAudit(full, production, today = new Date().toISOString().slice(0, 10)) {
  const problems = [];
  const valid = (a) =>
    a && !a.error && a.metadata && a.metadata.vulnerabilities &&
    a.vulnerabilities && typeof a.vulnerabilities === "object";
  if (!valid(full) || !valid(production)) {
    return { allowed: false, problems: ["Incomplete or invalid npm audit output"] };
  }

  const prodKeys = Object.keys(production.vulnerabilities);
  if (prodKeys.length > 0 || production.metadata.vulnerabilities.total > 0) {
    problems.push("Production dependencies have vulnerabilities: " + prodKeys.join(", "));
  }

  const entries = Object.entries(full.vulnerabilities);
  const unexpectedPackages = entries.map(([name]) => name).filter((name) => !EXPECTED_CHAIN.has(name));
  if (unexpectedPackages.length) problems.push("Unexpected vulnerable packages: " + unexpectedPackages.join(", "));

  const advisories = entries.flatMap(([, vulnerability]) =>
    (vulnerability.via || []).filter((via) => typeof via === "object" && via !== null)
  );
  const unexpectedAdvisories = advisories.filter((via) =>
    via.name !== "braces" ||
    !String(via.url || "").endsWith("/" + EXPECTED_ADVISORY)
  );
  if (unexpectedAdvisories.length) {
    problems.push("Unexpected security advisories: " + unexpectedAdvisories.map((a) => a.url || a.name).join(", "));
  }
  if (entries.length && !advisories.length) {
    problems.push("Vulnerabilities exist but no matching source advisory was found");
  }
  if (entries.length && today > EXCEPTION_EXPIRES) {
    problems.push("Temporary braces exception expired on " + EXCEPTION_EXPIRES);
  }
  if (entries.length && entries.length > EXPECTED_CHAIN.size) {
    problems.push("Additional vulnerable dependencies detected");
  }
  return { allowed: problems.length === 0, problems, exceptedPackages: entries.map(([name]) => name) };
}

function runAudit(args) {
  const result = spawnSync("npm", ["audit", "--json", ...args], {
    encoding: "utf8",
    maxBuffer: 12 * 1024 * 1024
  });
  if (result.error) throw result.error;
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error("npm audit did not return JSON: " + String(result.stderr).slice(0, 500));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const production = runAudit(["--omit=dev"]);
    const full = runAudit([]);
    const { allowed, problems, exceptedPackages } = assessAudit(full, production);
    if (!allowed) {
      for (const problem of problems) console.error("SECURITY AUDIT FAILED:", problem);
      process.exitCode = 1;
    } else if (exceptedPackages.length) {
      console.warn(
        "::warning title=Unpatched development advisory::" +
        EXPECTED_ADVISORY + " remains in Next ESLint tooling only. " +
        "Exception expires " + EXCEPTION_EXPIRES + ". " +
        "Review upstream and remove exception when patched."
      );
      console.log("Excepted development packages:", exceptedPackages.join(", "));
    } else {
      console.log("Full npm audit clean, no exceptions needed.");
    }
  } catch (error) {
    console.error("Could not verify npm audit:", error);
    process.exitCode = 1;
  }
}
