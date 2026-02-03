import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import '../popup/index.css' // Reuse global styles (assuming Tailwind or vanilla CSS setup there)

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
