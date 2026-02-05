import { useEffect, useState } from 'react';
import {
    type VirtualNode,
    initializeVirtualTree,
    saveVirtualTree,
    loadVirtualTree,
    removeNodeFromTree
} from '../utils/virtualTreeUtils';

export const useBookmarks = () => {
    const [bookmarks, setBookmarks] = useState<VirtualNode[]>([]);
    const [loading, setLoading] = useState(true);

    // Initial Load
    const fetchBookmarks = async (silent = false) => {
        if (!silent) setLoading(true);
        const tree = await initializeVirtualTree();
        setBookmarks(tree);
        if (!silent) setLoading(false);
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
        const onCreated = async (_id: string, _bookmark: chrome.bookmarks.BookmarkTreeNode) => {
            // Re-fetch to ensure correct order (index) from native tree
            await fetchBookmarks(true);
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
            // Silent refresh to keep scroll position!
            await fetchBookmarks(true);
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

    // Default refresh to silent=true because usually manual refresh is for updates, initial load is internal
    return { bookmarks, loading, updateBookmarks, refresh: () => fetchBookmarks(true) };
};
