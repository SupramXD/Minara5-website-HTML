/* eslint-disable max-len, camelcase, require-jsdoc, valid-jsdoc */
const {setGlobalOptions} = require("firebase-functions");
const {onCall, HttpsError, onRequest} = require("firebase-functions/v2/https");
const {onDocumentCreated, onDocumentDeleted} = require("firebase-functions/v2/firestore");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");

// Initialize Firebase Admin
const fs = require("fs");
const path = require("path");

admin.initializeApp();
const firestore = admin.firestore();

// Product documents are built from client payloads where optional fields (e.g. a
// customisation block's `price`) can be `undefined`. Without this the Admin SDK
// rejects the whole write with "Cannot use "undefined" as a Firestore value",
// which the admin panel could only report as a masked "internal" error.
firestore.settings({ignoreUndefinedProperties: true});

// Global Cloud Function configurations
setGlobalOptions({maxInstances: 10});

// Access secrets configured via Firebase Secret Manager
const githubTokenSecret = defineSecret("GITHUB_TOKEN");
const courierGuySecret = defineSecret("COURIER_GUY_API_KEY");
// Yoco Checkout API keys (test keys today, swap the same secret names for the
// live keys once the domain is verified in the Yoco App).
const yocoSecretKey = defineSecret("YOCO_TEST_SECRET_KEY");
// Signing secret returned once by POST https://payments.yoco.com/api/webhooks.
const yocoWebhookSecret = defineSecret("YOCO_WEBHOOK_SECRET");

// Ozow Payments API credentials (instant EFT). A Payin site has three values,
// all found in the Ozow Dashboard (dash.ozow.com) under Merchant Details and
// the site itself. The secret names describe the role each value plays:
//   * OZOW_API_KEY        - the site's PRIVATE key. Never transmitted: it is
//     appended when signing the `hashCheck` of every payment request, and again
//     when verifying the `Hash` of every transaction notification.
//   * OZOW_API_KEY_NORMAL - the site's API key. Sent verbatim in the `ApiKey`
//     header of every request to Ozow.
//   * OZOW_SITE_CODE      - the site code (format AAA-AAA-AAA).
const ozowPrivateKeySecret = defineSecret("OZOW_API_KEY");
const ozowApiKeySecret = defineSecret("OZOW_API_KEY_NORMAL");
const ozowSiteCodeSecret = defineSecret("OZOW_SITE_CODE");

/**
 * Utility function to retrieve active Courier Guy Secret Key
 */
function getCourierGuySecretKey() {
  let key = "";
  try {
    key = courierGuySecret.value();
  } catch (e) {
    // Ignore error if not initialized
  }
  if (!key) {
    key = process.env.COURIER_GUY_API_KEY || "";
  }
  return key;
}

/**
 * Utility functions for the Yoco Checkout API configuration.
 * Docs: https://yoco.docs.buildwithfern.com/docs/checkout-api
 */
const YOCO_CHECKOUTS_URL = "https://payments.yoco.com/api/checkouts";
const YOCO_PUBLIC_KEY_DEFAULT = "pk_test_2dff1e63rrv6qKe6af44";
const WEBSITE_ORIGIN = "https://studioextrait.co.za";
// Base URL of this functions deployment, used for the URLs Ozow calls back on
// (the transaction notification / webhook). Overridable for other projects.
const FUNCTIONS_BASE_URL = process.env.FUNCTIONS_BASE_URL ||
  "https://us-central1-minara5.cloudfunctions.net";

/**
 * Public (publishable) key of the Yoco integration. Safe to expose to the
 * browser - it is used for display/debugging only, never to authorise a charge.
 */
function getYocoPublicKey() {
  return process.env.YOCO_PUBLIC_KEY || YOCO_PUBLIC_KEY_DEFAULT;
}

/**
 * Yoco Checkout API secret key (test or live). Never returned to the client:
 * checkout sessions are always created here on the server, as Yoco requires.
 */
function getYocoSecretKey() {
  let key = "";
  try {
    key = yocoSecretKey.value();
  } catch (e) {
    // Ignore error if the secret is not initialised (e.g. emulator runs).
  }
  if (!key) {
    key = process.env.YOCO_TEST_SECRET_KEY || process.env.YOCO_SECRET_KEY || "";
  }
  return String(key).trim();
}

/**
 * Webhook signing secret (format `whsec_...`). Optional at runtime so a
 * missing secret can never silently break order fulfilment.
 */
function getYocoWebhookSecret() {
  let secret = "";
  try {
    secret = yocoWebhookSecret.value();
  } catch (e) {
    // Ignore error if the secret is not initialised.
  }
  if (!secret) {
    secret = process.env.YOCO_WEBHOOK_SECRET || "";
  }
  return String(secret).trim();
}

/**
 * Utility functions for the Ozow Payments API (instant EFT) configuration.
 * Docs: https://hub.ozow.com/api-reference/payments-api
 *       https://hub.ozow.com/integration-methods/apis/deprecated-integrations/redirect-to-ozow
 */
const OZOW_PRODUCTION_URL = "https://api.ozow.com";

/**
 * Ozow private key. Signs our payment requests and verifies their
 * transaction notifications. Never returned to a client.
 */
function getOzowPrivateKey() {
  let key = "";
  try {
    key = ozowPrivateKeySecret.value();
  } catch (e) {
    // Ignore error if the secret is not initialised (e.g. emulator runs).
  }
  if (!key) {
    key = process.env.OZOW_API_KEY || process.env.OZOW_PRIVATE_KEY || "";
  }
  return String(key).trim();
}

/**
 * Ozow API key (public to the site). Sent in the `ApiKey` HTTP header.
 */
function getOzowApiKey() {
  let key = "";
  try {
    key = ozowApiKeySecret.value();
  } catch (e) {
    // Ignore error if the secret is not initialised.
  }
  if (!key) {
    key = process.env.OZOW_API_KEY_NORMAL || "";
  }
  return String(key).trim();
}

/**
 * Ozow site code, the public identifier of the merchant site.
 */
function getOzowSiteCode() {
  let code = "";
  try {
    code = ozowSiteCodeSecret.value();
  } catch (e) {
    // Ignore error if the secret is not initialised.
  }
  if (!code) {
    code = process.env.OZOW_SITE_CODE || "";
  }
  return String(code).trim();
}

/**
 * Base URL of the Ozow environment. Point `OZOW_API_BASE_URL` at
 * `https://stagingapi.ozow.com` to run against staging credentials.
 */
function getOzowBaseUrl() {
  const base = String(process.env.OZOW_API_BASE_URL || OZOW_PRODUCTION_URL)
      .trim().replace(/\/+$/, "");
  return base || OZOW_PRODUCTION_URL;
}

/**
 * `IsTest` flag of the payin request. Ozow test transactions settle into the
 * merchant bank account, so this stays false unless the whole integration is
 * pointed at the staging environment (`OZOW_IS_TEST=true`).
 */
function getOzowIsTest() {
  return String(process.env.OZOW_IS_TEST || "false").trim().toLowerCase() === "true";
}

/**
 * SHA512 hex digest - the only hash Ozow uses.
 * @param {string} value String to hash.
 * @return {string} Lowercase hexadecimal digest.
 */
function sha512Hex(value) {
  return crypto.createHash("sha512").update(String(value), "utf8").digest("hex");
}

/**
 * Builds the SHA512 `hashCheck` of a payin request: the values in the exact
 * order Ozow documents them, unused fields skipped entirely (never sent as
 * empty strings), the private key appended, the whole string lowercased and
 * hashed. The caller must already format the amount to two decimals.
 * @param {Array<{name: string, value: (*|null)}>} fields Ordered request fields.
 * @param {string} privateKey Ozow private key.
 * @return {string} Lowercase SHA512 hex digest.
 */
function buildOzowRequestHash(fields, privateKey) {
  const concatenated = fields
      .filter((entry) => entry && entry.value !== undefined && entry.value !== null &&
        String(entry.value) !== "")
      .map((entry) => String(entry.value))
      .join("");
  return sha512Hex((concatenated + privateKey).toLowerCase());
}

/**
 * Transaction notification fields, in Ozow's documented concatenation order.
 */
const OZOW_NOTIFICATION_HASH_FIELDS = [
  "SiteCode",
  "TransactionId",
  "TransactionReference",
  "Amount",
  "Status",
  "Optional1",
  "Optional2",
  "Optional3",
  "Optional4",
  "Optional5",
  "CurrencyCode",
  "IsTest",
  "StatusMessage",
];

/**
 * Verifies the `Hash` of a transaction notification by recomputing it with the
 * private key. The notification is an unauthenticated POST to a public URL, so
 * without this check anyone could claim any order is paid.
 * @param {object} body Parsed notification body (string values).
 * @param {string} privateKey Ozow private key.
 * @return {{verified: boolean, reason: string}} Outcome of the check.
 */
function verifyOzowNotificationHash(body, privateKey) {
  if (!privateKey) {
    return {verified: false, reason: "not_configured"};
  }
  const provided = String((body && body.Hash) || "").trim().toLowerCase();
  if (!provided) {
    return {verified: false, reason: "missing_hash"};
  }

  const values = OZOW_NOTIFICATION_HASH_FIELDS
      .map((field) => {
        const raw = body[field];
        if (raw === undefined || raw === null) {
          return "";
        }
        // Ozow's reference implementation normalises the amount to two decimals
        // before hashing ("100.00", never "100"), so match it exactly. A value
        // that is not a number is hashed verbatim rather than as "NaN".
        if (field === "Amount") {
          const amount = Number(raw);
          return Number.isFinite(amount) ? amount.toFixed(2) : String(raw);
        }
        return String(raw);
      })
      .filter((value) => value !== "");
  const expected = sha512Hex((values.join("") + privateKey).toLowerCase());

  // Constant-time compare: a plain === leaks the hash one character at a time.
  const sent = Buffer.from(provided, "utf8");
  const ours = Buffer.from(expected, "utf8");
  const ok = sent.length === ours.length && crypto.timingSafeEqual(sent, ours);
  return {verified: ok, reason: ok ? "ok" : "mismatch"};
}

/**
 * Ozow `Status` values that mean the money has been received.
 */
const OZOW_PAID_STATUSES = ["complete"];

/**
 * Ozow `Status` values that mean the payment will never complete. Anything else
 * (`Pending`, `Created`, `PendingInvestigation`, ...) stays pending.
 */
const OZOW_FAILED_STATUSES = ["cancelled", "abandoned", "error", "voided"];

/**
 * Verifies the `webhook-signature` header of an incoming Yoco event.
 * Signed content = "<webhook-id>.<webhook-timestamp>.<raw body>", HMAC-SHA256
 * with the base64-decoded `whsec_` secret, base64 encoded.
 * @param {object} headers Raw HTTP headers of the request.
 * @param {string} rawBody Exact request body as received.
 * @return {{configured: boolean, verified: boolean, reason: string}}
 */
function verifyYocoWebhookSignature(headers, rawBody) {
  const secret = getYocoWebhookSecret();
  const signatureHeader = headers["webhook-signature"] || "";
  const eventId = headers["webhook-id"] || "";
  const timestamp = headers["webhook-timestamp"] || "";

  if (!secret || !secret.startsWith("whsec_")) {
    return {configured: false, verified: false, reason: "not_configured"};
  }
  if (!signatureHeader || !eventId || !timestamp) {
    return {configured: true, verified: false, reason: "missing_headers"};
  }
  if (!rawBody) {
    // The raw body is required to rebuild the signature - never fail an event
    // because of a framework quirk, log it instead.
    return {configured: true, verified: false, reason: "no_raw_body"};
  }

  const secretBytes = Buffer.from(secret.split("_")[1], "base64");
  const expected = crypto.
      createHmac("sha256", secretBytes).
      update(`${eventId}.${timestamp}.${rawBody}`).
      digest("base64");

  const provided = signatureHeader.
      split(" ").
      map((part) => part.split(",")[1]).
      filter(Boolean);

  const expectedBuffer = Buffer.from(expected);
  const verified = provided.some((sig) => {
    const sigBuffer = Buffer.from(sig);
    return sigBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  });

  return {
    configured: true,
    verified,
    reason: verified ? "ok" : "mismatch",
  };
}

const OWNER = "SupramXD";
const REPO = "Minara5-website-HTML";

/**
 * Utility to make HTTP Requests to GitHub Contents API
 */
async function gitHubRequest(filePath, options = {}, token) {
  if (process.env.FUNCTIONS_EMULATOR === "true" &&
      options.method === "DELETE") {
    try {
      const absolutePath = path.join(__dirname, "..", filePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        logger.info(`Locally deleted ${filePath} in emulator environment.`);
      }
    } catch (fsErr) {
      logger.error(`Failed to delete local file ${filePath} in emulator:`,
          fsErr);
    }
  }

  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Firebase-Cloud-Function",
    ...options.headers,
  };

  const response = await fetch(url, {...options, headers});

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error("GitHub API error on " + url + ": Status " +
      response.status + " - " + text);
  }

  return response;
}

/**
 * Fetch a file from GitHub, returning its content and sha
 */
async function getFileShaAndContent(path, token) {
  const res = await gitHubRequest(path, {method: "GET"}, token);
  if (res.status === 404) {
    return {sha: null, content: null, base64: null};
  }
  const data = await res.json();
  const rawBase64 = data.content ? data.content.replace(/\s/g, "") : "";
  const decodedContent = data.content ? Buffer.from(rawBase64, "base64").toString("utf-8") : null;
  return {sha: data.sha, content: decodedContent, base64: rawBase64};
}

/**
 * Write a file directly to the GitHub repository
 */
async function writeFileToGitHub(filePath, contentBase64, commitMessage,
    sha, token) {
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    try {
      const absolutePath = path.join(__dirname, "..", filePath);
      const fileContent = Buffer.from(contentBase64, "base64");
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
      }
      fs.writeFileSync(absolutePath, fileContent);
      logger.info(`Locally updated ${filePath} in emulator environment.`);
    } catch (fsErr) {
      logger.error(`Failed to update local file ${filePath} in emulator:`,
          fsErr);
    }
  }

  const body = {
    message: commitMessage,
    content: contentBase64,
  };
  if (sha) {
    body.sha = sha;
  }

  const res = await gitHubRequest(filePath, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body),
  }, token);

  return res.json();
}

/**
 * Cloud Function to synchronize product catalog and hero settings to GitHub static files
 */
exports.syncToGithub = onCall({secrets: [githubTokenSecret]}, async (request) => {
  // 1. Authenticate user and verify Admin role
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }

  const uid = request.auth.uid;
  const userDocRef = firestore.collection("users").doc(uid);
  const userSnap = await userDocRef.get();

  if (!userSnap.exists || userSnap.data().role !== "Admin") {
    throw new HttpsError("permission-denied", "Unauthorized. Only Admins can modify settings.");
  }

  const {action, payload} = request.data;

  let token = "";
  try {
    token = githubTokenSecret.value();
  } catch (secretErr) {
    logger.error("GITHUB_TOKEN secret could not be read:", secretErr);
  }

  if (!token) {
    throw new HttpsError("failed-precondition", "GitHub Token secret is missing or empty.");
  }

  try {
    if (action === "saveProduct") {
      const {id, nameShort, name, price, retailPrice, stock, image, image_thumb, galleryImages, description, status, flair, flairText, flairColor, invisibleFlair, standardBottleImg, masculinePremiumBottleImg, femininePremiumBottleImg, customisations, sizes, isBundle, bundleSize, sortOrder, scentProfile} = payload;

      const {sha: jsonSha, content: jsonContent} = await getFileShaAndContent("products.json", token);
      let productsList = [];
      if (jsonContent) {
        try {
          productsList = JSON.parse(jsonContent);
        } catch (e) {
          logger.error("Failed to parse products.json from GitHub:", e);
        }
      }

      let mainImagePath = image;
      let thumbImagePath = image_thumb;

      // Extract and upload main image if base64 encoded
      if (image && image.startsWith("data:image/")) {
        const parts = image.split(";base64,");
        const mimeType = parts[0].split(":")[1];
        const base64Data = parts[1];
        const ext = mimeType.split("/")[1] || "webp";

        mainImagePath = `images/products/${id}.${ext}`;
        const {sha: imageSha} = await getFileShaAndContent(mainImagePath, token);
        await writeFileToGitHub(mainImagePath, base64Data, `Add/Update main image for product ${id}`, imageSha, token);
      }

      // Extract and upload thumbnail if base64 encoded
      if (image_thumb && image_thumb.startsWith("data:image/")) {
        const parts = image_thumb.split(";base64,");
        const mimeType = parts[0].split(":")[1];
        const base64Data = parts[1];
        const ext = mimeType.split("/")[1] || "webp";

        thumbImagePath = `images/products/${id}_thumb.${ext}`;
        const {sha: thumbSha} = await getFileShaAndContent(thumbImagePath, token);
        await writeFileToGitHub(thumbImagePath, base64Data, `Add/Update thumbnail image for product ${id}`, thumbSha, token);
      }

      // Extract and upload standard bottle image if base64 encoded
      let standardBottleImgPath = standardBottleImg || "";
      if (standardBottleImg && standardBottleImg.startsWith("data:image/")) {
        const parts = standardBottleImg.split(";base64,");
        const mimeType = parts[0].split(":")[1];
        const base64Data = parts[1];
        const ext = mimeType.split("/")[1] || "webp";

        standardBottleImgPath = `images/products/${id}_std.${ext}`;
        const {sha: stdSha} = await getFileShaAndContent(standardBottleImgPath, token);
        await writeFileToGitHub(standardBottleImgPath, base64Data, `Add/Update standard bottle image for product ${id}`, stdSha, token);
      }

      // Extract and upload masculine premium bottle image if base64 encoded
      let masculinePremiumBottleImgPath = masculinePremiumBottleImg || "";
      if (masculinePremiumBottleImg && masculinePremiumBottleImg.startsWith("data:image/")) {
        const parts = masculinePremiumBottleImg.split(";base64,");
        const mimeType = parts[0].split(":")[1];
        const base64Data = parts[1];
        const ext = mimeType.split("/")[1] || "webp";

        masculinePremiumBottleImgPath = `images/products/${id}_premium.${ext}`;
        const {sha: premSha} = await getFileShaAndContent(masculinePremiumBottleImgPath, token);
        await writeFileToGitHub(masculinePremiumBottleImgPath, base64Data, `Add/Update masculine premium bottle image for product ${id}`, premSha, token);
      }

      // Extract and upload feminine premium bottle image if base64 encoded
      let femininePremiumBottleImgPath = femininePremiumBottleImg || "";
      if (femininePremiumBottleImg && femininePremiumBottleImg.startsWith("data:image/")) {
        const parts = femininePremiumBottleImg.split(";base64,");
        const mimeType = parts[0].split(":")[1];
        const base64Data = parts[1];
        const ext = mimeType.split("/")[1] || "webp";

        femininePremiumBottleImgPath = `images/products/${id}_fem_premium.${ext}`;
        const {sha: femPremSha} = await getFileShaAndContent(femininePremiumBottleImgPath, token);
        await writeFileToGitHub(femininePremiumBottleImgPath, base64Data, `Add/Update feminine premium bottle image for product ${id}`, femPremSha, token);
      }

      const processedCustomisations = [];
      if (Array.isArray(customisations) && customisations.length > 0) {
        for (let idx = 0; idx < customisations.length; idx++) {
          const block = customisations[idx];
          let blockImg = block.image || "";
          let blockThumb = block.image_thumb || "";
          const base64ToUpload = (blockImg && blockImg.startsWith("data:image/")) ? blockImg : (block.image_data && block.image_data.startsWith("data:image/") ? block.image_data : "");

          // Upload main image for customisation block if base64
          if (base64ToUpload) {
            const parts = base64ToUpload.split(";base64,");
            const mimeType = parts[0].split(":")[1];
            const base64Data = parts[1];
            const ext = mimeType.split("/")[1] || "webp";

            const custImagePath = `images/products/${id}_cust_${idx}.${ext}`;
            const {sha: custSha} = await getFileShaAndContent(custImagePath, token);
            await writeFileToGitHub(custImagePath, base64Data, `Add/Update customisation image ${idx} for product ${id}`, custSha, token);
            blockImg = custImagePath;
            blockThumb = custImagePath;
          }

          const rawData = (block.image && block.image.startsWith("data:image/")) ? block.image : (block.image_data || "");

          processedCustomisations.push({
            label: block.label || `OPTION ${idx + 1}`,
            size: block.size || "",
            image: blockImg,
            image_thumb: blockThumb || blockImg,
            image_data: rawData,
            stock: (block.stock !== undefined && block.stock !== null && !isNaN(block.stock)) ? Number(block.stock) : 10,
            price: (block.price !== undefined && block.price !== null && block.price !== "") ? Number(block.price) : undefined,
            priceExtra: (block.priceExtra !== undefined && block.priceExtra !== null) ? Number(block.priceExtra) : undefined,
          });
        }
      }

      const updatedProduct = {
        id,
        nameShort: nameShort || "",
        name,
        price: Number(price),
        retailPrice: retailPrice !== null && retailPrice !== undefined ?
          retailPrice : null,
        stock: Number(stock),
        image: mainImagePath,
        galleryImages: galleryImages || (mainImagePath ? mainImagePath.split(",").map((s) => s.trim()) : []),
        image_thumb: thumbImagePath || "",
        description: description || "",
        status: status || "Active",
        flair: flair || "",
        flairText: flairText || "",
        flairColor: flairColor || "",
        invisibleFlair: invisibleFlair || "",
        standardBottleImg: standardBottleImgPath || "",
        masculinePremiumBottleImg: masculinePremiumBottleImgPath || "",
        femininePremiumBottleImg: femininePremiumBottleImgPath || "",
        customisations: processedCustomisations,
        sizes: Array.isArray(sizes) ? sizes : ["50ml", "100ml"],
        isBundle: isBundle !== undefined ? !!isBundle : false,
        bundleSize: bundleSize !== undefined ? Number(bundleSize) : 0,
        sortOrder: sortOrder !== undefined && sortOrder !== null ?
          Number(sortOrder) : null,
        scentProfile: scentProfile !== undefined ? scentProfile : null,
      };

      if (updatedProduct.status === "Active" &&
          updatedProduct.sortOrder !== null) {
        const otherActive = productsList
            .filter((p) => p.id !== id && p.status === "Active")
            .sort((a, b) => {
              const valA = a.sortOrder !== undefined && a.sortOrder !== null ?
              Number(a.sortOrder) : Infinity;
              const valB = b.sortOrder !== undefined && b.sortOrder !== null ?
              Number(b.sortOrder) : Infinity;
              if (valA !== valB) return valA - valB;
              return (a.name || "").localeCompare(b.name || "");
            });

        const targetIndex = Math.max(0, Math.min(updatedProduct.sortOrder - 1,
            otherActive.length));
        otherActive.splice(targetIndex, 0, updatedProduct);

        otherActive.forEach((p, idx) => {
          p.sortOrder = idx + 1;
        });

        const inactiveProds = productsList.filter((p) => p.id !== id &&
          p.status !== "Active");
        inactiveProds.forEach((p) => {
          p.sortOrder = null;
        });
        productsList = [...otherActive, ...inactiveProds];

        const batch = firestore.batch();
        for (const p of productsList) {
          const docRef = firestore.collection("products").doc(p.id);
          if (p.id === id) {
            batch.set(docRef, {
              nameShort: nameShort || "",
              name,
              price: Number(price),
              retailPrice: retailPrice !== null && retailPrice !== undefined ?
                retailPrice : null,
              stock: Number(stock),
              image: mainImagePath,
              galleryImages: galleryImages || (mainImagePath ? mainImagePath.split(",").map((s) => s.trim()) : []),
              image_thumb: thumbImagePath || "",
              description: description || "",
              status: status || "Active",
              flair: flair || "",
              flairText: flairText || "",
              flairColor: flairColor || "",
              invisibleFlair: invisibleFlair || "",
              standardBottleImg: standardBottleImg || "",
              masculinePremiumBottleImg: masculinePremiumBottleImg || "",
              femininePremiumBottleImg: femininePremiumBottleImg || "",
              customisations: processedCustomisations,
              sizes: sizes || ["50ml", "100ml"],
              isBundle: isBundle !== undefined ? !!isBundle : false,
              bundleSize: bundleSize !== undefined ? Number(bundleSize) : 0,
              sortOrder: p.sortOrder,
              scentProfile: scentProfile !== undefined ? scentProfile : null,
              timestamp: new Date().toISOString(),
            });
          } else {
            // set+merge (instead of update) so a product that only exists in
            // products.json (not in Firestore) can never abort the whole save.
            batch.set(docRef, {sortOrder: p.sortOrder}, {merge: true});
          }
        }
        await batch.commit();
      } else {
        const existingIdx = productsList.findIndex((p) => p.id === id);
        if (existingIdx > -1) {
          productsList[existingIdx] = updatedProduct;
        } else {
          productsList.push(updatedProduct);
        }
      }

      const updatedJsonStr = JSON.stringify(productsList, null, 2);
      const updatedJsonBase64 = Buffer.from(updatedJsonStr, "utf-8")
          .toString("base64");

      await writeFileToGitHub("products.json", updatedJsonBase64,
          `Update product ${name} (${id})`, jsonSha, token);

      return {success: true, message: `Product ${name} synced to GitHub.`};
    } else if (action === "deleteProduct") {
      const {id} = payload;

      const {sha: jsonSha, content: jsonContent} = await getFileShaAndContent("products.json", token);
      let productsList = [];
      if (jsonContent) {
        try {
          productsList = JSON.parse(jsonContent);
        } catch (e) {
          logger.warn("Failed to parse products.json", e);
        }
      }

      const newProductsList = productsList.filter((p) => p.id !== id);

      const updatedJsonStr = JSON.stringify(newProductsList, null, 2);
      const updatedJsonBase64 = Buffer.from(updatedJsonStr, "utf-8").toString("base64");

      await writeFileToGitHub("products.json", updatedJsonBase64, `Delete product ${id}`, jsonSha, token);

      // Clean up images from repo on deletion
      try {
        const mainImagePath = `images/products/${id}.webp`;
        const {sha: mainSha} = await getFileShaAndContent(mainImagePath, token);
        if (mainSha) {
          await gitHubRequest(mainImagePath, {
            method: "DELETE",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
              message: `Delete main image for product ${id}`,
              sha: mainSha,
            }),
          }, token);
        }
      } catch (err) {
        logger.error(`Could not delete main image file for ${id}`, err);
      }

      try {
        const thumbImagePath = `images/products/${id}_thumb.webp`;
        const {sha: thumbSha} = await getFileShaAndContent(thumbImagePath, token);
        if (thumbSha) {
          await gitHubRequest(thumbImagePath, {
            method: "DELETE",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
              message: `Delete thumb image for product ${id}`,
              sha: thumbSha,
            }),
          }, token);
        }
      } catch (err) {
        logger.error(`Could not delete thumbnail image file for ${id}`, err);
      }

      return {success: true, message: `Product ${id} deleted and synced.`};
    } else if (action === "adjustStock") {
      const {id, newStock} = payload;

      const {sha: jsonSha, content: jsonContent} = await getFileShaAndContent("products.json", token);
      let productsList = [];
      if (jsonContent) {
        try {
          productsList = JSON.parse(jsonContent);
        } catch (e) {
          logger.warn("Failed to parse products.json", e);
        }
      }

      const product = productsList.find((p) => p.id === id);
      if (product) {
        product.stock = Number(newStock);
        const updatedJsonStr = JSON.stringify(productsList, null, 2);
        const updatedJsonBase64 = Buffer.from(updatedJsonStr, "utf-8").toString("base64");
        await writeFileToGitHub("products.json", updatedJsonBase64, `Adjust stock for product ${id} to ${newStock}`, jsonSha, token);
        return {success: true, message: `Product ${id} stock synced.`};
      } else {
        throw new HttpsError("not-found", `Product ${id} not found in products.json`);
      }
    } else if (action === "saveHero") {
      const settingsData = payload;
      const {leftImage, rightImage, mobileImage, leftImageName, rightImageName, mobileImageName} = settingsData;

      if (leftImage && leftImage.startsWith("data:")) {
        const parts = leftImage.split(";base64,");
        const mimeType = parts[0].includes(":") ? parts[0].split(":")[1] : "image/webp";
        const base64Data = parts[1];
        let ext = "webp";
        if (leftImageName) {
          const extMatch = leftImageName.match(/\.([a-zA-Z0-9]+)$/);
          if (extMatch) ext = extMatch[1].toLowerCase();
        } else {
          ext = mimeType.split("/")[1] || "webp";
        }
        if (ext === "jpeg") ext = "jpg";

        const path = `images/hero/left.${ext}`;
        const {sha: imgSha} = await getFileShaAndContent(path, token);
        await writeFileToGitHub(path, base64Data, "Update left hero image", imgSha, token);
        settingsData.leftImage = path;
      }

      if (rightImage && rightImage.startsWith("data:")) {
        const parts = rightImage.split(";base64,");
        const mimeType = parts[0].includes(":") ? parts[0].split(":")[1] : "image/webp";
        const base64Data = parts[1];
        let ext = "webp";
        if (rightImageName) {
          const extMatch = rightImageName.match(/\.([a-zA-Z0-9]+)$/);
          if (extMatch) ext = extMatch[1].toLowerCase();
        } else {
          ext = mimeType.split("/")[1] || "webp";
        }
        if (ext === "jpeg") ext = "jpg";

        const path = `images/hero/right.${ext}`;
        const {sha: imgSha} = await getFileShaAndContent(path, token);
        await writeFileToGitHub(path, base64Data, "Update right hero image", imgSha, token);
        settingsData.rightImage = path;
      }

      if (mobileImage && mobileImage.startsWith("data:")) {
        const parts = mobileImage.split(";base64,");
        const mimeType = parts[0].includes(":") ? parts[0].split(":")[1] : "image/webp";
        const base64Data = parts[1];
        let ext = "webp";
        if (mobileImageName) {
          const extMatch = mobileImageName.match(/\.([a-zA-Z0-9]+)$/);
          if (extMatch) ext = extMatch[1].toLowerCase();
        } else {
          ext = mimeType.split("/")[1] || "webp";
        }
        if (ext === "jpeg") ext = "jpg";

        const path = `images/hero/mobile.${ext}`;
        const {sha: imgSha} = await getFileShaAndContent(path, token);
        await writeFileToGitHub(path, base64Data, "Update mobile hero image", imgSha, token);
        settingsData.mobileImage = path;
      }

      delete settingsData.leftImageName;
      delete settingsData.rightImageName;
      delete settingsData.mobileImageName;

      const {sha: settingsSha} = await getFileShaAndContent("hero_settings.json", token);

      const updatedJsonStr = JSON.stringify(settingsData, null, 2);
      const updatedJsonBase64 = Buffer.from(updatedJsonStr, "utf-8").toString("base64");

      await writeFileToGitHub("hero_settings.json", updatedJsonBase64, "Update hero section settings", settingsSha, token);

      return {success: true, message: "Hero settings synced to GitHub."};
    } else if (action === "saveSecondHero") {
      const settingsData = payload;
      const {leftImage, rightImage, mobileImage, leftImageName, rightImageName, mobileImageName} = settingsData;

      if (leftImage && leftImage.startsWith("data:")) {
        const parts = leftImage.split(";base64,");
        const mimeType = parts[0].includes(":") ? parts[0].split(":")[1] : "image/webp";
        const base64Data = parts[1];
        let ext = "webp";
        if (leftImageName) {
          const extMatch = leftImageName.match(/\.([a-zA-Z0-9]+)$/);
          if (extMatch) ext = extMatch[1].toLowerCase();
        } else {
          ext = mimeType.split("/")[1] || "webp";
        }
        if (ext === "jpeg") ext = "jpg";

        const path = `images/second-hero/left.${ext}`;
        const {sha: imgSha} = await getFileShaAndContent(path, token);
        await writeFileToGitHub(path, base64Data, "Update left second hero image", imgSha, token);
        settingsData.leftImage = path;
      }

      if (rightImage && rightImage.startsWith("data:")) {
        const parts = rightImage.split(";base64,");
        const mimeType = parts[0].includes(":") ? parts[0].split(":")[1] : "image/webp";
        const base64Data = parts[1];
        let ext = "webp";
        if (rightImageName) {
          const extMatch = rightImageName.match(/\.([a-zA-Z0-9]+)$/);
          if (extMatch) ext = extMatch[1].toLowerCase();
        } else {
          ext = mimeType.split("/")[1] || "webp";
        }
        if (ext === "jpeg") ext = "jpg";

        const path = `images/second-hero/right.${ext}`;
        const {sha: imgSha} = await getFileShaAndContent(path, token);
        await writeFileToGitHub(path, base64Data, "Update right second hero image", imgSha, token);
        settingsData.rightImage = path;
      }

      if (mobileImage && mobileImage.startsWith("data:")) {
        const parts = mobileImage.split(";base64,");
        const mimeType = parts[0].includes(":") ? parts[0].split(":")[1] : "image/webp";
        const base64Data = parts[1];
        let ext = "webp";
        if (mobileImageName) {
          const extMatch = mobileImageName.match(/\.([a-zA-Z0-9]+)$/);
          if (extMatch) ext = extMatch[1].toLowerCase();
        } else {
          ext = mimeType.split("/")[1] || "webp";
        }
        if (ext === "jpeg") ext = "jpg";

        const path = `images/second-hero/mobile.${ext}`;
        const {sha: imgSha} = await getFileShaAndContent(path, token);
        await writeFileToGitHub(path, base64Data, "Update mobile second hero image", imgSha, token);
        settingsData.mobileImage = path;
      }

      delete settingsData.leftImageName;
      delete settingsData.rightImageName;
      delete settingsData.mobileImageName;

      const {sha: settingsSha} = await getFileShaAndContent("second_hero_settings.json", token);

      const updatedJsonStr = JSON.stringify(settingsData, null, 2);
      const updatedJsonBase64 = Buffer.from(updatedJsonStr, "utf-8").toString("base64");

      await writeFileToGitHub("second_hero_settings.json", updatedJsonBase64, "Update second hero section settings", settingsSha, token);

      return {success: true, message: "Second hero settings synced to GitHub."};
    } else if (action === "listImages") {
      const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/images`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github.v3+json",
          "User-Agent": "Firebase-Cloud-Function",
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to list images: ${res.status}`);
      }
      const data = await res.json();
      const images = data.map((item) => ({path: item.path, sha: item.sha}));
      return {success: true, images};
    } else if (action === "renameImages") {
      const renameList = payload;
      if (!Array.isArray(renameList)) {
        throw new HttpsError("invalid-argument", "payload must be an array of rename objects");
      }
      const jsonFiles = ["products.json", "hero_settings.json", "second_hero_settings.json"];
      const jsonContents = {};
      for (const jf of jsonFiles) {
        const {sha, content} = await getFileShaAndContent(jf, token);
        jsonContents[jf] = {sha, content: content ? JSON.parse(content) : null};
      }
      for (const {oldPath, newPath} of renameList) {
        const {sha: oldSha, base64: oldBase64} = await getFileShaAndContent(oldPath, token);
        if (!oldSha) continue;
        await writeFileToGitHub(newPath, oldBase64, `Rename ${oldPath} to ${newPath}`, null, token);
        await gitHubRequest(oldPath, {
          method: "DELETE",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({message: `Delete old image ${oldPath}`, sha: oldSha}),
        }, token);
        for (const jf of jsonFiles) {
          const obj = jsonContents[jf].content;
          if (obj) {
            const jsonStr = JSON.stringify(obj);
            if (jsonStr.includes(oldPath)) {
              const updatedStr = jsonStr.split(oldPath).join(newPath);
              jsonContents[jf].content = JSON.parse(updatedStr);
            }
          }
        }
      }
      for (const jf of jsonFiles) {
        const {sha} = jsonContents[jf];
        const updatedObj = jsonContents[jf].content;
        if (updatedObj) {
          const updatedJsonStr = JSON.stringify(updatedObj, null, 2);
          const updatedBase64 = Buffer.from(updatedJsonStr, "utf-8").toString("base64");
          await writeFileToGitHub(jf, updatedBase64, "Update references after rename", sha, token);
        }
      }
      return {success: true, message: "Rename operation completed"};
    } else if (action === "syncReviews") {
      const reviewsList = payload;
      if (!Array.isArray(reviewsList)) {
        throw new HttpsError("invalid-argument", "payload must be an array of reviews");
      }
      const {sha: jsonSha} = await getFileShaAndContent("reviews.json", token);
      const updatedJsonStr = JSON.stringify(reviewsList, null, 2);
      const updatedJsonBase64 = Buffer.from(updatedJsonStr, "utf-8").toString("base64");
      await writeFileToGitHub("reviews.json", updatedJsonBase64, "Sync reviews from Firestore", jsonSha, token);
      return {success: true, message: "Reviews synced to GitHub."};
    } else if (action === "saveCustomText") {
      const settingsData = payload;
      const {sha: settingsSha} = await getFileShaAndContent("custom_text_settings.json", token);
      const updatedJsonStr = JSON.stringify(settingsData, null, 2);
      const updatedJsonBase64 = Buffer.from(updatedJsonStr, "utf-8").toString("base64");
      await writeFileToGitHub("custom_text_settings.json", updatedJsonBase64, "Update custom text settings", settingsSha, token);
      return {success: true, message: "Custom text settings synced to GitHub."};
    } else {
      throw new HttpsError("invalid-argument", `Action ${action} is not supported.`);
    }
  } catch (error) {
    logger.error("Error in syncToGithub:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    // Never use the "internal" code here: the callable protocol masks internal
    // error messages, so the admin panel only ever saw the word "internal".
    // "failed-precondition" passes the real reason (e.g. the GitHub API response)
    // through to the browser.
    throw new HttpsError("failed-precondition",
        `GitHub sync failed (${action}): ${error.message || error}`);
  }
});

/**
 * Rebuild the reviews.json array from Firestore and push it to GitHub.
 */
async function rebuildAndSyncReviews(token) {
  const reviewsSnap = await firestore.collection("reviews").get();
  const reviewsList = [];
  reviewsSnap.forEach((doc) => {
    const data = doc.data();
    reviewsList.push({
      productId: data.productId || "",
      name: data.name || "",
      text: data.text || "",
      rating: Number(data.rating || 5),
      timestamp: data.timestamp || new Date().toISOString(),
    });
  });

  // Sort by timestamp descending
  reviewsList.sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeB - timeA;
  });

  const {sha: jsonSha} = await getFileShaAndContent("reviews.json", token);
  const updatedJsonStr = JSON.stringify(reviewsList, null, 2);
  const updatedJsonBase64 = Buffer.from(updatedJsonStr, "utf-8").toString("base64");
  await writeFileToGitHub("reviews.json", updatedJsonBase64, "Auto-sync reviews from Firestore", jsonSha, token);
}

exports.onReviewCreated = onDocumentCreated({
  region: "us-central1",
  document: "reviews/{reviewId}",
  secrets: [githubTokenSecret],
}, async (event) => {
  const token = githubTokenSecret.value();
  if (!token) {
    logger.error("GitHub Token secret is missing.");
    return;
  }
  try {
    await rebuildAndSyncReviews(token);
    logger.log(`Auto-synced created review ${event.params.reviewId} to GitHub.`);
  } catch (error) {
    logger.error("Error in onReviewCreated trigger:", error);
  }
});

exports.onReviewDeleted = onDocumentDeleted({
  region: "us-central1",
  document: "reviews/{reviewId}",
  secrets: [githubTokenSecret],
}, async (event) => {
  const token = githubTokenSecret.value();
  if (!token) {
    logger.error("GitHub Token secret is missing.");
    return;
  }
  try {
    await rebuildAndSyncReviews(token);
    logger.log(`Auto-synced deleted review ${event.params.reviewId} to GitHub.`);
  } catch (error) {
    logger.error("Error in onReviewDeleted trigger:", error);
  }
});

/**
 * Create a Yoco Checkout session and save a pending order in Firestore.
 * The secret key never leaves this server, as required by Yoco.
 */
exports.createYocoCheckout = onCall({secrets: [yocoSecretKey]}, async (request) => {
  const {customer, items, shipping, total, callbackUrl, cancelUrl} = request.data || {};
  if (!customer || !customer.email || !items || !Array.isArray(items) || items.length === 0 || !total) {
    throw new HttpsError("invalid-argument", "Missing required order details.");
  }
  if (!(Number(total) > 0)) {
    throw new HttpsError("invalid-argument", "The order total must be greater than zero.");
  }

  const secretKey = getYocoSecretKey();
  if (!secretKey) {
    throw new HttpsError("failed-precondition", "The Yoco secret key is not configured on the server.");
  }

  const reference = `EXTRAIT-${Math.floor(Math.random() * 900000 + 100000)}-${Date.now().toString().slice(-4)}`;
  const email = String(customer.email).trim();
  const firstName = (String(customer.firstName || "").trim() || "Customer");
  const lastName = (String(customer.lastName || "").trim() || "Order");
  const customerName = `${firstName} ${lastName}`.trim();

  const orderDoc = {
    orderId: reference,
    customerName: customerName,
    email: email,
    emailAlt: customer.emailAlt || "",
    phone: customer.phone || "",
    phoneAlt: customer.phoneAlt || "",
    address: shipping ? shipping.address || "" : "",
    deliveryDate: shipping ? shipping.deliveryDate || "" : "",
    instructions: shipping ? shipping.instructions || "" : "",
    items: items,
    total: Number(total),
    currency: "ZAR",
    paymentGateway: "yoco",
    status: "pending_payment",
    paid: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stockDeducted: false,
  };

  // Save the pending order before the customer leaves the site.
  await firestore.collection("orders").doc(reference).set(orderDoc);

  const withReference = (baseUrl, fallback) => {
    const target = baseUrl || fallback;
    const separator = target.includes("?") ? "&" : "?";
    return `${target}${separator}reference=${encodeURIComponent(reference)}`;
  };

  const successUrl = withReference(callbackUrl, `${WEBSITE_ORIGIN}/success.html`);
  const cancelRedirectUrl = withReference(cancelUrl, `${WEBSITE_ORIGIN}/cancel.html`);

  const lineItems = items.map((item) => {
    const quantity = Number(item.quantity) || 1;
    const unitPrice = Number(item.price) || 0;
    const detail = [item.size, item.bottleCustomisation].filter(Boolean).join(" · ");
    return {
      displayName: String(item.name || item.nameShort || "Studio Extrait Extrait de Parfum").slice(0, 120),
      quantity: quantity,
      pricingDetails: {price: Math.round(unitPrice * 100)},
      description: detail.slice(0, 120) || null,
    };
  });

  const yocoPayload = {
    amount: Math.round(Number(total) * 100),
    currency: "ZAR",
    successUrl: successUrl,
    cancelUrl: cancelRedirectUrl,
    failureUrl: cancelRedirectUrl,
    clientReferenceId: reference,
    externalId: reference,
    metadata: {
      orderId: reference,
      customerEmail: email,
      customerName: customerName,
      source: "studioextrait.co.za",
    },
    lineItems: lineItems,
  };

  let yocoResponse = null;
  let yocoBody = null;
  try {
    yocoResponse = await fetch(YOCO_CHECKOUTS_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": reference,
      },
      body: JSON.stringify(yocoPayload),
    });
    yocoBody = await yocoResponse.json().catch(() => null);
  } catch (err) {
    logger.error("Yoco checkout request failed:", err);
    throw new HttpsError("unavailable", "We could not reach the Yoco payment gateway. Please try again.");
  }

  if (!yocoResponse.ok || !yocoBody || !yocoBody.redirectUrl) {
    logger.error(`Yoco checkout rejected (HTTP ${yocoResponse.status}):`, yocoBody);
    throw new HttpsError("internal", "Yoco could not create the secure payment session. Please try again.");
  }

  await firestore.collection("orders").doc(reference).set({
    yocoCheckoutId: yocoBody.id || null,
    yocoCheckoutStatus: yocoBody.status || "created",
    yocoProcessingMode: yocoBody.processingMode || "test",
    updatedAt: new Date().toISOString(),
  }, {merge: true});

  logger.info(`Yoco checkout ${yocoBody.id} created for order ${reference}`);

  return {
    success: true,
    gateway: "yoco",
    reference: reference,
    checkoutId: yocoBody.id || null,
    redirectUrl: yocoBody.redirectUrl,
    processUrl: yocoBody.redirectUrl,
    authorization_url: yocoBody.redirectUrl,
    publicKey: getYocoPublicKey(),
    processingMode: yocoBody.processingMode || "test",
  };
});

/**
 * Create an Ozow instant-EFT payment request and save a pending order in
 * Firestore. The private key never leaves this server - it only ever signs the
 * `hashCheck` field. Ozow answers HTTP 200 even when it rejects a request, so
 * `errorMessage` / `url` decide success, never the status code.
 * Docs: https://hub.ozow.com/api-reference/payments-api/post-post-payment-request
 */
exports.createOzowCheckout = onCall({
  secrets: [ozowPrivateKeySecret, ozowApiKeySecret, ozowSiteCodeSecret],
}, async (request) => {
  const {customer, items, shipping, total, callbackUrl, cancelUrl} = request.data || {};
  if (!customer || !customer.email || !items || !Array.isArray(items) || items.length === 0 || !total) {
    throw new HttpsError("invalid-argument", "Missing required order details.");
  }
  if (!(Number(total) > 0)) {
    throw new HttpsError("invalid-argument", "The order total must be greater than zero.");
  }

  const privateKey = getOzowPrivateKey();
  const apiKey = getOzowApiKey();
  const siteCode = getOzowSiteCode();
  if (!privateKey || !apiKey || !siteCode) {
    throw new HttpsError("failed-precondition",
        "The Ozow private key, API key and site code must all be configured on the server.");
  }

  const reference = `EXTRAIT-${Math.floor(Math.random() * 900000 + 100000)}-${Date.now().toString().slice(-4)}`;
  const email = String(customer.email).trim();
  const firstName = (String(customer.firstName || "").trim() || "Customer");
  const lastName = (String(customer.lastName || "").trim() || "Order");
  const customerName = `${firstName} ${lastName}`.trim();
  const phone = String(customer.phone || "").trim();
  // Ozow allows only letters, numbers, spaces and dashes in a bank reference
  // (max 20 characters): it is what the customer sees in their online banking.
  const bankReference = reference.replace(/[^a-zA-Z0-9 -]/g, "").slice(0, 20);
  // Exactly two decimals: Ozow hashes the formatted string, and a dropped
  // trailing zero is the most common cause of a hashCheck failure.
  const amount = Number(total).toFixed(2);
  const isTest = getOzowIsTest();

  const orderDoc = {
    orderId: reference,
    customerName: customerName,
    email: email,
    emailAlt: customer.emailAlt || "",
    phone: phone,
    phoneAlt: customer.phoneAlt || "",
    address: shipping ? shipping.address || "" : "",
    deliveryDate: shipping ? shipping.deliveryDate || "" : "",
    instructions: shipping ? shipping.instructions || "" : "",
    items: items,
    total: Number(total),
    currency: "ZAR",
    paymentGateway: "ozow",
    status: "pending_payment",
    paid: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stockDeducted: false,
  };

  // Save the pending order before the customer leaves the site.
  await firestore.collection("orders").doc(reference).set(orderDoc);

  // Ozow redirects the customer's browser back to these URLs once the payment
  // page is done with them. The authoritative outcome still arrives on the
  // notification URL below, so the customer's browser is never trusted.
  const withRedirectParams = (baseUrl, fallback) => {
    const target = baseUrl || fallback;
    const separator = target.includes("?") ? "&" : "?";
    return `${target}${separator}reference=${encodeURIComponent(reference)}&gateway=ozow`;
  };

  const successUrl = withRedirectParams(callbackUrl, `${WEBSITE_ORIGIN}/success.html`);
  const cancelRedirectUrl = withRedirectParams(cancelUrl, `${WEBSITE_ORIGIN}/cancel.html`);
  const notifyUrl = `${FUNCTIONS_BASE_URL}/ozowWebhook`;

  // Only fields we actually send may be hashed, in Ozow's documented order.
  // `customerCellphoneNumber` must never be part of the hash, which is why the
  // phone number travels as `optional2` instead.
  const hashCheck = buildOzowRequestHash([
    {name: "siteCode", value: siteCode},
    {name: "countryCode", value: "ZA"},
    {name: "currencyCode", value: "ZAR"},
    {name: "amount", value: amount},
    {name: "transactionReference", value: reference},
    {name: "bankReference", value: bankReference},
    {name: "optional1", value: email},
    {name: "optional2", value: phone},
    {name: "customer", value: customerName},
    {name: "cancelUrl", value: cancelRedirectUrl},
    {name: "errorUrl", value: cancelRedirectUrl},
    {name: "successUrl", value: successUrl},
    {name: "notifyUrl", value: notifyUrl},
    {name: "isTest", value: isTest ? "true" : "false"},
  ], privateKey);

  const ozowPayload = {
    siteCode: siteCode,
    countryCode: "ZA",
    currencyCode: "ZAR",
    amount: amount,
    transactionReference: reference,
    bankReference: bankReference,
    optional1: email,
    optional2: phone,
    customer: customerName,
    cancelUrl: cancelRedirectUrl,
    errorUrl: cancelRedirectUrl,
    successUrl: successUrl,
    notifyUrl: notifyUrl,
    isTest: isTest,
    hashCheck: hashCheck,
  };

  let ozowResponse = null;
  let ozowBody = null;
  try {
    ozowResponse = await fetch(`${getOzowBaseUrl()}/postpaymentrequest`, {
      method: "POST",
      headers: {
        "ApiKey": apiKey,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ozowPayload),
    });
    ozowBody = await ozowResponse.json().catch(() => null);
  } catch (err) {
    logger.error("Ozow payment request failed:", err);
    throw new HttpsError("unavailable",
        "We could not reach the Ozow payment gateway. Please try again.");
  }

  if (!ozowResponse.ok || !ozowBody || !ozowBody.url || ozowBody.errorMessage) {
    logger.error(`Ozow payment request rejected (HTTP ${ozowResponse.status}):`, ozowBody);
    const reason = String((ozowBody && ozowBody.errorMessage) || `HTTP ${ozowResponse.status}`);
    throw new HttpsError("failed-precondition",
        `Ozow could not create the secure payment session: ${reason}`);
  }

  await firestore.collection("orders").doc(reference).set({
    ozowPaymentRequestId: ozowBody.paymentRequestId || null,
    ozowPaymentUrl: ozowBody.url,
    ozowIsTest: isTest,
    updatedAt: new Date().toISOString(),
  }, {merge: true});

  logger.info(`Ozow payment request ${ozowBody.paymentRequestId} created for order ${reference}`);

  return {
    success: true,
    gateway: "ozow",
    reference: reference,
    paymentRequestId: ozowBody.paymentRequestId || null,
    redirectUrl: ozowBody.url,
    processUrl: ozowBody.url,
    authorization_url: ozowBody.url,
    isTest: isTest,
  };
});

/**
 * Backwards compatibility aliases: cached storefront pages (and the old
 * PayFast/Paystack integration) still call these names, so they stay wired to
 * the Yoco Checkout session creator. Safe to delete once nothing calls them.
 */
exports.createPayFastTransaction = onCall({secrets: [yocoSecretKey]}, async (request) => {
  return exports.createYocoCheckout.run(request);
});

exports.createPaystackTransaction = onCall({secrets: [yocoSecretKey]}, async (request) => {
  return exports.createYocoCheckout.run(request);
});

/**
 * Handle Yoco Checkout payment notification events (webhook).
 * Docs: https://yoco.docs.buildwithfern.com/api-reference/checkout-api/webhook-events/payment-notification
 */
async function handleYocoWebhook(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const rawBody = req.rawBody ? req.rawBody.toString("utf8") : "";
  const signature = verifyYocoWebhookSignature(req.headers || {}, rawBody);

  if (signature.reason === "mismatch" || signature.reason === "missing_headers") {
    logger.error(`Yoco webhook rejected: signature ${signature.reason}.`);
    res.status(403).send("Invalid signature");
    return;
  }
  if (signature.reason !== "ok") {
    logger.warn(`Yoco webhook accepted without a verified signature (${signature.reason}).`);
  }

  const event = req.body || {};
  const payload = event.payload || {};
  const metadata = payload.metadata || {};
  const reference = metadata.orderId || metadata.reference ||
    payload.externalId || metadata.checkoutId || "";
  const isPaid = event.type === "payment.succeeded" || payload.status === "succeeded";
  const isFailed = event.type === "payment.failed" || payload.status === "failed";

  logger.info(`Yoco webhook ${event.type || "unknown"} received for order ${reference || "(unmatched)"}`);

  if (!reference) {
    res.status(200).json({received: true, matched: false});
    return;
  }

  let ghToken = null;
  try {
    ghToken = githubTokenSecret.value();
  } catch (e) {
    ghToken = null;
  }

  const orderRef = firestore.collection("orders").doc(reference);
  let orderSnap = await orderRef.get();

  if (!orderSnap.exists && metadata.checkoutId) {
    const q = await firestore.collection("orders").
        where("yocoCheckoutId", "==", metadata.checkoutId).
        limit(1).
        get();
    if (!q.empty) {
      orderSnap = q.docs[0];
    }
  }

  const methodDetails = payload.paymentMethodDetails || {};
  const card = methodDetails.card || {};
  const updateData = {
    status: isPaid ? "paid" : (isFailed ? "payment_failed" : "pending_payment"),
    paid: isPaid,
    paidAt: isPaid ? new Date().toISOString() : null,
    yocoPaymentId: payload.id || null,
    yocoPaymentStatus: payload.status || null,
    yocoPaymentMode: payload.mode || null,
    yocoAmountGross: typeof payload.amount === "number" ? payload.amount / 100 : null,
    yocoPaymentMethod: methodDetails.type || null,
    yocoCardScheme: card.scheme || null,
    yocoCardMask: card.maskedCard || null,
    updatedAt: new Date().toISOString(),
  };

  if (orderSnap.exists) {
    const existingData = orderSnap.data();
    if (isPaid && !existingData.stockDeducted) {
      await deductStockForOrder(existingData, firestore, ghToken);
      updateData.stockDeducted = true;
    }
    await orderSnap.ref.update(updateData);
  } else {
    await orderRef.set({
      orderId: reference,
      email: metadata.customerEmail || "",
      total: typeof payload.amount === "number" ? payload.amount / 100 : 0,
      currency: payload.currency || "ZAR",
      paymentGateway: "yoco",
      ...updateData,
      createdAt: new Date().toISOString(),
    });
  }

  logger.info(`Order ${reference} updated via Yoco webhook. Paid: ${isPaid}`);
  res.status(200).json({received: true, matched: true});
}

exports.yocoWebhook = onRequest({
  secrets: [yocoSecretKey, yocoWebhookSecret, githubTokenSecret],
}, handleYocoWebhook);

/**
 * Backwards compatibility aliases for the retired PayFast/Paystack ITN URLs -
 * they now process Yoco payment notifications. Safe to delete later.
 */
exports.payfastWebhook = onRequest({
  secrets: [yocoSecretKey, yocoWebhookSecret, githubTokenSecret],
}, handleYocoWebhook);

exports.paystackWebhook = onRequest({
  secrets: [yocoSecretKey, yocoWebhookSecret, githubTokenSecret],
}, handleYocoWebhook);

/**
 * Handle Ozow transaction notifications (the payment webhook).
 * Docs: https://hub.ozow.com/api-reference/payments-api/webhooks/transaction-notification
 *
 * The notification is an unauthenticated form-encoded POST to a public URL, so
 * the `Hash` has to verify before anything is written: without that check anyone
 * could POST a fake `Complete` status and be handed a free order. Ozow may send
 * the same notification more than once, so the handler is idempotent and never
 * downgrades an order that has already been paid.
 */
async function handleOzowWebhook(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const rawBody = req.rawBody ? req.rawBody.toString("utf8") : "";
  const body = rawBody ? Object.fromEntries(new URLSearchParams(rawBody)) : (req.body || {});

  const hash = verifyOzowNotificationHash(body, getOzowPrivateKey());
  if (!hash.verified) {
    // Log the payload itself: Ozow's dashboard "test notification" arrives
    // without a Hash, and the body is the only way to tell a hand-fired probe
    // from a genuinely forged POST. Nothing is written to Firestore either way.
    logger.error(`Ozow notification rejected: hash ${hash.reason}.`, {
      body: body,
      rawBody: rawBody.slice(0, 2000),
    });
    res.status(200).send("OK");
    return;
  }

  const reference = String(body.TransactionReference || "").trim();
  const status = String(body.Status || "").trim().toLowerCase();
  const isPaid = OZOW_PAID_STATUSES.includes(status);
  const isFailed = OZOW_FAILED_STATUSES.includes(status);
  const needsReview = status === "pendinginvestigation";

  logger.info(`Ozow notification for order ${reference || "(unmatched)"}:`, body);

  if (!reference) {
    res.status(200).send("OK");
    return;
  }

  let ghToken = null;
  try {
    ghToken = githubTokenSecret.value();
  } catch (e) {
    ghToken = null;
  }

  const orderRef = firestore.collection("orders").doc(reference);
  let orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    const q = await firestore.collection("orders").
        where("orderId", "==", reference).
        limit(1).
        get();
    if (!q.empty) {
      orderSnap = q.docs[0];
    }
  }

  const alreadyPaid = orderSnap.exists &&
    (orderSnap.data().paid === true || orderSnap.data().status === "paid");

  const updateData = {
    ozowTransactionId: body.TransactionId || null,
    ozowTransactionReference: reference,
    ozowStatus: body.Status || null,
    ozowStatusMessage: body.StatusMessage || null,
    ozowSubStatus: body.SubStatus || null,
    ozowBankName: body.BankName || null,
    ozowAmount: body.Amount ? Number(body.Amount) : null,
    ozowIsTestNotification: String(body.IsTest || "").toLowerCase() === "true",
    ozowHashVerified: true,
    updatedAt: new Date().toISOString(),
  };

  if (alreadyPaid) {
    // A duplicate, or a later non-final repost, must never unpay an order.
    if (!isPaid) {
      logger.warn(`Ozow notification for the already paid order ${reference} reported ` +
        `"${status}" - keeping it paid.`);
    }
  } else {
    updateData.status = isPaid ? "paid" :
      (isFailed ? "payment_failed" : (needsReview ? "payment_needs_review" : "pending_payment"));
    updateData.paid = isPaid;
    updateData.paidAt = isPaid ? new Date().toISOString() : null;
  }

  if (orderSnap.exists) {
    const existingData = orderSnap.data();
    if (isPaid && !existingData.stockDeducted) {
      await deductStockForOrder(existingData, firestore, ghToken);
      updateData.stockDeducted = true;
    }
    await orderSnap.ref.update(updateData);
  } else {
    // The pending order is written before the customer ever reaches Ozow, so a
    // missing document means something else went wrong - record the payment
    // anyway, but without line items there is no stock to deduct.
    logger.warn(`Ozow notification for order ${reference} has no matching order document.`);
    await orderRef.set({
      orderId: reference,
      email: body.Optional1 || "",
      total: body.Amount ? Number(body.Amount) : 0,
      currency: body.CurrencyCode || "ZAR",
      paymentGateway: "ozow",
      ...updateData,
      createdAt: new Date().toISOString(),
    });
  }

  logger.info(`Order ${reference} updated via Ozow notification. Paid: ${isPaid}`);
  res.status(200).send("OK");
}

exports.ozowWebhook = onRequest({
  secrets: [ozowPrivateKeySecret, githubTokenSecret],
}, handleOzowWebhook);

async function deductStockForOrder(orderData, firestore, token) {
  try {
    if (!orderData || !orderData.items || !Array.isArray(orderData.items)) return;
    const modifiedProds = {};

    for (const item of orderData.items) {
      if (!item) continue;
      const qty = Number(item.quantity) || 1;
      let prodRef = null;
      let prodSnap = null;

      const targetId = item.id || item.productId;
      if (targetId) {
        prodRef = firestore.collection("products").doc(targetId);
        prodSnap = await prodRef.get();
      }

      if (!prodSnap || !prodSnap.exists) {
        const itemName = (item.name || "").trim().toLowerCase();
        if (itemName) {
          const q = await firestore.collection("products").get();
          for (const doc of q.docs) {
            const d = doc.data();
            if ((d.name && d.name.trim().toLowerCase() === itemName) ||
                (d.nameShort && d.nameShort.trim().toLowerCase() === itemName) ||
                (doc.id.toLowerCase() === itemName.replace(/\s+/g, "-"))) {
              prodRef = doc.ref;
              prodSnap = doc;
              break;
            }
          }
        }
      }

      if (!prodSnap || !prodSnap.exists) continue;

      const pId = prodSnap.id;
      const pData = prodSnap.data();
      const currentStock = Number(pData.stock) || 0;
      const newStock = Math.max(0, currentStock - qty);
      const updateObj = {stock: newStock, updatedAt: new Date().toISOString()};

      let updatedCustomisations = pData.customisations;
      if (item.bottleCustomisation && Array.isArray(pData.customisations)) {
        const custLabel = item.bottleCustomisation.toUpperCase().trim();
        updatedCustomisations = pData.customisations.map((c) => {
          if ((c.label || "").toUpperCase().trim() === custLabel && c.stock !== undefined && c.stock !== null) {
            const currentCStock = Number(c.stock) || 0;
            return Object.assign({}, c, {stock: Math.max(0, currentCStock - qty)});
          }
          return c;
        });
        updateObj.customisations = updatedCustomisations;
      }

      await prodRef.update(updateObj);
      modifiedProds[pId] = {stock: newStock, customisations: updatedCustomisations};
      logger.info(`Stock deducted for product ${pId}: ${currentStock} -> ${newStock}`);
    }

    if (token && Object.keys(modifiedProds).length > 0) {
      try {
        const {sha, content} = await getFileShaAndContent("products.json", token);
        if (content) {
          const prodsList = JSON.parse(content);
          let changed = false;
          prodsList.forEach((p) => {
            if (modifiedProds[p.id]) {
              p.stock = modifiedProds[p.id].stock;
              if (modifiedProds[p.id].customisations && Array.isArray(p.customisations)) {
                p.customisations = modifiedProds[p.id].customisations;
              }
              changed = true;
            }
          });
          if (changed) {
            const updatedBase64 = Buffer.from(JSON.stringify(prodsList, null, 2), "utf8").toString("base64");
            await writeFileToGitHub("products.json", updatedBase64, `Deduct inventory stock after completed order ${orderData.orderId || orderData.id || ""}`, sha, token);
            logger.info("Successfully updated products.json stock on GitHub for order.");
          }
        }
      } catch (ghErr) {
        logger.warn("GitHub products.json stock update warning:", ghErr);
      }
    }
  } catch (err) {
    logger.error("Error deducting stock for order:", err);
  }
}

/**
 * Verify a payment server-side. Orders are only ever marked paid by a gateway
 * webhook (the Yoco payment notification or the Ozow transaction notification),
 * never by the browser callback, so this function reports the trusted Firestore
 * order state back to success.html.
 */
exports.verifyYocoPayment = onCall({secrets: [githubTokenSecret]}, async (request) => {
  const data = request.data || {};
  const activeRef = data.reference || data.m_payment_id || data.orderId || "";
  const checkoutId = data.checkoutId || "";

  if (!activeRef && !checkoutId) {
    throw new HttpsError("invalid-argument", "A transaction reference or Yoco checkout id is required.");
  }

  let ghToken = null;
  try {
    ghToken = githubTokenSecret.value();
  } catch (e) {
    ghToken = null;
  }

  let orderSnap = null;

  if (checkoutId) {
    const q = await firestore.collection("orders").
        where("yocoCheckoutId", "==", checkoutId).
        limit(1).
        get();
    if (!q.empty) {
      orderSnap = q.docs[0];
    }
  }

  if (!orderSnap && activeRef) {
    const snap = await firestore.collection("orders").doc(activeRef).get();
    if (snap.exists) {
      orderSnap = snap;
    }
  }

  if (!orderSnap && activeRef) {
    const q = await firestore.collection("orders").
        where("orderId", "==", activeRef).
        limit(1).
        get();
    if (!q.empty) {
      orderSnap = q.docs[0];
    }
  }

  if (!orderSnap) {
    return {
      success: false,
      verified: false,
      pending: false,
      message: "Order reference not found.",
    };
  }

  const orderData = orderSnap.data();
  const isPaid = orderData.paid === true || orderData.status === "paid";

  if (!isPaid) {
    // The Yoco webhook has not confirmed the payment yet - let the client retry.
    return {
      success: true,
      verified: false,
      pending: true,
      status: orderData.status || "pending_payment",
      order: orderData,
    };
  }

  if (!orderData.stockDeducted) {
    await deductStockForOrder(orderData, firestore, ghToken);
    await orderSnap.ref.update({
      stockDeducted: true,
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    success: true,
    verified: true,
    pending: false,
    order: orderData,
  };
});

/**
 * Backwards compatibility aliases for cached storefront pages.
 */
exports.verifyPayFastPayment = onCall({secrets: [githubTokenSecret]}, async (request) => {
  return exports.verifyYocoPayment.run(request);
});

exports.verifyPaystackPayment = onCall({secrets: [githubTokenSecret]}, async (request) => {
  return exports.verifyYocoPayment.run(request);
});

/**
 * Ozow payments are confirmed from the same trusted Firestore order state as
 * Yoco ones: the `paymentGateway` field on the order records which gateway
 * created it, so the lookup itself is gateway agnostic.
 */
exports.verifyOzowPayment = onCall({secrets: [githubTokenSecret]}, async (request) => {
  return exports.verifyYocoPayment.run(request);
});

/**
 * Cloud Function to track shipments via Courier Guy API (Shiplogic) & Cloud Firestore orders
 */
exports.trackCourierGuyOrder = onCall({
  secrets: [courierGuySecret],
}, async (request) => {
  const apiKey = getCourierGuySecretKey();
  const rawInput = (request.data && request.data.trackingNumber) ? String(request.data.trackingNumber).trim() : "";

  if (!rawInput) {
    throw new HttpsError("invalid-argument", "Tracking or waybill number is required.");
  }

  let waybillToQuery = rawInput;
  let orderData = null;

  try {
    const ordersRef = firestore.collection("orders");
    let docSnap = await ordersRef.doc(rawInput).get();
    if (!docSnap.exists) {
      const q = await ordersRef.where("orderId", "==", rawInput).limit(1).get();
      if (!q.empty) docSnap = q.docs[0];
    }
    if (!docSnap.exists) {
      const q = await ordersRef.where("waybill", "==", rawInput).limit(1).get();
      if (!q.empty) docSnap = q.docs[0];
    }
    if (docSnap.exists) {
      orderData = docSnap.data();
      if (orderData.waybill) {
        waybillToQuery = orderData.waybill;
      }
    }
  } catch (dbErr) {
    logger.warn("Firestore order lookup warning during tracking:", dbErr);
  }

  if (apiKey) {
    const urls = [
      `https://api.shiplogic.com/tracking/shipments?tracking_number=${encodeURIComponent(waybillToQuery)}`,
      `https://api.shiplogic.com/v1/tracking/shipments/${encodeURIComponent(waybillToQuery)}`,
      `https://portal.thecourierguy.co.za/api/v1/track/${encodeURIComponent(waybillToQuery)}`,
    ];

    for (const targetUrl of urls) {
      try {
        const res = await fetch(targetUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          const apiJson = await res.json();
          return {
            success: true,
            source: "courier_guy_api",
            waybill: waybillToQuery,
            data: apiJson,
            order: orderData,
          };
        }
      } catch (fetchErr) {
        logger.warn(`Courier Guy API endpoint fetch failed for ${targetUrl}:`, fetchErr);
      }
    }
  }

  if (orderData) {
    return {
      success: true,
      source: "firestore_order",
      waybill: waybillToQuery,
      order: orderData,
      status: orderData.status || "Processing",
      message: "Order located in database. Dispatch details pending with carrier.",
    };
  }

  return {
    success: false,
    waybill: waybillToQuery,
    message: "No tracking records found for this waybill or reference number.",
  };
});

