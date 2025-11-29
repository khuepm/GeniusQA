/**
 * GeniusQA Desktop App Entry Point
 * Tauri + React Web version
 */

import React from 'react';
import './App.css';

const App: React.FC = () => {
  return (
    <div className="app">
      <div className="container">
        <h1>GeniusQA Desktop</h1>
        <p>Tauri + React application is running!</p>
        <div className="info">
          <p>✅ Vite dev server: OK</p>
          <p>✅ React: OK</p>
          <p>✅ Tauri: OK</p>
        </div>
      </div>
    </div>
  );
};

export default App;
