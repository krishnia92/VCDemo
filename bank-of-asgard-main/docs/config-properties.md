# 🔧 `config.js` - Configuration Guide

This file contains runtime environment-specific settings used by the frontend application.

## Configuration Fields

| Key                               | Description                                                                 |
|-----------------------------------|-----------------------------------------------------------------------------|
| `API_BASE_URL`                    | Base URL for initiating API requests (e.g., via an API Gateway or proxy). Example: `https://api.example.io`. For the local setup, this is the URL where the backend server is hosted. |
| `API_SERVICE_URL`                 | Full endpoint to reach backend services directly. Typically includes path/versioning. Example: `https://api.example.io/default/server/v1.0`. For the local setup, use the server URL without path/versioning. |
| `APP_BASE_URL`                    | Base URL where the frontend app is hosted.                                 |
| `ASGARDEO_BASE_URL`               | Asgardeo tenant URL for authentication. |
| `APP_CLIENT_ID`                   | OAuth/OpenID client ID for the app.                         |
| `DISABLED_FEATURES`               | Array of feature flags to disable specific frontend features.               |
| `TRANSFER_THRESHOLD`              | Maximum allowed transfer amount without verification.    |
| `IDENTITY_VERIFICATION_PROVIDER_ID` | ID of the configured Identity Verification Provider (IdVP). This can be obtained from the Quick start section of the Identity Verification Provider.             |
| `IDENTITY_VERIFICATION_CLAIMS`   | List of user claims that require verification. Ex: "http://wso2.org/claims/dob". Note that once any of these claims is updated, the user will require to perform Identity Verification again.                             |

## 🔒 Supported Feature Flags

The following feature flags can be used inside `DISABLED_FEATURES`:

| Flag                 | Description                                       |
|----------------------|---------------------------------------------------|
| `"identity-verification"` | Disables identity verification-related features. |
| `"odin-wallet"`           | Disables Odin Wallet integration.                |

> ℹ️ This file is meant to be environment-specific. Make sure to replace values when deploying to dev, staging, or production.
