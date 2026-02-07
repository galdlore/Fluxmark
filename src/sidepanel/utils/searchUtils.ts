import type { VirtualNode } from './virtualTreeUtils';

/**
 * Recursively searches for bookmarks matching the query in title or URL.
 * Returns a flat list of matching nodes.
 */
export const searchBookmarks = (nodes: VirtualNode[], query: string): VirtualNode[] => {
    const lowerQuery = query.toLowerCase();
    let results: VirtualNode[] = [];

    for (const node of nodes) {
        const titleMatch = node.title.toLowerCase().includes(lowerQuery);
        const urlMatch = node.url ? node.url.toLowerCase().includes(lowerQuery) : false;

        if (titleMatch || urlMatch) {
            results.push(node);
        }

        if (node.children && node.children.length > 0) {
            results = results.concat(searchBookmarks(node.children, query));
        }
    }

    return results;
};
