let chatWindow = null;
let isDragging = false;
let isResizing = false;
let initialPos = { x: 0, y: 0 };
let initialSize = { width: 0, height: 0 };
let isSidebar = true;
let isResizingSidebar = false;
let initialSidebarWidth = 500;
let isChatVisible = true;
let isExtensionActive = true;
let floatingBar = null;
let selectedText = '';
let selectionTimeout = null;
let lastSelection = null;
let predictionBar = null;
let currentPrediction = '';
let isTyping = false;
let typingTimer = null;
const TYPING_INTERVAL = 500; // ms
let floatingBarShown = false;
let showFloatingBarTimeout = null;
let isFloatingBarVisible = false; // Keep only this declaration

const isGmail = window.location.hostname === 'mail.google.com';

function createChatWindow() {
  console.log('Creating navAssist window');
  chatWindow = document.createElement('div');
  chatWindow.id = 'chatWindow';
  
  // Set initial display based on isChatVisible
  chatWindow.style.display = isChatVisible ? 'flex' : 'none';
  
  chatWindow.innerHTML = `
    <div id="chatHeader">
      <div id="dragHandle">
        <img src="${chrome.runtime.getURL('icon.png')}" alt="navAssist Icon" id="chatIcon">
        <span>navAssist</span>
      </div>
      <div class="chat-controls">
        <button id="hideChat" title="Hide Chat">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
        <button id="toggleSidebar" title="Toggle Sidebar/Popup">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>
        <button id="summarizeContent" title="Summarize page content">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="21" y1="10" x2="7" y2="10"></line>
            <line x1="21" y1="6" x2="3" y2="6"></line>
            <line x1="21" y1="14" x2="3" y2="14"></line>
            <line x1="21" y1="18" x2="7" y2="18"></line>
          </svg>
        </button>
        <button id="restartChat" title="Restart Chat">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
          </svg>
        </button>
      </div>
    </div>
    <div id="chatMessages"></div>
    <div id="chatInput">
      <textarea id="messageInput" placeholder="Type your message..." rows="1"></textarea>
      <button id="sendMessage">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
    <div id="resizeHandle"></div>
    <div id="sidebarResizeHandle"></div>
  `;
  document.body.appendChild(chatWindow);

  // Change this line to use the new dragHandle
  const dragHandle = chatWindow.querySelector('#dragHandle');
  dragHandle.addEventListener('mousedown', startDragging);

  // Set initial position and size for sidebar
  setSidebarMode();

  const chatHeader = chatWindow.querySelector('#chatHeader');
  chatHeader.addEventListener('mousedown', startDragging);

  const sendButton = chatWindow.querySelector('#sendMessage');
  sendButton.addEventListener('click', sendMessage);

  const messageInput = chatWindow.querySelector('#messageInput');
  messageInput.addEventListener('keydown', handleKeyDown);
  messageInput.addEventListener('input', autoResizeTextarea);

  const restartButton = chatWindow.querySelector('#restartChat');
  restartButton.addEventListener('click', restartChat);

  const resizeHandle = chatWindow.querySelector('#resizeHandle');
  resizeHandle.addEventListener('mousedown', startResizing);

  const summarizeButton = chatWindow.querySelector('#summarizeContent');
  summarizeButton.addEventListener('click', summarizePageContent);

  const toggleSidebarButton = chatWindow.querySelector('#toggleSidebar');
  toggleSidebarButton.addEventListener('click', toggleSidebarMode);

  const sidebarResizeHandle = chatWindow.querySelector('#sidebarResizeHandle');
  sidebarResizeHandle.addEventListener('mousedown', startResizingSidebar);

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Apply theme
  applyTheme();

  const hideButton = chatWindow.querySelector('#hideChat');
  hideButton.addEventListener('click', hideChatWindow);

  // Ensure correct visibility state after creation
  updateChatWindowVisibility();

  // Load chat history
  loadChatHistory();
}

function applyTheme() {
  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  chatWindow.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
}

function handleMouseMove(e) {
  if (isDragging) {
    const dx = e.clientX - initialPos.x;
    const dy = e.clientY - initialPos.y;
    const newLeft = chatWindow.offsetLeft + dx;
    const newTop = chatWindow.offsetTop + dy;
    chatWindow.style.left = `${newLeft}px`;
    chatWindow.style.top = `${newTop}px`;
    initialPos = { x: e.clientX, y: e.clientY };
  } else if (isResizing) {
    const dx = e.clientX - initialPos.x;
    const dy = e.clientY - initialPos.y;
    const newWidth = Math.max(300, initialSize.width + dx);
    const newHeight = Math.max(400, initialSize.height + dy);
    requestAnimationFrame(() => {
      chatWindow.style.width = `${newWidth}px`;
      chatWindow.style.height = `${newHeight}px`;
    });
  } else if (isResizingSidebar) {
    const dx = initialPos.x - e.clientX;
    const newWidth = Math.max(300, initialSidebarWidth + dx);
    requestAnimationFrame(() => {
      chatWindow.style.width = `${newWidth}px`;
      document.body.style.marginRight = `${newWidth}px`;
    });
  }
}

function handleMouseUp() {
  isDragging = false;
  isResizing = false;
  isResizingSidebar = false;
  document.body.style.userSelect = '';
  chatWindow.classList.remove('dragging');
}

function startDragging(e) {
  // Remove the check for e.target === e.currentTarget
  isDragging = true;
  initialPos = { x: e.clientX, y: e.clientY };
  document.body.style.userSelect = 'none';
  chatWindow.classList.add('dragging');
  e.preventDefault();
}

function startResizing(e) {
  if (isSidebar) return;
  isResizing = true;
  const rect = chatWindow.getBoundingClientRect();
  initialPos = { x: e.clientX, y: e.clientY };
  initialSize = { width: rect.width, height: rect.height };
  document.body.style.userSelect = 'none';
  e.preventDefault();
}

function startResizingSidebar(e) {
  if (!isSidebar) return;
  isResizingSidebar = true;
  initialPos = { x: e.clientX, y: e.clientY };
  initialSidebarWidth = chatWindow.offsetWidth;
  document.body.style.userSelect = 'none';
  e.preventDefault();
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResizeTextarea() {
  this.style.height = 'auto';
  this.style.height = `${this.scrollHeight}px`;
}

function sendMessage() {
  const messageInput = chatWindow.querySelector('#messageInput');
  const message = messageInput.value.trim();
  if (message) {
    addMessage('User', message);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Create a placeholder for the assistant's response
    const assistantMessageElement = addMessage('Assistant', '');
    const assistantMessageContent = assistantMessageElement.querySelector('.message-content');
    let accumulatedMarkdown = '';
    
    chrome.runtime.sendMessage({action: 'sendMessage', message: message});

    // Set up a listener for the streaming response
    chrome.runtime.onMessage.addListener(function responseHandler(message) {
      if (message.action === 'streamResponse') {
        if (message.reply) {
          accumulatedMarkdown += message.reply;
          assistantMessageContent.innerHTML = markdownToHtml(accumulatedMarkdown);
          const chatMessages = chatWindow.querySelector('#chatMessages');
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        if (message.done) {
          // Response is complete, add the copy button
          addCopyButton(assistantMessageElement, accumulatedMarkdown);

          // Remove the listener
          chrome.runtime.onMessage.removeListener(responseHandler);
        }
      }
    });
  }
}

function addMessage(sender, text) {
  const chatMessages = chatWindow.querySelector('#chatMessages');
  const messageElement = document.createElement('div');
  messageElement.className = `message ${sender.toLowerCase()}-message`;
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  messageContent.innerHTML = markdownToHtml(text);
  
  messageElement.appendChild(messageContent);
  
  // Add copy button to all messages
  addCopyButton(messageElement, text);
  
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  return messageElement;
}

function addCopyButton(messageElement, textToCopy) {
  const copyButton = createCopyButton();
  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      copyButton.classList.add('copied');
      setTimeout(() => copyButton.classList.remove('copied'), 2000);
    });
  });
  messageElement.appendChild(copyButton);
}

function markdownToHtml(markdown) {
  return markdown
    // Headers
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic text
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, function(match, lang, code) {
      return `<pre><code class="language-${lang || ''}">${code.trim()}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Unordered lists
    .replace(/^\s*[-*+] (.+)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)\s+(?=<li>)/g, '$1</ul><ul>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    // Ordered lists - remove this section or modify it to handle specific cases
    // .replace(/^\s*(\d+)\. (.+)/gm, '<li>$2</li>')
    // .replace(/(<li>.*<\/li>)\s+(?=<li>)/g, '$1</ol><ol>')
    // .replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>')
    // Links
    .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // Line breaks
    .replace(/\n/g, '<br>');
}

function restartChat() {
  console.log('Restarting chat');
  const chatMessages = chatWindow.querySelector('#chatMessages');
  chatMessages.innerHTML = '';
  chrome.runtime.sendMessage({action: 'clearChatHistory'}, response => {
    if (!response.success) {
      console.error('Failed to clear chat history');
      addMessage('System', 'Failed to restart chat. Please try again.');
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleChat') {
    toggleChat();
  }
  // Add this to your existing chrome.runtime.onMessage listener
  if (request.action === 'logFinalResponse') {
    console.log('Final response from model:', request.response);
  }
});

// Listen for changes in color scheme
window.matchMedia('(prefers-color-scheme: dark)').addListener(() => {
  if (chatWindow) {
    applyTheme();
  }
});

// Add this function to create the copy button
function createCopyButton() {
  const button = document.createElement('button');
  button.className = 'copy-button';
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  `;
  button.title = 'Copy to clipboard';
  return button;
}

// Add this function to handle the summarize button click
function summarizePageContent() {
  const assistantMessageElement = addMessage('Assistant', 'Summarizing page content...');
  const assistantMessageContent = assistantMessageElement.querySelector('.message-content');
  let accumulatedMarkdown = '';
  
  chrome.runtime.sendMessage({action: 'summarizeContent'});

  // Set up a listener for the streaming summary response
  chrome.runtime.onMessage.addListener(function summaryHandler(message) {
    if (message.action === 'streamResponse') {
      if (message.reply) {
        // Clear the "Summarizing page content..." message on first chunk
        if (accumulatedMarkdown === '') {
          assistantMessageContent.innerHTML = '';
        }
        
        accumulatedMarkdown += message.reply;
        assistantMessageContent.innerHTML = markdownToHtml(accumulatedMarkdown);
        const chatMessages = chatWindow.querySelector('#chatMessages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }

      if (message.done) {
        // Summary is complete, add the copy button
        addCopyButton(assistantMessageElement, accumulatedMarkdown);

        // Remove the listener
        chrome.runtime.onMessage.removeListener(summaryHandler);
      }
    }
  });
}

// Add this at the end of your content.js file

// Listen for the getPageContent message
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    // Get the page content
    const pageContent = document.body.innerText;
    // Send the content back
    sendResponse(pageContent);
  }
});

// Add this function to toggle between sidebar and popup modes
function toggleSidebarMode() {
  isSidebar = !isSidebar;
  chrome.storage.local.set({ isSidebar: isSidebar }); // Save the new mode
  chatWindow.classList.add('transitioning');
  if (isSidebar) {
    setSidebarMode();
  } else {
    setPopupMode();
  }
  setTimeout(() => {
    chatWindow.classList.remove('transitioning');
  }, 300);
}

// Add this function to set sidebar mode
function setSidebarMode() {
  chatWindow.classList.add('sidebar-mode');
  chatWindow.classList.remove('popup-mode');
  requestAnimationFrame(() => {
    chatWindow.style.width = `${initialSidebarWidth}px`;
    chatWindow.style.height = '100%';
    chatWindow.style.top = '0';
    chatWindow.style.right = '0';
    chatWindow.style.left = 'auto';
    chatWindow.style.bottom = 'auto';
    document.body.style.marginRight = `${initialSidebarWidth}px`;
  });
}

// Add this function to set popup mode
function setPopupMode() {
  chatWindow.classList.remove('sidebar-mode');
  chatWindow.classList.add('popup-mode');
  requestAnimationFrame(() => {
    chatWindow.style.width = '350px';
    chatWindow.style.height = '500px';
    chatWindow.style.top = '60px';
    chatWindow.style.right = '40px';
    chatWindow.style.left = 'auto';
    chatWindow.style.bottom = 'auto';
    document.body.style.marginRight = '0';
  });
}

function hideChatWindow() {
  if (chatWindow) {
    chatWindow.style.display = 'none';
    isChatVisible = false;
    chrome.storage.local.set({ isChatVisible: false }, () => {
      showChatToggle();
    });
  }
}

function showChatToggle() {
  if (!isExtensionActive) return;
  
  let toggleButton = document.getElementById('showChatToggle');
  if (!toggleButton) {
    toggleButton = document.createElement('button');
    toggleButton.id = 'showChatToggle';
    toggleButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
    `;
    toggleButton.addEventListener('click', showChatWindow);
    document.body.appendChild(toggleButton);
    
    // Position the toggle button on the right side of the window
    toggleButton.style.position = 'fixed';
    toggleButton.style.right = '0';
    toggleButton.style.top = '50%';
    toggleButton.style.transform = 'translateY(-50%)';
  }
  toggleButton.style.display = 'block';
}

function showChatWindow() {
  if (!isExtensionActive) return;
  
  if (chatWindow) {
    chatWindow.style.display = 'flex';
    isChatVisible = true;
    chrome.storage.local.set({ isChatVisible: true });
    const toggleButton = document.getElementById('showChatToggle');
    if (toggleButton) {
      toggleButton.style.display = 'none';
    }
  } else {
    createChatWindow();
  }
}

function toggleChat() {
  if (isChatVisible) {
    hideChatWindow();
  } else {
    showChatWindow();
  }
}

function updateChatWindowVisibility() {
  if (isExtensionActive) {
    if (isChatVisible) {
      if (chatWindow) {
        chatWindow.style.display = 'flex';
      } else {
        createChatWindow();
      }
      const toggleButton = document.getElementById('showChatToggle');
      if (toggleButton) {
        toggleButton.style.display = 'none';
      }
      // Set the correct mode after creating or showing the window
      if (isSidebar) {
        setSidebarMode();
      } else {
        setPopupMode();
      }
    } else {
      if (chatWindow) {
        chatWindow.style.display = 'none';
      }
      showChatToggle();
    }
    // Create prediction bar when extension is active
    createPredictionBar();
  } else {
    removeChatWindow();
    // Remove prediction bar when extension is inactive
    if (predictionBar) {
      predictionBar.remove();
      predictionBar = null;
    }
  }
}

function initializeChatWindow() {
  chrome.storage.local.get(['isChatVisible', 'isExtensionActive', 'isSidebar'], (result) => {
    isChatVisible = result.isChatVisible !== false; // Default to true if not set
    isExtensionActive = result.isExtensionActive !== false; // Default to true if not set
    isSidebar = result.isSidebar !== false; // Default to true (sidebar mode) if not set
    
    updateChatWindowVisibility();
  });
}

function removeChatWindow() {
  if (chatWindow) {
    chatWindow.remove();
    chatWindow = null;
  }
  const toggleButton = document.getElementById('showChatToggle');
  if (toggleButton) {
    toggleButton.remove();
  }
  if (floatingBar) {
    floatingBar.remove();
    floatingBar = null;
  }
}

// Modify this message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleExtensionPower') {
    isExtensionActive = request.isEnabled;
    if (isExtensionActive) {
      updateChatWindowVisibility();
    } else {
      removeChatWindow();
    }
  }
  // ... (keep existing message listeners) ...
});

// Call this function when the content script loads
initializeChatWindow();

// Listen for visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateChatWindowVisibility();
  }
});

function loadChatHistory() {
  chrome.runtime.sendMessage({action: 'getChatHistory'}, (history) => {
    if (history && history.length > 0) {
      const chatMessages = chatWindow.querySelector('#chatMessages');
      chatMessages.innerHTML = '';
      history.forEach((message) => {
        addMessage(message.role === 'user' ? 'User' : 'Assistant', message.content);
      });
    }
  });
}

// Use this check before performing operations that might interfere with Gmail
if (isGmail) {
  // Handle Gmail-specific behavior
} else {
  // Regular behavior
}

// Update the createFloatingBar function
function createFloatingBar() {
  console.log('Creating floating bar');
  floatingBar = document.createElement('div');
  floatingBar.id = 'navAssistFloatingBar';
  floatingBar.innerHTML = `
    <button id="transferToChat" title="Transfer to Chat">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
    </button>
    <button id="fixGrammar" title="Fix Grammar">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 7V4h16v3"></path>
        <path d="M9 20h6"></path>
        <path d="M12 4v16"></path>
      </svg>
    </button>
  `;
  document.body.appendChild(floatingBar);

  const transferButton = floatingBar.querySelector('#transferToChat');
  transferButton.addEventListener('click', transferSelectedTextToChat);

  const fixGrammarButton = floatingBar.querySelector('#fixGrammar');
  fixGrammarButton.addEventListener('click', fixGrammar);

  // Add event listeners for tooltips
  addTooltipListeners(transferButton, 'Transfer to Chat');
  addTooltipListeners(fixGrammarButton, 'Fix Grammar');

  console.log('Floating bar created and added to the document');
}

// Add this function to handle tooltips
function addTooltipListeners(element, tooltipText) {
  element.addEventListener('mouseenter', (e) => showTooltip(e, tooltipText));
  element.addEventListener('mouseleave', hideTooltip);
}

// Add these functions to show and hide tooltips
function showTooltip(event, text) {
  const tooltip = document.createElement('div');
  tooltip.id = 'navAssistFloatingBarTooltip';
  tooltip.textContent = text;
  document.body.appendChild(tooltip);

  const rect = event.target.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
  tooltip.style.top = `${rect.bottom + 5}px`;

  setTimeout(() => {
    tooltip.style.opacity = '1';
  }, 10);
}

function hideTooltip() {
  const tooltip = document.getElementById('navAssistFloatingBarTooltip');
  if (tooltip) {
    tooltip.style.opacity = '0';
    setTimeout(() => {
      tooltip.remove();
    }, 200);
  }
}

// Rename the function
function checkFloatingBarVisibility() {
  return floatingBar && floatingBar.style.display !== 'none';
}

// Update the showFloatingBar function
function showFloatingBar(x, y) {
  console.log('showFloatingBar called with coordinates:', x, y);
  if (!floatingBar) {
    console.log('Creating floating bar');
    createFloatingBar();
  }
  
  // Position the floating bar above the selected text
  const barHeight = floatingBar.offsetHeight;
  const offset = 50;
  const viewportHeight = window.innerHeight;
  
  // Calculate the position
  let top = y - barHeight - offset;
  
  // Ensure the bar doesn't go off-screen at the top
  if (top < 0) {
    top = offset;
  }
  
  // Ensure the bar doesn't go off-screen at the bottom
  if (top + barHeight > viewportHeight) {
    top = viewportHeight - barHeight - offset;
  }
  
  console.log('Setting floating bar position:', { left: x, top: top });
  floatingBar.style.left = `${x}px`;
  floatingBar.style.top = `${top}px`;
  floatingBar.style.display = 'flex';
  
  // Add a fade-in effect
  floatingBar.style.opacity = '0';
  setTimeout(() => {
    floatingBar.style.opacity = '1';
  }, 10);

  isFloatingBarVisible = true;
  console.log('Floating bar should now be visible');
}

// Update the hideFloatingBar function
function hideFloatingBar() {
  if (floatingBar && isFloatingBarVisible) {
    console.log('Hiding floating bar');
    floatingBar.style.opacity = '0';
    setTimeout(() => {
      floatingBar.style.display = 'none';
      isFloatingBarVisible = false;
    }, 300); // Match the transition duration in CSS
  }
}

// Update the document.addEventListener('mouseup', ...) function
document.addEventListener('mouseup', (e) => {
  if (!isExtensionActive) return;

  console.log('mouseup event triggered');

  // Clear any existing timeout
  if (showFloatingBarTimeout) {
    clearTimeout(showFloatingBarTimeout);
  }

  // Set a small timeout to allow for the selection to be properly set
  showFloatingBarTimeout = setTimeout(() => {
    const selection = window.getSelection();
    selectedText = selection.toString().trim();

    console.log('Selected text:', selectedText);
    console.log('isFloatingBarVisible:', isFloatingBarVisible);

    if (selectedText && !isFloatingBarVisible) {
      console.log('Showing floating bar');
      lastSelection = selection.getRangeAt(0).cloneRange();
      const rect = lastSelection.getBoundingClientRect();
      showFloatingBar(rect.left + window.scrollX, rect.top + window.scrollY);
    } else if (!selectedText && isFloatingBarVisible) {
      console.log('Hiding floating bar');
      hideFloatingBar();
    } else {
      console.log('No action taken: selectedText:', !!selectedText, 'isFloatingBarVisible:', isFloatingBarVisible);
    }

    // Hide prediction bar when selecting text
    hidePredictionBar();
  }, 100); // Increased delay to 100ms
});

// Update the document.addEventListener('mousedown', ...) function
document.addEventListener('mousedown', (e) => {
  if (isFloatingBarVisible && floatingBar && !floatingBar.contains(e.target) && e.target.id !== 'navAssistFloatingBarTooltip') {
    console.log('Mousedown outside floating bar, hiding it');
    hideFloatingBar();
  }
});

// Add a new event listener for 'selectionchange'
document.addEventListener('selectionchange', () => {
  if (!isExtensionActive) return;

  const selection = window.getSelection();
  if (selection.toString().trim() === '') {
    hideFloatingBar();
  }
});

// Add this function to transfer selected text to chat
function transferSelectedTextToChat() {
  console.log('Transferring selected text to chat:', selectedText);
  if (selectedText && chatWindow) {
    const messageInput = chatWindow.querySelector('#messageInput');
    messageInput.value = selectedText;
    messageInput.focus();
    hideFloatingBar();
  }
}

// Add this new function to handle grammar fixing
function fixGrammar() {
  console.log('Fixing grammar for:', selectedText);
  if (selectedText && lastSelection) {
    const prompt = `Fix this text grammar, don't change tone or way of speaking, just fix errors. No chitchat or conversation, only reply with the fixed text. Keep the line breaks and spaces of the original text:\n\n${selectedText}`;
    
    // Show loading indicator
    showLoadingIndicator();

    chrome.runtime.sendMessage({action: 'fixGrammar', prompt: prompt}, (response) => {
      // Hide loading indicator
      hideLoadingIndicator();

      if (response && response.fixedText) {
        console.log('Received fixed text:', response.fixedText);
        const success = replaceSelectedText(response.fixedText, lastSelection);
        if (success) {
          showNotification('Grammar fixed successfully!', 'success');
        } else {
          showNotification('Failed to replace text. Please try again.', 'error');
        }
      } else {
        console.error('Failed to fix grammar');
        showNotification('Failed to fix grammar. Please try again.', 'error');
      }
    });

    hideFloatingBar();
  } else {
    console.error('No valid selection found');
    showNotification('No valid selection found. Please try again.', 'error');
  }
}

// Modify the replaceSelectedText function
function replaceSelectedText(newText, storedRange) {
  console.log('Attempting to replace text:', newText);
  
  try {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(storedRange);
    
    const range = selection.getRangeAt(0);
    const activeElement = document.activeElement;

    console.log('Active element:', activeElement.tagName, activeElement.id, activeElement.className);

    if (activeElement.isContentEditable || 
        (activeElement.tagName === 'TEXTAREA') || 
        (activeElement.tagName === 'INPUT' && activeElement.type === 'text')) {
      // If the selection is within an editable field
      if (activeElement.isContentEditable) {
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
      } else {
        const start = activeElement.selectionStart;
        const end = activeElement.selectionEnd;
        const text = activeElement.value;
        activeElement.value = text.slice(0, start) + newText + text.slice(end);
        activeElement.setSelectionRange(start + newText.length, start + newText.length);
      }
    } else {
      // If the selection is in a non-editable area
      range.deleteContents();
      range.insertNode(document.createTextNode(newText));
    }
    console.log('Text replaced successfully');
    return true;
  } catch (error) {
    console.error('Error replacing text:', error);
    return false;
  }
}

// Add this function to get the current selection
function getCurrentSelection() {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    console.log('Current selection:', range.toString());
    console.log('Selection parent element:', range.commonAncestorContainer.tagName);
  } else {
    console.log('No current selection');
  }
}

function showLoadingIndicator() {
  console.log('Showing loading indicator');
  // Implement a loading indicator, e.g., a spinner or progress bar
}

function hideLoadingIndicator() {
  console.log('Hiding loading indicator');
  // Hide the loading indicator
}

function showNotification(message, type) {
  console.log(`${type.toUpperCase()}: ${message}`);
  // Implement a notification system, e.g., a toast message
}

// Add this function to create and show the prediction bar
function createPredictionBar() {
  if (predictionBar) return;

  predictionBar = document.createElement('div');
  predictionBar.id = 'navAssistPredictionBar';
  predictionBar.style.cssText = `
    position: absolute;
    display: none;
    background-color: var(--primary-color);
    color: white;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    z-index: 2147483646;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  document.body.appendChild(predictionBar);
}

// Modify the showPredictionBar function
function showPredictionBar(x, y, prediction) {
  if (!predictionBar) {
    createPredictionBar();
  }

  // Add the key hint to the prediction
  const predictionWithHint = `${prediction} <span style="opacity: 0.7; font-size: 0.9em;">(Tab to accept)</span>`;

  predictionBar.innerHTML = predictionWithHint;
  
  const offset = 50;
  const viewportHeight = window.innerHeight;
  let top = y - offset;
  
  if (top < 0) {
    top = offset;
  }
  
  if (top + predictionBar.offsetHeight > viewportHeight) {
    top = viewportHeight - predictionBar.offsetHeight - offset;
  }
  
  predictionBar.style.left = `${x}px`;
  predictionBar.style.top = `${top}px`;
  predictionBar.style.display = 'block';
  
  setTimeout(() => {
    predictionBar.style.opacity = '1';
  }, 10);
}

// Add this function to hide the prediction bar
function hidePredictionBar() {
  if (predictionBar) {
    predictionBar.style.opacity = '0';
    setTimeout(() => {
      predictionBar.style.display = 'none';
    }, 300);
  }
}

// Add this function to get the text before the cursor
function getTextBeforeCursor(element) {
  if (element.isContentEditable) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0).cloneRange();
    range.setStart(element, 0);
    return range.toString();
  } else {
    return element.value.substring(0, element.selectionStart);
  }
}

// Add this function to insert the prediction at the cursor position
function insertPrediction(element) {
  if (currentPrediction) {
    if (element.isContentEditable) {
      document.execCommand('insertText', false, currentPrediction);
    } else {
      const start = element.selectionStart;
      const end = element.selectionEnd;
      element.value = element.value.substring(0, start) + currentPrediction + element.value.substring(end);
      element.selectionStart = element.selectionEnd = start + currentPrediction.length;
    }
    hidePredictionBar();
    currentPrediction = '';
  }
}

// Add this function to trigger the prediction
function triggerPrediction(element) {
  const textBeforeCursor = getTextBeforeCursor(element);
  const prompt = `Given the following text, predict the next few words (max 5 words). Predict what the user is typing next, as if you were the user.
Your job is to complete what the user will type next, not talk with him. You are predicting his next words, not asking him anything.
He might be writing a message, an email, a comment, a review, a code, a document, etc. Only respond with the prediction, no explanation:

${textBeforeCursor}`;

  chrome.runtime.sendMessage({ action: 'getPrediction', prompt: prompt }, (response) => {
    if (response && response.prediction) {
      currentPrediction = response.prediction.trim();
      const rect = element.getBoundingClientRect();
      const cursorPos = getCursorPosition(element);
      showPredictionBar(
        rect.left + cursorPos.x + window.scrollX,
        rect.top + cursorPos.y + window.scrollY,
        currentPrediction
      );
    }
  });
}

// Add this function to get the cursor position
function getCursorPosition(element) {
  if (element.isContentEditable) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const clone = range.cloneRange();
    clone.setStart(element, 0);
    const rect = clone.getBoundingClientRect();
    return { x: rect.right - element.getBoundingClientRect().left, y: rect.top - element.getBoundingClientRect().top };
  } else {
    const rect = element.getBoundingClientRect();
    const text = element.value.substring(0, element.selectionStart);
    const span = document.createElement('span');
    span.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      font: ${getComputedStyle(element).font}`;
    span.textContent = text;
    document.body.appendChild(span);
    const spanRect = span.getBoundingClientRect();
    document.body.removeChild(span);
    return { x: spanRect.width % rect.width, y: Math.floor(spanRect.width / rect.width) * parseFloat(getComputedStyle(element).lineHeight) };
  }
}

// Add these event listeners for editable elements
document.addEventListener('focusin', (e) => {
  if (isEditableElement(e.target)) {
    e.target.addEventListener('input', handleInput);
    e.target.addEventListener('keydown', handleKeyDown);
  }
});

document.addEventListener('focusout', (e) => {
  if (isEditableElement(e.target)) {
    e.target.removeEventListener('input', handleInput);
    e.target.removeEventListener('keydown', handleKeyDown);
    hidePredictionBar();
  }
});

// Add this function to check if an element is editable
function isEditableElement(element) {
  return element.isContentEditable || element.tagName === 'TEXTAREA' || (element.tagName === 'INPUT' && element.type === 'text');
}

// Add this function to handle input events
function handleInput(e) {
  if (!isExtensionActive) return;

  isTyping = true;
  clearTimeout(typingTimer);

  typingTimer = setTimeout(() => {
    isTyping = false;
    triggerPrediction(e.target);
  }, TYPING_INTERVAL);
}

// Add this function to handle keydown events
function handleKeyDown(e) {
  if (!isExtensionActive) return;

  if (e.key === 'Tab' && currentPrediction) {
    e.preventDefault();
    insertPrediction(e.target);
  } else if (e.key === 'Escape') {
    hidePredictionBar();
  } else {
    hidePredictionBar();
  }
}