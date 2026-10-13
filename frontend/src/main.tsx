import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Scaffolding temporário de revisão visual local — ver devMock.ts.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('mock') === '1') {
    await import('./devMock');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
