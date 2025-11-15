/**
 * Options Page Logic
 */

import { getConfig, saveConfig, parseDomains, validateDomain } from '../utils/config.js';
import { testFirebaseConnection, testSupabaseConnection, testAWSConnection } from '../utils/storage.js';

// DOM Elements
const form = document.getElementById('optionsForm');
const targetDomainsInput = document.getElementById('targetDomains');
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
 * Load configuration into form
 */
async function loadConfig() {
  try {
    const config = await getConfig();

    // Load target domains
    targetDomainsInput.value = (config.targetDomains || ['binance.com']).join(', ');

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
 * Validate domains
 */
function validateDomains() {
  const input = targetDomainsInput.value.trim();
  if (!input) {
    domainError.textContent = 'At least one domain is required';
    domainError.classList.add('show');
    return false;
  }

  const domains = parseDomains(input);
  if (domains.length === 0) {
    domainError.textContent = 'No valid domains found. Please enter valid domain names (e.g., binance.com)';
    domainError.classList.add('show');
    return false;
  }

  domainError.classList.remove('show');
  return true;
}

/**
 * Save configuration
 */
async function saveConfiguration() {
  if (!validateDomains()) {
    return;
  }

  const domains = parseDomains(targetDomainsInput.value);

  const config = {
    targetDomains: domains,
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

  targetDomainsInput.value = 'binance.com';
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

// Domain validation
targetDomainsInput.addEventListener('input', () => {
  if (domainError.classList.contains('show')) {
    validateDomains();
  }
});

// Initialize
loadConfig();

