'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  MessageCircle, 
  Clock, 
  ChevronRight,
  GraduationCap,
  Sparkles,
  X
} from 'lucide-react';
import { ContextSelector } from '@/app/components/ai/ContextSelector';

interface Session {
  id: string;
  title: string;
  context: any;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    messages: number;
  };
}

interface Article {
  id: string;
  title: string;
  domain?: string;
  collectionId?: string;
}

interface Collection {
  id: string;
  title: string;
  type: string;
}

interface LearningClientPageProps {
  sessions: Session[];
  articles: Article[];
  collections: Collection[];
}

export function LearningClientPage({ sessions, articles, collections }: LearningClientPageProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedContext, setSelectedContext] = useState<{
    articleIds: string[];
    collectionId?: string;
  }>({ articleIds: [] });
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleCreateSession = async () => {
    if (selectedContext.articleIds.length === 0 && !selectedContext.collectionId) {
      return;
    }

    try {
      const res = await fetch('/api/learning/sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          context: {
            ...selectedContext,
            mode: 'tutor'
          }
        }),
      });

      if (!res.ok) throw new Error('Failed to create session');
      
      const session = await res.json();
      router.push(`/learning/${session.id}`);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('确定要删除这个学习会话吗？')) {
      return;
    }

    setIsDeleting(sessionId);
    
    try {
      const res = await fetch(`/api/learning/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to delete session');
      
      router.refresh();
    } catch (error) {
      console.error('Failed to delete session:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const getSessionContextLabel = (session: Session) => {
    const ctx = session.context;
    if (ctx?.collectionId) {
      const collection = collections.find(c => c.id === ctx.collectionId);
      return collection?.title || '集合';
    }
    if (ctx?.articleIds?.length) {
      if (ctx.articleIds.length === 1) {
        const article = articles.find(a => a.id === ctx.articleIds[0]);
        return article?.title || '文章';
      }
      return `${ctx.articleIds.length} 篇文章`;
    }
    return '通用学习';
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 rounded-lg">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">学习中心</h1>
              <p className="text-xs text-zinc-500">AI 导师陪伴你的学习之旅</p>
            </div>
          </div>
          
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            新建会话
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
            <div className="text-2xl font-bold text-indigo-500">{sessions.length}</div>
            <div className="text-sm text-zinc-500">学习会话</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
            <div className="text-2xl font-bold text-emerald-500">
              {sessions.reduce((acc, s) => acc + s._count.messages, 0)}
            </div>
            <div className="text-sm text-zinc-500">总消息数</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800">
            <div className="text-2xl font-bold text-amber-500">
              {sessions.filter(s => {
                const lastActivity = new Date(s.updatedAt);
                const today = new Date();
                return lastActivity.toDateString() === today.toDateString();
              }).length}
            </div>
            <div className="text-sm text-zinc-500">今日活跃</div>
          </div>
        </div>

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-zinc-400" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              还没有学习会话
            </h3>
            <p className="text-zinc-500 mb-6 max-w-sm mx-auto">
              创建一个新的学习会话，让 AI 导师帮助你深入理解文章内容
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              开始第一次学习
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
              最近会话
            </h2>
            
            {sessions.map((session, index) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => router.push(`/learning/${session.id}`)}
                className="group bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-indigo-500" />
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-500 transition-colors">
                        {session.title}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-zinc-500 mt-1">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          {getSessionContextLabel(session)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5" />
                          {session._count.messages} 条消息
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(session.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      disabled={isDeleting === session.id}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Create Session Modal */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsCreating(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                  <h2 className="font-bold text-lg">新建学习会话</h2>
                  <p className="text-sm text-zinc-500">选择要学习的内容</p>
                </div>
                <button
                  onClick={() => setIsCreating(false)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-4 overflow-y-auto max-h-[50vh]">
                <ContextSelector
                  articles={articles}
                  collections={collections}
                  selectedContext={selectedContext}
                  onContextChange={setSelectedContext}
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateSession}
                  disabled={selectedContext.articleIds.length === 0 && !selectedContext.collectionId}
                  className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                >
                  开始学习
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
