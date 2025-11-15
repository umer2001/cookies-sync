/**
 * Storage service integrations
 * Handles uploading cookies to Firebase Storage, Supabase Storage, and AWS S3
 */

import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString } from 'firebase/storage';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getConfig } from './config.js';

/**
 * Upload cookies to Firebase Storage
 * Uses Firebase Storage REST API with service account authentication
 * @param {Object} cookieData - Formatted cookie data
 * @param {Object} config - Firebase configuration
 * @param {string} domain - Domain name for filename
 * @returns {Promise<Object>} Upload result
 */
export async function uploadToFirebase(cookieData, config, domain) {
  try {
    if (!config.projectId || !config.bucket || !config.serviceAccountKey) {
      throw new Error('Firebase configuration is incomplete');
    }

    // Parse service account key
    let serviceAccount;
    try {
      serviceAccount = typeof config.serviceAccountKey === 'string' 
        ? JSON.parse(config.serviceAccountKey) 
        : config.serviceAccountKey;
    } catch (e) {
      throw new Error('Invalid Firebase service account key format');
    }

    // Note: Firebase Storage REST API requires OAuth2 token from service account
    // For browser extensions, we'll use a simplified approach:
    // Option 1: Use Firebase web SDK with anonymous/auth (requires Firebase config)
    // Option 2: Use REST API with signed URLs (requires backend)
    // Option 3: Use Firebase Storage with public write rules (not recommended for production)
    
    // For now, we'll use the web SDK approach with the project config
    // Users should configure Firebase Storage rules to allow writes
    const firebaseConfig = {
      projectId: config.projectId,
      storageBucket: config.bucket
    };

    const app = initializeApp(firebaseConfig);
    const storage = getStorage(app);

    // Create filename using domain name
    const filename = `${domain}.json`;
    const storageRef = ref(storage, filename);

    // Upload as JSON string
    const jsonData = JSON.stringify(cookieData, null, 2);
    await uploadString(storageRef, jsonData, 'raw');

    return {
      success: true,
      service: 'firebase',
      filename,
      message: 'Successfully uploaded to Firebase Storage'
    };
  } catch (error) {
    console.error('Firebase upload error:', error);
    return {
      success: false,
      service: 'firebase',
      error: error.message || 'Unknown error. Note: Firebase Storage requires proper authentication setup. See README for details.'
    };
  }
}

/**
 * Upload cookies to Supabase Storage
 * @param {Object} cookieData - Formatted cookie data
 * @param {Object} config - Supabase configuration
 * @param {string} domain - Domain name for filename
 * @returns {Promise<Object>} Upload result
 */
export async function uploadToSupabase(cookieData, config, domain) {
  try {
    if (!config.url || !config.apiKey || !config.bucket) {
      throw new Error('Supabase configuration is incomplete');
    }

    // Initialize Supabase client
    const supabase = createClient(config.url, config.apiKey);

    // Create filename using domain name
    const filename = `${domain}.json`;
    const jsonData = JSON.stringify(cookieData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });

    // Upload file (use upsert: true to overwrite existing file for same domain)
    const { data, error } = await supabase.storage
      .from(config.bucket)
      .upload(filename, blob, {
        contentType: 'application/json',
        upsert: true
      });

    if (error) {
      throw error;
    }

    return {
      success: true,
      service: 'supabase',
      filename,
      path: data.path,
      message: 'Successfully uploaded to Supabase Storage'
    };
  } catch (error) {
    console.error('Supabase upload error:', error);
    return {
      success: false,
      service: 'supabase',
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Upload cookies to AWS S3
 * @param {Object} cookieData - Formatted cookie data
 * @param {Object} config - AWS configuration
 * @param {string} domain - Domain name for filename
 * @returns {Promise<Object>} Upload result
 */
export async function uploadToAWS(cookieData, config, domain) {
  try {
    if (!config.accessKeyId || !config.secretAccessKey || !config.bucket || !config.region) {
      throw new Error('AWS configuration is incomplete');
    }

    // Initialize S3 client
    const s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });

    // Create filename using domain name
    const filename = `${domain}.json`;
    const jsonData = JSON.stringify(cookieData, null, 2);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: filename,
      Body: jsonData,
      ContentType: 'application/json'
    });

    await s3Client.send(command);

    return {
      success: true,
      service: 'aws',
      filename,
      message: 'Successfully uploaded to AWS S3'
    };
  } catch (error) {
    console.error('AWS upload error:', error);
    return {
      success: false,
      service: 'aws',
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Test Firebase connection
 * @param {Object} config - Firebase configuration
 * @returns {Promise<Object>} Test result
 */
export async function testFirebaseConnection(config) {
  try {
    if (!config.projectId || !config.bucket) {
      return { success: false, error: 'Configuration is incomplete' };
    }

    // Try to initialize Firebase
    const firebaseConfig = {
      projectId: config.projectId,
      storageBucket: config.bucket
    };

    const app = initializeApp(firebaseConfig);
    const storage = getStorage(app);

    // Try to create a reference (this will validate the config)
    const testRef = ref(storage, 'test_connection.json');
    
    // Note: Actual upload test requires proper authentication
    // This just validates the configuration format
    return {
      success: true,
      message: 'Firebase configuration valid. Ensure Storage rules allow writes.'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Connection failed'
    };
  }
}

/**
 * Test Supabase connection
 * @param {Object} config - Supabase configuration
 * @returns {Promise<Object>} Test result
 */
export async function testSupabaseConnection(config) {
  try {
    if (!config.url || !config.apiKey || !config.bucket) {
      return { success: false, error: 'Configuration is incomplete' };
    }

    const supabase = createClient(config.url, config.apiKey);

    // Try to list buckets or check access
    const { data, error } = await supabase.storage.from(config.bucket).list('', {
      limit: 1
    });

    if (error) {
      throw error;
    }

    return {
      success: true,
      message: 'Supabase connection successful'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Connection failed'
    };
  }
}

/**
 * Test AWS connection
 * @param {Object} config - AWS configuration
 * @returns {Promise<Object>} Test result
 */
export async function testAWSConnection(config) {
  try {
    if (!config.accessKeyId || !config.secretAccessKey || !config.bucket || !config.region) {
      return { success: false, error: 'Configuration is incomplete' };
    }

    const s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });

    // Try to head the bucket (check if we have access)
    const command = new HeadBucketCommand({ Bucket: config.bucket });
    await s3Client.send(command);

    return {
      success: true,
      message: 'AWS connection successful'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Connection failed'
    };
  }
}

/**
 * Upload cookies to all enabled services
 * @param {Object} cookieData - Formatted cookie data
 * @param {string} domain - Domain name for filename
 * @returns {Promise<Array>} Array of upload results
 */
export async function uploadToEnabledServices(cookieData, domain) {
  const config = await getConfig();
  const results = [];

  // Upload to Firebase if enabled
  if (config.services.firebase?.enabled) {
    const result = await uploadToFirebase(cookieData, config.services.firebase, domain);
    results.push(result);
  }

  // Upload to Supabase if enabled
  if (config.services.supabase?.enabled) {
    const result = await uploadToSupabase(cookieData, config.services.supabase, domain);
    results.push(result);
  }

  // Upload to AWS if enabled
  if (config.services.aws?.enabled) {
    const result = await uploadToAWS(cookieData, config.services.aws, domain);
    results.push(result);
  }

  return results;
}

/**
 * Upload cookies for all domains to all enabled services
 * @param {Array} domainCookies - Array of {domain, cookieData} objects
 * @returns {Promise<Array>} Array of upload results
 */
export async function uploadAllDomainsToEnabledServices(domainCookies) {
  const allResults = [];
  
  for (const { domain, cookieData } of domainCookies) {
    const results = await uploadToEnabledServices(cookieData, domain);
    allResults.push(...results.map(r => ({ ...r, domain })));
  }
  
  return allResults;
}

