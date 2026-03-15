import { useEffect, useState } from "react";
import {
  Database,
  ExternalLink,
  Mic,
  PhoneCall,
  RadioTower,
  RefreshCw,
} from "lucide-react";
import {
  apiService,
  CallingServiceStatus,
  CollectedCallRecord,
} from "../services/api";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export function CallingConsolePage() {
  const [status, setStatus] = useState<CallingServiceStatus | null>(null);
  const [records, setRecords] = useState<CollectedCallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void refreshConsole();
  }, []);

  const refreshConsole = async () => {
    try {
      setLoading(true);
      setError("");

      const [statusResponse, recordsResponse] = await Promise.all([
        apiService.getCallingServiceStatus(),
        apiService.getCollectedCallRecords(),
      ]);

      setStatus(statusResponse);
      setRecords(recordsResponse);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load calling data."
      );
    } finally {
      setLoading(false);
    }
  };

  const latestRecord = records[0] ?? null;

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-slate-200 bg-white/94 p-5 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.3)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Calls Monitor
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Call data and transcript view
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              This page is intentionally simple. Use Swagger or your detector
              integration to trigger broadcast or collect-details flows, then
              use this page only to confirm that CivicMitra received the
              records, transcripts, and endpoint configuration correctly.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={refreshConsole}
            disabled={loading}
            className="rounded-full border-slate-300 px-5 text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh data
          </Button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[24px] border-slate-200 bg-white/94 p-5 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.3)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Service State
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">
                Backend and calling routes
              </h3>
            </div>
            <Badge
              className={
                status?.reachable
                  ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                  : "border-amber-200 bg-amber-100 text-amber-800"
              }
            >
              {status?.reachable ? "Connected" : "Needs attention"}
            </Badge>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <RadioTower className="h-4 w-4" />
                Internal calling service
              </div>
              <p className="mt-2 break-all text-sm text-slate-600">
                {status?.base_url || "Not loaded"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <PhoneCall className="h-4 w-4" />
                Public broadcast endpoint
              </div>
              <p className="mt-2 break-all text-sm text-slate-600">
                {status?.detector_broadcast_endpoint ||
                  status?.public_broadcast_endpoint ||
                  "Not configured"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Mic className="h-4 w-4" />
                Public collect-details endpoint
              </div>
              <p className="mt-2 break-all text-sm text-slate-600">
                {status?.detector_collect_endpoint ||
                  status?.public_collect_endpoint ||
                  "Not configured"}
              </p>
            </div>
          </div>

            <div className="mt-5 rounded-[20px] border border-slate-200 bg-slate-950 p-4 text-slate-100">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Database className="h-4 w-4" />
                Test this from Swagger
              </div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">
              <p>
                Trigger data from Swagger instead of this page if international
                calling is blocked in your account.
              </p>
              <p className="break-all">
                Broadcast:{" "}
                {status?.detector_broadcast_endpoint ||
                  "https://<your-public-url>/api/calls/broadcast"}
              </p>
              <p className="break-all">
                Collect details:{" "}
                {status?.detector_collect_endpoint ||
                  "https://<your-public-url>/api/calls/collect-details"}
              </p>
              <p className="text-slate-400">
                Use a payload with both `prompt` and `location_prompt` so the call
                asks for the issue first and then the exact location.
              </p>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {status?.detail ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {status.detail}
            </div>
          ) : null}
        </Card>

        <div className="space-y-5">
          <Card className="rounded-[24px] border-slate-200 bg-white/94 p-5 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.3)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Latest Result
                </p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">
                  Most recent collected response
                </h3>
              </div>
              <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                {records.length} total
              </Badge>
            </div>

            {loading ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-600">
                Loading latest call data...
              </div>
            ) : latestRecord ? (
              <div className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Caller Number
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {latestRecord.number}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Completed At
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {formatDateTime(
                        latestRecord.completed_at || latestRecord.created_at
                      )}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Issue Prompt
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {latestRecord.prompt || "Prompt not available."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Location Prompt
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {latestRecord.location_prompt || "Location prompt not available."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Issue Transcript
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {latestRecord.issue_transcript ||
                      latestRecord.transcript ||
                      "Issue transcript not available for this record."}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Location Transcript
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {latestRecord.location_transcript ||
                      "Location transcript not available for this record."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                  <span>
                    <span className="font-medium text-slate-900">Flow:</span>{" "}
                    {latestRecord.flow}
                  </span>
                  {latestRecord.call_sid ? (
                    <span className="break-all">
                      <span className="font-medium text-slate-900">Call SID:</span>{" "}
                      {latestRecord.call_sid}
                    </span>
                  ) : null}
                  {latestRecord.issue_recording_url || latestRecord.recording_url ? (
                    <a
                      href={latestRecord.issue_recording_url || latestRecord.recording_url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-sky-700 hover:text-sky-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Issue recording
                    </a>
                  ) : null}
                  {latestRecord.location_recording_url ? (
                    <a
                      href={latestRecord.location_recording_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-sky-700 hover:text-sky-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Location recording
                    </a>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-600">
                No collected call data yet. Trigger the flow from Swagger and
                refresh this page.
              </div>
            )}
          </Card>

          <Card className="rounded-[24px] border-slate-200 bg-white/94 p-5 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.3)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Transcript Feed
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-900">
                Synced collected records
              </h3>
            </div>

            {loading ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-600">
                Loading records...
              </div>
            ) : records.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-6 text-sm text-slate-600">
                No synced records available.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {records.map((record) => (
                  <div
                    key={record.token}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="border-blue-200 bg-blue-100 text-blue-800">
                            {record.flow}
                          </Badge>
                          <Badge className="border-slate-200 bg-slate-100 text-slate-700">
                            {record.status || "completed"}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-700">
                          <span className="font-medium text-slate-900">Number:</span>{" "}
                          {record.number}
                        </p>
                        <p className="text-sm text-slate-700">
                          <span className="font-medium text-slate-900">Completed:</span>{" "}
                          {formatDateTime(record.completed_at || record.created_at)}
                        </p>
                      </div>

                      {record.recording_url ? (
                        <a
                          href={record.location_recording_url || record.issue_recording_url || record.recording_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-800"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Recording
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Issue
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {record.issue_transcript ||
                          record.transcript ||
                          "Issue transcript not available for this record."}
                      </p>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Location
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {record.location_transcript ||
                          "Location transcript not available for this record."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
