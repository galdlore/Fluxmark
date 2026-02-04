import { useEffect, useState } from 'react';
import {
    type VirtualNode,
    initializeVirtualTree,
    saveVirtualTree,
    loadVirtualTree,
    appendNodeToParent,
    removeNodeFromTree
} from '../utils/virtualTreeUtils';

export const useBookmarks = () => {
    const [bookmarks, setBookmarks] = useState<VirtualNode[]>([]);
    const [loading, setLoading] = useState(true);

    // Initial Load
    const fetchBookmarks = async () => {
        setLoading(true);
        const tree = await initializeVirtualTree();
        setBookmarks(tree);
        setLoading(false);
    };

    // Force Save (used by DragEnd and Rename)
    const updateBookmarks = async (newTree: VirtualNode[]) => {
        setBookmarks(newTree);
        await saveVirtualTree(newTree);
    };

    useEffect(() => {
        fetchBookmarks();

        // Listeners for Chrome events (Sync Existence)
        // 1. Created: Add to virtual tree (simple append)
        const onCreated = async (_id: string, bookmark: chrome.bookmarks.BookmarkTreeNode) => {
            const currentTree = await loadVirtualTree() || [];
            const newNode: VirtualNode = {
                id: bookmark.id,
                title: bookmark.title,
                url: bookmark.url,
                parentId: bookmark.parentId,
                children: bookmark.children ? [] : undefined // Simplified, usually new default is empty
            };
            // For now, simple append. If parent is not found (e.g. root), it might be tricky.
            // We assume parentId aligns with our structure.
            const newTree = appendNodeToParent(currentTree, bookmark.parentId || '0', newNode);
            // If no change (parent not found), we might push to root?
            // Lets keep it safe.
            setBookmarks(newTree);
            await saveVirtualTree(newTree);
        };

        // 2. Removed: Remove from virtual tree
        const onRemoved = async (id: string) => {
            const currentTree = await loadVirtualTree() || [];
            const newTree = removeNodeFromTree(currentTree, id);
            setBookmarks(newTree);
            await saveVirtualTree(newTree);
        };

        const onMoved = async () => {
            // Simplified: Just re-fetch full tree to ensure consistency
            await fetchBookmarks();
        };

        // 3. Changed: Only update URL if changed? Ignore Title (user custom).
        // actually we can ignore it completely if we are fully decoupled.
        // user asks for "book mark name can be custom in extension".

        chrome.bookmarks.onCreated.addListener(onCreated);
        chrome.bookmarks.onRemoved.addListener(onRemoved);
        chrome.bookmarks.onMoved.addListener(onMoved);

        return () => {
            chrome.bookmarks.onCreated.removeListener(onCreated);
            chrome.bookmarks.onRemoved.removeListener(onRemoved);
            chrome.bookmarks.onMoved.removeListener(onMoved);
        };
    }, []);

    return { bookmarks, loading, updateBookmarks, refresh: fetchBookmarks };
};
