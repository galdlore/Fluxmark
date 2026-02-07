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

// Batch set flags
export const setBookmarkFlags = async (flagMap: FlagMap) => {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const existingFlags = (result[STORAGE_KEY] || {}) as FlagMap;
    // Merge
    const newFlags = { ...existingFlags, ...flagMap };

    // Clean up nulls
    Object.keys(flagMap).forEach(key => {
        if (flagMap[key] === null) {
            delete newFlags[key];
        }
    });

    await chrome.storage.local.set({ [STORAGE_KEY]: newFlags });
};

export const deleteBookmark = async (id: string) => {
    // ... existing ...
    try {
        await chrome.bookmarks.removeTree(id);
    } catch (e) {
        await chrome.bookmarks.remove(id);
    }
};

// Recursive Flag Setting
export const setFolderFlag = async (folderNode: chrome.bookmarks.BookmarkTreeNode, flag: OpenFlag, recursive = true) => {
    // 1. Collect all bookmark IDs (not folders, unless we want to flag folders? No, flags are for items)
    // Actually our getBookmarkFlag checks based on ID.
    // So we need to find all child items.

    const ids: string[] = [];
    const traverse = (node: chrome.bookmarks.BookmarkTreeNode) => {
        if (node.url) {
            ids.push(node.id);
        }
        if (node.children) {
            if (recursive) {
                node.children.forEach(traverse);
            } else {
                node.children.forEach(child => {
                    if (child.url) ids.push(child.id);
                });
            }
        }
    };

    // If folderNode itself is the root to start from
    if (folderNode.children) {
        folderNode.children.forEach(traverse);
    }

    if (ids.length === 0) return;

    // 2. batch update
    const updateMap: FlagMap = {};
    ids.forEach(id => {
        updateMap[id] = flag;
    });

    await setBookmarkFlags(updateMap);
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

export const moveBookmark = async (id: string, parentId: string, index?: number): Promise<boolean | string> => {
    try {
        await chrome.bookmarks.move(id, { parentId, index });
        return true;
    } catch (error: any) {
        console.error('Failed to move bookmark:', error);
        return error.message || JSON.stringify(error);
    }
};
export const createBookmarkFolder = async (parentId: string, index?: number, title: string = 'New Folder'): Promise<void> => {
    try {
        await chrome.bookmarks.create({
            parentId,
            index,
            title
        });
    } catch (error) {
        console.error('Failed to create folder:', error);
    }
};

export const saveSession = async () => {
    try {
        // 1. Get all tabs in current window
        const tabs = await chrome.tabs.query({ currentWindow: true });
        if (tabs.length === 0) return;

        // 2. Create "Session YYYY-MM-DD HH:mm" Folder
        const now = new Date();
        const folderName = `Session ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // Create in "Other Bookmarks" (usually root '2' is Other, but let's just use '2' or find it)
        // Ideally we search for "Other Bookmarks" or just dump in root (which might be '0' or '1' or '2')
        // '1' is usually Bookmark Bar, '2' is Other Bookmarks. Let's try '2'.
        // Safe fallback: '1' if '2' fails? No, let's just use '2' for Other Bookmarks or '1' for Bar if user prefers.
        // Let's us '2' (Other Bookmarks) as default for session dumps to avoid cluttering bar.
        const parentId = '2';

        const folder = await chrome.bookmarks.create({
            parentId,
            title: folderName
        });

        if (!folder) return;

        // 3. Save all tabs
        for (const tab of tabs) {
            if (tab.url && tab.title) {
                await chrome.bookmarks.create({
                    parentId: folder.id,
                    title: tab.title,
                    url: tab.url
                });
            }
        }
        return true;

    } catch (error) {
        console.error('Failed to save session:', error);
        return false;
    }
};

