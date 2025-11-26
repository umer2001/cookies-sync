/**
 * Configuration management utility
 * Handles reading and writing extension configuration
 */

const DEFAULT_CONFIG = {
  targetDomains: [
    {
      domain: 'binance.com',
      apiPaths: [] // Empty means monitor all cookies (backward compatible)
    }
  ],
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
/**
 * Migrate old config format to new format
 * @param {Object} oldConfig - Old configuration object
 * @returns {Object} Migrated configuration
 */
function migrateConfig(oldConfig) {
  // Check if targetDomains is old format (array of strings)
  if (oldConfig.targetDomains && Array.isArray(oldConfig.targetDomains) && oldConfig.targetDomains.length > 0) {
    const firstItem = oldConfig.targetDomains[0];
    // If first item is a string, it's old format
    if (typeof firstItem === 'string') {
      return {
        ...oldConfig,
        targetDomains: oldConfig.targetDomains.map(domain => ({
          domain: domain,
          apiPaths: []
        }))
      };
    }
  }
  return oldConfig;
}

export async function getConfig() {
  try {
    const result = await chrome.storage.local.get(['config']);
    if (result.config) {
      // Migrate old format to new format if needed
      const migratedConfig = migrateConfig(result.config);
      
      // Merge with defaults to ensure all fields exist
      const config = {
        ...DEFAULT_CONFIG,
        ...migratedConfig,
        services: {
          firebase: { ...DEFAULT_CONFIG.services.firebase, ...(migratedConfig.services?.firebase || {}) },
          supabase: { ...DEFAULT_CONFIG.services.supabase, ...(migratedConfig.services?.supabase || {}) },
          aws: { ...DEFAULT_CONFIG.services.aws, ...(migratedConfig.services?.aws || {}) }
        }
      };
      
      // Ensure targetDomains is in new format
      if (config.targetDomains && Array.isArray(config.targetDomains)) {
        config.targetDomains = config.targetDomains.map(item => {
          if (typeof item === 'string') {
            return { domain: item, apiPaths: [] };
          }
          return {
            domain: item.domain || '',
            apiPaths: Array.isArray(item.apiPaths) ? item.apiPaths : []
          };
        }).filter(item => item.domain);
      } else {
        config.targetDomains = DEFAULT_CONFIG.targetDomains;
      }
      
      return config;
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
 * @param {Array} targetDomains - Array of domain config objects or strings (for backward compat)
 * @returns {Promise<void>}
 */
async function updateHostPermissions(targetDomains) {
  try {
    const permissions = {
      origins: []
    };
    
    // Handle both old format (strings) and new format (objects)
    const domains = targetDomains.map(item => {
      if (typeof item === 'string') {
        return item;
      }
      return item.domain;
    }).filter(Boolean);
    
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

/**
 * Validate API path format
 * @param {string} path - API path to validate
 * @returns {boolean} True if valid
 */
export function validateApiPath(path) {
  if (!path || typeof path !== 'string') return false;
  
  const trimmed = path.trim();
  
  // Must start with /
  if (!trimmed.startsWith('/')) return false;
  
  // Can contain wildcards (*)
  // Basic validation: allow alphanumeric, /, *, -, _, .
  const pathRegex = /^\/[a-zA-Z0-9\/\*\-_\.]*$/;
  return pathRegex.test(trimmed);
}

/**
 * Convert wildcard path to regex pattern
 * @param {string} path - API path with optional wildcards
 * @returns {RegExp} Regex pattern for matching
 */
export function pathToRegex(path) {
  // Escape special regex characters except *
  let pattern = path
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
    .replace(/\*/g, '.*'); // Convert * to .*
  
  return new RegExp(`^${pattern}$`);
}

/**
 * Check if URL path matches any of the configured API paths
 * @param {string} urlPath - URL path to check
 * @param {string[]} apiPaths - Array of API paths (may contain wildcards)
 * @returns {boolean} True if matches
 */
export function matchesApiPath(urlPath, apiPaths) {
  if (!apiPaths || apiPaths.length === 0) return false;
  
  return apiPaths.some(path => {
    const regex = pathToRegex(path);
    return regex.test(urlPath);
  });
}


