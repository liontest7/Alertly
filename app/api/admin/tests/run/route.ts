import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type TestResult = {
  name: string;
  status: "pass" | "fail" | "skip";
  duration: number;
  error?: string;
};

type SuiteResult = {
  file: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
};

function parseVitestJson(raw: any): { suites: SuiteResult[]; passed: number; failed: number; skipped: number } {
  const suites: SuiteResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  const files = raw.testResults || raw.files || [];
  for (const testFile of files) {
    const fileName = (testFile.name || testFile.testFilePath || "").split("/").slice(-2).join("/");
    const tests: TestResult[] = [];

    const assertions = testFile.assertionResults || testFile.tests || [];
    for (const t of assertions) {
      const status: TestResult["status"] =
        t.status === "passed" || t.status === "pass" ? "pass" :
        t.status === "failed" || t.status === "fail" ? "fail" : "skip";

      const name = t.ancestorTitles
        ? [...(t.ancestorTitles || []), t.title].join(" › ")
        : (t.name || t.title || "unknown");

      const errorMsg =
        t.failureMessages?.join("\n") ||
        t.message ||
        (t.errors ? t.errors.map((e: any) => e.message || String(e)).join("\n") : undefined);

      tests.push({
        name,
        status,
        duration: t.duration || 0,
        error: status === "fail" ? (errorMsg || "Test failed").slice(0, 600) : undefined,
      });

      if (status === "pass") totalPassed++;
      else if (status === "fail") totalFailed++;
      else totalSkipped++;
    }

    const filePassed = tests.filter(t => t.status === "pass").length;
    const fileFailed = tests.filter(t => t.status === "fail").length;
    const fileSkipped = tests.filter(t => t.status === "skip").length;

    suites.push({
      file: fileName,
      tests,
      passed: filePassed,
      failed: fileFailed,
      skipped: fileSkipped,
      duration: (testFile.endTime ?? 0) - (testFile.startTime ?? 0) || testFile.duration || 0,
    });
  }

  return { suites, passed: totalPassed, failed: totalFailed, skipped: totalSkipped };
}

export async function POST(req: Request) {
  const access = await requireAdmin(req);
  if (!access.ok) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const suite = searchParams.get("suite") || "all";

  const testPath = suite === "unit"
    ? "tests/unit"
    : suite === "integration"
    ? "tests/integration"
    : "tests";

  const outputFile = join("/tmp", `vitest-results-${Date.now()}.json`);
  const startTime = Date.now();
  let runError = false;
  let stderrText = "";

  try {
    const result = await execAsync(
      `node_modules/.bin/vitest run ${testPath} --reporter=json --outputFile=${outputFile}`,
      { cwd: process.cwd(), timeout: 55_000 }
    );
    stderrText = result.stderr || "";
  } catch (err: any) {
    stderrText = err.stderr || "";
    runError = true;
  }

  const totalDuration = Date.now() - startTime;

  if (!existsSync(outputFile)) {
    const fallbackMsg = stderrText.slice(0, 800) || "Test runner did not produce output. Check that test files exist.";
    return NextResponse.json({
      ok: false,
      error: fallbackMsg,
      duration: totalDuration,
      suites: [],
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      ranAt: new Date().toISOString(),
    });
  }

  let parsed: any = null;
  try {
    const raw = readFileSync(outputFile, "utf-8");
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({
      ok: false,
      error: "Could not parse test output file.",
      duration: totalDuration,
      suites: [],
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
      ranAt: new Date().toISOString(),
    });
  } finally {
    try { unlinkSync(outputFile); } catch {}
  }

  const { suites, passed, failed, skipped } = parseVitestJson(parsed);

  return NextResponse.json({
    ok: !runError && failed === 0,
    duration: totalDuration,
    suites,
    summary: {
      total: passed + failed + skipped,
      passed,
      failed,
      skipped,
    },
    ranAt: new Date().toISOString(),
  });
}
