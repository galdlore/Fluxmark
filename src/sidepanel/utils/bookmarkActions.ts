// Helper to get stored flags. 
// We will store flags as a map: { [bookmarkId]: 'NF' | 'RF' | 'NB' }
// NF: New Foreground, RF: Reload Foregroundf (Current), NB: New Background
const STORAGE_KEY = 'bookmark_flags';

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
    const flag = await getBookmarkFlag(bookmark.id);

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
        // Default Behavior: Background Open (active: false)
        await chrome.tabs.create({ url: bookmark.url, active: false });
    }
};

export const openFolderInBackground = async (folderNode: chrome.bookmarks.BookmarkTreeNode) => {
    if (!folderNode.children) return;

    // Open all children in background tabs
    for (const child of folderNode.children) {
        if (child.url) {
            // await ensures sequence, active: false keeps them in background
            await chrome.tabs.create({ url: child.url, active: false });
        }
    }
};
