/**
 * Background Service Worker
 * Handles cookie sync operations (manual and automatic)
 */

import { getFormattedCookiesByDomain } from '../utils/cookies.js';
import { uploadAllDomainsToEnabledServices } from '../utils/storage.js';
import { getConfig, getEnabledServices } from '../utils/config.js';
import { setupCookieChangeListener, isCookieChangeForDomain } from '../utils/cookies.js';
import { setupRequestMonitoring, setSyncTriggerCallback } from '../utils/api-monitor.js';

// Debounce timer for automatic sync
let autoSyncTimer = null;
const AUTO_SYNC_DEBOUNCE_MS = 5000; // 5 seconds

/**
 * Perform cookie sync operation
 * @returns {Promise<Object>} Sync result
 */
async function performSync() {
  try {
    const config = await getConfig();
    const enabledServices = await getEnabledServices();

    if (enabledServices.length === 0) {
      return {
        success: false,
        error: 'No storage services enabled. Please configure at least one service in options.'
      };
    }

    // Get cookies per domain
    const domainCookies = await getFormattedCookiesByDomain();

    if (domainCookies.length === 0) {
      return {
        success: false,
        error: 'No cookies found for configured domains'
      };
    }

    // Calculate total cookie count (handle both old and new format)
    const totalCookieCount = domainCookies.reduce((sum, { cookieData }) => {
      if (Array.isArray(cookieData.cookies)) {
        // Old format: cookies is an array
        return sum + cookieData.cookies.length;
      } else {
        // New format: cookies is an object
        return sum + Object.keys(cookieData.cookies || {}).length;
      }
    }, 0);

    // Upload to enabled services (one file per domain)
    const uploadResults = await uploadAllDomainsToEnabledServices(domainCookies);

    // Check if all uploads succeeded
    const allSuccess = uploadResults.every(r => r.success);
    const someSuccess = uploadResults.some(r => r.success);

    // Save sync status
    const syncStatus = {
      timestamp: Date.now(),
      success: allSuccess,
      cookieCount: totalCookieCount,
      domainCount: domainCookies.length,
      results: uploadResults
    };

    await chrome.storage.local.set({ lastSync: syncStatus });

    return {
      success: allSuccess,
      partialSuccess: someSuccess && !allSuccess,
      cookieCount: totalCookieCount,
      domainCount: domainCookies.length,
      results: uploadResults
    };
  } catch (error) {
    console.error('Sync error:', error);
    const errorStatus = {
      timestamp: Date.now(),
      success: false,
      error: error.message || 'Unknown error'
    };
    await chrome.storage.local.set({ lastSync: errorStatus });

    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Handle manual sync request
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sync') {
    performSync().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'getStatus') {
    chrome.storage.local.get(['lastSync', 'config']).then(result => {
      sendResponse({
        lastSync: result.lastSync || null,
        config: result.config || null
      });
    });
    return true;
  }
});

/**
 * Setup automatic sync listener
 */
async function setupAutoSync() {
  const config = await getConfig();

  if (!config.autoSync) {
    return; // Auto-sync disabled
  }

  const enabledServices = await getEnabledServices();
  if (enabledServices.length === 0) {
    return; // No services enabled
  }

  // Setup cookie change listener
  setupCookieChangeListener(async (changeInfo) => {
    const currentConfig = await getConfig();

    // Extract domain list from config (handle both old and new format)
    const domains = (currentConfig.targetDomains || []).map(d => 
      typeof d === 'string' ? d : d.domain
    ).filter(Boolean);

    // Check if change is for a configured domain
    if (!isCookieChangeForDomain(changeInfo, domains)) {
      return;
    }

    // Check if auto-sync is still enabled
    if (!currentConfig.autoSync) {
      return;
    }

    // Debounce: clear existing timer
    if (autoSyncTimer) {
      clearTimeout(autoSyncTimer);
    }

    // Set new timer
    autoSyncTimer = setTimeout(async () => {
      console.log('Auto-sync triggered by cookie change');
      await performSync();
    }, AUTO_SYNC_DEBOUNCE_MS);
  });
}

/**
 * Initialize service worker
 */
async function initialize() {
  console.log('Cookie Sync extension service worker initialized');

  // Setup API request monitoring
  setupRequestMonitoring();
  
  // Set sync trigger callback for API monitor
  setSyncTriggerCallback(async () => {
    const config = await getConfig();
    if (config.autoSync) {
      await performSync();
    }
  });

  // Setup auto-sync if enabled
  await setupAutoSync();

  // Listen for config changes to update auto-sync and monitoring
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.config) {
      setupAutoSync();
      // Reinitialize API monitoring when config changes
      setupRequestMonitoring();
    }
  });
}

// Initialize on service worker startup
initialize();

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    console.log('Extension updated');
  }
});

