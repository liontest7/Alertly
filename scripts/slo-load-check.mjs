#!/usr/bin/env node

const baseUrl = (process.env.ALERTLY_API_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
const totalRequests = Number(process.env.SLO_REQUESTS || 120);
const concurrency = Number(process.env.SLO_CONCURRENCY || 12);
const p95TargetMs = Number(process.env.SLO_P95_TARGET_MS || 2000);
const errorRateTarget = Number(process.env.SLO_ERROR_RATE_TARGET || 0.02);

if (!baseUrl) {
  console.error('slo-load-check: missing ALERTLY_API_BASE_URL or NEXT_PUBLIC_APP_URL');
  process.exit(1);
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

async function singleRequest() {
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/alerts`, { headers: { 'Cache-Control': 'no-cache' } });
    const latency = Date.now() - start;
    if (!res.ok) return { ok: false, latency, status: res.status };
    await res.json().catch(() => []);
    return { ok: true, latency, status: res.status };
  } catch {
    const latency = Date.now() - start;
    return { ok: false, latency, status: 0 };
  }
}

(async () => {
  const results = [];
  const started = Date.now();

  let launched = 0;
  async function worker() {
    while (launched < totalRequests) {
      launched += 1;
      const result = await singleRequest();
      results.push(result);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const durationMs = Date.now() - started;
  const successes = results.filter((r) => r.ok);
  const failures = results.filter((r) => !r.ok);
  const latencies = successes.map((r) => r.latency);

  const avgMs = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const p50Ms = percentile(latencies, 50);
  const p95Ms = percentile(latencies, 95);
  const p99Ms = percentile(latencies, 99);
  const errorRate = results.length ? failures.length / results.length : 1;

  const pass = p95Ms <= p95TargetMs && errorRate <= errorRateTarget;

  const report = {
    baseUrl,
    timestamp: new Date().toISOString(),
    totalRequests,
    concurrency,
    durationMs,
    throughputRps: Number((results.length / (durationMs / 1000)).toFixed(2)),
    successCount: successes.length,
    failureCount: failures.length,
    errorRate: Number(errorRate.toFixed(4)),
    latency: {
      avgMs: Number(avgMs.toFixed(2)),
      p50Ms,
      p95Ms,
      p99Ms,
    },
    slo: {
      p95TargetMs,
      errorRateTarget,
      pass,
    },
  };

  console.log('slo-load-check report:\n', JSON.stringify(report, null, 2));
  process.exit(pass ? 0 : 1);
})();
