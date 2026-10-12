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
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-200">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white border border-stone-200 rounded-xl">
          {UNITY_SCRIPTS.map(script => (
            <button
              key={script.id}
              onClick={() => setSelectedScriptId(script.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedScriptId === script.id
                  ? 'bg-teal-600 text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-800 hover:bg-stone-200/60'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{script.name}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleDownloadAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg text-xs font-medium border border-stone-300 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-teal-700" />
          <span>Download All C# Files</span>
        </button>
      </div>

      {/* Script Header Info */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-stone-900">{activeScript.name}</span>
              <span className="text-stone-500">·</span>
              <code className="text-xs text-teal-700 font-mono break-all">{activeScript.filePath}</code>
            </div>
            <p className="text-xs text-stone-600 mt-1">{activeScript.summary}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(activeScript.code, activeScript.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg text-xs font-medium border border-stone-300 transition-colors"
            >
              {copied === activeScript.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="text-emerald-700">Copied!</span>
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-stone-900 rounded-lg text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save .cs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inspector Parameters Table */}
      {activeScript.inspectorFields.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-700">
            <Layers className="w-3.5 h-3.5 text-teal-700" />
            <span>Unity Inspector Fields &amp; Recommended Values</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-stone-600">
                  <th className="py-2 px-3 font-semibold">Field Name</th>
                  <th className="py-2 px-3 font-semibold">Type</th>
                  <th className="py-2 px-3 font-semibold">Default / Tuned Value</th>
                  <th className="py-2 px-3 font-semibold">Role in Simulation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/60 font-mono">
                {activeScript.inspectorFields.map((field, idx) => (
                  <tr key={idx} className="hover:bg-stone-200/40">
                    <td className="py-2.5 px-3 text-stone-900 font-medium">{field.name}</td>
                    <td className="py-2.5 px-3 text-teal-700">{field.type}</td>
                    <td className="py-2.5 px-3 text-amber-700">{field.defaultValue}</td>
                    <td className="py-2.5 px-3 font-sans text-stone-700">{field.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Code Editor Preview */}
      <div className="relative rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
        <div className="flex flex-wrap gap-2 items-center justify-between px-4 py-2 bg-white border-b border-stone-200 text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-2 font-mono text-stone-700">{activeScript.name} (C# Source)</span>
          </div>
          <span className="text-[11px] text-stone-500">UTF-8 · C# 10 / Unity 2022+ / Unity 6 Compatible</span>
        </div>

        <pre className="p-5 text-xs font-mono leading-relaxed text-stone-800 overflow-x-auto selection:bg-teal-600 selection:text-stone-900 max-h-[500px]">
          <code>{activeScript.code}</code>
        </pre>
      </div>

      <div className="p-4 bg-teal-50/30 border border-teal-800/40 rounded-xl flex items-start gap-3 text-xs text-teal-700">
        <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
        <p>
          <strong>Modularity Guarantee:</strong> Notice that <code className="text-teal-700 font-mono">VehicleInput.cs</code> never touches physics, and <code className="text-teal-700 font-mono">CarController.cs</code> never directly polls keyboard keys. This strict decoupling satisfies your college lab criteria and makes adding autonomous traffic AI, pedestrians, or mobile on-screen controls in later phases effortless.
        </p>
      </div>
    </div>
  );
};
