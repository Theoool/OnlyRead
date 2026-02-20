'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  MessageCircle, 
  Clock, 
  GraduationCap,
  Sparkles,
  X,
  BookOpen,
  TrendingUp,
  Zap,
  Search,
  Filter,
  MoreVertical,
  Edit3
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'week'>('all');

  // 过滤会话
  const filteredSessions = useMemo(() => {
    let filtered = sessions;

    // 时间过滤
    if (filterMode === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter(s => new Date(s.updatedAt) >= today);
    } else if (filterMode === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(s => new Date(s.updatedAt) >= weekAgo);
    }

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [sessions, filterMode, searchTerm]);

  // 统计数据
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return {
      total: sessions.length,
      messages: sessions.reduce((acc, s) => acc + s._count.messages, 0),
      todayActive: sessions.filter(s => new Date(s.updatedAt) >= today).length,
    };
  }, [sessions]);

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
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'short',
      day: 'numeric',
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
      {/* Header - 移动端优化 */}
      <header className="sticky top-0 z-20 bg-white/90 dark:bg-black/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* 顶部栏 */}
          <div className="h-14 sm:h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
                <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-base sm:text-lg">学习中心</h1>
                <p className="text-xs text-zinc-500 hidden sm:block">AI 导师陪伴你的学习之旅</p>
              </div>
            </div>
            
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-xl transition-all text-sm font-medium shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 active:scale-95 touch-manipulation"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">新建会话</span>
              <span className="sm:hidden">新建</span>
            </button>
          </div>

          {/* 搜索和过滤栏 - 移动端折叠 */}
          <div className="pb-3 sm:pb-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="搜索会话..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-900 border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-950 rounded-lg transition-all outline-none touch-manipulation"
                style={{ fontSize: '16px' }}
              />
            </div>
            
            <div className="flex gap-2">
              {['all', 'today', 'week'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode as any)}
                  className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all touch-manipulation ${
                    filterMode === mode
                      ? 'bg-indigo-500 text-white shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  {mode === 'all' ? '全部' : mode === 'today' ? '今天' : '本周'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Stats Cards - 响应式网格 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-indigo-200/50 dark:border-indigo-800/50"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs text-zinc-600 dark:text-zinc-400">会话</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.total}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-emerald-200/50 dark:border-emerald-800/50"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs text-zinc-600 dark:text-zinc-400">消息</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.messages}</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-amber-200/50 dark:border-amber-800/50"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs text-zinc-600 dark:text-zinc-400">今日</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.todayActive}</div>
          </motion.div>
        </div>

        {/* Sessions List */}
        {filteredSessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12 sm:py-20"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 rounded-2xl flex items-center justify-center">
              <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-zinc-400" />
            </div>
            <h3 className="text-base sm:text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              {searchTerm ? '没有找到匹配的会话' : '还没有学习会话'}
            </h3>
            <p className="text-sm text-zinc-500 mb-4 sm:mb-6 max-w-sm mx-auto px-4">
              {searchTerm ? '尝试使用其他关键词搜索' : '创建一个新的学习会话，让 AI 导师帮助你深入理解文章内容'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-xl transition-all font-medium shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 active:scale-95 touch-manipulation"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                开始第一次学习
              </button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {filteredSessions.map((session, index) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => router.push(`/learning/${session.id}`)}
                className="group bg-white dark:bg-zinc-900 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-xl hover:shadow-indigo-500/10 transition-all cursor-pointer active:scale-[0.98] touch-manipulation"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm sm:text-base text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-500 transition-colors truncate mb-1">
                      {session.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1 truncate max-w-[150px] sm:max-w-none">
                        <BookOpen className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{getSessionContextLabel(session)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" />
                        {session._count.messages}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(session.updatedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    disabled={isDeleting === session.id}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 flex-shrink-0 touch-manipulation active:scale-90"
                    aria-label="删除会话"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Create Session Modal - 全屏移动端优化 */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
            onClick={() => setIsCreating(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 w-full sm:rounded-2xl sm:max-w-2xl sm:max-h-[85vh] h-[90vh] sm:h-auto overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                <div>
                  <h2 className="font-bold text-lg">新建学习会话</h2>
                  <p className="text-sm text-zinc-500">选择要学习的内容</p>
                </div>
                <button
                  onClick={() => setIsCreating(false)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors touch-manipulation active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-hidden">
                <ContextSelector
                  articles={articles}
                  collections={collections}
                  selectedContext={selectedContext}
                  onContextChange={setSelectedContext}
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex-shrink-0">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors touch-manipulation active:scale-95"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateSession}
                  disabled={selectedContext.articleIds.length === 0 && !selectedContext.collectionId}
                  className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-medium shadow-lg shadow-indigo-500/25 active:scale-95 touch-manipulation"
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
