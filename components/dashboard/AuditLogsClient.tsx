'use client';

import { useState } from 'react';
import {
  FileText,
  Search,
  Calendar,
  User,
  PlusCircle,
  Edit,
  Trash,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';

interface AuditLog {
  id: string;
  table_name: string | null;
  action: string | null;
  row_id: string | null;
  old_values: any;
  new_values: any;
  created_at: string;
  profiles: {
    full_name: string;
  } | null;
}

interface AuditLogsClientProps {
  initialLogs: AuditLog[];
}

export default function AuditLogsClient({ initialLogs }: AuditLogsClientProps) {
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleRow = (id: string) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  const filteredLogs = logs.filter((log) => {
    if (!log) return false;
    const query = searchQuery.toLowerCase();
    const table_name = log.table_name || '';
    const action = log.action || '';
    const row_id = log.row_id || '';
    const operator = log.profiles?.full_name || '';

    const matchesSearch =
      table_name.toLowerCase().includes(query) ||
      action.toLowerCase().includes(query) ||
      row_id.toLowerCase().includes(query) ||
      operator.toLowerCase().includes(query);

    const matchesAction = filterAction === 'all' || action === filterAction;

    return matchesSearch && matchesAction;
  });

  const getActionColor = (action: string | null | undefined) => {
    switch (action) {
      case 'INSERT':
        return 'rx-badge-success';
      case 'UPDATE':
        return 'rx-badge-warning';
      case 'DELETE':
        return 'rx-badge-danger';
      default:
        return 'bg-slate-100 border-slate-200 text-slate-600';
    }
  };

  const getActionIcon = (action: string | null | undefined) => {
    switch (action) {
      case 'INSERT':
        return <PlusCircle className="h-3.5 w-3.5" />;
      case 'UPDATE':
        return <Edit className="h-3.5 w-3.5" />;
      case 'DELETE':
        return <Trash className="h-3.5 w-3.5" />;
      default:
        return <FileText className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-teal-600" />
          System Audit Trail
        </h1>
        <p className="text-sm text-slate-500">
          Permanent history of database changes, row level additions, deletions, and operator details
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Search by table name, operator, or row UUID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 transition"
          />
        </div>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-xs text-slate-800 outline-none focus:border-teal-500 transition"
        >
          <option value="all">All Actions</option>
          <option value="INSERT">INSERT Only</option>
          <option value="UPDATE">UPDATE Only</option>
          <option value="DELETE">DELETE Only</option>
        </select>
      </div>

      {/* Table Container */}
      <div className="overflow-hidden border border-slate-200 bg-white rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="rx-table-header">
                <th className="p-4">Timestamp</th>
                <th className="p-4">Action</th>
                <th className="p-4">Target Table</th>
                <th className="p-4">Operator</th>
                <th className="p-4">Affected Row ID</th>
                <th className="p-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedRow === log.id;
                  return (
                    <>
                      <tr
                        key={log.id}
                        className={`rx-table-row cursor-pointer ${
                          isExpanded ? 'bg-slate-50' : ''
                        }`}
                        onClick={() => toggleRow(log.id)}
                      >
                        {/* Timestamp */}
                        <td className="p-4 font-mono text-slate-500 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {new Date(log.created_at).toLocaleString()}
                        </td>

                        {/* Action Badge */}
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${getActionColor(
                              log.action
                            )}`}
                          >
                            {getActionIcon(log.action)}
                            {log.action}
                          </span>
                        </td>

                        {/* Table Name */}
                        <td className="p-4 font-bold text-slate-900 uppercase tracking-wide">
                          {log.table_name || 'UNKNOWN'}
                        </td>

                        {/* Operator */}
                        <td className="p-4 text-slate-700 flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          {log.profiles?.full_name || 'System / DB Trigger'}
                        </td>

                        {/* Affected UUID */}
                        <td className="p-4 font-mono text-slate-500 flex items-center gap-1.5">
                          <span>{log.row_id ? `${log.row_id.substring(0, 8)}...` : 'N/A'}</span>
                          {log.row_id && (
                            <button
                              onClick={(e) => handleCopy(e, log.row_id || '')}
                              className="rounded p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                              title="Copy full UUID"
                            >
                              {copiedId === log.row_id ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </td>

                        {/* Action expand */}
                        <td className="p-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(log.id);
                            }}
                            className="rounded p-1 text-slate-500 hover:text-slate-950"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable JSON details */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50/50 p-4 border-b border-slate-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Old Values */}
                              <div>
                                <div className="text-[10px] font-bold text-slate-600 uppercase mb-1">
                                  State Before (Old Values)
                                </div>
                                <pre className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-[10px] text-rose-600 font-mono shadow-inner">
                                  {log.old_values
                                    ? JSON.stringify(log.old_values, null, 2)
                                    : 'NULL / First State'}
                                </pre>
                              </div>

                              {/* New Values */}
                              <div>
                                <div className="text-[10px] font-bold text-slate-600 uppercase mb-1">
                                  State After (New Values)
                                </div>
                                <pre className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-[10px] text-emerald-700 font-mono shadow-inner">
                                  {log.new_values
                                    ? JSON.stringify(log.new_values, null, 2)
                                    : 'NULL / Row Deleted'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
