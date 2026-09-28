# Previous clipping confidence baseline

`guided-baseline.ts` freezes `packages/audio-metrics/src/guided.ts` from commit
`e8ade9e`, before unselected-clipping evidence and the confidence guard. The
benchmark bundles this source at its original production path, so relative
imports resolve to the same unchanged scoring/metric dependencies as the current
worker. It uses the actual current worker's segments; VAD and its model are
unchanged. This is an isolated before/after confidence comparison, not a second
historical VAD run or a frozen snapshot of all future scoring dependencies.

The held-out protocol records its checksum. No source recording or external
inference is included in this folder. See the
[benchmark decision](../../../../../docs/CLIPPING_SELECTION_BENCHMARK.md).
