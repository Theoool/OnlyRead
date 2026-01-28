'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RenderEngine } from '@/app/components/learning/engine/RenderEngine';
import { UIComponent } from '@/lib/core/learning/schemas';
import { Loader2, Send, Sparkles, FileText, UploadCloud, Library, Plus } from 'lucide-react';
import { toast } from 'sonner';
import useSWR from 'swr';

interface Message {
  role: 'user' | 'assistant';
  content?: string;
  ui?: UIComponent;
  id: string;
}

interface Article {
  id: string;
  title: string;
  summary?: string;
  // ... other fields
}

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function LearningPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Real data state
  const [activeArticles, setActiveArticles] = useState<Article[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch real articles from user's library
  const { data: articlesData, error } = useSWR('/api/articles?limit=50', fetcher);
  const userArticles: Article[] = articlesData?.articles || [];
console.log(userArticles);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleDocumentToggle = (article: Article) => {
    setActiveArticles(prev => {
        const exists = prev.find(a => a.id === article.id);
        if (exists) {
            return prev.filter(a => a.id !== article.id);
        } else {
            return [...prev, article];
        }
    });
  };

  const handleStartSession = () => {
    if (activeArticles.length === 0) return;

    const titles = activeArticles.map(a => a.title).join(', ');
    
    setMessages([
        {
            id: 'system-init',
            role: 'assistant',
            ui: {
                type: 'explanation',
                title: `Ready to learn`,
                content: `I've loaded context from **${activeArticles.length} documents**: ${titles}.\n\nAsk me anything about these topics, or request a quiz to test your understanding.`,
                tone: 'encouraging'
            }
        }
    ]);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { role: 'user', content: text, id: Date.now().toString() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Prepare context for API
      const history = messages.map(m => ({
        role: m.role,
        content: m.content || (m.ui ? JSON.stringify(m.ui) : '')
      }));

      // Pass real article IDs to the backend
      const articleIds = activeArticles.map(a => a.id);

      const response = await fetch('/api/Learningdemo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: text,
          history: history,
          context: {
             masteryLevel: 0.5,
             articleIds: articleIds,
             currentTopic: activeArticles.length === 1 ? activeArticles[0].title : 'Mixed Context'
          }
        })
      });

      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      
      if (data.ui) {
         const assistantMsg: Message = {
            id: Date.now().toString() + '_ai',
            role: 'assistant',
            ui: data.ui
         };
         setMessages(prev => [...prev, assistantMsg]);
      }

    } catch (error) {
      console.error(error);
      toast.error("Failed to generate response");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEngineAction = (action: string, value: any) => {
    let feedbackText = "";
    if (action === 'quiz_correct') {
        feedbackText = `I answered correctly: ${value.answer}`;
        toast.success("Correct! 🎉");
    } else if (action === 'quiz_incorrect') {
        feedbackText = `I answered incorrectly: ${value.answer}`;
        toast.error("Not quite right.");
    } else if (action === 'code_run') {
        feedbackText = `I submitted code: ${value.code.substring(0, 20)}...`;
        toast.info("Code submitted");
    }

    if (feedbackText) {
        handleSendMessage(feedbackText);
    }
  };

  // 1. Document Selection State
  if (messages.length === 0) {
      return (
          <div className="flex flex-col h-screen items-center bg-zinc-50 dark:bg-zinc-950 p-6">
              <div className="max-w-2xl w-full space-y-8 mt-12">
                  <div className="text-center space-y-2">
                      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                          Learning Workspace
                      </h1>
                      <p className="text-zinc-500 dark:text-zinc-400">
                          Select documents from your library to start a focused session.
                      </p>
                  </div>

                  {/* Document Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto p-2">
                      {userArticles.length === 0 ? (
                          <div className="col-span-2 text-center py-12 text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                              <Library className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p>No articles found.</p>
                              <p className="text-sm">Import some documents first!</p>
                          </div>
                      ) : (
                          userArticles.map(article => {
                              const isActive = activeArticles.some(a => a.id === article.id);
                              return (
                                <button
                                    key={article.id}
                                    onClick={() => handleDocumentToggle(article)}
                                    className={`
                                        group relative flex items-start gap-4 p-4 rounded-xl border transition-all text-left shadow-sm
                                        ${isActive 
                                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' 
                                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700'
                                        }
                                    `}
                                >
                                    <div className={`
                                        p-2 rounded-lg transition-colors
                                        ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}
                                    `}>
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-semibold truncate ${isActive ? 'text-indigo-900 dark:text-indigo-100' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                            {article.title || 'Untitled Document'}
                                        </h3>
                                        {article.summary && (
                                            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                                                {article.summary}
                                            </p>
                                        )}
                                    </div>
                                    {isActive && (
                                        <div className="absolute top-4 right-4 text-indigo-600">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                        </div>
                                    )}
                                </button>
                              );
                          })
                      )}
                  </div>

                  {/* Actions */}
                  <div className="flex justify-center gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <button 
                        disabled={activeArticles.length === 0}
                        onClick={handleStartSession}
                        className="flex items-center gap-2 px-8 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full font-medium hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
                      >
                          <Sparkles className="w-4 h-4" />
                          Start Session ({activeArticles.length})
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // 2. Chat Interface
  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Sidebar: Context Info */}
      <div className="hidden lg:flex w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex-col">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="font-semibold text-sm text-zinc-500 uppercase tracking-wider">Active Context</h2>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-2">
              {activeArticles.map(article => (
                  <div key={article.id} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-xs">
                      <FileText className="w-3 h-3 text-zinc-400" />
                      <span className="truncate">{article.title}</span>
                  </div>
              ))}
              <button 
                onClick={() => { setMessages([]); setActiveArticles([]); }}
                className="w-full mt-4 flex items-center justify-center gap-2 p-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                  <Plus className="w-3 h-3" />
                  Change Context
              </button>
          </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 backdrop-blur flex items-center justify-between">
             <span className="font-semibold text-sm">Adaptive Tutor</span>
             <button onClick={() => { setMessages([]); setActiveArticles([]); }} className="text-xs text-zinc-500">Back</button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
            <div className="max-w-3xl mx-auto space-y-8 pb-24">
            <AnimatePresence mode="popLayout">
                {messages.map((msg) => (
                <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    layout
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                    {msg.role === 'user' ? (
                    <div className="bg-zinc-200 dark:bg-zinc-800 px-4 py-2 rounded-2xl rounded-tr-sm max-w-[80%]">
                        {msg.content}
                    </div>
                    ) : (
                    <div className="w-full">
                        {/* Render the Dynamic UI Component */}
                        {msg.ui && (
                            <RenderEngine 
                                component={msg.ui} 
                                onAction={handleEngineAction} 
                            />
                        )}
                    </div>
                    )}
                </motion.div>
                ))}
            </AnimatePresence>
            
            {isLoading && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-zinc-400 pl-4"
                >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Analyzing documents...</span>
                </motion.div>
            )}
            
            <div ref={scrollRef} />
            </div>
        </main>

        {/* Input Area */}
        <footer className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
            <div className="max-w-3xl mx-auto relative">
            <form 
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputValue); }}
                className="relative"
            >
                <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask a question..."
                className="w-full px-4 py-3 pr-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-950 transition-all outline-none"
                disabled={isLoading}
                />
                <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
                >
                <Send className="w-4 h-4" />
                </button>
            </form>
            </div>
        </footer>
      </div>
    </div>
  );
}
