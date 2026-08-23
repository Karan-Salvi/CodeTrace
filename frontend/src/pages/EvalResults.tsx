import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CardSoft } from "../components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { BrandLogo } from "../components/ui/BrandLogo";

interface RetrievalRow {
  recall_at_5: number;
  precision_at_5: number;
  mrr: number;
}

interface EvalSnapshot {
  generatedAt: string;
  retrieval: Record<string, RetrievalRow>;
  prReview: { truePositives: number; falsePositives: number; falseNegatives: number; precision: number; recall: number };
  symbolRelationships: { precision: number; recall: number };
}

const RETRIEVAL_CONFIG_ORDER = ["Vector", "Keyword", "Hybrid", "Hybrid+Rerank"];

function formatPct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-mute mb-xxs">{label}</p>
      <p className="text-[22px] font-semibold text-ink font-mono">{value}</p>
    </div>
  );
}

export function EvalResults() {
  const [data, setData] = useState<EvalSnapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/eval-results.json")
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setData)
      .catch(() => setError("Evaluation results haven't been published yet."));
  }, []);

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-[840px] mx-auto px-md py-3xl">
        <Link to="/" className="flex items-center gap-2 mb-2xl w-fit">
          <BrandLogo className="w-5 h-5 text-ink" />
          <span className="font-semibold text-[14px] text-ink">CodeTrace</span>
        </Link>

        <h1 className="text-[28px] font-semibold tracking-tight text-ink mb-xxs">Evaluation results</h1>
        <p className="text-[15px] text-mute mb-xl">
          Measured, not estimated — retrieval and PR-review quality scored against a fixed fixture repository via{" "}
          <code className="text-[13px] bg-canvas-soft px-1 py-0.5 rounded-xs">evaluation/</code>.
        </p>

        {error ? (
          <CardSoft className="p-lg">
            <p className="text-[14px] text-mute">{error}</p>
          </CardSoft>
        ) : !data ? (
          <div className="h-[200px] animate-pulse bg-canvas-soft border border-hairline rounded-lg" />
        ) : (
          <div className="flex flex-col gap-xl">
            <p className="text-[13px] text-mute">Last measured {formatDate(data.generatedAt)}</p>

            <div>
              <h2 className="text-[16px] font-semibold text-ink mb-sm">Retrieval quality</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Config</TableHead>
                    <TableHead>Recall@5</TableHead>
                    <TableHead>Precision@5</TableHead>
                    <TableHead>MRR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {RETRIEVAL_CONFIG_ORDER.filter((c) => data.retrieval[c]).map((config) => (
                    <TableRow key={config}>
                      <TableCell className="font-medium">{config}</TableCell>
                      <TableCell className="font-mono">{formatPct(data.retrieval[config].recall_at_5)}</TableCell>
                      <TableCell className="font-mono">{formatPct(data.retrieval[config].precision_at_5)}</TableCell>
                      <TableCell className="font-mono">{data.retrieval[config].mrr.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <h2 className="text-[16px] font-semibold text-ink mb-sm">PR review</h2>
              <CardSoft className="p-md">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-md">
                  <StatBlock label="Precision" value={data.prReview.precision.toFixed(2)} />
                  <StatBlock label="Recall" value={data.prReview.recall.toFixed(2)} />
                  <StatBlock label="True positives" value={String(data.prReview.truePositives)} />
                  <StatBlock
                    label="False pos / neg"
                    value={`${data.prReview.falsePositives} / ${data.prReview.falseNegatives}`}
                  />
                </div>
              </CardSoft>
            </div>

            <div>
              <h2 className="text-[16px] font-semibold text-ink mb-sm">Symbol relationships</h2>
              <CardSoft className="p-md">
                <div className="grid grid-cols-2 gap-md">
                  <StatBlock label="Precision" value={data.symbolRelationships.precision.toFixed(2)} />
                  <StatBlock label="Recall" value={data.symbolRelationships.recall.toFixed(2)} />
                </div>
              </CardSoft>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
