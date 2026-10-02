/**
 * Copyright (c) 2025, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { AsgardeoProvider } from "@asgardeo/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { environmentConfig } from "./util/environment-util";

// Bypass ngrok's free-tier browser-warning interstitial for every request
// this app makes to the ngrok-tunneled WSO2 IS instance. Without this,
// background fetch() calls the Asgardeo SDK makes (jwks, branding-preference,
// etc.) get intercepted by ngrok's own HTML warning page instead of reaching
// the real backend, which breaks CORS since that warning page sends no
// Access-Control-Allow-Origin header.
(function patchFetchForNgrok() {
  const NGROK_HOST = new URL(environmentConfig.ASGARDEO_BASE_URL).host;
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : input?.url;
    if (url && url.includes(NGROK_HOST)) {
      init = init || {};
      const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined));
      headers.set("ngrok-skip-browser-warning", "true");
      init.headers = headers;
    }
    return originalFetch.call(this, input, init);
  };
})();

createRoot(document.getElementById('root')).render(
    <AsgardeoProvider
      clientId={`${environmentConfig.APP_CLIENT_ID}`}
      baseUrl={`${environmentConfig.ASGARDEO_BASE_URL}`}
      organizationHandle="carbon.super"
      // Explicitly request "email" alongside the SDK's own defaults
      // (openid, profile, internal_login) - "email" isn't requested by
      // default, and the profile page reads its claims (email, given_name,
      // family_name) straight from the ID token now instead of /scim2/Me.
      // IBAN is a separate case: it isn't in the ID token on this instance
      // at all, it comes from its own GET /scim2/Me call - see
      // getIban() in pages/user-profile.jsx.
      scopes="openid profile email internal_login"
      preferences={{
        theme: {
          overrides: {
            borderRadius: {
              small: '0',
              medium: '0',
              large: '0'
            },
            colors: {
              primary: {
                main: 'var(--primary-2)'
              }
            }
          }
        }
      }}
    >
      <App />
    </AsgardeoProvider>
);
