# Performance evidence policy

Files in this directory are immutable reports generated from accepted installed
Obsidian runs. Their environment, raw observations, production bundle size, and
provenance lock describe the measured run; they are not rewritten merely because
a later source change produces a different `main.js`.

## Production bundle regression budget

The latest accepted selected-renderer artifact anchors the production bundle
check. The current production `main.js` may be at most 5% larger than the
artifact's recorded `resources.bundleBytes`, rounded down to a whole byte. For
the current 1,200,758-byte baseline, the maximum is 1,260,795 bytes.

Growth within this budget lets the bundle regression gate continue to use the
existing host-sensitive latency and memory run while still bounding package
expansion. It does not alter the recorded bundle size or claim that the newer
bundle was measured in that run. Exceeding the budget fails
`npm run test:performance:baseline` and requires one of the following:

- run the installed performance protocol again and commit the reviewed artifact,
  provenance lock, and generated report; or
- intentionally revise the budget in product code, tests, this policy, and the
  governing ADR as one reviewed change.

The 5% bundle allowance does not apply to latency, cleanup, cancellation,
resource-completion, fixture provenance, or run-selection gates.
