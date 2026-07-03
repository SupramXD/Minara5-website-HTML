/* eslint-disable max-len, camelcase, require-jsdoc, valid-jsdoc */
const {setGlobalOptions} = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onDocumentCreated, onDocumentDeleted} = require("firebase-functions/v2/firestore");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

// Initialize Firebase Admin
const fs = require("fs");
const path = require("path");

admin.initializeApp();
const firestore = admin.firestore();

// Global Cloud Function configurations
setGlobalOptions({maxInstances: 10});

// Access secret GITHUB_TOKEN configured via Firebase Secret Manager
const githubTokenSecret = defineSecret("GITHUB_TOKEN");

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
      const {id, nameShort, name, price, retailPrice, stock, image, image_thumb, description, status, flair, invisibleFlair, sizes, isBundle, bundleSize, sortOrder} = payload;

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

      // Retrieve existing catalog products.json
      const {sha: jsonSha, content: jsonContent} = await getFileShaAndContent("products.json", token);
      let productsList = [];
      if (jsonContent) {
        try {
          productsList = JSON.parse(jsonContent);
        } catch (e) {
          logger.warn("Failed to parse products.json, resetting to empty array", e);
        }
      }

      const updatedProduct = {
        id,
        nameShort: nameShort || "",
        name,
        price: Number(price),
        retailPrice: retailPrice !== null && retailPrice !== undefined ?
          Number(retailPrice) : null,
        stock: Number(stock),
        image: mainImagePath,
        image_thumb: thumbImagePath || "",
        description: description || "",
        status: status || "Active",
        flair: flair || "",
        invisibleFlair: invisibleFlair || "",
        sizes: sizes || ["50ml", "100ml"],
        isBundle: isBundle !== undefined ? !!isBundle : false,
        bundleSize: bundleSize !== undefined ? Number(bundleSize) : 0,
        sortOrder: sortOrder !== undefined && sortOrder !== null ?
          Number(sortOrder) : null,
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
                Number(retailPrice) : null,
              stock: Number(stock),
              image: mainImagePath,
              image_thumb: thumbImagePath || "",
              description: description || "",
              status: status || "Active",
              flair: flair || "",
              invisibleFlair: invisibleFlair || "",
              sizes: sizes || ["50ml", "100ml"],
              isBundle: isBundle !== undefined ? !!isBundle : false,
              bundleSize: bundleSize !== undefined ? Number(bundleSize) : 0,
              sortOrder: p.sortOrder,
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
