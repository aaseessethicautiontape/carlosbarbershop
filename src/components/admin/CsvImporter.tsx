"use client";
import Papa from "papaparse";
import { useMemo, useState, useTransition } from "react";
import { importClientsAction } from "@/app/admin/(app)/clients/actions";
import { formatPhone } from "@/lib/format";
import { guessMapping, mapRows, TARGETS, type Mapping, type Target } from "@/lib/csv/mapping";

const LABEL: Record<Target, string> = { name: "Full name", first_name: "First name", last_name: "Last name", phone: "Phone", email: "Email", notes: "Notes" };

/** Upload → map columns → preview what will happen → import. Nothing is saved until the last button. */
export function CsvImporter() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const mapped = useMemo(() => mapRows(rows, mapping), [rows, mapping]);

  function onFile(file: File | undefined) {
    if (!file) return;
    setResult(null); setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim(),
      complete: (res) => { const h = res.meta.fields ?? []; setHeaders(h); setRows(res.data); setMapping(guessMapping(h)); },
      error: (e) => setResult({ ok: false, text: `Couldn't read that file: ${e.message}` }),
    });
  }

  const needsName = !mapping.name && !(mapping.first_name || mapping.last_name);
  const canImport = mapped.valid.length > 0 && !needsName && !pending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card-a">
        <label className="fld">1. Choose a CSV file exported from your current system
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {fileName && <p style={{ margin: "8px 0 0", color: "var(--a-mute)" }}>{fileName} · {rows.length} rows</p>}
      </div>

      {headers.length > 0 && (
        <>
          <div className="card-a">
            <b>2. Match the columns</b>
            <p style={{ margin: "4px 0 12px", color: "var(--a-mute)" }}>We guessed where we could. Change any that look wrong.</p>
            <div className="grid-a">
              {TARGETS.map((t) => (
                <label className="fld" key={t}>{LABEL[t]}
                  <select value={mapping[t] ?? ""} onChange={(e) => setMapping({ ...mapping, [t]: e.target.value || undefined })}>
                    <option value="">— not in my file —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {needsName && <p className="form-error" style={{ marginTop: 12 }}>Pick a name column (or first and last name).</p>}
          </div>

          <div className="card-a">
            <b>3. Preview</b>
            <p style={{ margin: "4px 0 12px" }}>
              <span className="pill" style={{ background: "#eaf5ed", color: "#2e6b43" }}>{mapped.valid.length} ready</span>{" "}
              <span className="pill">{mapped.duplicates} duplicates in file</span>{" "}
              <span className="pill" style={{ background: mapped.invalid.length ? "#fbedee" : undefined }}>{mapped.invalid.length} skipped</span>
            </p>
            <div className="tbl">
              <div className="tr h" style={{ ["--tcols" as string]: "1.4fr 1fr 1.4fr 1.4fr" }}><span>Name</span><span>Phone</span><span>Email</span><span>Notes</span></div>
              {mapped.valid.slice(0, 8).map((r, i) => (
                <div className="tr" key={i} style={{ ["--tcols" as string]: "1.4fr 1fr 1.4fr 1.4fr" }}><b>{r.name}</b><span>{formatPhone(r.phone) || "—"}</span><span>{r.email ?? "—"}</span><span>{r.notes ?? "—"}</span></div>
              ))}
            </div>
            {mapped.invalid.length > 0 && (
              <details style={{ marginTop: 10 }}><summary>Why were {mapped.invalid.length} rows skipped?</summary>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>{mapped.invalid.slice(0, 20).map((x) => <li key={x.line}>Line {x.line}: {x.reason}</li>)}</ul>
              </details>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-red" disabled={!canImport} onClick={() => start(async () => {
              const r = await importClientsAction({ rows: mapped.valid });
              setResult(r.ok ? { ok: true, text: `Imported ${r.added} new clients. ${r.skipped} already existed and were left as they were.` } : { ok: false, text: r.error });
            })}>{pending ? "Importing…" : `Import ${mapped.valid.length} clients`}</button>
            <span style={{ color: "var(--a-mute)" }}>Existing clients (same phone or email) are never overwritten.</span>
          </div>
        </>
      )}
      {result && <p role="status" className={result.ok ? "ok-msg" : "form-error"}>{result.text}</p>}
    </div>
  );
}
