# Performance measurements

Run `npm run analyze` to generate the webpack analyzer reports under `.next/analyze/`.
The Quality workflow uploads those reports for every build so route/chunk regressions can be reviewed without committing generated HTML.

Run `npm run performance:baseline` with a production build running locally, or set `PERF_BASE_URL` to a preview/staging URL. The script records TTFB, FCP, LCP, CLS, loaded JavaScript bytes, and the final route URL in `docs/performance/baseline.json`.

For real Dashboard, Skills, Course, Contacts, and Practice measurements, provide the dedicated staging account through `E2E_EMAIL` and `E2E_PASSWORD`. Without those variables, protected routes are intentionally recorded as login redirects rather than being mistaken for authenticated baselines.

The current static bundle guardrails are 3 MiB total and 550 KiB for the largest JavaScript chunk. They are based on the 2026-08-13 build measurement of 2.49 MiB total and 470.991 KiB largest chunk.
