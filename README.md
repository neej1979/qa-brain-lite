# QA Brain Lite

**QA Brain Lite** is a lightweight scaffold showing how to build a **0→1 QA function** around Playwright, risk-tagged test packs, and an LLM evaluation harness.  

It’s intentionally minimal — designed to demonstrate principles, not expose full IP. The complete [QA Brain](https://github.com/neej1979/qa-brain) system (private) expands on these ideas with replay-driven test generation, origin-aware grading, and self-healing selectors.  

---

## Contents

- **Examples**
  - `examples/ui/login.spec.ts` → minimal UI test (risk-tagged).
  - `examples/api/healthcheck.spec.ts` → API health check with Playwright.
  - `examples/llm-evals/` → golden set + eval runner for LLM safety checks.
- **Whitepaper**  
  - [`whitepaper.pdf`](./whitepaper.pdf) → *From 0→1 QA in AI Healthcare* (2-page blueprint).
- **CLI**
  - [`qa_brain/cli.py`](./qa_brain/cli.py) → Python CLI (`qa-brain`) for sanity checks, test packs, and evals.
- **CI**
  - `.github/workflows/qa.yml` → GitHub Actions workflow running smoke, nightly, and eval jobs.

---

## Quickstart

### 1. Install dependencies
```bash
npm install
npx playwright install --with-deps
```

### 2. Run sanity check
```bash
npm run qa:doctor
```
Checks for Node/Playwright, required files, optional LLM harness, and environment variables.

### 3. Run tests
#### Full suite

```bash
npm run test:all
```
#### Smoke pack (risk:high + risk:medium only)

```bash
npm run test:smoke
```
#### UI only

```bash
npm run test:ui
```

#### API only

```bash
npm run test:api
```

### 4. Run LLM eval harness
``` bash
npm run evals
```
#### or via CLI:
```bash
npm run qa:evals
```

This runs the golden set in llm-evals/golden.yaml, scoring outputs (mocked in this repo ).
Fails if the eval score drops below 0.95.

## Risk Tags
All tests are tagged with both domain (@ui, @api) and risk level (@risk:high, @risk:medium, @risk:low).
This allows targeted execution:

- PR smoke packs → only high/medium risks
- Nightly runs → all tests (including low-risk, slower suites)
  
## LLM Evals
The llm-evals/ folder includes:

- golden.yaml → small golden set with expected behaviors
- run_eval.ts → stub runner (uses mock outputs in this repo)

In production, swap mock_output for real model responses and keep the same expected-check logic.

## GitHub Actions
See .github/workflows/qa.yml.

Jobs included:

- pr-smoke → Runs smoke tests (@risk:high|@risk:medium) on pull requests.
- nightly-full → Runs all tests on a nightly schedule; enforces JSON gate for failures.
- llm-evals → Runs the eval harness and uploads results.

Secrets you’ll need to set:

- APP_BASE_URL → base URL of your app
- API_BASE_URL → (optional) API base URL if separate
- E2E_USER / E2E_PASS → test account credentials

## Whitepaper
See whitepaper.pdf → From 0→1 QA in AI Healthcare.
It describes:

- Risk-weighted coverage
- Synthetic PHI safety
- LLM evaluation as a first-class surface
- CI/CD evidence and auditability
- 30/60/90 rollout plan

## About QA Brain
This repo is an example only. The full QA Brain system (private) adds:

- Replay-driven test generation
- Origin-aware test quality grading
- Self-healing selectors
- Domain heuristics libraries
- Local memory + testrunner engine

These innovations are designed to make QA faster, smarter, and safer in domains like healthcare.

## License
MIT — free to use, fork, and adapt.
