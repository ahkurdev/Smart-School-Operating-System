import type { Actor } from "@/types/actor";
import { Errors } from "@/server/errors";
import { authorize } from "@/server/policies";
import { requireTenantId } from "@/server/db/tenant";
import { prisma } from "@/server/db/client";
import { recordAudit } from "@/server/services/audit.service";

/**
 * Import/export (Phase 80).
 *
 * CSV is parsed/serialised in-process with an RFC-4180 parser (quotes, embedded
 * commas/newlines, CRLF) - no dependency needed for a well-understood format.
 * XLSX export is emitted as SpreadsheetML 2003 (a single XML file Excel opens
 * natively) so we do not pull a spreadsheet engine for a tabular dump.
 *
 * Imports are staged: parse -> map -> validate -> preview -> commit, and every
 * commit is audited. Import writes go through the same tenant checks as the
 * normal services.
 */

// --- CSV primitives ----------------------------------------------------------

/** Parse RFC-4180 CSV text into rows of cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  // Normalise BOM and newlines.
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  // CRLF + a trailing newline is the most compatible CSV.
  return lines.join("\r\n") + "\r\n";
}

/** XML-escape for SpreadsheetML. */
function xml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Emit SpreadsheetML 2003 for a table (opens in Excel/LibreOffice). */
export function toXlsxXml(sheetName: string, headers: string[], rows: unknown[][]): string {
  const cellRow = (cells: unknown[]) =>
    `<Row>${cells
      .map((c) => `<Cell><Data ss:Type="${typeof c === "number" ? "Number" : "String"}">${xml(c)}</Data></Cell>`)
      .join("")}</Row>`;
  const body = [headers, ...rows].map(cellRow).join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="${xml(sheetName).slice(0, 31)}">
    <Table>${body}</Table>
  </Worksheet>
</Workbook>`;
}

// --- Import: students --------------------------------------------------------

export type ImportPreview = {
  columns: string[];
  rows: Record<string, string>[];
  totalRows: number;
  /** Row-level problems keyed by 1-based data row index. */
  errors: { row: number; message: string }[];
  /** How many rows would be created. */
  validCount: number;
};

export type StudentImportRow = {
  fullName: string;
  studentNumber: string;
  email?: string;
  guardianName?: string;
};

/**
 * Parse a students CSV and validate it without writing. Expected headers:
 * fullName, studentNumber, and optionally email, guardianName.
 */
export async function previewStudentImport(actor: Actor, csvText: string): Promise<ImportPreview> {
  authorize(actor, "student.import");
  const tenantId = requireTenantId(actor);
  const table = parseCsv(csvText);
  if (table.length === 0) throw Errors.validation("The file is empty.");

  const headers = table[0]!.map((h) => h.trim());
  const required = ["fullName", "studentNumber"];
  for (const r of required) {
    if (!headers.includes(r)) throw Errors.validation(`Missing required column: ${r}.`);
  }

  const existing = new Set(
    (await prisma.student.findMany({ where: { tenantId, deletedAt: null }, select: { studentNumber: true } })).map((s) => s.studentNumber),
  );

  const seen = new Set<string>();
  const rows: Record<string, string>[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 1; i < table.length; i++) {
    const cells = table[i]!;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => (obj[h] = (cells[idx] ?? "").trim()));
    const rowNo = i; // 1-based data row (header is row 0)
    if (!obj.fullName) {
      errors.push({ row: rowNo, message: "fullName is empty" });
      continue;
    }
    if (!obj.studentNumber) {
      errors.push({ row: rowNo, message: "studentNumber is empty" });
      continue;
    }
    if (existing.has(obj.studentNumber)) {
      errors.push({ row: rowNo, message: `studentNumber ${obj.studentNumber} already exists` });
      continue;
    }
    if (seen.has(obj.studentNumber)) {
      errors.push({ row: rowNo, message: `studentNumber ${obj.studentNumber} duplicated in file` });
      continue;
    }
    seen.add(obj.studentNumber);
    rows.push(obj);
  }

  return { columns: headers, rows, totalRows: table.length - 1, errors, validCount: rows.length };
}

/** Commit a previously previewed import (re-validated for safety). */
export async function commitStudentImport(actor: Actor, rows: StudentImportRow[]) {
  authorize(actor, "student.import");
  const tenantId = requireTenantId(actor);
  if (rows.length === 0) throw Errors.validation("Nothing to import.");
  if (rows.length > 2000) throw Errors.validation("Import at most 2000 rows at a time.");

  const numbers = rows.map((r) => r.studentNumber);
  const dupe = numbers.find((n, i) => numbers.indexOf(n) !== i);
  if (dupe) throw Errors.validation(`Duplicate student number in payload: ${dupe}.`);

  const result = await prisma.$transaction(async (tx) => {
    const existing = new Set(
      (await tx.student.findMany({ where: { tenantId, studentNumber: { in: numbers } }, select: { studentNumber: true } })).map((s) => s.studentNumber),
    );
    let created = 0;
    let skipped = 0;
    for (const r of rows) {
      if (existing.has(r.studentNumber)) {
        skipped++;
        continue;
      }
      let userId: string | null = null;
      if (r.email) {
        const user = await tx.user.upsert({
          where: { email: r.email },
          update: {},
          create: { email: r.email, fullName: r.fullName, passwordHash: "!imported-no-login", status: "ACTIVE" },
          select: { id: true },
        });
        userId = user.id;
      }
      await tx.student.create({
        data: { tenantId, userId, fullName: r.fullName, studentNumber: r.studentNumber },
      });
      created++;
    }
    return { created, skipped };
  });

  await recordAudit({ actor, action: "student.import", resource: "Student", metadata: { created: result.created, skipped: result.skipped } });
  return result;
}

// --- Export ------------------------------------------------------------------

export type ExportFormat = "csv" | "xlsx";

export async function exportStudents(actor: Actor, format: ExportFormat) {
  authorize(actor, "student.export");
  const tenantId = requireTenantId(actor);
  const students = await prisma.student.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { studentNumber: "asc" },
    select: { studentNumber: true, fullName: true, preferredName: true, gender: true, status: true, createdAt: true },
  });

  const headers = ["studentNumber", "fullName", "preferredName", "gender", "status", "createdAt"];
  const rows = students.map((s) => [s.studentNumber, s.fullName, s.preferredName ?? "", s.gender ?? "", s.status, s.createdAt.toISOString().slice(0, 10)]);
  await recordAudit({ actor, action: "student.export", resource: "Student", metadata: { format, count: rows.length } });
  return { headers, rows, filename: `students-${new Date().toISOString().slice(0, 10)}` };
}

export async function exportAttendance(actor: Actor, from: Date, to: Date, format: ExportFormat) {
  authorize(actor, "attendance.export");
  const tenantId = requireTenantId(actor);
  const records = await prisma.attendanceRecord.findMany({
    where: { tenantId, session: { sessionDate: { gte: from, lte: to } } },
    orderBy: { session: { sessionDate: "asc" } },
    take: 5000,
    select: { status: true, session: { select: { sessionDate: true, classroom: { select: { name: true } } } }, student: { select: { fullName: true, studentNumber: true } } },
  });
  const headers = ["date", "classroom", "studentNumber", "studentName", "status"];
  const rows = records.map((r) => [
    r.session.sessionDate.toISOString().slice(0, 10),
    r.session.classroom?.name ?? "",
    r.student?.studentNumber ?? "",
    r.student?.fullName ?? "",
    r.status,
  ]);
  await recordAudit({ actor, action: "attendance.export", resource: "AttendanceRecord", metadata: { format, count: rows.length, from: from.toISOString(), to: to.toISOString() } });
  return { headers, rows, filename: `attendance-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}` };
}
