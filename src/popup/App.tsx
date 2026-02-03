import { useEffect, useState } from 'react'
import { BookmarkTree } from './components/BookmarkTree'

function App() {
    const [bookmarks, setBookmarks] = useState<chrome.bookmarks.BookmarkTreeNode[]>([])

    useEffect(() => {
        // Check if we are in an extension environment
        if (chrome.bookmarks) {
            chrome.bookmarks.getTree((tree) => {
                setBookmarks(tree)
            })
        } else {
            // Mock data for development outside extension
            console.warn('Bookmarks API not available, using mock data')
            setBookmarks([
                {
                    id: '1',
                    title: 'Mock Bookmarks Bar',
                    children: [
                        { id: '2', title: 'Example', url: 'https://example.com' },
                        { id: '3', title: 'Google', url: 'https://google.com' }
                    ]
                }
            ] as any)
        }
    }, [])

    return (
        <div style={{
            padding: '10px',
            minWidth: '300px',
            backgroundColor: '#f5f5f5',
            minHeight: '100vh',
            boxSizing: 'border-box'
        }}>
            <h2 style={{ margin: '0 0 10px', fontSize: '18px' }}>Bookmarks</h2>
            {bookmarks.length > 0 ? (
                bookmarks.map(node => (
                    <BookmarkTree key={node.id} node={node} />
                ))
            ) : (
                <p>Loading...</p>
            )}
        </div>
    )
}

export default App
