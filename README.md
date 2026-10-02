# Bank Of Asgard — Sample Verifiable Credentials App

**Bank Of Asgard** is a fictional banking app that demonstrates **Verifiable Credential
issuance (OID4VCI)** and **Verifiable Credential presentation/verification (OID4VP)** against a
**WSO2 Identity Server** instance.

This repo contains the sample app itself. It does **not** include a WSO2 Identity Server
installation — you'll need one already running and reachable over HTTPS (see Prerequisites).

## What's in this repo

`bank-of-asgard-main/` — `app/` is the React frontend customers use; `server/` is its Express
backend. `server/verifiers/` contains two verification portals, both merged into the main
server so starting the server starts them too:

- **`verifier-portal/`** — the general identity verifier. Handles the "Present Your Digital ID"
  flows (e.g. statement access) using the `personal-data-verification` presentation definition.
  Runs on **port 3001**.
- **`vc-verifier-address/`** — the address verifier. Handles address verification specifically,
  using the `utility-credential-presentation` presentation definition. Runs on **port 3003**.

## Prerequisites

- Node.js + npm
- A running WSO2 Identity Server instance, reachable over HTTPS, configured as the Credential
  Issuer (OID4VCI) and Verifier backend (OID4VP) for this demo — not included in this repo.
- **Lissi Wallet app, version 2.11, on your phone.**

## Configuration

Point these at your WSO2 IS instance's base URL:

- `bank-of-asgard-main/server/verifiers/verifier-portal/.env` → `IS_BASE_URL`
- `bank-of-asgard-main/server/verifiers/vc-verifier-address/.env` → `IS_BASE_URL`
- `bank-of-asgard-main/server/.env` → `ASGARDEO_BASE_URL` and `ASGARDEO_TOKEN_ENDPOINT`

If your WSO2 IS instance's hostname ever changes (e.g. you're tunneling it and the tunnel URL
rotates), update these three files to match.

## Starting the app

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

## One-time demo data setup

These are done in your WSO2 IS Console, against the test user **Jane**. Do the steps in this
section once, in order, before your first demo run.

### 1. Create the test user

**Users → Add User**, and create a user with username `jane` and password `Jane@1234`. This is
the account used throughout the demo (see Demo scenario below).

### 2. Add the custom user attributes

**Attributes → custom schema → Add Attribute**, and add four custom attributes to the user
schema:

- `AddressVerified`
- `LinkedToGovWallet`
- `LinkedWalletHolders`
- `IBAN`

Make sure each one is set to show on the user's profile in the Console (otherwise you won't be
able to see or edit them on Jane in the steps below). `IBAN` in particular needs to exist as a
user attribute *before* it can be added to the `Bank ID` credential template in the next step —
a template can only reference claims that already exist on the schema, it can't create them.

### 3. Create the credential templates

**Verifiable Credentials → Credential Templates → Create**, and set up three templates:

- `Person Identity Credential`
- `Utility Credential`
- `Bank ID`

When you create a template, you pick which of the user attributes from step 2 (plus standard
ones) get carried onto the credential it issues — e.g. `Person Identity Credential` carries
claims like given name, family name and date of birth; `Utility Credential` carries the address
claims; `Bank ID` carries the `IBAN` claim.

### 4. Create the presentation templates

**Verifiable Credentials → Presentation Definitions → Create**, and create two presentation
definitions, matching the IDs the verifier portals are already configured to request:

- `personal-data-verification` — used by `verifier-portal` (port 3001) for the "Present Your
  Digital ID" flow.
- `utility-credential-presentation` — used by `vc-verifier-address` (port 3003) for address
  verification.

These IDs must match exactly what's set as `DEFINITION_ID` in each verifier's `.env` file — if
you name a definition differently, update the corresponding `.env` to match instead.

### Reset Jane's profile (do this before every demo run)

**Users → Jane** → edit her profile and set:

1. `AddressVerified` → `false`
2. `LinkedToGovWallet` → `false`
3. `LinkedWalletHolders` → clear/remove its value

These claims drive which features are unlocked in the app (see the demo scenario below), so
resetting them lets you replay the full story from a clean state each time.

### Pre-load Jane's wallet with her starting credentials (do this before every demo run)

Jane's wallet needs to already hold her **Person Identity** and **Utility** credentials before
the demo starts, to illustrate that she's already a verified government-ID holder with a
utility bill on record (her **Bank** credential is issued later, mid-demo — don't provision it
now).

For each of `Person Identity Credential` and `Utility Credential`:

1. Open the template under **Verifiable Credentials → Credential Templates**.
2. Copy its **Offer URL**.
3. Generate a QR code from that URL (any QR generator works — it's an
   `openid-credential-offer://...` deep link).
4. Scan the QR code with Lissi on your phone. It may prompt you to log in before it hands the
   credential to the wallet.

Do **not** do this for the `Bank ID` template — see the demo scenario below for when that one
comes in.

## Demo scenario

**Jane** is an existing Bank Of Asgard customer. Before the demo starts, her wallet already
holds a government-issued **Person Identity Credential** and a **Utility Credential** (proof of
address) — loaded above.

**Test login:** username `jane`, password `Jane@1234`.

1. Jane logs into the Bank Of Asgard app the normal way (existing username/password).
2. At this point, **Download Statement** and **Verify Address** are both disabled on her
   account — she hasn't linked a government wallet yet.
3. Jane wants to link her government wallet to her bank account. While logged in, she clicks
   **"Link my wallet"** in the app — this triggers an OID4VP presentation from her wallet, and
   on success links her wallet identity to her bank account.
4. With her wallet linked, **Download Statement** and **Verify Address** are now enabled. She
   also now has the option to log out and log back in **using her wallet** instead of her
   password.
5. Jane verifies her address — this presents her Utility Credential through the address
   verifier portal. Once verified, her address becomes visible under her profile in the app.
6. Jane can now download her account statement.
7. Finally, Bank Of Asgard can also issue Jane a
   **Bank credential** (carrying her IBAN) to her wallet — using the app's **Issue Credentials**
   functionality and the `Bank ID` template that was deliberately held back earlier.

**Possible future improvement:** today, a customer can log in using their wallet credentials
even if they haven't linked their government wallet to their bank account yet — wallet-based
login isn't currently gated on gov wallet linked status. This could be tightened with identifier-first login
plus an adaptive authentication script, so that if the account isn't linked, wallet-based login
is blocked entirely. That's not implemented in this demo, just worth noting as a natural next
iteration.
