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

const STORAGE_KEY_STATE = 'virtual_bookmark_state';
const STORAGE_KEY_EXPANDED = 'expanded_nodes';

// Initial Load of Stats
export const loadVirtualState = async (): Promise<VirtualState> => {
    const result = await chrome.storage.local.get(STORAGE_KEY_STATE);
    const state = result[STORAGE_KEY_STATE] as VirtualState;
    return state || { order: {}, hidden: [], titles: {}, virtualParent: {} };
};

export const saveVirtualState = async (state: VirtualState) => {
    await chrome.storage.local.set({ [STORAGE_KEY_STATE]: state });
};

// Expanded State Helpers
export const loadExpandedState = async (): Promise<Set<string>> => {
    const result = await chrome.storage.local.get(STORAGE_KEY_EXPANDED);
    return new Set((result[STORAGE_KEY_EXPANDED] as string[]) || []);
};
export const saveExpandedState = async (ids: Set<string>) => {
    await chrome.storage.local.set({ [STORAGE_KEY_EXPANDED]: Array.from(ids) });
};

export const resetVirtualState = async () => {
    await chrome.storage.local.remove([STORAGE_KEY_STATE]);
    // Optionally remove expanded state too?
    // await chrome.storage.local.remove([STORAGE_KEY_EXPANDED]);
};

// --- Reconcile Logic ---

export const buildVirtualTree = (
    nativeNodes: chrome.bookmarks.BookmarkTreeNode[],
    state: VirtualState,
    showHidden: boolean
): VirtualNode[] => {
    // 1. Flatten Native Nodes for Lookup
    const nativeMap = new Map<string, chrome.bookmarks.BookmarkTreeNode>();
    // We also need to know the *original* parent to detect if it was moved virtually.
    const originalParentMap = new Map<string, string>();

    const flatten = (nodes: chrome.bookmarks.BookmarkTreeNode[], inferredParentId?: string) => {
        nodes.forEach(node => {
            nativeMap.set(node.id, node);
            // Use existing parentId, or inferred one if missing
            const pid = node.parentId || inferredParentId;
            if (pid) {
                originalParentMap.set(node.id, pid);
            }
            if (node.children) {
                flatten(node.children, node.id);
            }
        });
    };
    // Root is usually 0, children [1, 2...]. We start consistently.
    // If nativeNodes is top-level children (Bar, Other), mapped to IDs.
    // Root usually has id '0'. The children of root have parentId '0'.
    // If we pass topLevelNodes, we can infer their parent is '0' if missing.
    flatten(nativeNodes, '0');

    // 2. Identify Children for each (Virtual) Parent
    // Start with Native Children lists
    const childrenMap = new Map<string, string[]>(); // parentId -> childIds

    nativeMap.forEach((node) => {
        // If this node is virtually moved, ignore its native parent linkage derived here?
        // No, we iterate all nodes and assign them to their effective parent.

        // Use our robust map first
        let effectiveParentId = originalParentMap.get(node.id);
        // Apply Virtual Move if valid
        if (state.virtualParent[node.id]) {
            const targetPid = state.virtualParent[node.id];
            // Check if targetPid exists in nativeMap or is a root (like '0' or '1' etc depends on browser)
            // Roots are usually in nativeMap if we flattened everything.
            // If target parent is missing (e.g. deleted folder), ignore this virtual move.
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
        const isHidden = state.hidden.includes(id);

        // Skip if hidden and not showing hidden items
        // Wait, if we return null here, array map needs filter.
        // We handle filtering at the list generation level.

        // Get effective children IDs
        let childIds = childrenMap.get(id) || [];

        // Apply Custom Order
        // If we have a stored order for this parent, utilize it.
        const storedOrder = state.order[id];
        if (storedOrder) {
            // Sort childIds based on storedOrder
            // Items NOT in storedOrder (newly added) go to end (or top?) -> End is safer.
            const orderMap = new Map(storedOrder.map((cid, idx) => [cid, idx]));

            childIds.sort((a, b) => {
                const idxA = orderMap.has(a) ? orderMap.get(a)! : 999999;
                const idxB = orderMap.has(b) ? orderMap.get(b)! : 999999;
                return idxA - idxB;
            });
        }

        // Build Children Nodes
        const children: VirtualNode[] = [];
        childIds.forEach(childId => {
            const childNative = nativeMap.get(childId);
            if (childNative) {
                // Visibility Check
                const isChildHidden = state.hidden.includes(childId);
                if (!isChildHidden || showHidden) {
                    children.push(buildNode(childNative));
                }
            }
        });

        // Determine Title
        const title = state.titles[id] !== undefined ? state.titles[id] : nativeNode.title;

        return {
            id,
            title,
            url: nativeNode.url,
            children: children.length > 0 || !nativeNode.url ? children : undefined, // Folders have children (or empty array if empty folder), Items undefined
            // Note: Native 'children' property existence distinguishes folder. 
            // Better: if !nativeNode.url, it is a folder.
            parentId: nativeNode.parentId, // Original Parent? Or Virtual? 
            // Let's keep original for ref, but for UI rendering we rely on structure.
            isExpanded: false, // Handled by separate state in UI, or passed in? 
            // We can leave isExpanded logic to the UI component or merge it here if we pass expanded set.
            isHidden,
            dateAdded: nativeNode.dateAdded
        };
    };

    // 4. Build Roots
    // We expect nativeNodes to be the top-level list (e.g., Bookmarks Bar, Other Bookmarks)
    // We map them directly.
    return nativeNodes.map(root => buildNode(root));
};

// --- Helpers for Action Integration ---

// Get new order after move
export const getNewOrder = (currentOrder: string[], movingId: string, newIndex: number): string[] => {
    const list = currentOrder.filter(id => id !== movingId);
    // Clamp index
    if (newIndex < 0) newIndex = 0;
    if (newIndex > list.length) newIndex = list.length;

    list.splice(newIndex, 0, movingId);
    return list;
};

// Helper used in hooks
export const initializeVirtualTree = async (showHidden: boolean) => {
    const [state, nativeRoot] = await Promise.all([
        loadVirtualState(),
        chrome.bookmarks.getTree()
    ]);

    // Usually root[0] is root (id:0), children are Bar(1), Other(2).
    const topLevelNodes = nativeRoot[0].children || [];

    return buildVirtualTree(topLevelNodes, state, showHidden);
};

