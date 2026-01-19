'use client';

import { useState, useEffect } from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { LocalBook } from '@/lib/db';
import { useTheme } from 'next-themes';
import { Loader2 } from 'lucide-react';

interface PdfReaderProps {
  book: LocalBook;
}

export function PdfReader({ book }: PdfReaderProps) {
  const [url, setUrl] = useState<string | null>(null);
  const { theme } = useTheme();
  
  // Initialize plugin
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: (defaultTabs) => [
      defaultTabs[0], // Thumbnails
      defaultTabs[1], // Bookmarks/Outline
    ],
  });

  useEffect(() => {
    if (book.fileData) {
      const blob = new Blob([book.fileData], { type: 'application/pdf' });
      const u = URL.createObjectURL(blob);
      setUrl(u);
      return () => URL.revokeObjectURL(u);
    }
  }, [book]);

  if (!url) {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-zinc-50 dark:bg-black">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      );
  }

  return (
    <div 
        className="h-screen w-full relative"
        style={{
            backgroundColor: theme === 'dark' ? '#000' : '#fff'
        }}
    >
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <div 
            style={{
                height: '100%',
                filter: theme === 'dark' ? 'invert(0.9) hue-rotate(180deg)' : 'none' // Simple dark mode hack for PDF content if needed, or use native theme support
            }}
            className={theme === 'dark' ? 'pdf-dark-mode' : ''}
        >
             {/* Note: rpv-core__viewer--dark class is needed on the viewer container, but Viewer component accepts theme prop */}
             <Viewer
                fileUrl={url}
                plugins={[defaultLayoutPluginInstance]}
                theme={theme === 'dark' ? 'dark' : 'light'}
             />
        </div>
      </Worker>
      
      {/* Global Style Override for PDF Viewer Dark Mode to match App */}
      {theme === 'dark' && (
          <style jsx global>{`
            .rpv-core__viewer--dark {
                background-color: #000 !important;
            }
            .rpv-default-layout__toolbar {
                background-color: #000 !important;
                border-bottom-color: #333 !important;
            }
            .rpv-default-layout__sidebar {
                background-color: #000 !important;
                border-right-color: #333 !important;
            }
            .rpv-core__textbox {
                background-color: #222 !important;
                color: #fff !important;
                border-color: #444 !important;
            }
          `}</style>
      )}
    </div>
  );
}
