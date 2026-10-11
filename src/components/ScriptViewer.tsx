import React, { useState } from 'react';
import { UNITY_SCRIPTS } from '../data/unityGuideData';
import { Copy, Check, Download, FileCode, Layers, Info } from 'lucide-react';

interface ScriptViewerProps {
  initialScriptId?: string;
}

export const ScriptViewer: React.FC<ScriptViewerProps> = ({ initialScriptId }) => {
  const [selectedScriptId, setSelectedScriptId] = useState<string>(initialScriptId || UNITY_SCRIPTS[0].id);
  const [copied, setCopied] = useState<string | null>(null);

  const activeScript = UNITY_SCRIPTS.find(s => s.id === selectedScriptId) || UNITY_SCRIPTS[0];

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = (name: string, code: string) => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    UNITY_SCRIPTS.forEach(script => {
      handleDownload(script.name, script.code);
    });
  };

  return (
    <div className="space-y-6">
      {/* Script Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          {UNITY_SCRIPTS.map(script => (
            <button
              key={script.id}
              onClick={() => setSelectedScriptId(script.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedScriptId === script.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{script.name}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleDownloadAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          <span>Download All C# Files</span>
        </button>
      </div>

      {/* Script Header Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">{activeScript.name}</span>
              <span className="text-slate-500">·</span>
              <code className="text-xs text-sky-400 font-mono">{activeScript.filePath}</code>
            </div>
            <p className="text-xs text-slate-400 mt-1">{activeScript.summary}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(activeScript.code, activeScript.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
            >
              {copied === activeScript.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Script</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleDownload(activeScript.name, activeScript.code)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save .cs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inspector Parameters Table */}
      {activeScript.inspectorFields.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Unity Inspector Fields &amp; Recommended Values</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3 font-semibold">Field Name</th>
                  <th className="py-2 px-3 font-semibold">Type</th>
                  <th className="py-2 px-3 font-semibold">Default / Tuned Value</th>
                  <th className="py-2 px-3 font-semibold">Role in Simulation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {activeScript.inspectorFields.map((field, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 text-white font-medium">{field.name}</td>
                    <td className="py-2.5 px-3 text-sky-400">{field.type}</td>
                    <td className="py-2.5 px-3 text-amber-300">{field.defaultValue}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-300">{field.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Code Editor Preview */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-2 font-mono text-slate-300">{activeScript.name} (C# Source)</span>
          </div>
          <span className="text-[11px] text-slate-500">UTF-8 · C# 10 / Unity 2022+ / Unity 6 Compatible</span>
        </div>

        <pre className="p-5 text-xs font-mono leading-relaxed text-slate-200 overflow-x-auto selection:bg-blue-600 selection:text-white max-h-[500px]">
          <code>{activeScript.code}</code>
        </pre>
      </div>

      <div className="p-4 bg-sky-950/30 border border-sky-800/40 rounded-xl flex items-start gap-3 text-xs text-sky-200">
        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <p>
          <strong>Modularity Guarantee:</strong> Notice that <code className="text-sky-300 font-mono">VehicleInput.cs</code> never touches physics, and <code className="text-sky-300 font-mono">CarController.cs</code> never directly polls keyboard keys. This strict decoupling satisfies your college lab criteria and makes adding autonomous traffic AI, pedestrians, or mobile on-screen controls in later phases effortless.
        </p>
      </div>
    </div>
  );
};
