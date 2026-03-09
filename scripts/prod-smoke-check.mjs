#!/usr/bin/env node

const baseUrl = (process.env.ALERTLY_API_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
const adminToken = process.env.ADMIN_BEARER_TOKEN || '';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

if (!baseUrl) {
  console.error('prod-smoke-check: missing ALERTLY_API_BASE_URL or NEXT_PUBLIC_APP_URL');
  process.exit(1);
}

function headersJson(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  return headers;
}

async function withTimeout(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(path, init = {}) {
  const started = Date.now();
  const res = await withTimeout(fetch(`${baseUrl}${path}`, init), timeoutMs);
  const latencyMs = Date.now() - started;
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body, latencyMs };
}

async function checkSse(path = '/api/alerts/stream') {
  const controller = new AbortController();
  const result = { ok: false, events: [], status: null, message: '' };

  const stopTimer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${baseUrl}${path}`, { signal: controller.signal });
    result.status = res.status;
    if (!res.ok || !res.body) {
      result.message = `bad SSE response ${res.status}`;
      return result;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sawEvent = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          const evt = line.replace('event:', '').trim();
          result.events.push(evt);
          if (evt === 'alerts' || evt === 'heartbeat') {
            sawEvent = true;
          }
        }
      }

      if (sawEvent) break;
    }

    result.ok = sawEvent;
    result.message = sawEvent ? 'sse received live event' : 'no live event observed before timeout';
    return result;
  } catch (error) {
    result.message = error instanceof Error ? error.message : String(error);
    return result;
  } finally {
    clearTimeout(stopTimer);
    controller.abort();
  }
}

(async () => {
  const report = {
    baseUrl,
    timestamp: new Date().toISOString(),
    checks: {},
    pass: false,
  };

  try {
    report.checks.health = await fetchJson('/api/health');
    report.checks.alerts = await fetchJson('/api/alerts');
    report.checks.extensionSync = await fetchJson('/api/extension/sync');
    report.checks.sse = await checkSse('/api/alerts/stream');

    if (adminToken) {
      report.checks.listenerRestart = await fetchJson('/api/admin/listener/control', {
        method: 'POST',
        headers: headersJson(),
        body: JSON.stringify({ action: 'restart' }),
      });
      report.checks.adminOverview = await fetchJson('/api/admin/overview', {
        headers: headersJson(),
      });
    } else {
      report.checks.listenerRestart = { ok: false, skipped: true, reason: 'missing ADMIN_BEARER_TOKEN' };
      report.checks.adminOverview = { ok: false, skipped: true, reason: 'missing ADMIN_BEARER_TOKEN' };
    }

    const required = [
      report.checks.health?.ok,
      report.checks.alerts?.ok,
      report.checks.extensionSync?.ok,
      report.checks.sse?.ok,
    ];

    if (adminToken) {
      required.push(report.checks.listenerRestart?.ok, report.checks.adminOverview?.ok);
    }

    report.pass = required.every(Boolean);

    console.log('prod-smoke-check report:\n', JSON.stringify(report, null, 2));
    process.exit(report.pass ? 0 : 1);
  } catch (error) {
    report.pass = false;
    report.error = error instanceof Error ? error.message : String(error);
    console.log('prod-smoke-check report:\n', JSON.stringify(report, null, 2));
    process.exit(1);
  }
})();
