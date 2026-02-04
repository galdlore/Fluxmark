import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { getBookmarkFlag, openBookmark, type OpenFlag } from '../utils/bookmarkActions';
import type { VirtualNode } from '../utils/virtualTreeUtils';

interface BookmarkNodeProps {
    node: VirtualNode;
    depth?: number;
    onContextMenu: (e: React.MouseEvent, node: VirtualNode) => void;
    expandedNodes: Set<string>;
    onToggle: (id: string) => void;
    disabled?: boolean;
}

const FaviconImage: React.FC<{ url?: string }> = ({ url }) => {
    const [error, setError] = useState(false);

    if (error || !url) return <span className="opacity-70">📄</span>;

    const faviconUrl = chrome.runtime.getURL(`_favicon/?pageUrl=${encodeURIComponent(url)}&size=16`);

    return (
        <img
            src={faviconUrl}
            alt=""
            className="w-4 h-4 object-contain"
            onError={() => {
                // console.warn('Favicon load failed:', faviconUrl);
                setError(true);
            }}
        />
    );
};

const BookmarkNode: React.FC<BookmarkNodeProps> = ({ node, depth = 0, onContextMenu, expandedNodes, onToggle, disabled }) => {
    const isOpen = expandedNodes.has(node.id);
    const [flag, setFlag] = useState<OpenFlag>(null);

    const isFolder = !node.url;
    const paddingLeft = `${depth * 16 + 8}px`;

    // Sortable Hook
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: node.id, data: { node }, disabled });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        paddingLeft,
    };

    useEffect(() => {
        if (!isFolder) {
            getBookmarkFlag(node.id).then(setFlag);
        }
    }, [node.id, isFolder]);

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isFolder) {
            onToggle(node.id);
        } else {
            // Map VirtualNode to BookmarkTreeNode-like object for openBookmark
            // We only need url and id really.
            const bookmarkLike = { id: node.id, title: node.title, url: node.url } as chrome.bookmarks.BookmarkTreeNode;
            openBookmark(bookmarkLike);
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, node);
    };

    return (
        <div className="select-none">
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className={`
          flex items-center py-1 cursor-pointer transition-colors duration-150
          hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] rounded
          ${isDragging ? 'z-50 relative' : ''}
        `}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
            >
                {flag && !isFolder && (
                    <span className="mr-1 text-[10px] text-[var(--accent-color)] font-mono opacity-80">
                        ({flag})
                    </span>
                )}
                <span className="mr-2 flex items-center justify-center w-4 h-4 shrink-0">
                    {isFolder ? (
                        <span className="opacity-70">{isOpen ? '📂' : '📁'}</span>
                    ) : (
                        <FaviconImage url={node.url} />
                    )}
                </span>
                <span className="truncate text-sm flex-1">
                    {node.title}
                </span>
            </div>

            {isFolder && isOpen && node.children && (
                <div className="flex-col">
                    <SortableContext
                        items={node.children.map(c => c.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {node.children.map(child => (
                            <BookmarkNode
                                key={child.id}
                                node={child}
                                depth={depth + 1}
                                onContextMenu={onContextMenu}
                                expandedNodes={expandedNodes}
                                onToggle={onToggle}
                                disabled={disabled}
                            />
                        ))}
                    </SortableContext>
                </div>
            )}
        </div>
    );
};

export default BookmarkNode;
