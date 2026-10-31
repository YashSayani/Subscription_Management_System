import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Activity, Database, Server, Clock, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import type { HealthResponse } from '@brightloop/shared';

interface ApiResponse {
  success: boolean;
  data: HealthResponse;
}

const fetchHealth = async (): Promise<HealthResponse> => {
  const res = await axios.get<ApiResponse>('/api/health');
  return res.data.data;
};

export default function App() {
  const { data, error, isLoading, isFetching, refetch } = useQuery<HealthResponse>({
    queryKey: ['system-health'],
    queryFn: fetchHealth,
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">Brightloop</h1>
              <p className="text-xs text-slate-400">Subscription Management System</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
              Step P0 Bootstrap
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl">
          <div className="flex items-center justify-between pb-6 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                System Diagnostics & Infrastructure Health
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Real-time connectivity verification between React SPA, Express REST API, and PostgreSQL.
              </p>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Re-check Health
            </button>
          </div>

          {/* Health Status View */}
          <div className="mt-6">
            {isLoading && (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="text-sm">Querying backend /api/health and PostgreSQL...</p>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 mt-0.5 text-rose-400 shrink-0" />
                <div>
                  <h3 className="font-semibold text-rose-200">API Connection Failed</h3>
                  <p className="text-xs text-rose-300/80 mt-1">
                    {error instanceof Error ? error.message : 'Unable to connect to http://localhost:4000/api/health'}
                  </p>
                  <p className="text-xs text-rose-400 mt-2">
                    Ensure the Express backend is running (`npm run dev --workspace=@brightloop/api`).
                  </p>
                </div>
              </div>
            )}

            {data && (
              <div className="space-y-6">
                {/* Overall Status Banner */}
                <div
                  className={`p-4 rounded-lg border flex items-center justify-between ${
                    data.database.connected
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {data.database.connected ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-amber-400" />
                    )}
                    <div>
                      <span className="font-semibold">
                        {data.database.connected
                          ? 'All Systems Operational'
                          : 'Database Connection Degraded'}
                      </span>
                      <p className="text-xs opacity-80 mt-0.5">
                        API responding at /api/health | Node environment: {data.environment}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
                    HTTP 200 OK
                  </span>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Database Card */}
                  <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <div className="flex items-center justify-between text-slate-400 text-xs">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Database className="h-4 w-4 text-emerald-400" /> PostgreSQL
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          data.database.connected
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {data.database.connected ? 'Connected' : 'Offline'}
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="text-lg font-semibold text-white font-mono">
                        {data.database.databaseName}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                        <span>Query Latency</span>
                        <span className="font-mono text-emerald-400">{data.database.latencyMs} ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Server Uptime Card */}
                  <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <div className="flex items-center justify-between text-slate-400 text-xs">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Server className="h-4 w-4 text-blue-400" /> Express REST API
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">Node v24</span>
                    </div>
                    <div className="mt-3">
                      <div className="text-lg font-semibold text-white font-mono">
                        {data.uptime}s uptime
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                        <span>Server Status</span>
                        <span className="text-emerald-400 font-medium">Active</span>
                      </div>
                    </div>
                  </div>

                  {/* Timestamp Card */}
                  <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <div className="flex items-center justify-between text-slate-400 text-xs">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Clock className="h-4 w-4 text-purple-400" /> Server Time
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">UTC</span>
                    </div>
                    <div className="mt-3">
                      <div className="text-sm font-semibold text-white font-mono truncate">
                        {new Date(data.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 truncate font-mono text-[11px]">
                        {new Date(data.timestamp).toISOString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500">
        Brightloop Software &copy; 2026 &bull; Strict PostgreSQL Persistence &bull; Zero Float Financial Engine
      </footer>
    </div>
  );
}
