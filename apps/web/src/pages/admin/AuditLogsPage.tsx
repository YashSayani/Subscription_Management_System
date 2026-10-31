import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Eye,
  KeyRound,
  CreditCard,
  Layers,
  User,
  Clock,
} from 'lucide-react';
import { AuditLogDto } from '@brightloop/shared';
import { apiClient } from '../../api/client';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export const AuditLogsPage: React.FC = () => {
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [inspectLog, setInspectLog] = useState<AuditLogDto | null>(null);

  const {
    data: auditData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<{ logs: AuditLogDto[]; total: number }>({
    queryKey: ['admin-audit-logs', selectedAction, selectedEntity],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedAction !== 'all') params.append('action', selectedAction);
      if (selectedEntity !== 'all') params.append('entityType', selectedEntity);
      params.append('limit', '100');

      const res = await apiClient.get(`/api/audit-logs?${params.toString()}`);
      return {
        logs: res.data.data,
        total: res.data.meta?.total || res.data.data.length,
      };
    },
  });

  const logs = auditData?.logs || [];

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      log.entityType.toLowerCase().includes(term) ||
      log.entityId.toLowerCase().includes(term) ||
      (log.actor?.fullName && log.actor.fullName.toLowerCase().includes(term)) ||
      (log.actor?.email && log.actor.email.toLowerCase().includes(term))
    );
  });

  const getActionBadge = (action: string) => {
    if (action.includes('PASSWORD')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <KeyRound className="h-3 w-3" />
          {action}
        </span>
      );
    }
    if (action.includes('PAYMENT') || action.includes('CREDIT')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CreditCard className="h-3 w-3" />
          {action}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Layers className="h-3 w-3" />
        {action}
      </span>
    );
  };

  const getActorRoleBadge = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return <Badge variant="danger">Admin</Badge>;
      case 'STAFF':
        return <Badge variant="info">Staff</Badge>;
      case 'CUSTOMER':
        return <Badge variant="success">Customer</Badge>;
      default:
        return <Badge variant="neutral">System</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-emerald-400" />
            Security & Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable log of user authentication events, session revocations, and financial adjustments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-slate-400 hover:text-white"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh Trail
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-slate-900/40 border-slate-800">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Action Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <span>Action:</span>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Actions</option>
                <option value="PASSWORD_RESET_REQUESTED">PASSWORD_RESET_REQUESTED</option>
                <option value="PASSWORD_RESET_COMPLETED">PASSWORD_RESET_COMPLETED</option>
                <option value="PAYMENT_SURPLUS_CREDITED">PAYMENT_SURPLUS_CREDITED</option>
                <option value="CREDIT_APPLIED_TO_INVOICE">CREDIT_APPLIED_TO_INVOICE</option>
              </select>
            </div>

            {/* Entity Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>Entity:</span>
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Entities</option>
                <option value="User">User</option>
                <option value="Invoice">Invoice</option>
                <option value="Payment">Payment</option>
                <option value="Subscription">Subscription</option>
              </select>
            </div>
          </div>

          <div className="w-full md:w-72">
            <Input
              placeholder="Search by action, actor, entity ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader className="p-4 border-b border-slate-800 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-white">
            Audit Events ({filteredLogs.length})
          </CardTitle>
          <span className="text-xs text-slate-500 font-mono">
            Total records: {auditData?.total || 0}
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12">
              <LoadingSpinner message="Querying system audit log repository..." />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No Audit Logs Found"
                description="No audit events matched your search or filter criteria."
                icon={<ShieldAlert className="h-6 w-6" />}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-medium">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">Entity ID</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 text-slate-300 font-mono whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          <span>
                            {new Date(log.createdAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          <div>
                            <span className="font-medium text-slate-200">
                              {log.actor?.fullName || 'System / Automated'}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {getActorRoleBadge(log.actorRole)}
                              {log.actor?.email && (
                                <span className="text-[10px] text-slate-400 font-mono truncate max-w-xs">
                                  {log.actor.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">{getActionBadge(log.action)}</td>
                      <td className="py-3 px-4 text-slate-300 font-medium">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                          {log.entityType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px] truncate max-w-xs" title={log.entityId}>
                        {log.entityId}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInspectLog(log)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inspect Audit Log Modal */}
      {inspectLog && (
        <Modal
          isOpen={!!inspectLog}
          onClose={() => setInspectLog(null)}
          title={`Audit Event: ${inspectLog.action}`}
          maxWidth="xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 block">Event Timestamp</span>
                <span className="font-mono text-slate-300">
                  {new Date(inspectLog.createdAt).toISOString()}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Actor</span>
                <span className="text-slate-200 font-medium">
                  {inspectLog.actor?.fullName || 'System'} ({inspectLog.actorRole})
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Target Entity</span>
                <span className="font-mono text-emerald-400">
                  {inspectLog.entityType}: {inspectLog.entityId}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Audit Record ID</span>
                <span className="font-mono text-slate-400 truncate block" title={inspectLog.id}>
                  {inspectLog.id}
                </span>
              </div>
            </div>

            {Boolean(inspectLog.newValues) && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 block">
                  Event Data / Payload:
                </span>
                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-60">
                  {JSON.stringify(inspectLog.newValues, null, 2)}
                </pre>
              </div>
            )}

            {Boolean(inspectLog.oldValues) && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 block">
                  Previous Values:
                </span>
                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-amber-400 overflow-x-auto max-h-40">
                  {JSON.stringify(inspectLog.oldValues, null, 2)}
                </pre>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setInspectLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
