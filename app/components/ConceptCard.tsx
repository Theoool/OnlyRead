"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, PenLine, Check, X, ChevronRight, ArrowLeft, Bookmark } from "lucide-react";
import { ConceptData } from "@/lib/store/useConceptStore";
import { getCachedConcept, setCachedConcept } from "@/lib/cache";

interface ConceptCardProps {
  selection: string;
  position: { top: number; left: number };
  savedData?: ConceptData;
  onSave: (data: ConceptData) => void;
  onClose: () => void;
}
interface AIResponse {
  term: string;
  definition: string;
  example: string;
  related: string[];
}

export function ConceptCard({ selection, position, savedData, onSave, onClose }: ConceptCardProps) {
  // Modes: 'loading' -> 'preview' (AI result) <-> 'edit' (User input) -> 'view' (Saved)
  const [mode, setMode] = useState<"loading" | "preview" | "edit" | "view">(
      savedData ? "view" : "loading"
  );
  
  // Data
  const [term, setTerm] = useState<string>(savedData?.term || selection);
  const [aiData, setAiData] = useState<AIResponse | null>(null);
  
  // User Input
  const [editStep, setEditStep] = useState<1 | 2>(1);
  const [myDefinition, setMyDefinition] = useState(savedData?.myDefinition || "");
  const [myExample, setMyExample] = useState(savedData?.myExample || "");
  const [confidence, setConfidence] = useState(savedData?.confidence || 3);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardStyle, setCardStyle] = useState({ top: position.top, left: position.left });

  // Smart Positioning (Keep inside viewport)
  useEffect(() => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let newLeft = position.left;
      let newTop = position.top + 20; // Offset a bit down from selection

      // Horizontal
      if (newLeft + rect.width > viewportWidth - 20) {
        newLeft = viewportWidth - rect.width - 20;
      }
      if (newLeft < 20) newLeft = 20;

      // Vertical (Flip to top if near bottom)
      if (newTop + rect.height > viewportHeight - 20) {
        newTop = position.top - rect.height - 20;
      }
      
      setCardStyle({ top: newTop, left: newLeft });
    }
  }, [position, mode]);

  // Fetch AI Data
  useEffect(() => {
    if (savedData) return; // Skip AI fetch if viewing saved card

    let mounted = true;
    const fetchTerm = async () => {
      const cached = getCachedConcept<AIResponse>(selection);
      if (cached) {
        if (mounted) {
          setAiData(cached);
          setTerm(cached.term);
          setMode("preview");
        }
        return;
      }

      try {
        const res = await fetch("/api/concept", {
          method: "POST",
          credentials: 'include',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selection }),
        });
        
        const data = await res.json();
        if (mounted) {
          if (data.term) setTerm(data.term);
          setAiData(data);
          setCachedConcept(selection, data);
          setMode("preview");
        }
      } catch (err) {
        if (mounted) {
          console.error(err);
          setMode("edit"); // Fallback to edit mode on error
        }
      }
    };
    fetchTerm();
    return () => { mounted = false; };
  }, [selection]);

  // Handle Click Outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleSave = () => {
    if (myDefinition.length < 20 || myExample.length < 20) return; 
    onSave({
        term,
        myDefinition,
        myExample,
        myConnection: "",
        confidence,
        createdAt: Date.now(),
    });
    onClose();
  };

  const handleQuickCollect = () => {
      if (!aiData) return;
      onSave({
          term,
          myDefinition: aiData.definition,
          myExample: aiData.example,
          myConnection: "AI Collected",
          confidence: 3,
          createdAt: Date.now(),
      });
      onClose();
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.9, y: 10, filter: "blur(10px)" }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      style={{ top: cardStyle.top, left: cardStyle.left }}
      className="absolute z-50 w-[280px] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-white/20 dark:border-zinc-700/50 rounded-2xl shadow-2xl shadow-zinc-200/50 dark:shadow-black/50 overflow-hidden flex flex-col"
    >
      <AnimatePresence mode="wait">
        {mode === "loading" && (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="p-6 flex flex-col items-center justify-center gap-3 text-zinc-400"
          >
            <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            <span className="text-xs font-medium tracking-wide">AI Thinking...</span>
          </motion.div>
        )}

        {mode === "preview" && (
          <motion.div 
            key="preview"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="p-5 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="font-serif text-lg font-medium text-zinc-900 dark:text-zinc-100 leading-tight">
                        {term}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5 font-mono uppercase tracking-wider">Concept</p>
                </div>
                <div className="flex gap-1">
                    <button onClick={() => setMode("edit")} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" title="Write Note">
                        <PenLine className="w-4 h-4" />
                    </button>
                    <button onClick={handleQuickCollect} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-purple-500 transition-colors" title="Quick Collect">
                        <Bookmark className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="relative">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-purple-500/30 rounded-full" />
                <p className="pl-3 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {aiData?.definition}
                </p>
            </div>
            
            {aiData?.related && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                    {aiData.related.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-full">
                            #{tag}
                        </span>
                    ))}
                </div>
            )}
          </motion.div>
        )}

        {mode === "edit" && (
          <motion.div 
            key="edit"
            initial={{ opacity: 0, rotateY: 90 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0, rotateY: -90 }}
            className="p-5 flex flex-col gap-4 bg-zinc-50/50 dark:bg-zinc-900/50"
          >
            <div className="flex items-center justify-between">
                <button 
                    onClick={() => editStep === 1 ? setMode("preview") : setEditStep(1)} 
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                    <ArrowLeft className="w-3 h-3" /> {editStep === 1 ? "Back" : "Definition"}
                </button>
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{term}</span>
            </div>

            <AnimatePresence mode="wait">
                {editStep === 1 ? (
                    <motion.div
                        key="step1"
                        initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
                        className="space-y-2"
                    >
                         <div className="flex justify-between items-center">
                             <label className="text-xs font-medium text-zinc-500 block">Definition</label>
                             <span className={`text-[10px] ${myDefinition.length >= 20 ? 'text-green-500' : 'text-zinc-400'}`}>
                                 {myDefinition.length}/20
                             </span>
                         </div>
                        <textarea 
                            autoFocus
                            value={myDefinition}
                            onChange={(e) => setMyDefinition(e.target.value)}
                            onPaste={(e) => {
                                e.preventDefault();
                            }}
                            placeholder="Summarize in your own words (no pasting)..."
                            className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none h-24 transition-all"
                        />
                         <button 
                            onClick={() => setEditStep(2)}
                            disabled={myDefinition.length < 20}
                            className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl text-sm font-medium hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            Next <ChevronRight className="w-4 h-4" />
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="step2"
                        initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
                        className="space-y-4"
                    >
                        <div className="space-y-2">
                             <div className="flex justify-between items-center">
                                 <label className="text-xs font-medium text-zinc-500 block">Example</label>
                                 <span className={`text-[10px] ${myExample.length >= 20 ? 'text-green-500' : 'text-zinc-400'}`}>
                                     {myExample.length}/20
                                 </span>
                             </div>
                            <textarea 
                                autoFocus
                                value={myExample}
                                onChange={(e) => setMyExample(e.target.value)}
                                onPaste={(e) => {
                                    e.preventDefault();
                                }}
                                placeholder="Give a concrete example (no pasting)..."
                                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none h-24 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-medium text-zinc-500">Confidence</label>
                                <span className="text-xs text-purple-600 font-medium">{confidence}/5</span>
                            </div>
                            <input 
                                type="range" min="1" max="5" 
                                value={confidence} onChange={(e) => setConfidence(Number(e.target.value))}
                                className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full accent-purple-600 cursor-pointer"
                            />
                        </div>

                        <button 
                            onClick={handleSave}
                            disabled={myExample.length < 20}
                            className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-xl text-sm font-medium hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Check className="w-4 h-4" /> Complete
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
          </motion.div>
        )}

        {mode === "view" && (
          <motion.div 
            key="view"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="p-5 flex flex-col gap-3"
          >
             <div className="flex items-start justify-between gap-2">
                <div>
                    <h3 className="font-serif text-lg font-medium text-zinc-900 dark:text-zinc-100 leading-tight">
                        {term}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-green-500 font-mono uppercase tracking-wider">Collected</p>
                        <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className={`w-1 h-1 rounded-full ${i < confidence ? 'bg-purple-500' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex gap-1">
                    <button onClick={() => setMode("edit")} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" title="Edit Note">
                        <PenLine className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-green-500/30 rounded-full" />
                    <p className="pl-3 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        {myDefinition}
                    </p>
                </div>
                
                {myExample && (
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                         <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                            "{myExample}"
                        </p>
                    </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
