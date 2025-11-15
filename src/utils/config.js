/**
 * Configuration management utility
 * Handles reading and writing extension configuration
 */

const DEFAULT_CONFIG = {
  targetDomains: ['binance.com'],
  autoSync: false,
  services: {
    firebase: {
      enabled: false,
      projectId: '',
      bucket: '',
      serviceAccountKey: ''
    },
    supabase: {
      enabled: false,
      url: '',
      apiKey: '',
      bucket: ''
    },
    aws: {
      enabled: false,
      accessKeyId: '',
      secretAccessKey: '',
      bucket: '',
      region: 'us-east-1'
    }
  }
};

/**
 * Get current configuration
 * @returns {Promise<Object>} Configuration object
 */
export async function getConfig() {
  try {
    const result = await chrome.storage.local.get(['config']);
    if (result.config) {
      // Merge with defaults to ensure all fields exist
      return {
        ...DEFAULT_CONFIG,
        ...result.config,
        services: {
          firebase: { ...DEFAULT_CONFIG.services.firebase, ...(result.config.services?.firebase || {}) },
          supabase: { ...DEFAULT_CONFIG.services.supabase, ...(result.config.services?.supabase || {}) },
          aws: { ...DEFAULT_CONFIG.services.aws, ...(result.config.services?.aws || {}) }
        }
      };
    }
    return DEFAULT_CONFIG;
  } catch (error) {
    console.error('Error getting config:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Save configuration
 * @param {Object} config - Configuration object to save
 * @returns {Promise<void>}
 */
export async function saveConfig(config) {
  try {
    await chrome.storage.local.set({ config });
    
    // Update host permissions if domains changed
    const domains = config.targetDomains || DEFAULT_CONFIG.targetDomains;
    await updateHostPermissions(domains);
  } catch (error) {
    console.error('Error saving config:', error);
    throw error;
  }
}

/**
 * Update host permissions based on configured domains
 * @param {string[]} domains - Array of domain names
 * @returns {Promise<void>}
 */
async function updateHostPermissions(domains) {
  try {
    const permissions = {
      origins: []
    };
    
    domains.forEach(domain => {
      const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      permissions.origins.push(`https://${cleanDomain}/*`);
      permissions.origins.push(`https://*.${cleanDomain}/*`);
    });
    
    // Request new permissions
    if (permissions.origins.length > 0) {
      await chrome.permissions.request(permissions);
    }
  } catch (error) {
    console.error('Error updating host permissions:', error);
    // Non-critical error, continue
  }
}

/**
 * Get enabled services
 * @returns {Promise<Array<string>>} Array of enabled service names
 */
export async function getEnabledServices() {
  const config = await getConfig();
  const enabled = [];
  
  if (config.services.firebase?.enabled) enabled.push('firebase');
  if (config.services.supabase?.enabled) enabled.push('supabase');
  if (config.services.aws?.enabled) enabled.push('aws');
  
  return enabled;
}

/**
 * Validate domain format
 * @param {string} domain - Domain to validate
 * @returns {boolean} True if valid
 */
export function validateDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  
  const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  // Basic domain validation
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  return domainRegex.test(cleanDomain);
}

/**
 * Parse domains from input (supports comma-separated or newline-separated)
 * @param {string} input - Domain input string
 * @returns {string[]} Array of valid domains
 */
export function parseDomains(input) {
  if (!input || typeof input !== 'string') return [];
  
  const domains = input
    .split(/[,\n]/)
    .map(d => d.trim())
    .filter(d => d.length > 0)
    .map(d => d.replace(/^https?:\/\//, '').replace(/\/$/, ''))
    .filter(validateDomain);
  
  return [...new Set(domains)]; // Remove duplicates
}

