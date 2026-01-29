import { useState, useRef } from 'react';
import { api, SqliteSchemaInfo, SqliteColumn, SqliteQueryResult, SqliteTable } from '../services/api';
import { useStore } from '../hooks/useStore';
import {
  Database,
  Table,
  Play,
  RefreshCw,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Key,
  FileText,
  Clock,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

export default function SqlitePanel() {
  const { addNotification } = useStore();
  const [dbPath, setDbPath] = useState<string | null>(null);
  const [schema, setSchema] = useState<SqliteSchemaInfo | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<SqliteQueryResult | null>(null);
  const [columns, setColumns] = useState<SqliteColumn[]>([]);
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState<SqliteQueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'data' | 'query'>('data');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 100;

  const queryInputRef = useRef<HTMLTextAreaElement>(null);

  const openDatabase = async () => {
    const selected = await open({
      multiple: false,
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3', 'db3'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'Open SQLite Database',
    });

    if (selected && typeof selected === 'string') {
      setDbPath(selected);
      loadSchema(selected);
    }
  };

  const loadSchema = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.sqliteGetSchema(path);
      if (result.ok && result.data) {
        setSchema(result.data);
        setSelectedTable(null);
        setTableData(null);
        setQueryResult(null);
      } else {
        setError(result.error?.message || 'Failed to load database schema');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
    setLoading(false);
  };

  const loadTableData = async (table: string, pageNum: number = 0) => {
    if (!dbPath) return;
    setLoading(true);
    setError(null);
    try {
      // Get columns
      const colResult = await api.sqliteGetColumns(dbPath, table);
      if (colResult.ok && colResult.data) {
        setColumns(colResult.data);
      }

      // Get data
      const dataResult = await api.sqliteGetTableData(dbPath, table, pageSize, pageNum * pageSize);
      if (dataResult.ok && dataResult.data) {
        setTableData(dataResult.data);
        setPage(pageNum);
      } else {
        setError(dataResult.error?.message || 'Failed to load table data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
    setLoading(false);
  };

  const executeQuery = async () => {
    if (!dbPath || !query.trim()) return;
    setQueryLoading(true);
    setError(null);
    try {
      const result = await api.sqliteExecuteQuery(dbPath, query);
      if (result.ok && result.data) {
        setQueryResult(result.data);
        if (result.data.affectedRows !== null) {
          addNotification({
            type: 'success',
            title: 'Query Executed',
            message: `${result.data.affectedRows} rows affected`,
          });
          // Refresh schema in case tables changed
          loadSchema(dbPath);
        }
      } else {
        setError(result.error?.message || 'Query execution failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
    setQueryLoading(false);
  };

  const toggleTable = (tableName: string) => {
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName);
    } else {
      newExpanded.add(tableName);
    }
    setExpandedTables(newExpanded);
  };

  const selectTable = (table: SqliteTable) => {
    setSelectedTable(table.name);
    setActiveTab('data');
    setQuery(`SELECT * FROM "${table.name}" LIMIT 100`);
    loadTableData(table.name, 0);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatValue = (value: unknown): string => {
    if (value === null) return 'NULL';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return JSON.stringify(value);
  };

  if (!dbPath) {
    return (
      <div className="flex h-full flex-col bg-[#1E1E1E]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#3E3E42]">
          <Database className="h-5 w-5 text-[#D4D4D4]" />
          <span className="font-medium">SQLite Browser</span>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Database className="h-16 w-16 mx-auto mb-4 text-[#858585] opacity-50" />
            <h2 className="text-lg mb-2">No Database Open</h2>
            <p className="text-sm text-[#858585] mb-6">
              Open a SQLite database file to browse tables and run queries
            </p>
            <button
              onClick={openDatabase}
              className="btn btn-primary flex items-center gap-2"
            >
              <FolderOpen className="h-4 w-4" />
              Open Database
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#1E1E1E]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#3E3E42]">
        <Database className="h-5 w-5 text-[#D4D4D4]" />
        <span className="font-medium truncate flex-1" title={dbPath}>
          {dbPath.split(/[/\\]/).pop()}
        </span>
        <button
          onClick={openDatabase}
          className="p-1.5 hover:bg-[#3E3E42] rounded"
          title="Open different database"
        >
          <FolderOpen className="h-4 w-4" />
        </button>
        <button
          onClick={() => dbPath && loadSchema(dbPath)}
          disabled={loading}
          className="p-1.5 hover:bg-[#3E3E42] rounded"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => {
            setDbPath(null);
            setSchema(null);
            setSelectedTable(null);
            setTableData(null);
          }}
          className="p-1.5 hover:bg-[#3E3E42] rounded text-[#858585] hover:text-[#F48771]"
          title="Close database"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Database info bar */}
      {schema && (
        <div className="flex items-center gap-4 px-4 py-2 bg-[#252526] border-b border-[#3E3E42] text-xs text-[#858585]">
          <span>SQLite {schema.version}</span>
          <span>{schema.tables.length} tables</span>
          <span>{formatBytes(schema.databaseSize)}</span>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Tables list */}
        <div className="w-56 border-r border-[#3E3E42] overflow-y-auto">
          <div className="px-3 py-2 text-xs text-[#858585] uppercase tracking-wider">
            Tables
          </div>
          {schema?.tables.map((table) => (
            <div key={table.name}>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-[#2A2D2E] ${
                  selectedTable === table.name ? 'bg-[#37373D]' : ''
                }`}
                onClick={() => selectTable(table)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTable(table.name);
                  }}
                  className="p-0.5"
                >
                  {expandedTables.has(table.name) ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
                <Table className="h-4 w-4 text-[#4EC9B0]" />
                <span className="flex-1 text-sm truncate">{table.name}</span>
                {table.rowCount !== null && (
                  <span className="text-xs text-[#858585]">{table.rowCount}</span>
                )}
              </div>

              {/* Columns preview when expanded */}
              {expandedTables.has(table.name) && columns.length > 0 && selectedTable === table.name && (
                <div className="ml-6 border-l border-[#3E3E42]">
                  {columns.map((col) => (
                    <div
                      key={col.cid}
                      className="flex items-center gap-2 px-3 py-1 text-xs text-[#858585]"
                    >
                      {col.pk ? (
                        <Key className="h-3 w-3 text-[#DCDCAA]" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                      <span className="truncate">{col.name}</span>
                      <span className="text-[#606060]">{col.columnType}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#3E3E42]">
            <button
              onClick={() => setActiveTab('data')}
              className={`px-4 py-2 text-sm ${
                activeTab === 'data'
                  ? 'border-b-2 border-[#007ACC] text-white'
                  : 'text-[#858585] hover:text-white'
              }`}
            >
              Data
            </button>
            <button
              onClick={() => setActiveTab('query')}
              className={`px-4 py-2 text-sm ${
                activeTab === 'query'
                  ? 'border-b-2 border-[#007ACC] text-white'
                  : 'text-[#858585] hover:text-white'
              }`}
            >
              Query
            </button>
          </div>

          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-2 bg-[#5A1D1D] text-[#F48771] text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-[#6E2222] rounded">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Query tab */}
          {activeTab === 'query' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Query input */}
              <div className="p-3 border-b border-[#3E3E42]">
                <textarea
                  ref={queryInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter SQL query..."
                  className="w-full h-24 bg-[#1E1E1E] border border-[#3E3E42] rounded p-2 text-sm font-mono focus:border-[#007ACC] outline-none resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      executeQuery();
                    }
                  }}
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={executeQuery}
                    disabled={queryLoading || !query.trim()}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    {queryLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Execute
                  </button>
                  <span className="text-xs text-[#858585]">Ctrl+Enter to run</span>
                </div>
              </div>

              {/* Query results */}
              {queryResult && (
                <div className="flex-1 overflow-auto">
                  <div className="flex items-center gap-4 px-3 py-2 bg-[#252526] border-b border-[#3E3E42] text-xs text-[#858585]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {queryResult.executionTimeMs}ms
                    </span>
                    {queryResult.affectedRows !== null ? (
                      <span>{queryResult.affectedRows} rows affected</span>
                    ) : (
                      <span>{queryResult.rowCount} rows</span>
                    )}
                  </div>
                  {queryResult.columns.length > 0 && (
                    <DataTable data={queryResult} formatValue={formatValue} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Data tab */}
          {activeTab === 'data' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedTable ? (
                <>
                  {/* Table header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#252526] border-b border-[#3E3E42]">
                    <Table className="h-4 w-4 text-[#4EC9B0]" />
                    <span className="font-medium">{selectedTable}</span>
                    {tableData && (
                      <span className="text-xs text-[#858585]">
                        ({tableData.executionTimeMs}ms)
                      </span>
                    )}
                  </div>

                  {/* Data table */}
                  <div className="flex-1 overflow-auto">
                    {loading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-[#858585]" />
                      </div>
                    ) : tableData ? (
                      <DataTable data={tableData} formatValue={formatValue} />
                    ) : null}
                  </div>

                  {/* Pagination */}
                  {tableData && selectedTable && (
                    <div className="flex items-center gap-2 px-3 py-2 border-t border-[#3E3E42] bg-[#252526]">
                      <button
                        onClick={() => loadTableData(selectedTable, page - 1)}
                        disabled={page === 0 || loading}
                        className="btn btn-secondary text-xs py-1 px-2"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-[#858585]">
                        Page {page + 1}
                      </span>
                      <button
                        onClick={() => loadTableData(selectedTable, page + 1)}
                        disabled={tableData.rowCount < pageSize || loading}
                        className="btn btn-secondary text-xs py-1 px-2"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[#858585]">
                  <div className="text-center">
                    <Table className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Select a table to view data</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Data table component
function DataTable({
  data,
  formatValue,
}: {
  data: SqliteQueryResult;
  formatValue: (value: unknown) => string;
}) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead className="sticky top-0 bg-[#252526]">
        <tr>
          {data.columns.map((col, i) => (
            <th
              key={i}
              className="text-left px-3 py-2 border-b border-[#3E3E42] font-medium text-[#DCDCAA]"
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, i) => (
          <tr key={i} className="hover:bg-[#2A2D2E]">
            {row.map((cell, j) => (
              <td
                key={j}
                className={`px-3 py-1.5 border-b border-[#3E3E42] ${
                  cell === null ? 'text-[#858585] italic' : ''
                }`}
              >
                {formatValue(cell)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
