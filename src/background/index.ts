console.log('Background service worker started');

// Open side panel on action click
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Shortcut listener is handled by _execute_action in manifest,
// which now triggers the side panel automatically if openPanelOnActionClick is true.
// But if we want custom behavior or if we used a command name "toggle_side_panel", we would listen here.
// Since we bound it to _execute_action, no extra code needed for basic toggle.
