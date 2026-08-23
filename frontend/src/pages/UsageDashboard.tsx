import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../lib/api-client";
import type { UsageSummaryResponse } from "../types";
import { CardSoft } from "../components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Loader2 } from "lucide-react";

const RANGE_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];

export function UsageDashboard() {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<UsageSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<UsageSummaryResponse>(`/usage/summary?days=${range}`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load usage data");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-lg">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Usage</h1>
        <p className="text-[14px] text-mute mt-xxs">
          Real LLM spend — QA and PR-review only. Indexing cost is not yet tracked.
        </p>
      </div>

      <div className="flex items-center gap-xs">
        {RANGE_OPTIONS.map((opt) => (
          <Button
            key={opt}
            variant={range === opt ? "primary-sm" : "secondary-sm"}
            onClick={() => setRange(opt)}
          >
            {opt}d
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-[200px] items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-mute" />
        </div>
      ) : error ? (
        <p className="text-[14px] text-error-deep bg-error-soft p-sm rounded-xs">{error}</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-sm">
            <CardSoft className="p-md">
              <p className="text-[12px] text-mute mb-xxs">Total cost</p>
              <p className="text-[22px] font-semibold text-ink font-mono">${data.totals.costUsd.toFixed(4)}</p>
            </CardSoft>
            <CardSoft className="p-md">
              <p className="text-[12px] text-mute mb-xxs">Total tokens</p>
              <p className="text-[22px] font-semibold text-ink font-mono">{data.totals.tokens.toLocaleString()}</p>
            </CardSoft>
            <CardSoft className="p-md">
              <p className="text-[12px] text-mute mb-xxs">QA calls</p>
              <p className="text-[22px] font-semibold text-ink font-mono">{data.totals.byKind.QA.calls}</p>
            </CardSoft>
            <CardSoft className="p-md">
              <p className="text-[12px] text-mute mb-xxs">PR-review calls</p>
              <p className="text-[22px] font-semibold text-ink font-mono">{data.totals.byKind.PR_REVIEW.calls}</p>
            </CardSoft>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-ink mb-sm">Daily</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Calls</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.daily.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-mute text-center py-lg">
                      No usage in this range.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.daily.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell>{d.date}</TableCell>
                      <TableCell className="font-mono">${d.costUsd.toFixed(4)}</TableCell>
                      <TableCell className="font-mono">{d.calls}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-ink mb-sm">Top repositories by cost</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repository</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Calls</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topRepositories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-mute text-center py-lg">
                      No usage in this range.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.topRepositories.map((r) => (
                    <TableRow key={r.repositoryId}>
                      <TableCell className="truncate max-w-[240px]">{r.owner}/{r.name}</TableCell>
                      <TableCell className="font-mono">${r.costUsd.toFixed(4)}</TableCell>
                      <TableCell className="font-mono">{r.calls}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
    </div>
  );
}
