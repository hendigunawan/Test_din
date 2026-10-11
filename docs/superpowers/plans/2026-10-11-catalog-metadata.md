# Automatic Catalog Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editing only `products.js` updates the published catalog count and update date.

**Architecture:** A dependency-free build reads the last Git commit affecting `products.js`, validates the catalog, and bundles its metadata with the product data. Content-hashed assets keep each deployment internally consistent. GitHub Actions runs tests and publishes the generated site after changes to `main`.

**Tech Stack:** Plain browser JavaScript, Node.js built-ins, Git, official GitHub Pages actions.

**Spec:** User request in this conversation, 11 October 2026: make the app description's dataset and update date follow additions to `products.js` automatically.

## Global Constraints

- Preserve every product and the existing 100-question, 50/50 sampling rules.
- Use the product file's last commit time in Asia/Jakarta; do not substitute the visitor's current date.
- No runtime GitHub API dependency or credentials in the site.
- Missing build metadata must not prevent local practice or show a fabricated date.
- Existing GitHub Pages publishing settings require a one-time switch to GitHub Actions; verify access and report any actual blocker.

## Review Focus

- Product addition changes count and date; test an actual second Git commit.
- An unrelated app change must not change the catalog update date; test a third Git commit.
- Same-count name edits must invalidate product asset URLs; test a renamed product.
- Invalid product data must fail before publishing; test duplicate codes.
- Missing or malformed metadata must leave the quiz usable; test controller rendering.

### Task 1: Build and display catalog metadata

**Files:** Create `scripts/build.cjs`, `tests/build.test.cjs`; modify `app.js`, `index.html`, `tests/app-flow.test.cjs`.

**Interfaces:** `buildSite({root, outDir, updatedAt?})` returns `{count, updatedAt, assets}`; optional timestamp is for a verified manual deployment. Built product asset exports `PRODUCT_META={count,updatedAt}` alongside `PRODUCT_BANK`.

- [x] Add failing build tests using a temporary Git repository, and controller tests for dates/count/fallback.
- [x] Run `node --test tests/build.test.cjs tests/app-flow.test.cjs`; verify new assertions fail.
- [x] Implement metadata build and display, cache-safe asset filenames, and generated HTML description.
- [x] Run the targeted tests and all existing tests; verify unchanged quiz behavior.

### Task 2: Publish and document the one-file update flow

**Files:** Create `.github/workflows/pages.yml`, `.gitignore`; modify `README.md`, `products.js` comments.

- [x] Add a workflow on `main` push/manual dispatch, using full checkout history, tests, build, and official Pages artifact/deploy actions.
- [x] Document editing `products.js` on `main`, the date/timezone, build command, and required Pages source setting.
- [ ] Review changes, commit to `main`, and verify the workflow's actual result.
- [ ] Configure Pages if access permits; otherwise publish a verified built snapshot through the existing `gh-pages` path and report the remaining one-time setting.
- [ ] Verify the live count, date, and screenshot before claiming completion.

## Verification record

- Metadata tests observed failing before implementation, then passing. Full suite: 34/34.
- Independent review found a live-catalog dependency in the existing session-preservation test. Appending a valid duplicate-name product reproduced the failure; a synthetic unique catalog fixes it. Regression RED→GREEN and full suite 34/34.
- Product array is byte-for-byte unchanged; only its explanatory comments changed.
- Ruling: source is an isolated connector-managed directory rather than a Git checkout; use GitHub tree/commit/ref APIs with expected-head leases. Build integration tests use real temporary Git repositories.
