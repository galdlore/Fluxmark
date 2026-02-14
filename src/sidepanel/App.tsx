import React, { useState, useEffect, useMemo } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    type DragStartEvent,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useBookmarks } from './hooks/useBookmarks';
import BookmarkNode, { BookmarkItemVisual } from './components/BookmarkNode';
import ContextMenu from './components/ContextMenu';
import {
    openBookmark,
    openFolderInBackground,
    setBookmarkFlag,
    getBookmarkFlag,
    moveBookmark,
    getGlobalDefaultFlag,
    setGlobalDefaultFlag,
    deleteBookmark,
    restoreBookmark,
    createBookmarkFolder,
    saveSession,
    renameBookmark,
    setFolderFlag,
    type OpenFlag
} from './utils/bookmarkActions';
import {
    type VirtualNode,
    resetVirtualState
} from './utils/virtualTreeUtils';
import { searchBookmarks } from './utils/searchUtils';
import HelpView from './components/HelpView';

const App = () => {
    const { bookmarks, loading, refresh, showHidden, toggleShowHidden, expandedIds, toggleNode } = useBookmarks();

    // Safety Mode State
    const [isSafetyMode, setIsSafetyMode] = useState<boolean>(() => {
        return localStorage.getItem('safetyMode') === 'true';
    });
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    useEffect(() => {
        localStorage.setItem('safetyMode', String(isSafetyMode));
    }, [isSafetyMode]);

    // Global Default State
    const [globalDefault, setGlobalDefaultState] = useState<OpenFlag>('NB');

    useEffect(() => {
        getGlobalDefaultFlag().then(flag => setGlobalDefaultState(flag || 'NB'));
    }, []);

    const handleGlobalDefaultChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value as OpenFlag;
        setGlobalDefaultState(val);
        await setGlobalDefaultFlag(val);
    };

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string, node: VirtualNode } | null>(null);
    const [currentFlag, setCurrentFlag] = useState<OpenFlag>(null);
    const [activeId, setActiveId] = useState<string | null>(null);

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const searchResults = useMemo(() => {
        if (!searchTerm) return [];
        return searchBookmarks(bookmarks, searchTerm);
    }, [bookmarks, searchTerm]);

    const handleContextMenu = (e: React.MouseEvent, node: VirtualNode) => {
        e.preventDefault(); // Prevent default
        getBookmarkFlag(node.id).then(f => setCurrentFlag(f));
        setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, node });
    };

    const closeMenu = () => setContextMenu(null);

    // -- Handlers --

    const handleOpenBackground = (recursive: boolean) => {
        if (!contextMenu?.node) return;
        if (contextMenu.node.children) {
            // Map VirtualNode to BookmarkTreeNode-like for compatibility
            const nodeLike = { ...contextMenu.node, children: contextMenu.node.children as any } as chrome.bookmarks.BookmarkTreeNode;
            openFolderInBackground(nodeLike, recursive);
        } else {
            const nodeLike = { id: contextMenu.node.id, title: contextMenu.node.title, url: contextMenu.node.url } as chrome.bookmarks.BookmarkTreeNode;
            openBookmark(nodeLike, true);
        }
    };

    const handleSetFlag = async (flag: OpenFlag) => {
        if (!contextMenu?.node) return;
        if (contextMenu.node.children) {
            // Folder - Bulk Set
            const nodeLike = {
                id: contextMenu.node.id,
                children: contextMenu.node.children as any
            } as chrome.bookmarks.BookmarkTreeNode;
            await setFolderFlag(nodeLike, flag, true);
        } else {
            // Single Item
            await setBookmarkFlag(contextMenu.node.id, flag);
        }
        refresh();
    };

    const handleRename = async (newName: string) => {
        if (isSafetyMode || !contextMenu?.node) return;
        await renameBookmark(contextMenu.node.id, newName);
        refresh();
    };

    const handleDelete = async () => {
        if (contextMenu?.node) {
            await deleteBookmark(contextMenu.node.id);
            // utilize hook listener/refresh
            refresh();
        }
    };

    const handleRestore = async () => {
        if (contextMenu?.node) {
            await restoreBookmark(contextMenu.node.id);
            refresh();
        }
    };

    const handleNewFolder = async () => {
        if (isSafetyMode || !contextMenu?.node) return;

        // Find context to know parent
        const findContext = (nodes: VirtualNode[], id: string, parentId: string = '0'): { parentId: string, index: number } | null => {
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id === id) return { parentId, index: i };
                if (nodes[i].children) {
                    const found = findContext(nodes[i].children!, id, nodes[i].id);
                    if (found) return found;
                }
            }
            return null;
        };

        const ctx = findContext(bookmarks, contextMenu.node.id, bookmarks[0]?.parentId || '0');
        if (!ctx) return;

        const parentId = ctx.parentId;
        if (!parentId || parentId === '0') return;

        await createBookmarkFolder(parentId, ctx.index + 1, 'New Folder');
        refresh();
    };


    const handleDragStart = (event: DragStartEvent) => {
        if (isSafetyMode) return;
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (isSafetyMode || searchTerm) return; // Disable DnD in search mode
        if (!over) return;

        if (active.id !== over.id) {
            const activeId = active.id as string;
            const overId = over.id as string;

            // Context finding logic
            const findContext = (nodes: VirtualNode[], id: string, parentId: string = '0'): { parentId: string, index: number } | null => {
                for (let i = 0; i < nodes.length; i++) {
                    if (nodes[i].id === id) return { parentId, index: i };
                    if (nodes[i].children) {
                        const found = findContext(nodes[i].children!, id, nodes[i].id);
                        if (found) return found;
                    }
                }
                return null;
            };

            const overCtx = findContext(bookmarks, overId, bookmarks[0]?.parentId || '0');

            if (overCtx) {
                await moveBookmark(activeId, overCtx.parentId, overCtx.index);
                refresh();
            }
        }
    };

    return (
        <div className="h-screen w-screen flex flex-col bg-primary text-primary overflow-hidden">
            {/* Header */}
            <div className="flex-none flex flex-col gap-2 p-2 border-b border-color z-50 bg-primary">
                <div className="flex items-center justify-end">
                    {/* <h1 className="text-lg font-bold tracking-tight mr-auto">Bookmarks</h1> */}

                    <div className="flex items-center gap-2">
                        {/* Toggle Hidden */}
                        <button
                            onClick={toggleShowHidden}
                            className={`p-1 rounded transition-colors border-none outline-none ring-0 focus:ring-0 ${showHidden ? 'bg-accent text-white hover-opacity-90' : 'text-gray-400 hover-bg-gray-200'}`}
                            title={showHidden ? "Hide Deleted Items" : "Show Deleted Items"}
                        >
                            👁️
                        </button>

                        {/* Global Default Selector */}
                        <select
                            value={globalDefault || 'NB'}
                            onChange={handleGlobalDefaultChange}
                            className="text-xs bg-[var(--bg-secondary)] text-primary border border-color rounded p-1 outline-none"
                            title="Global Default Action"
                        >
                            <option value="NB">New Tab (Back)</option>
                            <option value="NF">New Tab (Front)</option>
                            <option value="RF">Current Tab</option>
                        </select>

                        {/* Save Session Button */}
                        <button
                            onClick={async () => {
                                if (isSafetyMode) return;
                                const success = await saveSession();
                                if (success) refresh();
                            }}
                            className="p-1 rounded hover:bg-[var(--bg-hover)] text-xs border border-color opacity-70"
                            title="Save Current Session (Tabs to Folder)"
                            disabled={isSafetyMode}
                        >
                            💾
                        </button>

                        {/* Safety Mode Toggle */}
                        <button
                            onClick={() => setIsSafetyMode(!isSafetyMode)}
                            className="p-1 rounded hover:bg-[var(--bg-hover)] text-xs font-mono border border-color opacity-70"
                            title={isSafetyMode ? "Safety Mode ON (Read Only)" : "Edit Mode ON"}
                        >
                            {isSafetyMode ? "🔒" : "🔓"}
                        </button>

                        {/* Reset State Button */}
                        <button
                            onClick={async () => {
                                if (window.confirm("Are you sure you want to reset all customizations? This will clear custom names, hidden items, and virtual folder structures.")) {
                                    await resetVirtualState();
                                    window.location.reload();
                                }
                            }}
                            className="p-1 rounded hover:bg-red-100 text-xs border border-color opacity-70 text-red-500"
                            title="Reset Customizations"
                        >
                            🗑️
                        </button>

                        {/* Help Button */}
                        <button
                            onClick={() => setIsHelpOpen(true)}
                            className="p-1 rounded hover:bg-[var(--bg-hover)] text-xs border border-color opacity-70 font-bold w-6 h-6 flex items-center justify-center"
                            title="Help & Usage"
                        >
                            ?
                        </button>
                    </div>
                </div>

                {/* Search Input */}
                <input
                    type="text"
                    placeholder="Search bookmarks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-xs bg-[var(--bg-secondary)] text-primary border border-color rounded p-1.5 outline-none focus:border-[var(--accent-color)]"
                />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-2 pt-0">
                {loading ? (
                    <p className="text-sm text-[var(--text-secondary)] text-center py-4">Loading...</p>
                ) : isHelpOpen ? (
                    // Help View
                    <HelpView onClose={() => setIsHelpOpen(false)} />
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="space-y-1">
                            {searchTerm ? (
                                // Search Results
                                searchResults.length > 0 ? (
                                    <div className="space-y-1">
                                        <p className="text-xs text-[var(--text-secondary)] px-2 pb-2">
                                            Found {searchResults.length} result(s)
                                        </p>
                                        <SortableContext
                                            items={searchResults.map(b => b.id)}
                                            strategy={verticalListSortingStrategy}
                                            disabled={true}
                                        >
                                            {searchResults.map(node => (
                                                <BookmarkNode
                                                    key={node.id}
                                                    node={node}
                                                    onContextMenu={handleContextMenu}
                                                    expandedNodes={expandedIds}
                                                    onToggle={toggleNode}
                                                    disabled={true}
                                                    depth={0} // Flat view
                                                />
                                            ))}
                                        </SortableContext>
                                    </div>
                                ) : (
                                    <p className="text-sm text-[var(--text-secondary)] text-center py-4">No results found.</p>
                                )
                            ) : (
                                // Standard Tree View
                                <SortableContext
                                    items={bookmarks.map(b => b.id)}
                                    strategy={verticalListSortingStrategy}
                                    disabled={isSafetyMode}
                                >
                                    {bookmarks.map(node => (
                                        <BookmarkNode
                                            key={node.id}
                                            node={node}
                                            onContextMenu={handleContextMenu}
                                            expandedNodes={expandedIds}
                                            onToggle={toggleNode}
                                            disabled={isSafetyMode}
                                        />
                                    ))}
                                </SortableContext>
                            )}
                        </div>
                        <DragOverlay>
                            {activeId ? (() => {
                                const findNode = (nodes: VirtualNode[], id: string): VirtualNode | null => {
                                    for (const n of nodes) {
                                        if (n.id === id) return n;
                                        if (n.children) {
                                            const found = findNode(n.children, id);
                                            if (found) return found;
                                        }
                                    }
                                    return null;
                                };
                                const node = findNode(bookmarks, activeId);
                                return node ? (
                                    <BookmarkItemVisual
                                        node={node}
                                        isFolder={!node.url}
                                        isOpen={expandedIds.has(node.id)}
                                        style={{ opacity: 0.8, cursor: 'grabbing' }}
                                    />
                                ) : null;
                            })() : null}
                        </DragOverlay>
                    </DndContext>
                )}
            </div>

            {
                contextMenu && (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        targetId={contextMenu.nodeId}
                        isFolder={!!contextMenu.node.children}
                        onClose={closeMenu}
                        onOpenBackground={handleOpenBackground}
                        onSetFlag={handleSetFlag}
                        onRename={handleRename}
                        onDelete={handleDelete}
                        onRestore={handleRestore}
                        onNewFolder={handleNewFolder}
                        currentFlag={currentFlag}
                        currentTitle={contextMenu.node.title}
                        isSafetyMode={isSafetyMode}
                        isHidden={!!contextMenu.node.isHidden}
                    />
                )
            }
        </div >
    );
};

export default App;
