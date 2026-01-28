import React, { useState, useCallback } from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism-dark.css'; // Or your preferred theme
import { motion } from 'framer-motion';
import { Play, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';

interface CodeAtomProps {
  initialCode: string;
  language?: string;
  onRun?: (code: string, output: string, isError: boolean) => void;
  readOnly?: boolean;
}

export const CodeAtom: React.FC<CodeAtomProps> = ({ 
  initialCode, 
  language = 'javascript', 
  onRun,
  readOnly = false 
}) => {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const runCode = useCallback(() => {
    // Reset state
    setOutput(null);
    setIsError(false);

    // Capture console.log
    const logs: string[] = [];
    const originalLog = console.log;
    
    // Mock console.log
    const mockConsole = {
        log: (...args: any[]) => {
            logs.push(args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' '));
        }
    };

    try {
      // Safe-ish execution using Function constructor
      // Note: This is NOT fully secure for production with malicious users, 
      // but sufficient for a client-side learning sandbox.
      // We wrap it to inject our mock console
      const runUserCode = new Function('console', code);
      runUserCode(mockConsole);
      
      const result = logs.length > 0 ? logs.join('\n') : 'Code executed successfully (no output)';
      setOutput(result);
      if (onRun) onRun(code, result, false);

    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      setOutput(errorMsg);
      setIsError(true);
      if (onRun) onRun(code, errorMsg, true);
    } finally {
        // Restore console (though we passed a mock one, just in case)
    }
  }, [code, onRun]);

  const resetCode = () => {
    setCode(initialCode);
    setOutput(null);
    setIsError(false);
  };

  return (
    <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-[#1e1e1e] shadow-lg"
    >
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-zinc-700">
        <span className="text-xs font-mono text-zinc-400 uppercase">{language}</span>
        <div className="flex gap-2">
            {!readOnly && (
                <>
                <button 
                    onClick={resetCode}
                    className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                    title="Reset Code"
                >
                    <RotateCcw size={14} />
                </button>
                <button 
                    onClick={runCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
                >
                    <Play size={12} fill="currentColor" />
                    Run
                </button>
                </>
            )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="relative font-mono text-sm max-h-[300px] overflow-auto custom-scrollbar">
        <Editor
          value={code}
          onValueChange={setCode}
          highlight={code => highlight(code, languages.javascript, 'javascript')}
          padding={16}
          disabled={readOnly}
          className="min-h-[100px] text-zinc-100"
          style={{
            fontFamily: '"Fira Code", "Fira Mono", monospace',
            fontSize: 14,
            backgroundColor: '#1e1e1e',
          }}
        />
      </div>

      {/* Output Area */}
      {output !== null && (
        <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className={`border-t border-zinc-700 ${isError ? 'bg-red-900/20' : 'bg-zinc-900'}`}
        >
            <div className="px-4 py-2 border-b border-zinc-800/50 flex items-center gap-2">
                {isError ? (
                    <AlertCircle size={14} className="text-red-400" />
                ) : (
                    <CheckCircle2 size={14} className="text-green-400" />
                )}
                <span className={`text-xs font-medium ${isError ? 'text-red-400' : 'text-zinc-400'}`}>
                    Console Output
                </span>
            </div>
            <pre className={`p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap ${isError ? 'text-red-300' : 'text-zinc-300'}`}>
                {output}
            </pre>
        </motion.div>
      )}
    </motion.div>
  );
};
