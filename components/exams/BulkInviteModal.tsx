"use client";

import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { authHeaders } from "@/lib/auth-token";
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  X,
} from "lucide-react";

export interface StudentInviteRow {
  name: string;
  email: string;
  enrollmentNo: string;
}

export interface BulkInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId: string;
  examTitle?: string;
}

export function BulkInviteModal({
  isOpen,
  onClose,
  examId,
  examTitle = "Exam",
}: BulkInviteModalProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<StudentInviteRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [sending, setSending] = useState<boolean>(false);
  /** Per-row outcomes after sending, index-aligned with parsedRows. */
  const [rowResults, setRowResults] = useState<
    { row: StudentInviteRow; ok: boolean; error?: string }[] | null
  >(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Handles CSV parsing
  const handleFileChange = (file: File) => {
    setParseError(null);
    setRowResults(null);
    setSendError(null);

    if (!file.name.endsWith(".csv")) {
      setParseError("Please select a valid .csv file");
      return;
    }

    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setParseError("CSV file must contain a header row and at least one student row.");
          return;
        }

        // Keep EVERY data line (even short ones) so preview indices stay
        // 1:1 aligned with the server's row numbers in per-row errors.
        // No fabricated names or enrollment numbers — blanks stay blank and
        // the server reports them per row.
        const rows: StudentInviteRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
          rows.push({
            name: cols[0] || "",
            email: cols[1] || "",
            enrollmentNo: cols[2] || "",
          });
        }

        setParsedRows(rows);
      } catch (err) {
        setParseError("Failed to parse CSV file format.");
      }
    };
    reader.readAsText(file);
  };

  // Generates and downloads template CSV
  const handleDownloadTemplate = () => {
    const templateContent =
      "Name,Email,EnrollmentNo\nJohn Doe,john.doe@example.com,ENR202601\nJane Smith,jane.smith@example.com,ENR202602\nAlex Kumar,alex.kumar@example.com,ENR202603";
    const blob = new Blob([templateContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "examora_student_invite_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sends invites via API. No fabricated outcomes: HTTP/network failures
  // surface as errors, and per-row results come from the server's errors[]
  // ("Row N: ..." / "Row N (email): ...", 1-based over the data rows).
  const handleSendInvites = async () => {
    if (!csvFile || parsedRows.length === 0) return;

    setSending(true);
    setRowResults(null);
    setSendError(null);

    try {
      const formData = new FormData();
      formData.append("file", csvFile);
      formData.append("students", JSON.stringify(parsedRows));

      const res = await fetch(`/api/exams/${examId}/invite-bulk`, {
        method: "POST",
        credentials: "include",
        headers: { ...authHeaders() },
        body: formData,
      });

      const payload = (await res.json().catch(() => ({}))) as {
        message?: string;
        data?: { successful?: number; failed?: number; errors?: string[] };
      };

      if (!res.ok) {
        setSendError(
          payload?.message ?? "The invite request failed. No invites were sent."
        );
        return;
      }

      const errorByRow = new Map<number, string>();
      for (const entry of payload.data?.errors ?? []) {
        const match = /^Row (\d+)\s*(?:\(.*?\))?\s*:?\s*(.*)$/.exec(entry);
        if (match) {
          const idx = Number(match[1]) - 1;
          if (idx >= 0 && !errorByRow.has(idx)) {
            errorByRow.set(idx, match[2] || entry);
          }
        }
      }

      setRowResults(
        parsedRows.map((row, index) => ({
          row,
          ok: !errorByRow.has(index),
          error: errorByRow.get(index),
        }))
      );
    } catch {
      setSendError("Could not reach the server. No invites were sent.");
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setCsvFile(null);
    setParsedRows([]);
    setParseError(null);
    setRowResults(null);
    setSendError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Bulk Invite Students</h2>
              <p className="text-xs text-slate-500">Upload CSV to invite multiple candidates to {examTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-6 space-y-5">
          {sendError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Invites were not sent</p>
                <p className="mt-0.5">{sendError}</p>
              </div>
            </div>
          )}

          {/* Per-row result table after sending */}
          {rowResults ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                {rowResults.every((r) => r.ok) ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <p className="font-bold text-emerald-950">
                      All {rowResults.length} invite
                      {rowResults.length === 1 ? "" : "s"} sent
                    </p>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <p className="font-bold text-slate-900">
                      {rowResults.filter((r) => r.ok).length} sent ·{" "}
                      {rowResults.filter((r) => !r.ok).length} failed
                    </p>
                  </>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 font-semibold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rowResults.map(({ row, ok, error }, i) => (
                      <tr key={i} className={ok ? "" : "bg-red-50/50"}>
                        <td className="p-2.5 font-medium text-slate-900">
                          {row.name || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600">
                          {row.email || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="p-2.5">
                          {ok ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Sent
                            </span>
                          ) : (
                            <span>
                              <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                                <AlertCircle className="h-3.5 w-3.5" /> Failed
                              </span>
                              {error && (
                                <span className="mt-0.5 block font-normal text-red-600">
                                  {error}
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pt-1 text-center">
                <Button onClick={handleReset} variant="outline">
                  Invite More Students
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Template & Upload Zone */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  1. CSV File Selection
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="gap-2 text-xs border-slate-200 text-indigo-600 hover:bg-indigo-50"
                >
                  <Download className="h-3.5 w-3.5" /> Download CSV Template
                </Button>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) {
                    handleFileChange(e.dataTransfer.files[0]);
                  }
                }}
                className="group cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/30 p-8 text-center transition"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
                  }}
                />
                <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-400 group-hover:text-indigo-600 transition" />
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {csvFile ? csvFile.name : "Click or drag & drop CSV file here"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Expected columns: <code className="font-mono text-slate-600">Name, Email, EnrollmentNo</code>
                </p>
              </div>

              {parseError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Parsed CSV Preview Table */}
              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">
                      2. Preview Candidates ({parsedRows.length} total)
                    </span>
                    <button onClick={handleReset} className="text-red-500 hover:underline">
                      Clear Selection
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 font-semibold text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Email</th>
                          <th className="p-2.5">Enrollment No</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {parsedRows.map((row, i) => (
                          <tr key={i} className="hover:bg-white transition">
                            <td className="p-2.5 font-medium text-slate-900">{row.name}</td>
                            <td className="p-2.5 font-mono text-slate-600">{row.email}</td>
                            <td className="p-2.5 font-mono text-slate-600">{row.enrollmentNo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          {!rowResults && (
            <Button
              onClick={handleSendInvites}
              disabled={parsedRows.length === 0 || sending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px]"
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                `Send ${parsedRows.length > 0 ? parsedRows.length : ""} Invites`
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BulkInviteModal;
