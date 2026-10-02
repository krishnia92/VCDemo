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

import express from "express";
import cors from "cors";
import axios from "axios";
import pino from "pino";

import { getAccessToken, requireBearer } from "./middleware/auth.js";
import { addUserToAdminRole, createOrganization, deleteOrganization, getAdminRoleIdInOrganization, getOrganizationId, getUserIdInOrganization, isBusinessNameAvailable } from "./controllers/business.js"
import { agent, ASGARDEO_BASE_URL, ASGARDEO_BASE_URL_SCIM2, GEO_API_KEY, HOST, PORT, SCIM2_ADMIN_PASSWORD, SCIM2_ADMIN_USERNAME, USER_STORE_NAME, VITE_REACT_APP_CLIENT_BASE_URL } from "./config.js";

// Mounted verifier portals (formerly standalone apps in ../../verifier-portal
// and ../../vc-verifier-address). They're plain CommonJS Express apps, so
// we pull them in via createRequire and start them alongside this server -
// starting this server now starts all three.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const identityVerifier = require("./verifiers/verifier-portal/app.cjs");
const addressVerifier = require("./verifiers/vc-verifier-address/app.cjs");

const corsOptions = {
  origin: [VITE_REACT_APP_CLIENT_BASE_URL],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Access-Control-Allow-Methods",
    "Access-Control-Request-Headers",
  ],
  credentials: true,
  enablePreflight: true,
};

const app = express();

const logger = pino({
  level: process.env.LOG_LEVEL || "debug",
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

// logger middleware.
app.use((req, res, next) => {
  logger.debug({
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
  });
  next();
});

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

async function createUser(userData) {
  const {
    username,
    password,
    email,
    firstName,
    lastName,
    country,
    accountType,
    businessName,
    dateOfBirth,
    mobile,
  } = userData;
  console.log(`Creating ${accountType} user`)

  const token = await getAccessToken();

  const response = await axios.post(
    `${ASGARDEO_BASE_URL_SCIM2}/Users`,
    {
      schemas: [],
      userName: `${USER_STORE_NAME}/${username}`,
      password: password,
      emails: [
        {
          value: email,
          primary: true,
        },
      ],
      name: {
        givenName: firstName,
        familyName: lastName,
      },
      "urn:scim:wso2:schema": {
        country: country,
        dateOfBirth: dateOfBirth,
      },
      phoneNumbers: [
        {
          type: "mobile",
          value: mobile,
        },
      ],
      "urn:scim:schemas:extension:custom:User": {
        accountType: accountType,
        ...(businessName ? { businessName } : {}), 
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      httpsAgent: agent, // Attach the custom agents
    }
  );
  return response;
};

app.post("/signup", async (req, res) => {
  try {
    const response = await createUser(req.body);
    res.json({ message: "User registered successfully", data: response.data });
  } catch (error) {
    console.log("SCIM2 API Error:", error.detail || error.message);
    res.status(400).json({ error: error.detail || "Signup failed" });
  }
});

app.post("/business-signup", async (req, res) => {
  try {
    const { businessName } = req.body;
    const { username } = req.body;

    const available = await isBusinessNameAvailable(businessName);
    if (!available) {
      return res.status(400).json({ error: "Business name is already taken" });
    }

    const userResponse = await createUser(req.body);
    // Return a response and asynchronously continue with the remaining operations
    res.json({
      message: "Business user registered successfully",
      user: userResponse.data
    });

    const creatorId = userResponse.data.id;
    const orgResponse = await createOrganization(businessName, creatorId, username);
    const organizationId = orgResponse.data.id;
    
    const orgUserId = await getUserIdInOrganization(organizationId, username);
    const adminRoleId = await getAdminRoleIdInOrganization(organizationId);
    addUserToAdminRole(organizationId, adminRoleId, orgUserId);
  } catch (error) {
    console.log(error)
    console.error("Business signup error:", error.message);
    res.status(400).json({ error: "Business signup failed" });
  }
});



// IP geolocation request
app.post("/risk", async (req, res) => {
  try {
    let { ip, country } = req.body;

    if (!ip || !country) {
      return res
        .status(400)
        .json({ error: "IP address and country name are required" });
    }
    
    // Call the IP Geolocation API
    const response = await axios.get(
      `https://api.ipgeolocation.io/ipgeo?apiKey=${GEO_API_KEY}&ip=${ip}&fields=country_name`
    );

    const country_name = response.data.country_name;
    // Determine risk based on country code
    const hasRisk = country_name !== country;
    console.log("This country shows risk: " + hasRisk);
    res.json({ hasRisk });
  } catch (error) {
    console.error("Error fetching IP geolocation:", error.message);
    res.status(500).json({ error: "Failed to process request" });
  }
});

async function deleteUser(req) {

  const token = await getAccessToken();
  const userAccessToken = req.token;

  const me = await axios.get(`${ASGARDEO_BASE_URL_SCIM2}/Me`, {
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
      Accept: "application/scim+json"
    },
    httpsAgent: agent
  });

  const scimId = me.data?.id;
  if (!scimId) {
    return res.status(500).json({ error: "Could not resolve SCIM user id" });
  }

  const response = await axios.delete(
    `${ASGARDEO_BASE_URL_SCIM2}/Users/${scimId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "*/*",
      },
      httpsAgent: agent, // Attach the custom agent
    }
  );
  return response;
}

app.delete("/close-account", requireBearer, async (req, res) => {
  try {
    const response = deleteUser(req);
    if (response.status == 204) {
      res.json({
        message: "Account removed successfully",
        data: response.data,
      });
    }
  } catch (error) {
    console.log("SCIM2 API Error:", error.detail || error.message);
    res
      .status(400)
      .json({ error: error.detail || "An error occurred while deleting user" });
  }
});

app.delete("/close-business-account", requireBearer, async (req, res) => {
  
  try {
    const organizationName = req.query.businessName;
    const orgId = await getOrganizationId(organizationName);
    const businessDeletionStatus = await deleteOrganization(orgId);
    const deletionResponse = await deleteUser(req);
    if (businessDeletionStatus == 204 && deletionResponse.status == 204) {
      res.json({
        message: "Business account removed successfully"
      });
    }
  } catch (error) {
    console.log("Error:", error.detail || error.message);
    res
      .status(400)
      .json({ error: error.detail || "An error occurred while deleting business user" });
  }
});

app.get("/business", async (req, res) => {
  
  try {
    const organizationId = req.query.organizationId;
    const token = await getAccessToken();
    const response = await axios.get(
    `${ASGARDEO_BASE_URL}/api/server/v1/organizations/${organizationId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      httpsAgent: agent,
    }
  );

  const businessRegistrationAttribute = response.data.attributes.find(attr => attr.key === "business-registration-number");
  const businessRegNumber = businessRegistrationAttribute ? businessRegistrationAttribute.value : null;

  if (response.status === 200) {
    res.json({
      "businessRegistrationNumber": businessRegNumber
    });
  }
  } catch (error) {
    console.log("Business API Error:", error.detail || error.message);
    res
      .status(400)
      .json({ error: error.detail || "An error occurred while fetching business details" });
  }
});

app.patch("/business-update", async (req, res) => {
  try {
    const organizationId = req.body.organizationId;
    const newBusinessRegistrationNumber = req.body.businessRegistrationNumber;
    const operation = req.body.operation

    if (!organizationId || !newBusinessRegistrationNumber) {
      return res.status(400).json({ error: "Missing organizationId or business details in request" });
    }

    const token = await getAccessToken();

    const response = await axios.patch(
      `${ASGARDEO_BASE_URL}/api/server/v1/organizations/${organizationId}`,
      [
        {
          operation,
          path: "/attributes/business-registration-numberr",
          value: newBusinessRegistrationNumber
        }
      ],
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        },
        httpsAgent: agent
      }
    );

    if (response.status === 200) {
      res.json({
        message: "Business details updated successfully",
        data: response.data
      });
    } else {
      res.status(response.status).json({ error: "Failed to update business details" });
    }
  } catch (error) {
    console.error("Organization PATCH API Error:", error.response?.data || error.message);
    res.status(400).json({
      error: error.response?.data || "An error occurred while updating the business"
    });
  }
});

const CUSTOM_SCHEMA = "urn:scim:schemas:extension:custom:User";

// Wallet-based sign-ins authenticate via a federated VP (Verifiable
// Presentation) authenticator rather than a local password, so there is no
// backing local SCIM user reachable through /scim2/Me + the caller's own
// token (that self-service call 404s for those sessions - see
// user-profile.jsx and wallet-provider.jsx on the frontend). The one claim
// that *does* come through for every login method is email, so we resolve
// the caller's real local account by looking it up with our own M2M
// credentials instead of relying on self-service SCIM.
//
// /oauth2/userinfo (not /scim2/Me) is used to read that email, because it
// validates the caller's actual bearer token server-side rather than
// trusting a value the client could otherwise just make up.
// Basic-auth header for direct SCIM2 admin access - deliberately NOT the
// M2M client_credentials token (getAccessToken() from middleware/auth.js).
// That M2M app turned out to be missing/misconfigured in this environment
// (invalid_client), and even a working M2M client would still need an
// explicit "Authorized APIs" scope grant in the IS Console for user-mgt
// SCIM2 calls specifically - confirmed by testing the vc-verifier app's
// own M2M credentials, which get a token fine but are rejected 403 by
// SCIM2. Basic auth with the WSO2 IS super-admin account sidesteps both
// problems entirely for this server-side-only lookup.
function scim2AdminAuthHeader() {
  if (!SCIM2_ADMIN_USERNAME || !SCIM2_ADMIN_PASSWORD) {
    throw new Error("SCIM2_ADMIN_USERNAME / SCIM2_ADMIN_PASSWORD are not configured");
  }
  return "Basic " + Buffer.from(`${SCIM2_ADMIN_USERNAME}:${SCIM2_ADMIN_PASSWORD}`).toString("base64");
}

async function resolveScimUserByToken(userToken) {
  const userinfoResp = await axios.get(`${ASGARDEO_BASE_URL}/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${userToken}` },
    httpsAgent: agent,
  });

  // [resolveScimUserByToken] logs are intentionally verbose - this is the
  // one path a wallet-based (no local password) sign-in relies on to find
  // its real SCIM account, and failures here are otherwise silent to the
  // browser (the frontend just falls back to "no linked wallet / no
  // verified address" with no visible error). If linking/address status
  // isn't showing up after a wallet login, these lines say exactly why:
  // no email claim released by the login authenticator, or an email that
  // doesn't match any existing local account (e.g. a JIT-provisioned
  // shadow account distinct from the one holding the custom claims).
  console.log("[resolveScimUserByToken] userinfo claims:", Object.keys(userinfoResp.data || {}));

  const email = userinfoResp.data && userinfoResp.data.email;
  if (!email) {
    console.log("[resolveScimUserByToken] FAILED: no 'email' claim in /oauth2/userinfo response. Full response:", JSON.stringify(userinfoResp.data));
    throw new Error("Could not resolve an email claim for this session");
  }

  console.log("[resolveScimUserByToken] resolved email:", email, "- searching SCIM2 for matching account...");

  const authHeader = scim2AdminAuthHeader();
  const searchResp = await axios.get(`${ASGARDEO_BASE_URL_SCIM2}/Users`, {
    params: { filter: `emails eq \"${email}\"` },
    headers: { Authorization: authHeader, Accept: "application/json" },
    httpsAgent: agent,
  });

  const user = searchResp.data && searchResp.data.Resources && searchResp.data.Resources[0];
  if (!user) {
    console.log(`[resolveScimUserByToken] FAILED: SCIM2 search for emails eq "${email}" returned 0 results (totalResults=${searchResp.data && searchResp.data.totalResults}).`);
    throw new Error(`No local account found for ${email}`);
  }

  console.log(
    "[resolveScimUserByToken] matched SCIM user id:", user.id,
    "- custom schema:", JSON.stringify(user[CUSTOM_SCHEMA] || {})
  );

  return { token: authHeader, email, user };
}

// Extended profile fields that live on the SCIM2 custom schema but aren't
// reachable via self-service /scim2/Me for a wallet-based sign-in: IBAN,
// wallet-link status, linked wallet holder ids, and address-verification
// status. The frontend calls this as a fallback only when its own
// self-service /scim2/Me attempt fails (see wallet-provider.jsx and
// user-profile.jsx) - for a normal password login, self-service already
// works and this route is never hit.
app.get("/me-extended", requireBearer, async (req, res) => {
  try {
    const { user } = await resolveScimUserByToken(req.token);
    const custom = user[CUSTOM_SCHEMA] || {};

    res.json({
      scimId: user.id,
      iban: custom.iban || "",
      islinkedtogovwallet: custom.islinkedtogovwallet || "false",
      linkedwalletholders: custom.linkedwalletholders || "[]",
      isaddressverified: custom.isaddressverified || "false",
      homeAddress: custom.homeAddress || "",
    });
  } catch (error) {
    console.log("me-extended GET error:", error.response?.data || error.message);
    res.status(404).json({ error: "Could not resolve extended profile for this session" });
  }
});

// Companion write path for the same fields, used by the same fallback
// pattern - only reached when a self-service PATCH /scim2/Me attempt fails
// first.
app.patch("/me-extended", requireBearer, async (req, res) => {
  try {
    const { token, user } = await resolveScimUserByToken(req.token);
    const allowedFields = ["islinkedtogovwallet", "linkedwalletholders", "isaddressverified", "homeAddress"];
    const value = {};
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        value[key] = String(req.body[key]);
      }
    }

    if (Object.keys(value).length === 0) {
      return res.status(400).json({ error: "No recognized fields to update" });
    }

    // One "replace" operation per field, each with its own explicit path
    // (see the matching comment in wallet-provider.jsx's persistProfileFields
    // - a single operation whose value is a nested multi-attribute object
    // was observed to only reliably apply one of the attributes).
    await axios.patch(
      `${ASGARDEO_BASE_URL_SCIM2}/Users/${user.id}`,
      {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: Object.entries(value).map(([key, val]) => ({
          op: "replace",
          path: `${CUSTOM_SCHEMA}:${key}`,
          value: val,
        })),
      },
      {
        headers: { Authorization: token, "Content-Type": "application/scim+json" },
        httpsAgent: agent,
      }
    );

    res.json({ message: "Profile updated" });
  } catch (error) {
    console.log("me-extended PATCH error:", error.response?.data || error.message);
    res.status(400).json({ error: "Could not update extended profile for this session" });
  }
});

app.listen(PORT, () =>
  console.log(`🌐 Server running at: http://${HOST}:${PORT}`)
);

identityVerifier.app.listen(identityVerifier.PORT, () =>
  console.log(`🪪  Identity verifier (verifier-portal) running at: http://localhost:${identityVerifier.PORT}`)
);

addressVerifier.app.listen(addressVerifier.PORT, () =>
  console.log(`🏠  Address verifier (vc-verifier-address) running at: http://localhost:${addressVerifier.PORT}`)
);
