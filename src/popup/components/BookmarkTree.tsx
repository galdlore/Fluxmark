import { useState } from 'react'

interface Props {
    node: chrome.bookmarks.BookmarkTreeNode
    depth?: number
}

export function BookmarkTree({ node, depth = 0 }: Props) {
    const [isOpen, setIsOpen] = useState(depth === 0) // Open root by default

    const isFolder = !node.url
    const paddingLeft = `${depth * 10}px`

    // Handle click on a bookmark link
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault()
        if (node.url) {
            chrome.tabs.create({ url: node.url, active: true })
        }
    }

    // Handle toggling a folder
    const handleToggle = () => {
        if (isFolder) {
            setIsOpen(!isOpen)
        }
    }

    if (isFolder) {
        return (
            <div style={{ paddingLeft }}>
                <div
                    onClick={handleToggle}
                    style={{
                        cursor: 'pointer',
                        userSelect: 'none',
                        fontWeight: 'bold',
                        padding: '4px 0',
                        display: 'flex',
                        alignItems: 'center'
                    }}
                >
                    <span style={{ marginRight: '5px', fontSize: '12px' }}>
                        {isOpen ? '📂' : '📁'}
                    </span>
                    {node.title || 'Root'}
                </div>

                {isOpen && node.children && (
                    <div>
                        {node.children.map(child => (
                            <BookmarkTree key={child.id} node={child} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // It's a bookmark link
    return (
        <div style={{ paddingLeft }}>
            <a
                href={node.url}
                onClick={handleClick}
                style={{
                    display: 'block',
                    padding: '4px 0',
                    textDecoration: 'none',
                    color: '#333',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}
                title={node.title} // Tooltip for full title
            >
                <span style={{ marginRight: '5px' }}>🔗</span>
                {node.title}
            </a>
        </div>
    )
}
