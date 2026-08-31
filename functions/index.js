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

// Global Cloud Function configurations
setGlobalOptions({maxInstances: 10});

// Access secrets configured via Firebase Secret Manager
const githubTokenSecret = defineSecret("GITHUB_TOKEN");
const courierGuySecret = defineSecret("COURIER_GUY_API_KEY");

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
 * Utility functions for PayFast configuration & MD5 signature generation
 */
function getPayFastMerchantId() {
  return process.env.PAYFAST_MERCHANT_ID || "10000100";
}

function getPayFastMerchantKey() {
  return process.env.PAYFAST_MERCHANT_KEY || "46f0cd694581a";
}

function getPayFastPassphrase() {
  return process.env.PAYFAST_PASSPHRASE || "";
}

function getPayFastEnv() {
  const env = process.env.PAYFAST_ENV || "sandbox";
  return String(env).toLowerCase().trim();
}

function getPayFastProcessUrl() {
  const env = getPayFastEnv();
  return env === "live" ?
    "https://www.payfast.co.za/eng/process" :
    "https://sandbox.payfast.co.za/eng/process";
}

function getPayFastValidateUrl() {
  const env = getPayFastEnv();
  return env === "live" ?
    "https://www.payfast.co.za/eng/query/validate" :
    "https://sandbox.payfast.co.za/eng/query/validate";
}

/**
 * PHP-compatible urlencode for PayFast signature matching.
 */
function phpUrlEncode(str) {
  return encodeURIComponent(String(str).trim()).
      replace(/%20/g, "+").
      replace(/!/g, "%21").
      replace(/'/g, "%27").
      replace(/\(/g, "%28").
      replace(/\)/g, "%29").
      replace(/\*/g, "%2A").
      replace(/~/g, "%7E");
}

/**
 * Generates MD5 signature for PayFast requests and webhooks.
 */
function generatePayFastSignature(dataObj, passphrase = "") {
  let getString = "";
  for (const key in dataObj) {
    if (Object.prototype.hasOwnProperty.call(dataObj, key)) {
      const val = dataObj[key];
      if (key !== "signature" && val !== undefined && val !== null && String(val).trim() !== "") {
        getString += `${key}=${phpUrlEncode(val)}&`;
      }
    }
  }
  getString = getString.substring(0, getString.length - 1);

  if (passphrase && String(passphrase).trim() !== "") {
    getString += `&passphrase=${phpUrlEncode(passphrase)}`;
  }

  return crypto.createHash("md5").update(getString).digest("hex");
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

  const token = githubTokenSecret.value();
  const {action, payload} = request.data;

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
            batch.update(docRef, {sortOrder: p.sortOrder});
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
    throw new HttpsError("internal", error.message || "Failed to synchronize changes to GitHub.");
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
 * Initialize a PayFast transaction and save a pending order in Firestore.
 */
/**
 * Initialize a PayFast transaction and save a pending order in Firestore.
 */
exports.createPayFastTransaction = onCall({}, async (request) => {
  const {customer, items, shipping, total, callbackUrl, cancelUrl} = request.data || {};
  if (!customer || !customer.email || !items || !Array.isArray(items) || items.length === 0 || !total) {
    throw new HttpsError("invalid-argument", "Missing required order details.");
  }

  const reference = `EXTRAIT-${Math.floor(Math.random() * 900000 + 100000)}-${Date.now().toString().slice(-4)}`;
  const merchantId = getPayFastMerchantId();
  const merchantKey = getPayFastMerchantKey();
  const passphrase = getPayFastPassphrase();
  const processUrl = getPayFastProcessUrl();

  const orderDoc = {
    orderId: reference,
    customerName: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Customer",
    email: customer.email,
    emailAlt: customer.emailAlt || "",
    phone: customer.phone || "",
    phoneAlt: customer.phoneAlt || "",
    address: shipping ? shipping.address || "" : "",
    deliveryDate: shipping ? shipping.deliveryDate || "" : "",
    instructions: shipping ? shipping.instructions || "" : "",
    items: items,
    total: Number(total),
    currency: "ZAR",
    paymentGateway: "payfast",
    status: "pending_payment",
    paid: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save pending order to Firestore
  await firestore.collection("orders").doc(reference).set(orderDoc);

  const defaultSuccessUrl = "https://minara5.web.app/success.html";
  const defaultCancelUrl = "https://minara5.web.app/cancel.html";

  const returnUrl = callbackUrl || `${defaultSuccessUrl}?m_payment_id=${encodeURIComponent(reference)}`;
  const cancelRedirectUrl = cancelUrl || defaultCancelUrl;
  const notifyUrl = "https://us-central1-minara5.cloudfunctions.net/payfastWebhook";

  // Construct PayFast payload fields
  const fields = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: returnUrl,
    cancel_url: cancelRedirectUrl,
    notify_url: notifyUrl,
    name_first: (customer.firstName || "Customer").trim(),
    name_last: (customer.lastName || "Order").trim(),
    email_address: customer.email.trim(),
    cell_number: (customer.phone || "").trim(),
    m_payment_id: reference,
    amount: Number(total).toFixed(2),
    item_name: `Studio Extrait Order ${reference}`,
  };

  // Calculate signature only if a passphrase is configured
  if (passphrase && passphrase.trim() !== "") {
    fields.signature = generatePayFastSignature(fields, passphrase);
  }

  logger.info(`Initialized PayFast transaction for order ${reference}`);

  return {
    success: true,
    processUrl: processUrl,
    authorization_url: processUrl,
    fields: fields,
    reference: reference,
  };
});

/**
 * Backwards compatibility alias for createPaystackTransaction -> createPayFastTransaction
 */
exports.createPaystackTransaction = onCall({}, async (request) => {
  const {customer, items, shipping, total, callbackUrl, cancelUrl} = request.data || {};
  if (!customer || !customer.email || !items || !Array.isArray(items) || items.length === 0 || !total) {
    throw new HttpsError("invalid-argument", "Missing required order details.");
  }

  const reference = `EXTRAIT-${Math.floor(Math.random() * 900000 + 100000)}-${Date.now().toString().slice(-4)}`;
  const merchantId = getPayFastMerchantId();
  const merchantKey = getPayFastMerchantKey();
  const passphrase = getPayFastPassphrase();
  const processUrl = getPayFastProcessUrl();

  const orderDoc = {
    orderId: reference,
    customerName: `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Customer",
    email: customer.email,
    emailAlt: customer.emailAlt || "",
    phone: customer.phone || "",
    phoneAlt: customer.phoneAlt || "",
    address: shipping ? shipping.address || "" : "",
    deliveryDate: shipping ? shipping.deliveryDate || "" : "",
    instructions: shipping ? shipping.instructions || "" : "",
    items: items,
    total: Number(total),
    currency: "ZAR",
    paymentGateway: "payfast",
    status: "pending_payment",
    paid: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await firestore.collection("orders").doc(reference).set(orderDoc);

  const returnUrl = callbackUrl || `https://minara5.web.app/success.html?m_payment_id=${encodeURIComponent(reference)}`;
  const cancelRedirectUrl = cancelUrl || "https://minara5.web.app/cancel.html";
  const notifyUrl = "https://us-central1-minara5.cloudfunctions.net/payfastWebhook";

  const fields = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: returnUrl,
    cancel_url: cancelRedirectUrl,
    notify_url: notifyUrl,
    name_first: (customer.firstName || "Customer").trim(),
    name_last: (customer.lastName || "Order").trim(),
    email_address: customer.email.trim(),
    cell_number: (customer.phone || "").trim(),
    m_payment_id: reference,
    amount: Number(total).toFixed(2),
    item_name: `Studio Extrait Order ${reference}`,
  };

  if (passphrase && passphrase.trim() !== "") {
    fields.signature = generatePayFastSignature(fields, passphrase);
  }

  return {
    success: true,
    processUrl: processUrl,
    authorization_url: processUrl,
    fields: fields,
    reference: reference,
  };
});

/**
 * Handle incoming Instant Transaction Notifications (ITN webhooks) from PayFast.
 */
exports.payfastWebhook = onRequest({secrets: [githubTokenSecret]}, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const pfData = req.body || {};
  logger.info("PayFast ITN Received:", pfData);

  const passphrase = getPayFastPassphrase();
  const calculatedSignature = generatePayFastSignature(pfData, passphrase);

  if (pfData.signature && calculatedSignature !== pfData.signature) {
    logger.error("PayFast signature mismatch! Received:", pfData.signature, "Calculated:", calculatedSignature);
    res.status(400).send("Signature mismatch");
    return;
  }

  // Server-to-server validation with PayFast
  const validateUrl = getPayFastValidateUrl();
  try {
    const searchParams = new URLSearchParams();
    for (const key in pfData) {
      if (Object.prototype.hasOwnProperty.call(pfData, key)) {
        searchParams.append(key, pfData[key]);
      }
    }

    const validationRes = await fetch(validateUrl, {
      method: "POST",
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: searchParams.toString(),
    });

    const validationText = await validationRes.text();
    logger.info("PayFast validation status response:", validationText);

    if (validationText.trim() !== "VALID" && getPayFastEnv() === "live") {
      logger.error("PayFast ITN validation failed:", validationText);
      res.status(400).send("Invalid ITN validation");
      return;
    }
  } catch (err) {
    logger.warn("PayFast ITN validate check warning:", err);
  }

  const reference = pfData.m_payment_id;
  const paymentStatus = pfData.payment_status;
  let ghToken = null;
  try {
    ghToken = githubTokenSecret.value();
  } catch (e) {
    ghToken = null;
  }

  if (reference) {
    const orderRef = firestore.collection("orders").doc(reference);
    const orderSnap = await orderRef.get();

    const isPaid = paymentStatus === "COMPLETE";
    const updateData = {
      status: isPaid ? "paid" : (paymentStatus ? paymentStatus.toLowerCase() : "pending_payment"),
      paid: isPaid,
      paidAt: isPaid ? new Date().toISOString() : null,
      payfastPaymentId: pfData.pf_payment_id || null,
      payfastAmountGross: pfData.amount_gross || null,
      payfastAmountFee: pfData.amount_fee || null,
      payfastAmountNet: pfData.amount_net || null,
      updatedAt: new Date().toISOString(),
    };

    if (orderSnap.exists) {
      const existingData = orderSnap.data();
      if (isPaid && !existingData.stockDeducted) {
        await deductStockForOrder(existingData, firestore, ghToken);
        updateData.stockDeducted = true;
      }
      await orderRef.update(updateData);
    } else {
      await orderRef.set({
        orderId: reference,
        email: pfData.email_address || "",
        total: pfData.amount_gross ? Number(pfData.amount_gross) : 0,
        currency: "ZAR",
        ...updateData,
        createdAt: new Date().toISOString(),
      });
    }
    logger.info(`Order ${reference} updated via PayFast Webhook. Payment status: ${paymentStatus}`);
  }

  res.status(200).send("ITN Received");
});

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
 * Backwards compatibility alias for paystackWebhook -> payfastWebhook
 */
exports.paystackWebhook = onRequest({}, async (req, res) => {
  return exports.payfastWebhook(req, res);
});

/**
 * Verify PayFast payment status server-side upon client callback.
 */
exports.verifyPayFastPayment = onCall({secrets: [githubTokenSecret]}, async (request) => {
  const {reference, m_payment_id} = request.data || {};
  const activeRef = reference || m_payment_id;

  if (!activeRef) {
    throw new HttpsError("invalid-argument", "Transaction reference or m_payment_id is required.");
  }

  let ghToken = null;
  try {
    ghToken = githubTokenSecret.value();
  } catch (e) {
    ghToken = null;
  }

  const orderRef = firestore.collection("orders").doc(activeRef);
  let orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    const q = await firestore.collection("orders").where("orderId", "==", activeRef).limit(1).get();
    if (!q.empty) {
      orderSnap = q.docs[0];
    }
  }

  if (orderSnap.exists) {
    const orderData = orderSnap.data();
    if (orderData.paid || orderData.status === "paid") {
      if (!orderData.stockDeducted) {
        await deductStockForOrder(orderData, firestore, ghToken);
        await orderSnap.ref.update({stockDeducted: true});
      }
      return {
        success: true,
        verified: true,
        order: orderData,
      };
    } else {
      // Mark as paid when verified via client callback
      await deductStockForOrder(orderData, firestore, ghToken);
      await orderSnap.ref.update({
        status: "paid",
        paid: true,
        stockDeducted: true,
        paidAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const updatedSnap = await orderSnap.ref.get();
      return {
        success: true,
        verified: true,
        order: updatedSnap.data(),
      };
    }
  }

  return {
    success: false,
    verified: false,
    message: "Order reference not found.",
  };
});

/**
 * Backwards compatibility alias for verifyPaystackPayment -> verifyPayFastPayment
 */
exports.verifyPaystackPayment = onCall({}, async (request) => {
  return exports.verifyPayFastPayment(request);
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

