# Cookie Sync Browser Extension

A Chrome/Chromium browser extension that syncs cookies from configured websites to cloud storage services (Firebase Storage, Supabase Storage, and AWS S3). Supports both manual and automatic synchronization.

## Features

- 🔄 **Manual & Automatic Sync**: Sync cookies on-demand or automatically when cookies/headers change
- 🌐 **Configurable Domains**: Choose which websites to sync cookies from (default: binance.com)
- 🎯 **API Path Monitoring**: Optionally monitor specific API endpoints and capture request headers and cookies
- ⭐ **Wildcard Support**: Use wildcards in API paths (e.g., `/api/v3/*`) to match multiple endpoints
- ☁️ **Multiple Storage Services**: Support for Firebase Storage, Supabase Storage, and AWS S3
- 🔒 **Secure**: Credentials stored locally in browser storage
- ⚙️ **Easy Configuration**: User-friendly options page for setup
- 📊 **Status Monitoring**: View sync status and history in the popup

## Installation

### Prerequisites

- Chrome/Chromium browser (version 88+)
- Node.js 18+ and pnpm 8+ (for development)

### Development Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd cookies-sync
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Build the extension:**
   ```bash
   pnpm run build
   ```
   This will create a `dist/` directory with all bundled files.

4. **Load the extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `dist/` directory (not the root `cookies-sync` directory)

5. **Create extension icons** (optional but recommended):
   ```bash
   # If you have ImageMagick installed:
   ./generate-icons.sh
   
   # Or create icons manually using online tools:
   # - https://www.favicon-generator.org/
   # - https://realfavicongenerator.net/
   # See icons/README.md for details
   ```

## Configuration

### Initial Setup

1. Click the extension icon in your browser toolbar
2. Click "Options" to open the configuration page
3. Configure your target domains and storage services

### Target Domains & API Paths

The extension supports two monitoring modes:

#### Mode 1: All Cookies (Default)
- If no API paths are configured, the extension syncs all cookies for the domain
- Works exactly like the original behavior

#### Mode 2: API Path Monitoring (New)
- Configure specific API paths to monitor per domain
- Only captures request headers and cookies from requests matching those paths
- Syncs automatically when headers or cookies change for those requests

**Configuration:**
1. Click "Add Domain" to add a new domain configuration
2. Enter the domain name (e.g., `binance.com`)
3. (Optional) Add API paths to monitor:
   - Click "Add Path" for each API endpoint
   - Enter paths like `/api/v3/account`, `/api/v3/order`
   - Use wildcards: `/api/v3/*` matches all paths under `/api/v3/`
4. Leave API paths empty to sync all cookies (Mode 1)

**Examples:**
- Domain: `binance.com`, API Paths: `/api/v3/account`, `/api/v3/order`
- Domain: `binance.com`, API Paths: `/api/v3/*` (matches all `/api/v3/` endpoints)
- Domain: `example.com`, API Paths: (empty) - syncs all cookies

### Firebase Storage Setup

**Note**: Firebase Storage in browser extensions has authentication limitations. The web SDK requires either:
- Anonymous authentication (configure in Firebase Console)
- Custom authentication tokens
- Public write rules (not recommended for production)

**Recommended Setup:**

1. **Enable Firebase** toggle in the options page
2. **Get your Firebase credentials:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project or create a new one
   - Go to Project Settings > General
   - Copy your Project ID
   - Go to Storage and note your bucket name
3. **Configure Storage Rules** (Firebase Console > Storage > Rules):
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow write: if request.auth != null || request.resource.size < 10 * 1024 * 1024; // Allow authenticated or small files
       }
     }
   }
   ```
   Or for development/testing (not recommended for production):
   ```javascript
   allow write: if true;
   ```
4. **Configure in extension:**
   - Project ID: Your Firebase project ID
   - Storage Bucket: Your storage bucket name (e.g., `your-project.appspot.com`)
   - Service Account Key: Leave empty or use for future backend integration
5. **Test connection** to verify setup

**Alternative**: Use Firebase with anonymous authentication by enabling it in Authentication > Sign-in method.

### Supabase Storage Setup

1. **Enable Supabase** toggle in the options page
2. **Get your Supabase credentials:**
   - Go to [Supabase Dashboard](https://app.supabase.com/)
   - Select your project
   - Go to Settings > API
   - Copy your Project URL and anon/public API key
   - Create a storage bucket (Settings > Storage)
3. **Configure in extension:**
   - Supabase URL: Your project URL (e.g., `https://xxxxx.supabase.co`)
   - API Key: Your anon/public API key
   - Bucket Name: Name of your storage bucket
4. **Test connection** to verify setup

### AWS S3 Setup

1. **Enable AWS** toggle in the options page
2. **Get your AWS credentials:**
   - Go to [AWS Console](https://console.aws.amazon.com/)
   - Create an IAM user with S3 write permissions
   - Create access keys for the user
   - Create an S3 bucket (or use existing)
3. **Configure in extension:**
   - Access Key ID: Your AWS access key ID
   - Secret Access Key: Your AWS secret access key
   - Bucket Name: Your S3 bucket name
   - Region: AWS region (e.g., `us-east-1`)
4. **Test connection** to verify setup

## Usage

### Manual Sync

1. Click the extension icon
2. Click "Sync Now" button
3. Wait for sync to complete
4. View results in the popup

### Automatic Sync

1. Open the extension popup
2. Toggle "Auto Sync" to enable
3. **All Cookies Mode**: Cookies will automatically sync when they change (with 5-second debounce)
4. **API Path Monitoring Mode**: Sync triggers when:
   - Request headers change for any monitored API path
   - Cookies in requests change for any monitored API path
   - Changes are detected with 2-second debounce

### Viewing Sync Status

- **Last Sync**: Shows when the last sync occurred
- **Target Domains**: Displays configured domains
- **Monitoring Mode**: Shows "All Cookies" or "API Path Monitoring"
- **API Paths**: Displays count of configured API paths (when in API Path Monitoring mode)
- **Enabled Services**: Shows which storage services are active
- **Status Indicators**: Green for success, red for errors

## Storage Format

The storage format depends on the monitoring mode:

### All Cookies Mode (No API Paths)

```json
{
  "timestamp": 1234567890123,
  "cookies": [
    {
      "name": "cookie_name",
      "value": "cookie_value",
      "domain": ".example.com",
      "path": "/",
      "secure": true,
      "httpOnly": false,
      "sameSite": "lax",
      "expirationDate": 1234567890,
      "storeId": "0"
    }
  ],
  "count": 1
}
```

### API Path Monitoring Mode

```json
{
  "timestamp": 1234567890123,
  "cookies": {
    "cookie_name": "cookie_value",
    "another_cookie": "another_value"
  },
  "headers": {
    "authorization": "Bearer token123",
    "x-api-key": "key456",
    "content-type": "application/json"
  }
}
```

**File Naming:**
- Files are named using the domain: `[domain].json`
- Example: `binance.com.json`, `example.com.json`
- Each domain gets its own file
- If multiple domains are configured, separate files are created for each domain
- Files are overwritten on each sync (latest data replaces previous)

**Notes:**
- In API Path Monitoring mode, cookies and headers are combined from all monitored API paths
- Header names are normalized to lowercase
- Cookie values are extracted from the `Cookie` header in requests

## Security & Privacy

- **Local Storage**: All credentials are stored locally in your browser using `chrome.storage.local`
- **No External Servers**: The extension only communicates with your configured storage services
- **HTTPS Only**: All API calls use HTTPS
- **Input Validation**: Domain and API path inputs are validated to prevent security issues
- **No Cookie Modification**: The extension only reads cookies and headers, never modifies them
- **Request Monitoring**: The extension uses Chrome's `webRequest` API to monitor network requests (requires permission)
- **Sensitive Data**: Be aware that request headers may contain sensitive information (API keys, tokens, etc.)

### Best Practices

- Use service account keys with minimal required permissions
- Regularly rotate your API keys and credentials
- Don't share your extension configuration
- Review uploaded cookie data periodically

## Troubleshooting

### Extension Not Loading

- Ensure you're using Chrome/Chromium 88+
- Check that all files are present in the extension directory
- Review the browser console for errors (`chrome://extensions/` > Details > Inspect views)

### Sync Fails

1. **Check Configuration:**
   - Verify all required fields are filled
   - Use "Test Connection" buttons to verify credentials

2. **Check Permissions:**
   - Ensure host permissions are granted for your target domains
   - Check browser console for permission errors

3. **Check Storage Services:**
   - Verify bucket names and regions are correct
   - Ensure API keys have proper permissions
   - Check service quotas/limits

4. **Check Network:**
   - Verify internet connection
   - Check if storage services are accessible

### No Cookies Found

- Verify target domains are correct
- Ensure you're logged into the target websites
- Check that cookies exist for the configured domains
- Verify host permissions are granted

### Auto-Sync Not Working

- Ensure auto-sync is enabled in the popup
- Check that at least one storage service is enabled
- Verify target domains are configured
- **For API Path Monitoring**: Ensure API paths are correctly configured and requests are being made
- Check browser console for errors

### API Path Monitoring Not Working

- Verify API paths are correctly formatted (must start with `/`)
- Check that requests are actually being made to those paths
- Ensure wildcard patterns are correct (e.g., `/api/v3/*`)
- Check browser console for monitoring errors
- Verify `webRequest` permission is granted

## Development

### Project Structure

```
cookies-sync/
├── manifest.json          # Extension manifest
├── package.json           # Dependencies
├── src/
│   ├── background/        # Service worker
│   ├── popup/             # Popup UI
│   ├── options/            # Options page
│   └── utils/              # Utility functions
├── icons/                  # Extension icons
└── README.md              # This file
```

### Building

The extension requires a build step to bundle npm dependencies (Firebase, Supabase, AWS SDK) for browser extension compatibility.

**Build the extension:**
```bash
pnpm run build
```

This will:
- Bundle all JavaScript files with their dependencies
- Copy HTML, CSS, and manifest files
- Copy icons
- Output everything to the `dist/` directory

**Development mode (watch for changes):**
```bash
pnpm run dev
```

**Load the extension:**
After building, load the extension from the `dist/` directory in Chrome.

### Testing

1. Load the extension in developer mode
2. Configure storage services
3. Test manual sync
4. Enable auto-sync and test cookie changes
5. Verify files appear in storage buckets

### Code Style

- ES6 modules
- Modern JavaScript (async/await)
- Chrome Extension Manifest V3

## Browser Support

- **Primary**: Chrome/Chromium 88+
- **Firefox**: Not currently supported (Manifest V3 differences)
  - Firefox support may be added in future versions

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues, questions, or feature requests:

- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section

## Changelog

### Version 1.0.0

- Initial release
- Support for Firebase Storage, Supabase Storage, and AWS S3
- Manual and automatic sync
- Configurable target domains
- Options page for configuration
- Status monitoring in popup

## Acknowledgments

Built with:
- [Firebase SDK](https://firebase.google.com/docs)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/sdk-for-javascript/)

---

**Note**: This extension is for personal use. Ensure you comply with website terms of service and privacy policies when syncing cookies.

