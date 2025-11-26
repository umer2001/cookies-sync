/**
 * API Request Monitoring Module
 * Monitors API requests for configured domains and paths
 * Captures request headers and cookies, detects changes, and triggers sync
 */

import { getConfig } from './config.js';
import { matchesApiPath } from './config.js';

// Storage key for API request state
const STATE_STORAGE_KEY = 'apiRequestState';

// Debounce timer for sync triggers
let syncDebounceTimer = null;
const SYNC_DEBOUNCE_MS = 2000; // 2 seconds

// Sync trigger callback (set by service worker)
let syncTriggerCallback = null;

/**
 * Set the sync trigger callback
 * @param {Function} callback - Function to call when sync should be triggered
 */
export function setSyncTriggerCallback(callback) {
    syncTriggerCallback = callback;
}

/**
 * Extract domain from URL
 * @param {string} url - Full URL
 * @returns {string|null} Domain name or null
 */
function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        return null;
    }
}

/**
 * Check if a domain matches a configured domain (handles subdomains)
 * @param {string} requestDomain - Domain from request (e.g., www.binance.com)
 * @param {string} configDomain - Configured domain (e.g., binance.com)
 * @returns {boolean} True if matches
 */
function matchesDomain(requestDomain, configDomain) {
    if (!requestDomain || !configDomain) return false;

    // Exact match
    if (requestDomain === configDomain) return true;

    // Subdomain match: www.binance.com should match binance.com
    // Remove leading dot if present
    const cleanConfigDomain = configDomain.replace(/^\./, '');

    // Check if request domain ends with .configDomain
    if (requestDomain.endsWith('.' + cleanConfigDomain)) return true;

    // Also check reverse: binance.com should match www.binance.com (if configured as www.binance.com)
    const cleanRequestDomain = requestDomain.replace(/^\./, '');
    if (cleanConfigDomain.endsWith('.' + cleanRequestDomain)) return true;

    return false;
}

/**
 * Extract path from URL
 * @param {string} url - Full URL
 * @returns {string} URL path
 */
function extractPath(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.pathname;
    } catch (e) {
        return '';
    }
}

/**
 * Parse Cookie header into object
 * @param {string} cookieHeader - Cookie header value
 * @returns {Object} Object with cookie names as keys and values as values
 */
function parseCookieHeader(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) return cookies;

    cookieHeader.split(';').forEach(cookie => {
        const parts = cookie.trim().split('=');
        if (parts.length >= 2) {
            const name = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            if (name) {
                cookies[name] = value;
            }
        }
    });

    return cookies;
}

/**
 * Extract headers from request details
 * @param {Array} requestHeaders - Array of header objects
 * @returns {Object} Object with header names (lowercase) as keys and values as values
 */
function extractHeaders(requestHeaders) {
    const headers = {};
    if (!requestHeaders || !Array.isArray(requestHeaders)) return headers;

    requestHeaders.forEach(header => {
        if (header.name && header.value !== undefined) {
            // Normalize header names to lowercase for comparison
            const name = header.name.toLowerCase();
            headers[name] = header.value;
        }
    });

    return headers;
}

/**
 * Get cookies for a URL using chrome.cookies API
 * @param {string} url - Request URL
 * @returns {Promise<Object>} Object with cookie names as keys and values as values
 */
async function getCookiesForUrl(url) {
    try {
        const cookies = await chrome.cookies.getAll({ url });
        const cookieObj = {};

        cookies.forEach(cookie => {
            cookieObj[cookie.name] = cookie.value;
        });

        return cookieObj;
    } catch (error) {
        console.error('Error getting cookies for URL:', url, error);
        return {};
    }
}

/**
 * Extract cookies and headers from request
 * @param {Object} details - webRequest details
 * @returns {Promise<Object>} Object with cookies and headers
 */
async function extractRequestData(details) {
    const headers = extractHeaders(details.requestHeaders);

    // Try to get cookies from Cookie header first
    const cookieHeader = headers['cookie'] || '';
    let cookies = parseCookieHeader(cookieHeader);

    // If Cookie header is empty or missing, use chrome.cookies API
    // (Cookie header is not always present in requestHeaders)
    if (Object.keys(cookies).length === 0) {
        cookies = await getCookiesForUrl(details.url);
    }

    // Remove cookie header from headers object (we store it separately)
    const { cookie, ...otherHeaders } = headers;

    return {
        cookies,
        headers: otherHeaders
    };
}

/**
 * Get stored data for a domain
 * @param {string} domain - Domain name
 * @returns {Promise<Object|null>} Stored data or null
 */
async function getStoredDataForDomain(domain) {
    try {
        const result = await chrome.storage.local.get([STATE_STORAGE_KEY]);
        const state = result[STATE_STORAGE_KEY] || {};
        return state[domain] || null;
    } catch (error) {
        console.error('Error getting stored data:', error);
        return null;
    }
}

/**
 * Update stored data for a domain
 * @param {string} domain - Domain name
 * @param {Object} data - Data to store { cookies, headers, timestamp }
 * @returns {Promise<void>}
 */
async function updateStoredData(domain, data) {
    try {
        const result = await chrome.storage.local.get([STATE_STORAGE_KEY]);
        const state = result[STATE_STORAGE_KEY] || {};
        state[domain] = {
            cookies: data.cookies,
            headers: data.headers,
            timestamp: Date.now()
        };
        await chrome.storage.local.set({ [STATE_STORAGE_KEY]: state });
    } catch (error) {
        console.error('Error updating stored data:', error);
    }
}

/**
 * Deep compare two objects
 * @param {Object} obj1 - First object
 * @param {Object} obj2 - Second object
 * @returns {boolean} True if objects are different
 */
function hasChanges(obj1, obj2) {
    if (!obj1 && !obj2) return false;
    if (!obj1 || !obj2) return true;

    // Check if any keys are different
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return true;

    // Check if any values are different
    for (const key of keys1) {
        if (obj1[key] !== obj2[key]) {
            return true;
        }
    }

    // Check for keys in obj2 that aren't in obj1
    for (const key of keys2) {
        if (!(key in obj1)) {
            return true;
        }
    }

    return false;
}

/**
 * Calculate percentage of changed headers for common keys
 * @param {Object} newHeaders - New headers object
 * @param {Object} oldHeaders - Old headers object
 * @returns {Object} { changedCount, totalCommonKeys, percentage }
 */
function calculateHeaderChangePercentage(newHeaders, oldHeaders) {
    if (!oldHeaders || Object.keys(oldHeaders).length === 0) {
        // No old headers means 100% change (first time)
        return {
            changedCount: Object.keys(newHeaders).length,
            totalCommonKeys: Object.keys(newHeaders).length,
            percentage: 100
        };
    }

    // Get all unique keys from both objects
    const allKeys = new Set([...Object.keys(newHeaders), ...Object.keys(oldHeaders)]);

    // Find common keys (keys that exist in both)
    const commonKeys = Array.from(allKeys).filter(key =>
        key in newHeaders && key in oldHeaders
    );

    if (commonKeys.length === 0) {
        // No common keys means 100% change
        return {
            changedCount: allKeys.size,
            totalCommonKeys: 0,
            percentage: 100
        };
    }

    // Count how many common keys have different values
    let changedCount = 0;
    for (const key of commonKeys) {
        if (newHeaders[key] !== oldHeaders[key]) {
            changedCount++;
        }
    }

    const percentage = (changedCount / commonKeys.length) * 100;

    return {
        changedCount,
        totalCommonKeys: commonKeys.length,
        percentage: Math.round(percentage * 100) / 100 // Round to 2 decimal places
    };
}

/**
 * Compare and detect changes with percentage calculation
 * @param {Object} newData - New data { cookies, headers }
 * @param {Object} storedData - Stored data { cookies, headers }
 * @returns {Object} { shouldSync: boolean, cookiesChanged: boolean, headersChanged: boolean, headerChangePercentage: number, details: string }
 */
function compareAndDetectChanges(newData, storedData) {
    const MIN_HEADER_CHANGE_PERCENTAGE = 20; // 20% threshold

    if (!storedData) {
        // No stored data means this is the first request - treat as change
        return {
            shouldSync: true,
            cookiesChanged: true,
            headersChanged: true,
            headerChangePercentage: 100,
            details: 'First request - initial sync'
        };
    }

    // Check if cookies changed
    const cookiesChanged = hasChanges(newData.cookies, storedData.cookies);

    // Check if headers changed
    const headersChanged = hasChanges(newData.headers, storedData.headers);

    // If cookies changed, always sync (no percentage check)
    if (cookiesChanged) {
        return {
            shouldSync: true,
            cookiesChanged: true,
            headersChanged,
            headerChangePercentage: headersChanged ? 100 : 0,
            details: 'Cookies changed - sync required'
        };
    }

    // If only headers changed, calculate percentage
    if (headersChanged) {
        const headerStats = calculateHeaderChangePercentage(
            newData.headers,
            storedData.headers
        );

        const shouldSync = headerStats.percentage >= MIN_HEADER_CHANGE_PERCENTAGE;

        return {
            shouldSync,
            cookiesChanged: false,
            headersChanged: true,
            headerChangePercentage: headerStats.percentage,
            changedHeaderCount: headerStats.changedCount,
            totalCommonHeaders: headerStats.totalCommonKeys,
            details: shouldSync
                ? `Headers changed: ${headerStats.changedCount}/${headerStats.totalCommonKeys} (${headerStats.percentage}%) - sync triggered`
                : `Headers changed: ${headerStats.changedCount}/${headerStats.totalCommonKeys} (${headerStats.percentage}%) - below ${MIN_HEADER_CHANGE_PERCENTAGE}% threshold, skipping sync`
        };
    }

    // No changes
    return {
        shouldSync: false,
        cookiesChanged: false,
        headersChanged: false,
        headerChangePercentage: 0,
        details: 'No changes detected'
    };
}

/**
 * Merge data from multiple requests (combine cookies and headers)
 * @param {Object} currentData - Current stored data
 * @param {Object} newData - New request data
 * @returns {Object} Merged data
 */
function mergeRequestData(currentData, newData) {
    if (!currentData) {
        return {
            cookies: { ...newData.cookies },
            headers: { ...newData.headers }
        };
    }

    // Merge cookies (new values override old)
    const mergedCookies = {
        ...currentData.cookies,
        ...newData.cookies
    };

    // Merge headers (new values override old)
    const mergedHeaders = {
        ...currentData.headers,
        ...newData.headers
    };

    return {
        cookies: mergedCookies,
        headers: mergedHeaders
    };
}

/**
 * Trigger sync with debouncing
 */
function triggerSync() {
    if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
    }

    syncDebounceTimer = setTimeout(() => {
        if (syncTriggerCallback) {
            console.log('API monitor: Triggering sync due to header/cookie change');
            syncTriggerCallback();
        }
    }, SYNC_DEBOUNCE_MS);
}

/**
 * Handle request before headers are sent
 * @param {Object} details - webRequest details
 */
async function onBeforeSendHeaders(details) {
    try {
        const config = await getConfig();
        const domain = extractDomain(details.url);
        const path = extractPath(details.url);

        if (!domain) return;

        // Find domain config
        const domainConfig = config.targetDomains.find(d => {
            const configDomain = typeof d === 'string' ? d : d.domain;
            return matchesDomain(domain, configDomain);
        });

        if (!domainConfig) {
            // Debug: log why domain didn't match
            console.log('[API Monitor] Domain not matched:', {
                requestDomain: domain,
                configuredDomains: config.targetDomains.map(d => typeof d === 'string' ? d : d.domain),
                url: details.url
            });
            return;
        }

        // Get API paths (handle both old and new format)
        const apiPaths = typeof domainConfig === 'string' ? [] : (domainConfig.apiPaths || []);

        // If no API paths configured, skip (fall back to cookie-only mode)
        if (!apiPaths || apiPaths.length === 0) return;

        // Check if path matches any configured API path
        if (!matchesApiPath(path, apiPaths)) {
            // Debug: log why path didn't match
            console.log('[API Monitor] Path not matched:', {
                requestPath: path,
                configuredPaths: apiPaths,
                url: details.url
            });
            return;
        }

        // Get the configured domain (for storage key)
        const configuredDomain = typeof domainConfig === 'string' ? domainConfig : domainConfig.domain;

        console.log('[API Monitor] ✓ Request matched:', {
            requestDomain: domain,
            configuredDomain,
            path,
            url: details.url
        });

        // Extract request data (async - needs to fetch cookies)
        const requestData = await extractRequestData(details);

        // Debug logging
        console.log('[API Monitor] Request captured:', {
            url: details.url,
            requestDomain: domain,
            storageDomain: configuredDomain,
            path,
            method: details.method,
            headersCount: Object.keys(requestData.headers).length,
            cookiesCount: Object.keys(requestData.cookies).length,
            sampleHeaders: Object.keys(requestData.headers).slice(0, 5),
            sampleCookies: Object.keys(requestData.cookies).slice(0, 5)
        });

        // Get stored data using configured domain (not request domain)
        const storedData = await getStoredDataForDomain(configuredDomain);

        // Merge with existing data (combine from all API paths)
        const mergedData = mergeRequestData(storedData, requestData);

        // Check for changes with percentage calculation
        const changeResult = compareAndDetectChanges(mergedData, storedData);

        // Always update stored data to keep it fresh
        await updateStoredData(configuredDomain, mergedData);

        if (changeResult.shouldSync) {
            console.log('[API Monitor] Changes detected for', configuredDomain, {
                cookiesChanged: changeResult.cookiesChanged,
                headersChanged: changeResult.headersChanged,
                headerChangePercentage: changeResult.headerChangePercentage,
                changedHeaderCount: changeResult.changedHeaderCount,
                totalCommonHeaders: changeResult.totalCommonHeaders,
                details: changeResult.details
            });

            // Trigger sync
            triggerSync();
        } else {
            // Log why sync was skipped
            if (changeResult.headersChanged) {
                console.log('[API Monitor] Header changes below threshold for', configuredDomain, {
                    headerChangePercentage: changeResult.headerChangePercentage,
                    changedHeaderCount: changeResult.changedHeaderCount,
                    totalCommonHeaders: changeResult.totalCommonHeaders,
                    details: changeResult.details
                });
            }
        }
    } catch (error) {
        console.error('Error in onBeforeSendHeaders:', error);
    }
}

/**
 * Setup request monitoring
 */
export function setupRequestMonitoring() {
    // Remove existing listeners if any
    if (chrome.webRequest.onBeforeSendHeaders.hasListeners()) {
        chrome.webRequest.onBeforeSendHeaders.removeListener(onBeforeSendHeaders);
    }

    // Add listener for request headers
    chrome.webRequest.onBeforeSendHeaders.addListener(
        onBeforeSendHeaders,
        { urls: ['<all_urls>'] },
        ['requestHeaders']
    );

    console.log('API request monitoring initialized');
}

/**
 * Get stored API request data for a domain
 * @param {string} domain - Domain name
 * @returns {Promise<Object|null>} Stored data or null
 */
export async function getStoredApiData(domain) {
    return await getStoredDataForDomain(domain);
}

/**
 * Get stored API request data for all configured domains
 * @returns {Promise<Array>} Array of { domain, data } objects
 */
export async function getAllStoredApiData() {
    try {
        const config = await getConfig();
        const result = await chrome.storage.local.get([STATE_STORAGE_KEY]);
        const state = result[STATE_STORAGE_KEY] || {};
        const domains = config.targetDomains.map(d => typeof d === 'string' ? d : d.domain);

        return domains.map(domain => ({
            domain,
            data: state[domain] || null
        }));
    } catch (error) {
        console.error('Error getting all stored API data:', error);
        return [];
    }
}

/**
 * Clear stored API request data
 * @param {string} domain - Optional domain to clear, or clear all if not provided
 * @returns {Promise<void>}
 */
export async function clearStoredApiData(domain = null) {
    try {
        if (domain) {
            const result = await chrome.storage.local.get([STATE_STORAGE_KEY]);
            const state = result[STATE_STORAGE_KEY] || {};
            delete state[domain];
            await chrome.storage.local.set({ [STATE_STORAGE_KEY]: state });
        } else {
            await chrome.storage.local.remove([STATE_STORAGE_KEY]);
        }
    } catch (error) {
        console.error('Error clearing stored API data:', error);
    }
}

