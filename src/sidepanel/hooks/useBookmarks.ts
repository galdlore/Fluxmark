import { useEffect, useState, useCallback } from 'react';
import {
    type VirtualNode,
    initializeVirtualTree,
    loadExpandedState,
    saveExpandedState
} from '../utils/virtualTreeUtils';

export const useBookmarks = () => {
    const [bookmarks, setBookmarks] = useState<VirtualNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [showHidden, setShowHidden] = useState(false); // New State: Toggle Hidden Items
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // Main Refresh Logic
    const fetchBookmarks = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);

        try {
            // 1. Load State & Tree
            // initializeVirtualTree wraps loadVirtualState + chrome.bookmarks.getTree + buildVirtualTree
            const tree = await initializeVirtualTree(showHidden);

            // 2. Load Expanded State (Runtime UI state)
            const expanded = await loadExpandedState();
            setExpandedIds(expanded);

            setBookmarks(tree);
        } catch (error) {
            console.error("Failed to fetch bookmarks:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [showHidden]);

    // Force Re-render with current state (useful after actions)
    const refresh = useCallback(async () => {
        await fetchBookmarks(true);
    }, [fetchBookmarks]);

    // Toggle Hidden Items
    const toggleShowHidden = useCallback(() => {
        setShowHidden(prev => !prev);
    }, []);

    // Toggle Expanded Helper (Wraps state update)
    const toggleNode = useCallback(async (id: string, isExpanded: boolean) => {
        const newSet = new Set(expandedIds);
        if (isExpanded) {
            newSet.add(id);
        } else {
            newSet.delete(id);
        }
        setExpandedIds(newSet);
        await saveExpandedState(newSet);
    }, [expandedIds]);


    useEffect(() => {
        fetchBookmarks();

        // Listeners for Chrome events (Sync Existence)
        // 1. Created: Refresh tree (new item will appear at end/default pos)
        const onCreated = async () => { /*_id, _bookmark*/
            await fetchBookmarks(true);
        };

        // 2. Removed: Refresh tree (item will disappear if not virtually hidden logic? 
        // Wait, if removed from Chrome, it's gone.
        // Virtual Hidden is only for when "We delete it virtually". 
        // If user deletes in Chrome, it should be gone here too.
        // buildVirtualTree iterates NATIVE nodes. If native node is gone, it's gone. Correct.
        const onRemoved = async () => { /*id*/
            await fetchBookmarks(true);
        };

        const onMoved = async () => {
            // Native Move -> Refresh. 
            // If we have virtual parent override, it might look weird if native parent changes?
            // But buildVirtualTree respects virtualParent if present.
            await fetchBookmarks(true);
        };

        const onChanged = async () => {
            await fetchBookmarks(true);
        }

        chrome.bookmarks.onCreated.addListener(onCreated);
        chrome.bookmarks.onRemoved.addListener(onRemoved);
        chrome.bookmarks.onMoved.addListener(onMoved);
        chrome.bookmarks.onChanged.addListener(onChanged);

        return () => {
            chrome.bookmarks.onCreated.removeListener(onCreated);
            chrome.bookmarks.onRemoved.removeListener(onRemoved);
            chrome.bookmarks.onMoved.removeListener(onMoved);
            chrome.bookmarks.onChanged.removeListener(onChanged);
        };
    }, [fetchBookmarks]);

    return {
        bookmarks,
        loading,
        refresh,
        showHidden,
        toggleShowHidden,
        expandedIds,
        toggleNode
    };
};
