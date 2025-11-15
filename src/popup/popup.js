/**
 * Popup UI Logic
 */

import { getConfig } from '../utils/config.js';

let isSyncing = false;

// DOM Elements
const autoSyncToggle = document.getElementById('autoSyncToggle');
const syncButton = document.getElementById('syncButton');
const syncButtonText = document.getElementById('syncButtonText');
const syncSpinner = document.getElementById('syncSpinner');
const optionsButton = document.getElementById('optionsButton');
const lastSyncTime = document.getElementById('lastSyncTime');
const targetDomains = document.getElementById('targetDomains');
const enabledServices = document.getElementById('enabledServices');
const messageArea = document.getElementById('messageArea');

/**
 * Format timestamp to readable date
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Never';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

/**
 * Show message
 */
function showMessage(message, type = 'info') {
  messageArea.textContent = message;
  messageArea.className = `message-area show ${type}`;
  
  setTimeout(() => {
    messageArea.classList.remove('show');
  }, 5000);
}

/**
 * Update status display
 */
async function updateStatus() {
  try {
    // Get status from background
    const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
    const config = await getConfig();

    // Update auto-sync toggle
    autoSyncToggle.checked = config.autoSync || false;

    // Update last sync time
    if (response.lastSync) {
      lastSyncTime.textContent = formatTimestamp(response.lastSync.timestamp);
      if (response.lastSync.success) {
        lastSyncTime.style.color = '#28a745';
      } else {
        lastSyncTime.style.color = '#dc3545';
      }
    } else {
      lastSyncTime.textContent = 'Never';
      lastSyncTime.style.color = '#666';
    }

    // Update target domains
    const domains = config.targetDomains || ['binance.com'];
    targetDomains.textContent = domains.join(', ');

    // Update enabled services
    const services = [];
    if (config.services.firebase?.enabled) services.push('Firebase');
    if (config.services.supabase?.enabled) services.push('Supabase');
    if (config.services.aws?.enabled) services.push('AWS S3');

    if (services.length > 0) {
      enabledServices.innerHTML = services.map(s => 
        `<span class="service-badge">${s}</span>`
      ).join('');
    } else {
      enabledServices.textContent = 'None (configure in Options)';
      enabledServices.style.color = '#dc3545';
    }
  } catch (error) {
    console.error('Error updating status:', error);
  }
}

/**
 * Perform sync
 */
async function performSync() {
  if (isSyncing) return;

  isSyncing = true;
  syncButton.disabled = true;
  syncButtonText.textContent = 'Syncing...';
  syncSpinner.classList.remove('hidden');
  messageArea.classList.remove('show');

  try {
    const response = await chrome.runtime.sendMessage({ action: 'sync' });

    if (response.success) {
      showMessage(
        `Successfully synced ${response.cookieCount || 0} cookies`,
        'success'
      );
    } else if (response.partialSuccess) {
      const successCount = response.results.filter(r => r.success).length;
      const totalCount = response.results.length;
      showMessage(
        `Partially synced: ${successCount}/${totalCount} services succeeded`,
        'info'
      );
    } else {
      showMessage(
        response.error || 'Sync failed',
        'error'
      );
    }

    // Update status after sync
    setTimeout(updateStatus, 500);
  } catch (error) {
    console.error('Sync error:', error);
    showMessage('Sync failed: ' + error.message, 'error');
  } finally {
    isSyncing = false;
    syncButton.disabled = false;
    syncButtonText.textContent = 'Sync Now';
    syncSpinner.classList.add('hidden');
  }
}

/**
 * Toggle auto-sync
 */
async function toggleAutoSync(enabled) {
  try {
    const config = await getConfig();
    config.autoSync = enabled;
    await chrome.storage.local.set({ config });
    showMessage(
      `Auto-sync ${enabled ? 'enabled' : 'disabled'}`,
      'info'
    );
  } catch (error) {
    console.error('Error toggling auto-sync:', error);
    showMessage('Failed to update auto-sync setting', 'error');
    // Revert toggle
    autoSyncToggle.checked = !enabled;
  }
}

// Event Listeners
syncButton.addEventListener('click', performSync);

autoSyncToggle.addEventListener('change', (e) => {
  toggleAutoSync(e.target.checked);
});

optionsButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Initialize
updateStatus();

// Update status every 30 seconds
setInterval(updateStatus, 30000);

