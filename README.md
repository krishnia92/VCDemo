# WSO2 Identity Server — Verifiable Credentials Full Demo (Bank Of Asgard)

This folder is a self-contained demo of **Verifiable Credential issuance (OID4VCI)** and
**Verifiable Credential presentation/verification (OID4VP)**, built on **WSO2 Identity
Server**, wrapped in a fictional banking app called **Bank Of Asgard**.

## What's in this folder

| Folder | What it is |
|---|---|
| `wso2is-7.4.0-SNAPSHOT-demo/` | The WSO2 Identity Server instance for this demo. Acts as both the **Credential Issuer** (OID4VCI — issues the Person Identity, Utility, and Bank credentials) and the **Verifier backend** (OID4VP — verifies presented credentials). |
| `bank-of-asgard-main/` | The sample banking app. `app/` is the React frontend customers use; `server/` is its Express backend. `server/verifiers/` contains the two verification portals (see below). |

Inside `bank-of-asgard-main/server/verifiers/`, there are two verification portals, both merged
into the main server so starting the server starts them too:

- **`verifier-portal/`** — the general identity verifier. Handles the "Present Your Digital ID"
  flows (e.g. statement access) using the `personal-data-verification` presentation definition.
  Runs on **port 3001**.
- **`vc-verifier-address/`** — the address verifier. Handles address verification specifically,
  using the `utility-credential-presentation` presentation definition. Runs on **port 3003**.

## Prerequisites

- Node.js + npm
- [ngrok](https://ngrok.com/) (free account is fine)
- **Lissi Wallet app, version 2.11, on your phone.**

### Why ngrok?

WSO2 IS runs **locally** on your machine (`https://localhost:9443`). The wallet app runs on
your **phone**, which needs to reach WSO2 IS's OID4VCI/OID4VP endpoints over the public
internet to issue and verify credentials — it can't reach `localhost` on your laptop directly.
ngrok opens a temporary public HTTPS tunnel to your local WSO2 IS instance so the wallet can
reach it from anywhere.

## Startup steps

Replace `<download_folder>` with wherever you've placed this folder.

### 1. Start WSO2 Identity Server

```bash
cd <download_folder>/wso2is-7.4.0-SNAPSHOT-demo/bin
./wso2server.sh
```

Wait for `WSO2 Carbon started in X sec` before continuing.

### 2. Start an ngrok tunnel to WSO2 IS

```bash
ngrok http https://localhost:9443
```

Copy the `https://<your-hostname>.ngrok-free.app` (or similar) URL it prints.

### 3. Re-sync WSO2 IS to the new ngrok hostname

These are manual edits (no script is included in this repo):

1. Open `wso2is-7.4.0-SNAPSHOT-demo/repository/conf/deployment.toml` and, under `[server]`,
   change `hostname = "..."` to your new ngrok hostname (just the host, no `https://` and no
   trailing slash).
2. Open `wso2is-7.4.0-SNAPSHOT-demo/repository/deployment/server/webapps/console/deployment.config.json`
   and change `"serverOrigin": "https://..."` to `"serverOrigin": "https://<your-new-hostname>"`.
3. Restart WSO2 IS for these changes to take effect.

### 4. Update the app/verifier configs to match your ngrok hostname

- `bank-of-asgard-main/server/verifiers/verifier-portal/.env` → `IS_BASE_URL`
- `bank-of-asgard-main/server/verifiers/vc-verifier-address/.env` → `IS_BASE_URL`
- `bank-of-asgard-main/server/.env` → `ASGARDEO_BASE_URL` and `ASGARDEO_TOKEN_ENDPOINT`

### 5. Reset Jane's profile (do this before every demo run)

In the WSO2 IS Console: **Users → Jane** → edit her profile and set:

1. `AddressVerified` → `false`
2. `LinkedToGovWallet` → `false`
3. `LinkedWalletHolders` → clear/remove its value

These claims drive which features are unlocked in the app (see the demo scenario below), so
resetting them lets you replay the full story from a clean state each time.

### 6. Load Jane's wallet with her starting credentials

Jane's wallet needs to already hold her **Person Identity** and **Utility** credentials before
the demo starts (her **Bank** credential is issued later, mid-demo — don't provision it now).

In the WSO2 IS Console: **Verifiable Credentials → Credential Templates**, for each of:

- `Person Identity Credential`
- `Utility Credential`

— open the template, copy its **Offer URL**, generate a QR code from that URL, and scan it
with Lissi on your phone. It may prompt you to log in before it hands the credential to the
wallet. Do **not** do this for the `Bank ID` template — see the demo scenario below for when
that one comes in.

### 7. Start the app and server

```bash
cd <download_folder>/bank-of-asgard-main/app
npm install
npm start
```

```bash
cd <download_folder>/bank-of-asgard-main/server
npm install
npx nodemon server.js
```

The second command starts the main server **and both verifier portals** together — you don't
need to run them separately. Open the app at `http://localhost:5173`.

## Demo scenario

**Jane** is an existing Bank Of Asgard customer. Before the demo starts, her wallet already
holds a government-issued **Person Identity Credential** and a **Utility Credential** (proof of
address) — loaded in step 6 above.

**Test login:** username `jane`, password `Jane@1234`.

1. Jane logs into the Bank Of Asgard app the normal way (existing username/password).
2. At this point, **Download Statement** and **Verify Address** are both disabled on her
   account — she hasn't linked a government wallet yet.
3. Jane wants to link her government wallet to her bank account. While logged in, she clicks
   **"Link my wallet"** in the app — this triggers an OID4VP presentation from her wallet, and
   on success links her wallet identity to her bank account (`LinkedToGovWallet` flips to
   `true`).
4. With her wallet linked, **Download Statement** and **Verify Address** are now enabled. She
   also now has the option to log out and log back in **using her wallet** instead of her
   password.
5. Jane verifies her address — this presents her Utility Credential through the address
   verifier portal. Once verified, her address becomes visible under her profile in the app.
6. Jane can now download her account statement.
7. Finally, Bank Of Asgard can also issue Jane a
   **Bank credential** (carrying her IBAN) to her wallet — using the app's **Issue Credentials**
   functionality and the `Bank ID` template that was deliberately held back in step 6.

**Possible future improvement:** today, a customer has to already have a password-based account
before they can link a wallet — wallet-linking happens as a post-login action. This could be
tightened with an adaptive authentication script at the identifier-first login step, which would
block password-based login entirely until a government wallet is linked. That's not implemented
in this demo, just worth noting as a natural next iteration.
