import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App';
import css from '../styles/main.css?inline';

const ROOT_ID = 'anti-ai-reader-root';

function toggleReader() {
  let root = document.getElementById(ROOT_ID);
  
  if (root) {
    // Toggle visibility if exists
    const isHidden = root.style.display === 'none';
    root.style.display = isHidden ? 'block' : 'none';
    document.body.style.overflow = isHidden ? 'hidden' : '';
  } else {
    // Create and mount
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.style.position = 'fixed';
    root.style.top = '0';
    root.style.left = '0';
    root.style.width = '100vw';
    root.style.height = '100vh';
    root.style.zIndex = '2147483647'; // Max z-index
    
    // Use Shadow DOM to isolate styles
    const shadow = root.attachShadow({ mode: 'open' });
    
    // Inject styles into Shadow DOM
    const style = document.createElement('style');
    style.textContent = css;
    shadow.appendChild(style);

    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';

    const appRoot = ReactDOM.createRoot(shadow);
    appRoot.render(
      <React.StrictMode>
        <App onClose={() => {
            root!.style.display = 'none';
            document.body.style.overflow = '';
        }} />
      </React.StrictMode>
    );
  }
}

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === 'TOGGLE_READER') {
    toggleReader();
  }
});
