import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../lib/utils';

interface CSVImportProps {
  onImport: (data: Record<string, string>[]) => Promise<{ success: number; errors: string[] }>;
  columns: { key: string; label: string; required?: boolean }[];
  templateName: string;
}

export function CSVImport({ onImport, columns, templateName }: CSVImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/"/g, ''));
    const data: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index].trim().replace(/^"|"$/g, '');
        });
        data.push(row);
      }
    }

    return data;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleFile = (file: File) => {
    setFile(file);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const data = parseCSV(text);
      setPreview(data.slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      handleFile(droppedFile);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const data = parseCSV(text);
      const result = await onImport(data);
      setResult(result);
      setImporting(false);
      if (result.success > 0 && result.errors.length === 0) {
        setFile(null);
        setPreview([]);
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const headers = columns.map(c => c.label).join(',');
    const example = columns.map(c => c.key === 'gender' ? 'male' : c.key === 'date_of_birth' ? '1990-01-15' : `Example ${c.label}`).join(',');
    const csv = `${headers}\n${example}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Template Download */}
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-500" />
          <span className="text-sm text-slate-600">Need a template?</span>
        </div>
        <Button variant="ghost" size="sm" onClick={downloadTemplate}>
          Download Template
        </Button>
      </div>

      {/* Expected Columns */}
      <div className="text-sm text-slate-600">
        <p className="font-medium mb-1">Expected columns:</p>
        <p className="text-slate-500">
          {columns.map((c, i) => (
            <span key={c.key}>
              {c.label}{c.required && <span className="text-red-500">*</span>}
              {i < columns.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragging ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-slate-400'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
        />
        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600">
          {file ? file.name : 'Drop CSV file here or click to browse'}
        </p>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
            <p className="text-sm font-medium text-slate-700">Preview (first 5 rows)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  {Object.keys(preview[0]).map((key) => (
                    <th key={key} className="px-3 py-2 text-left font-medium text-slate-600">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {Object.values(row).map((value, j) => (
                      <td key={j} className="px-3 py-2 text-slate-700">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={cn(
          'p-3 rounded-lg flex items-start gap-2',
          result.errors.length > 0 ? 'bg-red-50' : 'bg-green-50'
        )}>
          {result.errors.length > 0 ? (
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className={cn('font-medium', result.errors.length > 0 ? 'text-red-700' : 'text-green-700')}>
              {result.success} records imported successfully
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-1 text-sm text-red-600">
                {result.errors.slice(0, 5).map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
                {result.errors.length > 5 && (
                  <li>...and {result.errors.length - 5} more errors</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Import Button */}
      {file && (
        <div className="flex justify-end">
          <Button onClick={handleImport} loading={importing}>
            Import {preview.length > 0 ? `(${preview.length}+ rows)` : ''}
          </Button>
        </div>
      )}
    </div>
  );
}
