/**
 * Options Page Logic
 */

import { getConfig, saveConfig, validateDomain, validateApiPath } from '../utils/config.js';
import { testFirebaseConnection, testSupabaseConnection, testAWSConnection } from '../utils/storage.js';

// DOM Elements
const form = document.getElementById('optionsForm');
const domainsContainer = document.getElementById('domainsContainer');
const addDomainButton = document.getElementById('addDomainButton');
const domainError = document.getElementById('domainError');

// Firebase
const firebaseEnabled = document.getElementById('firebaseEnabled');
const firebaseConfig = document.getElementById('firebaseConfig');
const firebaseProjectId = document.getElementById('firebaseProjectId');
const firebaseBucket = document.getElementById('firebaseBucket');
const firebaseServiceAccountKey = document.getElementById('firebaseServiceAccountKey');
const testFirebaseBtn = document.getElementById('testFirebase');
const clearFirebaseBtn = document.getElementById('clearFirebase');

// Supabase
const supabaseEnabled = document.getElementById('supabaseEnabled');
const supabaseConfig = document.getElementById('supabaseConfig');
const supabaseUrl = document.getElementById('supabaseUrl');
const supabaseApiKey = document.getElementById('supabaseApiKey');
const supabaseBucket = document.getElementById('supabaseBucket');
const testSupabaseBtn = document.getElementById('testSupabase');
const clearSupabaseBtn = document.getElementById('clearSupabase');

// AWS
const awsEnabled = document.getElementById('awsEnabled');
const awsConfig = document.getElementById('awsConfig');
const awsAccessKeyId = document.getElementById('awsAccessKeyId');
const awsSecretAccessKey = document.getElementById('awsSecretAccessKey');
const awsBucket = document.getElementById('awsBucket');
const awsRegion = document.getElementById('awsRegion');
const testAWSBtn = document.getElementById('testAWS');
const clearAWSBtn = document.getElementById('clearAWS');

// Actions
const saveButton = document.getElementById('saveButton');
const resetButton = document.getElementById('resetButton');
const messageArea = document.getElementById('messageArea');

// Domain configuration counter
let domainCounter = 0;

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
 * Toggle service config visibility
 */
function toggleServiceConfig(serviceEnabled, serviceConfig) {
  if (serviceEnabled.checked) {
    serviceConfig.classList.remove('hidden');
  } else {
    serviceConfig.classList.add('hidden');
  }
}

/**
 * Create domain configuration UI
 * @param {Object} domainConfig - Domain configuration object
 * @param {number} index - Index for unique IDs
 * @returns {HTMLElement} Domain config element
 */
function createDomainConfig(domainConfig = { domain: '', apiPaths: [] }, index = null) {
  const id = index !== null ? index : domainCounter++;
  const domain = domainConfig.domain || '';
  const apiPaths = domainConfig.apiPaths || [];
  
  const domainDiv = document.createElement('div');
  domainDiv.className = 'domain-config';
  domainDiv.dataset.domainId = id;
  
  domainDiv.innerHTML = `
    <div class="domain-config-header">
      <h3>Domain Configuration</h3>
      <button type="button" class="remove-domain-btn" data-domain-id="${id}">Remove</button>
    </div>
    
    <div class="domain-input-group">
      <input 
        type="text" 
        class="domain-input" 
        data-domain-id="${id}"
        placeholder="binance.com"
        value="${domain}"
        required
      >
    </div>
    
    <div class="api-paths-section">
      <label style="font-weight: 500; display: block; margin-bottom: 8px;">
        API Paths (Optional)
        <span class="help-text" style="font-weight: normal;">Leave empty to sync all cookies. Use * for wildcards (e.g., /api/v3/*)</span>
      </label>
      
      <div class="api-paths-list" data-domain-id="${id}">
        ${apiPaths.map((path, pathIndex) => `
          <div class="api-path-item" data-path-index="${pathIndex}">
            <input 
              type="text" 
              class="api-path-input" 
              data-domain-id="${id}"
              data-path-index="${pathIndex}"
              placeholder="/api/v3/account"
              value="${path}"
            >
            <button type="button" class="remove-path-btn" data-domain-id="${id}" data-path-index="${pathIndex}">Remove</button>
          </div>
        `).join('')}
      </div>
      
      <div class="add-path-group">
        <input 
          type="text" 
          class="new-api-path-input" 
          data-domain-id="${id}"
          placeholder="/api/v3/account or /api/v3/*"
        >
        <button type="button" class="add-path-btn" data-domain-id="${id}">Add Path</button>
      </div>
      <div class="wildcard-hint">Tip: Use * for wildcards (e.g., /api/v3/* matches all paths under /api/v3/)</div>
    </div>
  `;
  
  // Add event listeners
  const removeDomainBtn = domainDiv.querySelector('.remove-domain-btn');
  removeDomainBtn.addEventListener('click', () => removeDomain(id));
  
  const addPathBtn = domainDiv.querySelector('.add-path-btn');
  addPathBtn.addEventListener('click', () => addApiPath(id));
  
  const newPathInput = domainDiv.querySelector('.new-api-path-input');
  newPathInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addApiPath(id);
    }
  });
  
  // Add remove listeners for existing paths
  domainDiv.querySelectorAll('.remove-path-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pathIndex = parseInt(e.target.dataset.pathIndex);
      removeApiPath(id, pathIndex);
    });
  });
  
  return domainDiv;
}

/**
 * Add a new domain configuration
 */
function addDomain() {
  const domainDiv = createDomainConfig();
  domainsContainer.appendChild(domainDiv);
}

/**
 * Remove a domain configuration
 */
function removeDomain(domainId) {
  const domainDiv = domainsContainer.querySelector(`[data-domain-id="${domainId}"]`);
  if (domainDiv) {
    domainDiv.remove();
  }
  
  // Ensure at least one domain exists
  if (domainsContainer.children.length === 0) {
    addDomain();
  }
}

/**
 * Add an API path to a domain
 */
function addApiPath(domainId) {
  const domainDiv = domainsContainer.querySelector(`[data-domain-id="${domainId}"]`);
  if (!domainDiv) return;
  
  const newPathInput = domainDiv.querySelector('.new-api-path-input');
  const path = newPathInput.value.trim();
  
  if (!path) {
    showMessage('Please enter an API path', 'error');
    return;
  }
  
  if (!validateApiPath(path)) {
    showMessage('Invalid API path. Must start with / and can contain wildcards (*)', 'error');
    return;
  }
  
  const pathsList = domainDiv.querySelector('.api-paths-list');
  const pathIndex = pathsList.children.length;
  
  const pathItem = document.createElement('div');
  pathItem.className = 'api-path-item';
  pathItem.dataset.pathIndex = pathIndex;
  pathItem.innerHTML = `
    <input 
      type="text" 
      class="api-path-input" 
      data-domain-id="${domainId}"
      data-path-index="${pathIndex}"
      placeholder="/api/v3/account"
      value="${path}"
    >
    <button type="button" class="remove-path-btn" data-domain-id="${domainId}" data-path-index="${pathIndex}">Remove</button>
  `;
  
  const removeBtn = pathItem.querySelector('.remove-path-btn');
  removeBtn.addEventListener('click', () => removeApiPath(domainId, pathIndex));
  
  pathsList.appendChild(pathItem);
  newPathInput.value = '';
}

/**
 * Remove an API path from a domain
 */
function removeApiPath(domainId, pathIndex) {
  const domainDiv = domainsContainer.querySelector(`[data-domain-id="${domainId}"]`);
  if (!domainDiv) return;
  
  const pathItem = domainDiv.querySelector(`[data-path-index="${pathIndex}"]`);
  if (pathItem) {
    pathItem.remove();
    
    // Reindex remaining paths
    const pathsList = domainDiv.querySelector('.api-paths-list');
    Array.from(pathsList.children).forEach((item, index) => {
      item.dataset.pathIndex = index;
      const input = item.querySelector('.api-path-input');
      const btn = item.querySelector('.remove-path-btn');
      if (input) {
        input.dataset.pathIndex = index;
      }
      if (btn) {
        btn.dataset.pathIndex = index;
        btn.onclick = () => removeApiPath(domainId, index);
      }
    });
  }
}

/**
 * Validate domains configuration
 */
function validateDomains() {
  const domainConfigs = Array.from(domainsContainer.children);
  
  if (domainConfigs.length === 0) {
    domainError.textContent = 'At least one domain is required';
    domainError.classList.add('show');
    return false;
  }
  
  const errors = [];
  
  domainConfigs.forEach((domainDiv, index) => {
    const domainInput = domainDiv.querySelector('.domain-input');
    const domain = domainInput.value.trim();
    
    if (!domain) {
      errors.push(`Domain ${index + 1} is required`);
      return;
    }
    
    if (!validateDomain(domain)) {
      errors.push(`Domain ${index + 1} (${domain}) is invalid`);
      return;
    }
    
    // Validate API paths
    const pathInputs = domainDiv.querySelectorAll('.api-path-input');
    pathInputs.forEach((pathInput, pathIndex) => {
      const path = pathInput.value.trim();
      if (path && !validateApiPath(path)) {
        errors.push(`Domain ${index + 1}, API path ${pathIndex + 1} (${path}) is invalid`);
      }
    });
  });
  
  if (errors.length > 0) {
    domainError.textContent = errors.join('. ');
    domainError.classList.add('show');
    return false;
  }
  
  domainError.classList.remove('show');
  return true;
}

/**
 * Get domain configurations from form
 */
function getDomainConfigs() {
  const domainConfigs = [];
  const domainDivs = Array.from(domainsContainer.children);
  
  domainDivs.forEach(domainDiv => {
    const domainInput = domainDiv.querySelector('.domain-input');
    const domain = domainInput.value.trim();
    
    if (!domain) return;
    
    const apiPaths = [];
    const pathInputs = domainDiv.querySelectorAll('.api-path-input');
    pathInputs.forEach(pathInput => {
      const path = pathInput.value.trim();
      if (path) {
        apiPaths.push(path);
      }
    });
    
    domainConfigs.push({
      domain,
      apiPaths
    });
  });
  
  return domainConfigs;
}

/**
 * Load configuration into form
 */
async function loadConfig() {
  try {
    const config = await getConfig();

    // Clear existing domains
    domainsContainer.innerHTML = '';
    
    // Load domain configurations
    const targetDomains = config.targetDomains || [{ domain: 'binance.com', apiPaths: [] }];
    
    // Handle migration from old format
    const domainConfigs = targetDomains.map(item => {
      if (typeof item === 'string') {
        return { domain: item, apiPaths: [] };
      }
      return {
        domain: item.domain || '',
        apiPaths: Array.isArray(item.apiPaths) ? item.apiPaths : []
      };
    });
    
    domainConfigs.forEach((domainConfig, index) => {
      const domainDiv = createDomainConfig(domainConfig, index);
      domainsContainer.appendChild(domainDiv);
    });
    
    // Ensure at least one domain
    if (domainsContainer.children.length === 0) {
      addDomain();
    }

    // Load Firebase
    firebaseEnabled.checked = config.services.firebase?.enabled || false;
    firebaseProjectId.value = config.services.firebase?.projectId || '';
    firebaseBucket.value = config.services.firebase?.bucket || '';
    firebaseServiceAccountKey.value = config.services.firebase?.serviceAccountKey || '';
    toggleServiceConfig(firebaseEnabled, firebaseConfig);

    // Load Supabase
    supabaseEnabled.checked = config.services.supabase?.enabled || false;
    supabaseUrl.value = config.services.supabase?.url || '';
    supabaseApiKey.value = config.services.supabase?.apiKey || '';
    supabaseBucket.value = config.services.supabase?.bucket || '';
    toggleServiceConfig(supabaseEnabled, supabaseConfig);

    // Load AWS
    awsEnabled.checked = config.services.aws?.enabled || false;
    awsAccessKeyId.value = config.services.aws?.accessKeyId || '';
    awsSecretAccessKey.value = config.services.aws?.secretAccessKey || '';
    awsBucket.value = config.services.aws?.bucket || '';
    awsRegion.value = config.services.aws?.region || 'us-east-1';
    toggleServiceConfig(awsEnabled, awsConfig);
  } catch (error) {
    console.error('Error loading config:', error);
    showMessage('Error loading configuration', 'error');
  }
}

/**
 * Save configuration
 */
async function saveConfiguration() {
  if (!validateDomains()) {
    return;
  }

  const domainConfigs = getDomainConfigs();
  
  if (domainConfigs.length === 0) {
    showMessage('At least one domain is required', 'error');
    return;
  }

  const config = {
    targetDomains: domainConfigs,
    autoSync: false, // Will be set from popup
    services: {
      firebase: {
        enabled: firebaseEnabled.checked,
        projectId: firebaseProjectId.value.trim(),
        bucket: firebaseBucket.value.trim(),
        serviceAccountKey: firebaseServiceAccountKey.value.trim()
      },
      supabase: {
        enabled: supabaseEnabled.checked,
        url: supabaseUrl.value.trim(),
        apiKey: supabaseApiKey.value.trim(),
        bucket: supabaseBucket.value.trim()
      },
      aws: {
        enabled: awsEnabled.checked,
        accessKeyId: awsAccessKeyId.value.trim(),
        secretAccessKey: awsSecretAccessKey.value.trim(),
        bucket: awsBucket.value.trim(),
        region: awsRegion.value.trim() || 'us-east-1'
      }
    }
  };

  try {
    await saveConfig(config);
    showMessage('Configuration saved successfully!', 'success');
  } catch (error) {
    console.error('Error saving config:', error);
    showMessage('Error saving configuration: ' + error.message, 'error');
  }
}

/**
 * Reset to defaults
 */
async function resetToDefaults() {
  if (!confirm('Are you sure you want to reset all settings to defaults? This will clear all your configurations.')) {
    return;
  }

  // Clear domains
  domainsContainer.innerHTML = '';
  addDomain();
  domainError.classList.remove('show');

  // Reset Firebase
  firebaseEnabled.checked = false;
  firebaseProjectId.value = '';
  firebaseBucket.value = '';
  firebaseServiceAccountKey.value = '';
  toggleServiceConfig(firebaseEnabled, firebaseConfig);

  // Reset Supabase
  supabaseEnabled.checked = false;
  supabaseUrl.value = '';
  supabaseApiKey.value = '';
  supabaseBucket.value = '';
  toggleServiceConfig(supabaseEnabled, supabaseConfig);

  // Reset AWS
  awsEnabled.checked = false;
  awsAccessKeyId.value = '';
  awsSecretAccessKey.value = '';
  awsBucket.value = '';
  awsRegion.value = 'us-east-1';
  toggleServiceConfig(awsEnabled, awsConfig);

  // Clear stored config
  await chrome.storage.local.remove('config');
  showMessage('Configuration reset to defaults', 'info');
}

/**
 * Test Firebase connection
 */
async function testFirebase() {
  if (!firebaseEnabled.checked) {
    showMessage('Please enable Firebase first', 'info');
    return;
  }

  testFirebaseBtn.disabled = true;
  testFirebaseBtn.textContent = 'Testing...';

  try {
    const config = {
      projectId: firebaseProjectId.value.trim(),
      bucket: firebaseBucket.value.trim(),
      serviceAccountKey: firebaseServiceAccountKey.value.trim()
    };

    const result = await testFirebaseConnection(config);
    
    if (result.success) {
      showMessage('Firebase connection successful!', 'success');
    } else {
      showMessage('Firebase connection failed: ' + result.error, 'error');
    }
  } catch (error) {
    showMessage('Error testing Firebase: ' + error.message, 'error');
  } finally {
    testFirebaseBtn.disabled = false;
    testFirebaseBtn.textContent = 'Test Connection';
  }
}

/**
 * Test Supabase connection
 */
async function testSupabase() {
  if (!supabaseEnabled.checked) {
    showMessage('Please enable Supabase first', 'info');
    return;
  }

  testSupabaseBtn.disabled = true;
  testSupabaseBtn.textContent = 'Testing...';

  try {
    const config = {
      url: supabaseUrl.value.trim(),
      apiKey: supabaseApiKey.value.trim(),
      bucket: supabaseBucket.value.trim()
    };

    const result = await testSupabaseConnection(config);
    
    if (result.success) {
      showMessage('Supabase connection successful!', 'success');
    } else {
      showMessage('Supabase connection failed: ' + result.error, 'error');
    }
  } catch (error) {
    showMessage('Error testing Supabase: ' + error.message, 'error');
  } finally {
    testSupabaseBtn.disabled = false;
    testSupabaseBtn.textContent = 'Test Connection';
  }
}

/**
 * Test AWS connection
 */
async function testAWS() {
  if (!awsEnabled.checked) {
    showMessage('Please enable AWS first', 'info');
    return;
  }

  testAWSBtn.disabled = true;
  testAWSBtn.textContent = 'Testing...';

  try {
    const config = {
      accessKeyId: awsAccessKeyId.value.trim(),
      secretAccessKey: awsSecretAccessKey.value.trim(),
      bucket: awsBucket.value.trim(),
      region: awsRegion.value.trim() || 'us-east-1'
    };

    const result = await testAWSConnection(config);
    
    if (result.success) {
      showMessage('AWS connection successful!', 'success');
    } else {
      showMessage('AWS connection failed: ' + result.error, 'error');
    }
  } catch (error) {
    showMessage('Error testing AWS: ' + error.message, 'error');
  } finally {
    testAWSBtn.disabled = false;
    testAWSBtn.textContent = 'Test Connection';
  }
}

/**
 * Clear Firebase config
 */
function clearFirebase() {
  firebaseProjectId.value = '';
  firebaseBucket.value = '';
  firebaseServiceAccountKey.value = '';
  showMessage('Firebase configuration cleared', 'info');
}

/**
 * Clear Supabase config
 */
function clearSupabase() {
  supabaseUrl.value = '';
  supabaseApiKey.value = '';
  supabaseBucket.value = '';
  showMessage('Supabase configuration cleared', 'info');
}

/**
 * Clear AWS config
 */
function clearAWS() {
  awsAccessKeyId.value = '';
  awsSecretAccessKey.value = '';
  awsBucket.value = '';
  awsRegion.value = 'us-east-1';
  showMessage('AWS configuration cleared', 'info');
}

// Event Listeners
form.addEventListener('submit', (e) => {
  e.preventDefault();
  saveConfiguration();
});

resetButton.addEventListener('click', resetToDefaults);
addDomainButton.addEventListener('click', addDomain);

// Service toggles
firebaseEnabled.addEventListener('change', () => {
  toggleServiceConfig(firebaseEnabled, firebaseConfig);
});
supabaseEnabled.addEventListener('change', () => {
  toggleServiceConfig(supabaseEnabled, supabaseConfig);
});
awsEnabled.addEventListener('change', () => {
  toggleServiceConfig(awsEnabled, awsConfig);
});

// Test buttons
testFirebaseBtn.addEventListener('click', testFirebase);
testSupabaseBtn.addEventListener('click', testSupabase);
testAWSBtn.addEventListener('click', testAWS);

// Clear buttons
clearFirebaseBtn.addEventListener('click', clearFirebase);
clearSupabaseBtn.addEventListener('click', clearSupabase);
clearAWSBtn.addEventListener('click', clearAWS);

// Domain validation on input
domainsContainer.addEventListener('input', (e) => {
  if (e.target.classList.contains('domain-input') || e.target.classList.contains('api-path-input')) {
    if (domainError.classList.contains('show')) {
      validateDomains();
    }
  }
});

// Initialize
loadConfig();
