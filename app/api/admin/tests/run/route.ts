import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/access";
import { exec } from "child_process";
import { promisify } from "util";

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

  const startTime = Date.now();
  let stdout = "";
  let stderr = "";
  let runError = false;

  try {
    const result = await execAsync(
      `npx vitest run ${testPath} --reporter=json 2>/dev/null`,
      { cwd: process.cwd(), timeout: 55_000 }
    );
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (err: any) {
    stdout = err.stdout || "";
    stderr = err.stderr || "";
    runError = true;
  }

  const totalDuration = Date.now() - startTime;

  let parsed: any = null;
  try {
    const jsonStart = stdout.indexOf("{");
    if (jsonStart !== -1) {
      parsed = JSON.parse(stdout.slice(jsonStart));
    }
  } catch {
  }

  if (!parsed) {
    return NextResponse.json({
      ok: false,
      error: "Could not parse test output",
      rawOutput: stdout.slice(0, 2000),
      stderr: stderr.slice(0, 500),
      duration: totalDuration,
      suites: [],
      summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
    });
  }

  const suites: SuiteResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const testFile of parsed.testResults || []) {
    const fileName = (testFile.name || testFile.testFilePath || "").split("/").slice(-2).join("/");
    const tests: TestResult[] = [];

    for (const assertResult of testFile.assertionResults || []) {
      const status: TestResult["status"] =
        assertResult.status === "passed" ? "pass" :
        assertResult.status === "failed" ? "fail" : "skip";

      tests.push({
        name: [...(assertResult.ancestorTitles || []), assertResult.title].join(" › "),
        status,
        duration: assertResult.duration || 0,
        error: assertResult.failureMessages?.join("\n").slice(0, 500) || undefined,
      });

      if (status === "pass") totalPassed++;
      else if (status === "fail") totalFailed++;
      else totalSkipped++;
    }

    suites.push({
      file: fileName,
      tests,
      passed: tests.filter(t => t.status === "pass").length,
      failed: tests.filter(t => t.status === "fail").length,
      skipped: tests.filter(t => t.status === "skip").length,
      duration: testFile.endTime - testFile.startTime || 0,
    });
  }

  return NextResponse.json({
    ok: !runError || totalFailed === 0,
    duration: totalDuration,
    suites,
    summary: {
      total: totalPassed + totalFailed + totalSkipped,
      passed: totalPassed,
      failed: totalFailed,
      skipped: totalSkipped,
    },
    ranAt: new Date().toISOString(),
  });
}
