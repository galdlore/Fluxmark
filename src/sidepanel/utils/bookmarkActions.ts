// Helper to get stored flags. 
// We will store flags as a map: { [bookmarkId]: 'NF' | 'RF' | 'NB' }
// NF: New Foreground, RF: Reload Foregroundf (Current), NB: New Background
const STORAGE_KEY = 'bookmark_flags';
const GLOBAL_STORAGE_KEY = 'global_default_flag';

export type OpenFlag = 'NF' | 'RF' | 'NB' | null;

interface FlagMap {
    [id: string]: OpenFlag | undefined;
}

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
    return (result[GLOBAL_STORAGE_KEY] as OpenFlag) || 'NB'; // Default fallback is 'NB'
};

export const deleteBookmark = async (id: string) => {
    // For bookmarks API, removeTree is safe for both folders and items? 
    // Actually removeTree is for folders, remove is for items.
    // However, removeTree on an item works in some browsers but strictly 'remove' is for items.
    // Let's try to detect or just use try-catch hierarchy or check if it has children?
    // The caller usually knows. But easier:
    try {
        // Try removeTree first? No, removeTree is heavy.
        // We can just use the chrome.bookmarks.removeTree for everything?
        // Documentation says "recursively removes".
        await chrome.bookmarks.removeTree(id);
    } catch (e) {
        // Fallback to remove if it's not a folder or some other error?
        // Actually removeTree works for non-folders too in Chrome usually.
        // But safe approach:
        await chrome.bookmarks.remove(id);
    }
};

// Main Action: Open based on settings/flags
export const openBookmark = async (bookmark: chrome.bookmarks.BookmarkTreeNode, isBackgroundClick = false) => {
    if (!bookmark.url) return;

    // 1. Forced Background Open (Context Menu)
    if (isBackgroundClick) {
        // Explicitly active: false prevents focus stealing
        await chrome.tabs.create({ url: bookmark.url, active: false });
        return;
    }

    // 2. Open based on Flags
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
        // Default Fallback (should be covered by globalFlag='NB' but just in case)
        await chrome.tabs.create({ url: bookmark.url, active: false });
    }
};

// Helper to recursively collect URLs
const collectUrls = (node: chrome.bookmarks.BookmarkTreeNode, recursive: boolean, acc: string[] = []) => {
    if (node.url) {
        acc.push(node.url);
    }
    if (node.children) {
        if (recursive) {
            node.children.forEach(child => collectUrls(child, recursive, acc));
        } else {
            // If not recursive, we only want direct children files, but my helper structure is node-based.
            // If the entry function was called on the Folder, we iterate its children.
            // But if called recursively, we stop.
            // Actually, simplest is: Top level logic handles direct interaction.
            // But for recursion, we need to dive.
        }
    }
    return acc;
};

// Refined collector for the entry point
const getUrlsFromFolder = (folderNode: chrome.bookmarks.BookmarkTreeNode, recursive: boolean): string[] => {
    const urls: string[] = [];
    if (!folderNode.children) return urls;

    if (recursive) {
        // Deep traversal
        const traverse = (node: chrome.bookmarks.BookmarkTreeNode) => {
            if (node.url) urls.push(node.url);
            if (node.children) {
                node.children.forEach(traverse);
            }
        };
        // Initial children
        folderNode.children.forEach(traverse);
    } else {
        // Direct children only
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
        const confirmed = window.confirm(`You are about to open ${urls.length} tabs. This might slow down your browser. Continue?`);
        if (!confirmed) return;
    }

    // Open all collected URLs in background tabs
    for (const url of urls) {
        // eslint-disable-next-line
        await chrome.tabs.create({ url, active: false });
    }
    // Note: We intentionally await sequentially to avoid overloading browser process too fast, though parallel is also possible.
};

export const moveBookmark = async (id: string, parentId: string, index: number) => {
    try {
        await chrome.bookmarks.move(id, { parentId, index });
    } catch (error) {
        console.error('Failed to move bookmark:', error);
    }
};
