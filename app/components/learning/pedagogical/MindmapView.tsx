'use client';

import React, { useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Mindmap, MindmapNode } from '@/lib/core/learning/schemas';
import { motion } from 'framer-motion';

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface MindmapViewProps {
    data: Mindmap;
    onAction?: (action: string, value?: any) => void;
}

export const MindmapView: React.FC<MindmapViewProps> = ({ data, onAction }) => {
    const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
    const graphRef = useRef<any>(null);

    React.useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(isDark ? 'dark' : 'light');
    }, []);

    // Convert hierarchical tree to flat nodes and links
    const graphData = useMemo(() => {
        const nodes: any[] = [];
        const links: any[] = [];

        const traverse = (node: MindmapNode, parentId?: string) => {
            nodes.push({
                id: node.id,
                label: node.label,
                description: node.description,
                style: node.style || 'primary'
            });

            if (parentId) {
                links.push({ source: parentId, target: node.id });
            }

            if (node.children) {
                (node.children as MindmapNode[]).forEach(child => traverse(child, node.id));
            }
        };

        traverse(data.rootNode);
        return { nodes, links };
    }, [data]);

    const NODE_R = 12;

    const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const isDark = theme === 'dark';
        const label = node.label;
        const fontSize = 14 / globalScale;
        ctx.font = `${fontSize}px Inter, sans-serif`;
        const textWidth = ctx.measureText(label).width;
        const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 1.5); // padding

        // Draw background bubble
        ctx.fillStyle = node.style === 'primary'
            ? (isDark ? '#3b82f6' : '#2563eb')
            : node.style === 'secondary'
                ? (isDark ? '#10b981' : '#059669')
                : (isDark ? '#f59e0b' : '#d97706');

        const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
            if (w < 2 * r) r = w / 2;
            if (h < 2 * r) r = h / 2;
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
            return ctx;
        }

        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        roundedRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0] as number, bckgDimensions[1] as number, 6).fill();
        ctx.shadowBlur = 0;

        // Draw text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';
        ctx.fillText(label, node.x, node.y);

        // Store dimensions for collision/hover
        node.__bckgDimensions = bckgDimensions;
    }, [theme]);

    // Adjust graph properties after mount
    const handleEngineStop = useCallback(() => {
        if (graphRef.current) {
            graphRef.current.zoomToFit(400, 100);
        }
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-[500px] border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/50 relative group"
        >
            <div className="absolute top-4 left-4 z-10">
                <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{data.title}</h4>
                <p className="text-xs text-zinc-500">滚轮缩放，拖拽节点</p>
            </div>

            <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                nodeLabel={(node: any) => node.description || node.label}
                nodeCanvasObject={nodeCanvasObject}
                nodePointerAreaPaint={(node: any, color, ctx) => {
                    ctx.fillStyle = color;
                    const bckgDimensions: any = node.__bckgDimensions;
                    bckgDimensions && ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
                }}
                linkColor={() => (theme === 'dark' ? '#3f3f46' : '#e4e4e7')}
                linkWidth={2}
                backgroundColor="transparent"
                onNodeClick={(node: any) => onAction?.('node_click', node)}
                onEngineStop={handleEngineStop}
                cooldownTicks={100}
            />

            <div className="absolute bottom-4 right-4 flex gap-2">
                <button
                    onClick={() => graphRef.current.zoomToFit(400)}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 shadow-sm transition-colors text-xs font-medium"
                >
                    自适应视角
                </button>
            </div>
        </motion.div>
    );
};
