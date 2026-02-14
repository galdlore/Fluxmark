import {
    loadVirtualState,
    saveVirtualState
} from './virtualTreeUtils';

// --- Flags ---
const STORAGE_KEY = 'bookmark_flags';
const GLOBAL_STORAGE_KEY = 'global_default_flag';

export type OpenFlag = 'NF' | 'RF' | 'NB' | null;

interface FlagMap {
    [id: string]: OpenFlag | undefined;
}

// Re-implement Flag getters/setters
export const setBookmarkFlag = async (id: string, flag: OpenFlag) => {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const flags = (result[STORAGE_KEY] || {}) as FlagMap;
    if (flag === null) {
        delete flags[id];
    } else {
        flags[id] = flag;
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: flags });
};

export const getBookmarkFlag = async (id: string): Promise<OpenFlag> => {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const flags = (result[STORAGE_KEY] || {}) as FlagMap;
    return flags[id] || null;
};

export const setGlobalDefaultFlag = async (flag: OpenFlag) => {
    if (flag === null) {
        await chrome.storage.local.remove(GLOBAL_STORAGE_KEY);
    } else {
        await chrome.storage.local.set({ [GLOBAL_STORAGE_KEY]: flag });
    }
};

export const getGlobalDefaultFlag = async (): Promise<OpenFlag> => {
    const result = await chrome.storage.local.get(GLOBAL_STORAGE_KEY);
    return (result[GLOBAL_STORAGE_KEY] as OpenFlag) || 'NB';
};

export const setBookmarkFlags = async (flagMap: FlagMap) => {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const existingFlags = (result[STORAGE_KEY] || {}) as FlagMap;
    const newFlags = { ...existingFlags, ...flagMap };
    Object.keys(flagMap).forEach(key => {
        if (flagMap[key] === null) delete newFlags[key];
    });
    await chrome.storage.local.set({ [STORAGE_KEY]: newFlags });
};

// --- Virtual Actions ---

// 1. Virtual Move (Sort & Folder Change)
// 1. Virtual Move (Sort & Folder Change) -> Now NATIVE Move + Virtual Sort
export const moveBookmark = async (id: string, targetParentId: string, index?: number): Promise<boolean | string> => {
    try {
        const state = await loadVirtualState();

        // 1. Native Move
        // We always move natively first to ensure persistence.
        // For index: handling native index vs virtual index is complex.
        // We will move to the folder (append) natively, and rely on Virtual Order for exact specific position.
        // If we tried to sync native index, 'hidden' items would mess it up.
        await chrome.bookmarks.move(id, { parentId: targetParentId });

        // 2. Identify and Update Virtual Stat (Order)
        // Since we moved natively, we don't need 'virtualParent' anymore for this item (it matches native).
        if (state.virtualParent[id]) {
            delete state.virtualParent[id];
        }

        // 3. Update Order in Target Parent
        let newOrder = state.order[targetParentId];
        if (!newOrder) {
            // Initialize with current children if order doesn't exist
            const children = await chrome.bookmarks.getChildren(targetParentId);
            newOrder = children.map(c => c.id);
            // Ensure our ID is in there (it should be since we moved it, but async/race might vary)
            if (!newOrder.includes(id)) newOrder.push(id);
        }

        // Remove from old order if exists?
        // We don't easily know old parent here without query, but if we found it in state:
        // (Actually, iterating all orders to remove ID is safe)
        Object.keys(state.order).forEach(pid => {
            if (pid === targetParentId) return; // Handle target separately
            state.order[pid] = state.order[pid].filter(x => x !== id);
        });

        // Insert at correct index in TARGET order
        const cleanOrder = newOrder.filter(x => x !== id);
        const safeIndex = index !== undefined ? index : cleanOrder.length;
        cleanOrder.splice(safeIndex, 0, id);
        state.order[targetParentId] = cleanOrder;

        await saveVirtualState(state);
        return true;

    } catch (e: any) {
        console.error("Move failed", e);
        return e.message;
    }
};

// 2. Soft Delete (Hide)
export const deleteBookmark = async (id: string) => {
    // OLD: chrome.bookmarks.remove(id)
    // NEW: Add to hidden list
    const state = await loadVirtualState();
    if (!state.hidden.includes(id)) {
        state.hidden.push(id);
        await saveVirtualState(state);
    }
};

// 3. Restore
export const restoreBookmark = async (id: string) => {
    const state = await loadVirtualState();
    state.hidden = state.hidden.filter(hId => hId !== id);
    await saveVirtualState(state);
};

// 4. Virtual Rename
export const renameBookmark = async (id: string, newTitle: string) => {
    // OLD: chrome.bookmarks.update(id, { title })
    // NEW: Update titles map
    const state = await loadVirtualState();
    state.titles[id] = newTitle;
    await saveVirtualState(state);
};

// 5. Create Folder (Pass-through to Native + Auto-Append to Order?)
export const createBookmarkFolder = async (parentId: string, index?: number, title: string = 'New Folder') => {
    // Native create
    const node = await chrome.bookmarks.create({ parentId, title, index }); // Index might be respected by Chrome, but Virtual Order overrides.
    // Ideally we should add it to Virtual Order at the correct spot too?
    // If we rely on "Re-fetch merges new items at end", it might jump.
    // Better: Update Virtual Order immediately.

    if (node) {
        const state = await loadVirtualState();
        let order = state.order[parentId];
        if (order) {
            // Insert ID at index
            const safeIndex = index !== undefined ? index : order.length;
            order.splice(safeIndex, 0, node.id);
            await saveVirtualState(state);
        }
    }
};


// --- Recursive Helpers (Read behavior unchanged) ---
export const setFolderFlag = async (folderNode: chrome.bookmarks.BookmarkTreeNode, flag: OpenFlag, recursive = true) => {
    const ids: string[] = [];
    const traverse = (node: chrome.bookmarks.BookmarkTreeNode) => {
        if (node.url) ids.push(node.id);
        if (node.children) {
            if (recursive) node.children.forEach(traverse);
            else node.children.forEach(c => { if (c.url) ids.push(c.id); });
        }
    };
    if (folderNode.children) folderNode.children.forEach(traverse);
    if (ids.length === 0) return;
    const updateMap: FlagMap = {};
    ids.forEach(id => { updateMap[id] = flag; });
    await setBookmarkFlags(updateMap);
};

export const openBookmark = async (bookmark: chrome.bookmarks.BookmarkTreeNode, isBackgroundClick = false) => {
    if (!bookmark.url) return;
    if (isBackgroundClick) {
        await chrome.tabs.create({ url: bookmark.url, active: false });
        return;
    }
    const localFlag = await getBookmarkFlag(bookmark.id);
    const globalFlag = await getGlobalDefaultFlag();
    const flag = localFlag || globalFlag; // Local overrides Global

    if (flag === 'NB') {
        await chrome.tabs.create({ url: bookmark.url, active: false });
    } else if (flag === 'NF') {
        await chrome.tabs.create({ url: bookmark.url, active: true });
    } else if (flag === 'RF') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            await chrome.tabs.update(tab.id, { url: bookmark.url });
        } else {
            await chrome.tabs.create({ url: bookmark.url, active: true });
        }
    } else {
        await chrome.tabs.create({ url: bookmark.url, active: false });
    }
};

const getUrlsFromFolder = (folderNode: chrome.bookmarks.BookmarkTreeNode, recursive: boolean): string[] => {
    const urls: string[] = [];
    if (!folderNode.children) return urls;
    if (recursive) {
        const traverse = (node: chrome.bookmarks.BookmarkTreeNode) => {
            if (node.url) urls.push(node.url);
            if (node.children) node.children.forEach(traverse);
        };
        folderNode.children.forEach(traverse);
    } else {
        folderNode.children.forEach(child => {
            if (child.url) urls.push(child.url);
        });
    }
    return urls;
};

export const openFolderInBackground = async (folderNode: chrome.bookmarks.BookmarkTreeNode, recursive = false) => {
    const urls = getUrlsFromFolder(folderNode, recursive);
    if (urls.length === 0) return;
    if (urls.length > 20) {
        const confirmed = window.confirm(`You are about to open ${urls.length} tabs. Continue?`);
        if (!confirmed) return;
    }
    for (const url of urls) {
        await chrome.tabs.create({ url, active: false });
    }
};

export const saveSession = async () => {
    try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        if (tabs.length === 0) return;
        const now = new Date();
        const folderName = `Session ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const parentId = '2'; // Other Bookmarks
        const folder = await chrome.bookmarks.create({ parentId, title: folderName });
        if (!folder) return;
        for (const tab of tabs) {
            if (tab.url && tab.title) {
                await chrome.bookmarks.create({ parentId: folder.id, title: tab.title, url: tab.url });
            }
        }
        return true;
    } catch (error) {
        console.error('Failed to save session:', error);
        return false;
    }
};

