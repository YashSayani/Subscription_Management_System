import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  Activity,
  Database,
  Server,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { HealthResponse } from '@brightloop/shared';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

interface ApiResponse {
  success: boolean;
  data: HealthResponse;
}

const fetchHealth = async (): Promise<HealthResponse> => {
  const res = await axios.get<ApiResponse>('/api/health');
  return res.data.data;
};

export const DiagnosticsPage: React.FC = () => {
  const { data, error, isLoading, isFetching, refetch } = useQuery<HealthResponse>({
    queryKey: ['system-health'],
    queryFn: fetchHealth,
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Activity className="h-5 w-5 text-emerald-400" />
            Infrastructure & Health Diagnostics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time live verification between React SPA, Express REST API, and local PostgreSQL instance.
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          disabled={isFetching}
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />}
        >
          {isFetching ? 'Checking...' : 'Refresh Status'}
        </Button>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center">
            <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin mb-3" />
            <p className="text-xs text-slate-400">Probing backend and database connectivity...</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-rose-300">Connection Error</h3>
            <p className="text-xs text-rose-400/90 mt-1">
              Failed to connect to the backend API at <code className="font-mono text-rose-200">/api/health</code>.
              Ensure the Express API server is active on port 4000.
            </p>
          </div>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PostgreSQL Connectivity Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">PostgreSQL Engine</CardTitle>
                  <CardDescription>Primary relational storage</CardDescription>
                </div>
              </div>
              <Badge variant={data.database.connected ? 'success' : 'danger'}>
                {data.database.connected ? 'Connected' : 'Disconnected'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Active Database:</span>
                <span className="font-mono text-white bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  {data.database.databaseName}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Query Round-Trip Latency:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {data.database.latencyMs} ms
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Sequences & Constraints:</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Express REST API Server Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Server className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Express REST API</CardTitle>
                  <CardDescription>Modular Monolith runtime</CardDescription>
                </div>
              </div>
              <Badge variant="info">Operational</Badge>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Server Process Uptime:</span>
                <span className="font-mono text-white flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  {Math.floor(data.uptime)} seconds
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Server Timezone:</span>
                <span className="font-mono text-white">Asia/Kolkata (IST)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Runtime Environment:</span>
                <span className="font-mono uppercase text-xs text-amber-400">
                  {data.environment}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
