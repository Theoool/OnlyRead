'use client';

import React, { useState } from 'react';
import { useLearningSessions } from './hooks/useLearning';
import { SessionList } from './components/SessionList';
import { DocumentSelector } from './components/DocumentSelector';
import { ChatInterface } from './components/ChatInterface';
import { Menu, X, Plus } from 'lucide-react';

type ViewState = 'LIST' | 'NEW' | 'CHAT';

export default function LearningPage() {
  const { sessions, createSession, deleteSession } = useLearningSessions();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Handle mobile responsive sidebar
  const toggleSidebar = () => setShowSidebar(!showSidebar);

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    setIsCreating(false);
    // On mobile, close sidebar after selection
    if (window.innerWidth < 1024) setShowSidebar(false);
  };

  const handleStartNewSession = async (articleIds: string[], collectionId?: string) => {
    try {
      const session = await createSession({
        articleIds,
        collectionId, // Pass collectionId to backend
        currentTopic: 'Focused Learning', 
        masteryLevel: 0
      });
      
      // Trigger initial analysis
      // Note: If collectionId is present, the backend knows to analyze the collection.
      if (articleIds.length > 0 || collectionId) {
        try {
            await fetch('/api/learning/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    sessionId: session.id, 
                    message: "Analyze this content and create a learning plan." 
                }),
            });
        } catch (e) {
            console.error("Failed to trigger initial analysis", e);
        }
      }

      setActiveSessionId(session.id);
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to start session", error);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Sidebar - Session List */}
      <div 
        className={`
          fixed inset-y-0 left-0 z-20 w-80 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transform transition-transform duration-200 lg:relative lg:translate-x-0
          ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between p-4 lg:hidden">
            <h2 className="font-bold">Menu</h2>
            <button onClick={toggleSidebar}><X className="w-5 h-5"/></button>
        </div>
        
        <SessionList 
          sessions={sessions}
          onSelect={handleSelectSession}
          onDelete={deleteSession}
          onNew={() => { setIsCreating(true); setActiveSessionId(null); if(window.innerWidth < 1024) setShowSidebar(false); }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile Header */}
        <div className="lg:hidden p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 bg-white dark:bg-zinc-900">
           <button onClick={toggleSidebar} className="p-2 -ml-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
             <Menu className="w-5 h-5" />
           </button>
           <span className="font-semibold">Adaptive Tutor</span>
        </div>

        {isCreating ? (
          <DocumentSelector 
            onStart={handleStartNewSession}
            onCancel={() => { setIsCreating(false); if(sessions.length > 0) setActiveSessionId(sessions[0].id); }}
          />
        ) : activeSessionId ? (
          <ChatInterface 
            sessionId={activeSessionId}
            onBack={() => setShowSidebar(true)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 p-6 text-center">
             <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 opacity-50" />
             </div>
             <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Start Learning</h2>
             <p className="max-w-md">
               Select an existing session from the sidebar or create a new one to start learning from your documents.
             </p>
             <button 
               onClick={() => setIsCreating(true)}
               className="mt-6 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-medium transition-colors"
             >
               Create New Session
             </button>
          </div>
        )}
      </div>

      {/* Overlay for mobile sidebar */}
      {showSidebar && (
        <div 
            className="fixed inset-0 bg-black/20 z-10 lg:hidden"
            onClick={() => setShowSidebar(false)}
        />
      )}
    </div>
  );
}
