export interface VirtualNode {
    id: string; // Chrome Bookmark ID
    title: string; // Customizable title
    url?: string; // Optional URL (folders don't have one)
    children?: VirtualNode[];
    parentId?: string;
    isExpanded?: boolean; // For folders
}

const STORAGE_KEY_TREE = 'virtual_bookmark_tree';

// Convert native tree to virtual tree
export const convertNativeToVirtual = (nodes: chrome.bookmarks.BookmarkTreeNode[]): VirtualNode[] => {
    return nodes.map(node => ({
        id: node.id,
        title: node.title,
        url: node.url,
        parentId: node.parentId,
        children: node.children ? convertNativeToVirtual(node.children) : undefined,
        isExpanded: false
    }));
};

export const loadVirtualTree = async (): Promise<VirtualNode[] | null> => {
    const result = await chrome.storage.local.get(STORAGE_KEY_TREE);
    return (result[STORAGE_KEY_TREE] as VirtualNode[]) || null;
};

export const saveVirtualTree = async (tree: VirtualNode[]) => {
    await chrome.storage.local.set({ [STORAGE_KEY_TREE]: tree });
};

// --- Tree Manipulation Helpers ---

// Find node by ID
export const findNode = (nodes: VirtualNode[], id: string): VirtualNode | null => {
    for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
            const found = findNode(node.children, id);
            if (found) return found;
        }
    }
    return null;
};

// Update node properties (title, isExpanded)
export const updateNodeInTree = (nodes: VirtualNode[], id: string, updates: Partial<VirtualNode>): VirtualNode[] => {
    return nodes.map(node => {
        if (node.id === id) {
            return { ...node, ...updates };
        }
        if (node.children) {
            return { ...node, children: updateNodeInTree(node.children, id, updates) };
        }
        return node;
    });
};

// Remove node
export const removeNodeFromTree = (nodes: VirtualNode[], id: string): VirtualNode[] => {
    return nodes.filter(node => node.id !== id).map(node => ({
        ...node,
        children: node.children ? removeNodeFromTree(node.children, id) : undefined
    }));
};

// Add node (basic append to parent or root)
export const appendNodeToParent = (nodes: VirtualNode[], parentId: string, newNode: VirtualNode): VirtualNode[] => {
    // Special case: if appending to root (and sometimes parentId is not clear), assume root level if ID matches
    // But typically nodes are children of '0' or '1' (Bookmarks Bar).
    // If parentId matches a node, append to its children.
    const tryUpdate = (list: VirtualNode[]): VirtualNode[] => {
        return list.map(node => {
            if (node.id === parentId) {
                return {
                    ...node,
                    children: [...(node.children || []), newNode]
                };
            }
            if (node.children) {
                return { ...node, children: tryUpdate(node.children) };
            }
            return node;
        });
    };

    // If root itself is the parent (rare for flat root list, but possible if root is '0')
    // Our 'nodes' array passed here is usually children of root '0'.
    // So if parentId is '0', we just push to list.
    if (parentId === '0') return [...nodes, newNode];

    return tryUpdate(nodes);
};

// Initial sync check
export const initializeVirtualTree = async () => {
    const existing = await loadVirtualTree();
    if (!existing || existing.length === 0) {
        const root = await chrome.bookmarks.getTree();
        // Usually root[0] is root, we want its children (Bar, Other, etc.)
        const initialTree = convertNativeToVirtual(root[0].children || []);
        await saveVirtualTree(initialTree);
        return initialTree;
    }
    return existing;
};
