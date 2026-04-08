export interface VirtualNode {
    id: string; // Chrome Bookmark ID
    title: string; // Customizable title
    url?: string; // Optional URL (folders don't have one)
    children?: VirtualNode[];
    parentId?: string;
    isExpanded?: boolean; // For folders
    isHidden?: boolean; // Soft delete status
    dateAdded?: number;
}

export interface VirtualState {
    order: { [parentId: string]: string[] }; // Order of child IDs per parent
    hidden: string[]; // List of hidden (soft-deleted) IDs
    titles: { [id: string]: string }; // Custom titles
    virtualParent: { [childId: string]: string }; // Virtual parent mapping for folder moves
}

// --- Stable Key (device-independent identifier) ---

/**
 * デバイス間で一致するキーを生成する。
 * URLブックマーク: url + dateAdded の複合
 * フォルダ: dateAdded (またはタイトルフォールバック)
 * → Chrome sync はこれらの値を保持するため、IDと異なりデバイス間で一致する。
 */
export const stableKey = (node: { url?: string; dateAdded?: number; title?: string }): string => {
    if (node.url) return `u_${node.url}_${node.dateAdded ?? 0}`;
    return `f_${node.dateAdded ?? node.title ?? 'root'}`;
};

// --- Storage Keys ---
// sync: virtual state (split per key to avoid 8KB/item limit)
const STORAGE_KEY_ORDER_PREFIX = 'vs_order_'; // + parentId per folder
const STORAGE_KEY_HIDDEN = 'vs_hidden';
const STORAGE_KEY_TITLES = 'vs_titles';
const STORAGE_KEY_VPARENT = 'vs_vparent';
// local: UI-only state (no need to sync across devices)
export const STORAGE_KEY_EXPANDED = 'expanded_nodes';
// legacy local key (pre-sync)
const LEGACY_KEY_STATE = 'virtual_bookmark_state';

/** sync変更リスナーで使用: このキーがvirtual stateに属するか判定 */
export const isVirtualStateKey = (key: string): boolean =>
    key.startsWith(STORAGE_KEY_ORDER_PREFIX) ||
    key === STORAGE_KEY_HIDDEN ||
    key === STORAGE_KEY_TITLES ||
    key === STORAGE_KEY_VPARENT;

// --- Load / Save ---

export const loadVirtualState = async (): Promise<VirtualState> => {
    const syncData = await chrome.storage.sync.get(null);

    // syncにデータがなければローカルから移行を試みる
    const hasSyncData =
        STORAGE_KEY_HIDDEN in syncData ||
        STORAGE_KEY_TITLES in syncData ||
        Object.keys(syncData).some(k => k.startsWith(STORAGE_KEY_ORDER_PREFIX));

    if (!hasSyncData) {
        const localData = await chrome.storage.local.get(LEGACY_KEY_STATE);
        const legacy = localData[LEGACY_KEY_STATE] as VirtualState | undefined;
        if (legacy) {
            const migrated: VirtualState = {
                order: legacy.order || {},
                hidden: legacy.hidden || [],
                titles: legacy.titles || {},
                virtualParent: legacy.virtualParent || {},
            };
            await saveVirtualState(migrated);
            await chrome.storage.local.remove(LEGACY_KEY_STATE);
            return migrated;
        }
        return { order: {}, hidden: [], titles: {}, virtualParent: {} };
    }

    // フォルダごとの order キーを収集
    const order: { [parentId: string]: string[] } = {};
    Object.keys(syncData).forEach(key => {
        if (key.startsWith(STORAGE_KEY_ORDER_PREFIX)) {
            order[key.slice(STORAGE_KEY_ORDER_PREFIX.length)] = syncData[key] as string[];
        }
    });

    return {
        order,
        hidden: (syncData[STORAGE_KEY_HIDDEN] as string[]) || [],
        titles: (syncData[STORAGE_KEY_TITLES] as { [id: string]: string }) || {},
        virtualParent: (syncData[STORAGE_KEY_VPARENT] as { [childId: string]: string }) || {},
    };
};

export const saveVirtualState = async (state: VirtualState) => {
    const toSet: { [key: string]: unknown } = {
        [STORAGE_KEY_HIDDEN]: state.hidden,
        [STORAGE_KEY_TITLES]: state.titles,
        [STORAGE_KEY_VPARENT]: state.virtualParent,
    };

    // フォルダごとに個別キーで保存（8KB/item制限を回避）
    const newOrderKeys = new Set<string>();
    Object.keys(state.order).forEach(parentId => {
        if (state.order[parentId].length === 0) return; // 空の order は保存しない
        const key = `${STORAGE_KEY_ORDER_PREFIX}${parentId}`;
        toSet[key] = state.order[parentId];
        newOrderKeys.add(key);
    });

    // 削除されたフォルダの古い order キーをsyncから消す
    const allSync = await chrome.storage.sync.get(null);
    const staleKeys = Object.keys(allSync).filter(
        k => k.startsWith(STORAGE_KEY_ORDER_PREFIX) && !newOrderKeys.has(k)
    );

    await chrome.storage.sync.set(toSet);
    if (staleKeys.length > 0) {
        await chrome.storage.sync.remove(staleKeys);
    }
};

// --- Expanded State (local のまま: デバイスごとのUI状態) ---

export const loadExpandedState = async (): Promise<Set<string>> => {
    const result = await chrome.storage.local.get(STORAGE_KEY_EXPANDED);
    return new Set((result[STORAGE_KEY_EXPANDED] as string[]) || []);
};

export const saveExpandedState = async (ids: Set<string>) => {
    await chrome.storage.local.set({ [STORAGE_KEY_EXPANDED]: Array.from(ids) });
};

export const resetVirtualState = async () => {
    const allSync = await chrome.storage.sync.get(null);
    const vsKeys = Object.keys(allSync).filter(isVirtualStateKey);
    if (vsKeys.length > 0) {
        await chrome.storage.sync.remove(vsKeys);
    }
};

// --- Reconcile Logic ---

export const buildVirtualTree = (
    nativeNodes: chrome.bookmarks.BookmarkTreeNode[],
    state: VirtualState,
    showHidden: boolean
): VirtualNode[] => {
    // 1. Flatten Native Nodes for Lookup
    const nativeMap = new Map<string, chrome.bookmarks.BookmarkTreeNode>();
    const originalParentMap = new Map<string, string>();

    const flatten = (nodes: chrome.bookmarks.BookmarkTreeNode[], inferredParentId?: string) => {
        nodes.forEach(node => {
            nativeMap.set(node.id, node);
            const pid = node.parentId || inferredParentId;
            if (pid) {
                originalParentMap.set(node.id, pid);
            }
            if (node.children) {
                flatten(node.children, node.id);
            }
        });
    };
    flatten(nativeNodes, '0');

    // 2. Identify Children for each (Virtual) Parent
    const childrenMap = new Map<string, string[]>();

    nativeMap.forEach((node) => {
        let effectiveParentId = originalParentMap.get(node.id);
        if (state.virtualParent[node.id]) {
            const targetPid = state.virtualParent[node.id];
            if (nativeMap.has(targetPid) || targetPid === '0') {
                effectiveParentId = targetPid;
            }
        }

        if (effectiveParentId) {
            if (!childrenMap.has(effectiveParentId)) {
                childrenMap.set(effectiveParentId, []);
            }
            childrenMap.get(effectiveParentId)?.push(node.id);
        }
    });

    // 3. Recursive Build Function
    const buildNode = (nativeNode: chrome.bookmarks.BookmarkTreeNode): VirtualNode => {
        const id = nativeNode.id;
        const key = stableKey(nativeNode);
        const isHidden = state.hidden.includes(key);

        let childIds = childrenMap.get(id) || [];

        const storedOrder = state.order[id];
        if (storedOrder) {
            const orderMap = new Map(storedOrder.map((cid, idx) => [cid, idx]));
            childIds.sort((a, b) => {
                const idxA = orderMap.has(a) ? orderMap.get(a)! : 999999;
                const idxB = orderMap.has(b) ? orderMap.get(b)! : 999999;
                return idxA - idxB;
            });
        }

        const children: VirtualNode[] = [];
        childIds.forEach(childId => {
            const childNative = nativeMap.get(childId);
            if (childNative) {
                const isChildHidden = state.hidden.includes(childId);
                if (!isChildHidden || showHidden) {
                    children.push(buildNode(childNative));
                }
            }
        });

        const title = state.titles[key] !== undefined ? state.titles[key] : nativeNode.title;

        return {
            id,
            title,
            url: nativeNode.url,
            children: children.length > 0 || !nativeNode.url ? children : undefined,
            parentId: nativeNode.parentId,
            isExpanded: false,
            isHidden,
            dateAdded: nativeNode.dateAdded
        };
    };

    // 4. Build Roots
    return nativeNodes
        .filter(root => showHidden || !state.hidden.includes(root.id))
        .map(root => buildNode(root));
};

// --- Helpers for Action Integration ---

export const getNewOrder = (currentOrder: string[], movingId: string, newIndex: number): string[] => {
    const list = currentOrder.filter(id => id !== movingId);
    if (newIndex < 0) newIndex = 0;
    if (newIndex > list.length) newIndex = list.length;
    list.splice(newIndex, 0, movingId);
    return list;
};

export const initializeVirtualTree = async (showHidden: boolean) => {
    const [state, nativeRoot] = await Promise.all([
        loadVirtualState(),
        chrome.bookmarks.getTree()
    ]);

    const topLevelNodes = nativeRoot[0].children || [];
    return buildVirtualTree(topLevelNodes, state, showHidden);
};
