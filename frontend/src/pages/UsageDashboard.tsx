import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "../lib/api-client";
import type { UsageSummaryResponse } from "../types";
import { CardSoft } from "../components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { EmptyState, EmptyStateIcon, EmptyStateTitle, EmptyStateDescription } from "../components/ui/empty-state";
import { DollarSign, Hash, MessageSquare, GitMerge, Gauge, GitBranch } from "lucide-react";

const RANGE_OPTIONS: Array<7 | 30 | 90> = [7, 30, 90];

// Cost per LLM call is fractions of a cent (Gemini flash-tier pricing) —
// toFixed(4) rounds most real calls straight to $0.0000, which is exactly
// the "can't tell how much I'm actually spending" complaint this redesign
// fixes. 6 decimals matches usage_logs.cost_usd's own DB precision
// (Decimal(10,6)) — showing more than the column can hold would be false
// precision, showing less throws away real data the column actually has.
const formatCost = (n: number) => `$${n.toFixed(6)}`;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatCard({
  icon: Icon,
  label,
  value,
  hero,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  hero?: boolean;
}) {
  return (
    <CardSoft className={hero ? "p-lg" : "p-md"}>
      <div className="flex items-center gap-xs mb-sm">
        <div
          className={
            hero
              ? "w-9 h-9 rounded-full bg-success/10 border border-success/20 flex items-center justify-center"
              : "w-7 h-7 rounded-full bg-canvas border border-hairline flex items-center justify-center"
          }
        >
          <Icon className={hero ? "w-4 h-4 text-success" : "w-3.5 h-3.5 text-mute"} />
        </div>
        <p className="text-[12px] text-mute">{label}</p>
      </div>
      <p className={hero ? "text-[32px] font-semibold text-ink font-mono tracking-tight" : "text-[20px] font-semibold text-ink font-mono"}>
        {value}
      </p>
    </CardSoft>
  );
}

function KindBreakdown({ data }: { data: UsageSummaryResponse }) {
  const { QA, PR_REVIEW, INDEXING } = data.totals.byKind;
  const total = QA.costUsd + PR_REVIEW.costUsd + (INDEXING?.costUsd || 0);
  const qaPct = total > 0 ? (QA.costUsd / total) * 100 : 33.3;
  const prPct = total > 0 ? (PR_REVIEW.costUsd / total) * 100 : 33.3;
  const idxPct = total > 0 ? ((INDEXING?.costUsd || 0) / total) * 100 : 33.4;

  return (
    <CardSoft className="p-md">
      <p className="text-[12px] text-mute mb-sm">Cost by kind</p>
      <div className="flex h-2 rounded-full overflow-hidden bg-canvas mb-sm">
        {total > 0 ? (
          <>
            <div className="bg-success" style={{ width: `${qaPct}%` }} />
            <div className="bg-warning" style={{ width: `${prPct}%` }} />
            <div className="bg-positive" style={{ width: `${idxPct}%` }} />
          </>
        ) : (
          <div className="bg-hairline w-full" />
        )}
      </div>
      <div className="flex flex-col gap-xs">
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-xs text-body">
            <MessageSquare className="w-3.5 h-3.5 text-success" />
            QA
          </span>
          <span className="font-mono text-ink">{formatCost(QA.costUsd)}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-xs text-body">
            <GitMerge className="w-3.5 h-3.5 text-warning" />
            PR Review
          </span>
          <span className="font-mono text-ink">{formatCost(PR_REVIEW.costUsd)}</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-xs text-body">
            <GitBranch className="w-3.5 h-3.5 text-positive" />
            Indexing
          </span>
          <span className="font-mono text-ink">~{formatCost(INDEXING?.costUsd || 0)}</span>
        </div>
      </div>
    </CardSoft>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-lg animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-sm">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[92px] bg-canvas-soft border border-hairline rounded-lg" />
        ))}
      </div>
      <div className="h-[220px] bg-canvas-soft border border-hairline rounded-lg" />
    </div>
  );
}

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
    // Standard fetch-on-mount/range-change — load() setting loading/error
    // state synchronously at its top is the intended behavior here (an
    // immediate loading indicator), not the cascading-render footgun
    // this rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const avgCostPerCall = data && data.totals.calls > 0 ? data.totals.costUsd / data.totals.calls : 0;
  const maxDailyCost = data ? Math.max(...data.daily.map((d) => d.costUsd), 0.000001) : 1;
  const isEmpty = data && data.totals.calls === 0;

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Usage</h1>
          <p className="text-[14px] text-mute mt-xxs">
            Real LLM spend — QA, PR-review and estimated indexing cost.
          </p>
        </div>
        <div className="flex items-center gap-xxs bg-canvas-soft border border-hairline rounded-full p-xxs w-fit">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setRange(opt)}
              className={`px-sm py-xxs rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
                range === opt ? "bg-canvas text-ink border border-hairline" : "text-mute hover:text-ink"
              }`}
            >
              {opt}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <p className="text-[14px] text-error-deep bg-error-soft p-sm rounded-xs">{error}</p>
      ) : data && isEmpty ? (
        <EmptyState className="border border-hairline bg-canvas">
          <EmptyStateIcon>
            <Gauge className="w-8 h-8 text-mute" />
          </EmptyStateIcon>
          <EmptyStateTitle>No usage in this range</EmptyStateTitle>
          <EmptyStateDescription>
            Ask a question in any repository's Chat tab, or trigger a PR review, and it'll show up here.
          </EmptyStateDescription>
        </EmptyState>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-sm">
            <div className="sm:col-span-2 lg:col-span-1">
              <StatCard icon={DollarSign} label="Total cost" value={formatCost(data.totals.costUsd)} hero />
            </div>
            <KindBreakdown data={data} />
            <StatCard icon={Hash} label="Avg cost / call" value={formatCost(avgCostPerCall)} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-sm">
            <StatCard icon={Hash} label="Total tokens" value={data.totals.tokens.toLocaleString()} />
            <StatCard icon={MessageSquare} label="QA calls" value={String(data.totals.byKind.QA.calls)} />
            <StatCard icon={GitMerge} label="PR-review calls" value={String(data.totals.byKind.PR_REVIEW.calls)} />
            <StatCard icon={GitBranch} label="Indexing cost" value={`~${formatCost(data.totals.byKind.INDEXING?.costUsd || 0)}`} />
            <StatCard icon={Gauge} label="Total calls" value={String(data.totals.calls)} />
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-ink mb-sm">Daily</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead className="w-[40%]">&nbsp;</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.daily.map((d) => (
                  <TableRow key={d.date}>
                    <TableCell className="text-mute">{formatDate(d.date)}</TableCell>
                    <TableCell className="font-mono">{formatCost(d.costUsd)}</TableCell>
                    <TableCell>
                      <div className="h-1.5 rounded-full bg-canvas-soft overflow-hidden w-full">
                        <div
                          className="h-full bg-success rounded-full"
                          style={{ width: `${(d.costUsd / maxDailyCost) * 100}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-right">{d.calls}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-ink mb-sm">Top repositories by cost</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topRepositories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-mute text-center py-lg">
                      No usage in this range.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.topRepositories.map((r, i) => (
                    <TableRow key={r.repositoryId}>
                      <TableCell className="text-mute font-mono">{i + 1}</TableCell>
                      <TableCell className="truncate max-w-[240px]">
                        <span className="text-mute">{r.owner}/</span>
                        <span className="text-ink font-medium">{r.name}</span>
                      </TableCell>
                      <TableCell className="font-mono">{formatCost(r.costUsd)}</TableCell>
                      <TableCell className="font-mono text-right">{r.calls}</TableCell>
                      <TableCell className="font-mono text-right text-mute">
                        {data.totals.costUsd > 0 ? `${((r.costUsd / data.totals.costUsd) * 100).toFixed(1)}%` : "—"}
                      </TableCell>
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
