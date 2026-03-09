const baseUrl = process.env.ALERTLY_API_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:10000";
const runs = Number(process.env.ALERTS_LATENCY_RUNS || 5);

async function runOnce() {
  const start = Date.now();
  const res = await fetch(`${baseUrl}/api/alerts`, {
    headers: { "Cache-Control": "no-cache" },
  });
  const latency = Date.now() - start;
  if (!res.ok) {
    throw new Error(`alerts request failed with status ${res.status}`);
  }
  await res.json().catch(() => []);
  return latency;
}

try {
  const latencies = [];
  for (let i = 0; i < runs; i += 1) {
    const latency = await runOnce();
    latencies.push(latency);
  }

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const max = Math.max(...latencies);
  const min = Math.min(...latencies);

  console.log("alerts-latency:", { runs, minMs: min, avgMs: Number(avg.toFixed(2)), maxMs: max });
} catch (error) {
  console.error("alerts-latency-check: FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
