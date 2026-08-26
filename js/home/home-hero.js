/**
 * Studio Extrait - Home Hero Controller
 * Manages Hero 1 and Hero 2 responsive dimensions, split ratios, image cropping, and dynamic settings.
 */

// ==========================================
// 1. FIRST HERO CONTROLLER
// ==========================================
(function () {
  let settings = {
    leftImage: "images/hero/left.avif",
    rightImage: "images/hero/right.jpg",
    mobileImage: "images/hero/mobile.avif",
    leftFlex: 1.3,
    leftScale: 1.0,
    leftX: 67,
    leftY: 61,
    rightScale: 1.0,
    rightX: 80,
    rightY: 92,
    desktopHeight: "calc(115vh - 45px)",
    mobileHeight: "180px",
    mobileScale: 1.0,
    mobileX: 50,
    mobileY: 50,
    logoDesktopSpawn: 50,
    logoDesktopSpawn2: 65,
    logoDesktopStick: -34,
    logoDesktopX: 0,
    logoMobileSpawn: -95,
    logoMobileSpawn2: 180,
    logoMobileStick: 10,
    logoMobileX: -50,
    logoHeaderDesktopHeight: 50,
    logoHeaderMobileHeight: 36,
    logoHomeDesktopWidth: 1200,
    logoHomeMobileWidth: 100,
    showGiftsButton: false,
    hideRightImageDesktop: true
  };

  try {
    const cached = localStorage.getItem("minara_hero_settings");
    if (cached) {
      settings = Object.assign({}, settings, JSON.parse(cached));
    }
  } catch (e) {
    console.error("Failed to load cached hero settings:", e);
  }

  window.heroSettings = settings;

  function applyHeroSettings(s) {
    const activeSettings = (s && typeof s === 'object' && !(s instanceof Event)) ? s : (window.heroSettings || settings);
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    const imgL = document.getElementById("imgL");
    const imgR = document.getElementById("imgR");
    const hero = document.getElementById("hero");
    const imgRWrapper = document.getElementById("imgRWrapper");
    const picL = document.getElementById("picL");
    const picR = document.getElementById("picR");

    if (!imgL || !imgR || !hero) return;

    const bagsContainer = document.getElementById("bagsContainer");
    const mobileBags = document.querySelector(".mobile-bags");
    const showGifts = activeSettings.showGiftsButton !== false;
    if (bagsContainer) bagsContainer.style.display = showGifts ? "" : "none";
    if (mobileBags) mobileBags.style.display = showGifts ? "" : "none";

    // Dynamic logo dimensions connection
    const logo = document.getElementById("logo");
    if (logo) {
      if (!isMobile) {
        logo.style.width = (activeSettings.logoHomeDesktopWidth !== undefined ? activeSettings.logoHomeDesktopWidth + "px" : "1200px");
        logo.style.maxWidth = "none";
      } else {
        logo.style.width = "auto";
        logo.style.maxWidth = (activeSettings.logoHomeMobileWidth !== undefined ? activeSettings.logoHomeMobileWidth + "vw" : "88vw");
      }
    }

    const initStyle = document.getElementById("minara-logo-init-style");

    if (isMobile) {
      const targetMobileSrc = activeSettings.mobileImage || "images/hero/studio-extrait-clone-fragrances-2.avif";
      if (picR) {
        const source = picR.querySelector("source[media*='max-width']");
        if (source && source.getAttribute("srcset") !== targetMobileSrc) {
          source.setAttribute("srcset", targetMobileSrc);
        }
      }
      if (imgR.getAttribute("src") !== targetMobileSrc) {
        imgR.src = targetMobileSrc;
      }
      if (imgRWrapper) {
        imgRWrapper.style.setProperty("display", "block", "important");
      }
      imgR.style.setProperty("display", "block", "important");
      if (picL) picL.style.setProperty("display", "none", "important");
      imgL.style.setProperty("display", "none", "important");

      if (activeSettings.mobileHeight === "auto") {
        hero.style.height = "auto";
        if (imgRWrapper) {
          imgRWrapper.style.height = "auto";
          imgRWrapper.style.flex = "";
        }
        imgR.style.height = "auto";
        imgR.style.width = "100%";
        imgR.style.objectFit = "cover";
      } else {
        hero.style.height = activeSettings.mobileHeight;
        if (imgRWrapper) {
          imgRWrapper.style.height = "100%";
          imgRWrapper.style.flex = "";
        }
        imgR.style.height = "100%";
        imgR.style.width = "100%";
        imgR.style.objectFit = "cover";
      }

      imgR.style.transform = `scale(${activeSettings.mobileScale || 1.0})`;
      imgR.style.objectPosition = `${activeSettings.mobileX || 50}% ${activeSettings.mobileY || 50}%`;
      imgR.style.transformOrigin = `${activeSettings.mobileX || 50}% ${activeSettings.mobileY || 50}%`;
    } else {
      hero.style.height = activeSettings.desktopHeight || "calc(115vh - 45px)";
      if (picL) {
        picL.style.setProperty("display", "block", "important");
      }
      imgL.style.setProperty("display", "block", "important");

      if (activeSettings.hideRightImageDesktop) {
        const blankGif = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        if (picR) {
          picR.querySelectorAll("source").forEach(s => s.setAttribute("srcset", blankGif));
        }
        imgR.src = blankGif;
        if (imgRWrapper) {
          imgRWrapper.style.setProperty("display", "none", "important");
        }
        if (picL) {
          picL.style.setProperty("flex", "1", "important");
          picL.style.setProperty("width", "100%", "important");
          picL.style.setProperty("height", "100%", "important");
          picL.style.setProperty("display", "block", "important");
        }
        imgL.style.setProperty("flex", "1", "important");
        imgL.style.setProperty("width", "100%", "important");
        imgL.style.setProperty("height", "100%", "important");
        imgL.style.setProperty("object-fit", "cover", "important");
        imgL.style.setProperty("display", "block", "important");

        const targetLeftSrc = activeSettings.leftImage || "images/hero/studio-extrait-clone-fragrances.avif";
        if (picL) {
          const source = picL.querySelector("source[media*='min-width']");
          if (source && source.getAttribute("srcset") !== targetLeftSrc) {
            source.setAttribute("srcset", targetLeftSrc);
          }
        }
        if (imgL.getAttribute("src") !== targetLeftSrc) {
          imgL.src = targetLeftSrc;
        }

        imgL.style.transform = `scale(${activeSettings.leftScale || 1.0})`;
        imgL.style.objectPosition = `${activeSettings.leftX || 50}% ${activeSettings.leftY || 50}%`;
        imgL.style.transformOrigin = `${activeSettings.leftX || 50}% ${activeSettings.leftY || 50}%`;

        if (initStyle) {
          initStyle.innerHTML = initStyle.innerHTML
            .replace(/#imgRWrapper\s*\{[^}]*\}/g, "#imgRWrapper { display: none !important; }")
            .replace(/#hero #picL\s*\{[^}]*\}/g, "#hero #picL { flex: 1 !important; width: 100% !important; height: 100% !important; display: block !important; }")
            .replace(/#hero #imgL\s*\{[^}]*\}/g, "#hero #imgL { flex: 1 !important; width: 100% !important; height: 100% !important; object-fit: cover !important; display: block !important; }");
        }
      } else {
        const leftFlex = activeSettings.leftFlex !== undefined ? parseFloat(activeSettings.leftFlex) : 1.3;
        const rightFlex = Math.max(0.1, 2.0 - leftFlex);

        if (imgRWrapper) {
          imgRWrapper.style.setProperty("display", "block", "important");
          imgRWrapper.style.setProperty("flex", String(rightFlex), "important");
          imgRWrapper.style.setProperty("height", "100%", "important");
        }
        if (picL) {
          picL.style.setProperty("flex", String(leftFlex), "important");
          picL.style.setProperty("width", "", "");
          picL.style.setProperty("height", "100%", "important");
          picL.style.setProperty("display", "block", "important");
        }
        imgL.style.setProperty("flex", String(leftFlex), "important");
        imgL.style.setProperty("width", "100%", "important");
        imgL.style.setProperty("height", "100%", "important");
        imgL.style.setProperty("object-fit", "cover", "important");
        imgL.style.setProperty("display", "block", "important");

        const targetLeftSrc = activeSettings.leftImage || "images/hero/studio-extrait-clone-fragrances.avif";
        if (picL) {
          const source = picL.querySelector("source[media*='min-width']");
          if (source && source.getAttribute("srcset") !== targetLeftSrc) {
            source.setAttribute("srcset", targetLeftSrc);
          }
        }
        if (imgL.getAttribute("src") !== targetLeftSrc) {
          imgL.src = targetLeftSrc;
        }

        imgL.style.transform = `scale(${activeSettings.leftScale || 1.0})`;
        imgL.style.objectPosition = `${activeSettings.leftX || 50}% ${activeSettings.leftY || 50}%`;
        imgL.style.transformOrigin = `${activeSettings.leftX || 50}% ${activeSettings.leftY || 50}%`;

        const targetRightSrc = activeSettings.rightImage || "images/hero/right.png";
        if (picR) {
          const minSource = picR.querySelector("source[media*='min-width']");
          if (minSource && minSource.getAttribute("srcset") !== targetRightSrc) {
            minSource.setAttribute("srcset", targetRightSrc);
          }
          const maxSource = picR.querySelector("source[media*='max-width']");
          const mobileSrc = activeSettings.mobileImage || "images/hero/mobile.avif";
          if (maxSource && maxSource.getAttribute("srcset") !== mobileSrc) {
            maxSource.setAttribute("srcset", mobileSrc);
          }
        }
        if (imgR && imgR.getAttribute("src") !== targetRightSrc) {
          imgR.src = targetRightSrc;
        }

        if (imgR) {
          imgR.style.setProperty("display", "block", "important");
          imgR.style.transform = `scale(${activeSettings.rightScale || 1.0})`;
          imgR.style.objectPosition = `${activeSettings.rightX || 80}% ${activeSettings.rightY || 50}%`;
          imgR.style.transformOrigin = `${activeSettings.rightX || 80}% ${activeSettings.rightY || 50}%`;
          imgR.style.height = "100%";
          imgR.style.width = "100%";
          imgR.style.objectFit = "cover";
        }

        if (initStyle) {
          initStyle.innerHTML = initStyle.innerHTML
            .replace(/#imgRWrapper\s*\{[^}]*\}/g, `#imgRWrapper { display: block !important; flex: ${rightFlex} !important; height: 100% !important; }`)
            .replace(/#hero #picL\s*\{[^}]*\}/g, `#hero #picL { flex: ${leftFlex} !important; height: 100% !important; display: block !important; }`);
        }
      }
    }
  }

  window.addEventListener("resize", () => applyHeroSettings());
  document.addEventListener("DOMContentLoaded", () => applyHeroSettings());

  window.applyHeroSettings = function (newSettings) {
    settings = Object.assign({}, settings, newSettings);
    window.heroSettings = settings;
    applyHeroSettings();
    if (typeof window.updateLogoPosition === 'function') {
      window.updateLogoPosition();
    }
  };

  applyHeroSettings();
})();


// ==========================================
// 2. SECOND HERO CONTROLLER
// ==========================================
(function () {
  let settings = {
    leftImage: "images/second-hero/studio-extrait-perfumes.avif",
    rightImage: "",
    mobileImage: "",
    leftFlex: 1.0,
    leftScale: 1.0,
    leftX: 50,
    leftY: 50,
    rightScale: 1.0,
    rightX: 50,
    rightY: 50,
    desktopHeight: "auto",
    mobileHeight: "auto",
    mobileScale: 1.0,
    mobileX: 50,
    mobileY: 50
  };

  try {
    const cached = localStorage.getItem("minara_second_hero_settings");
    if (cached) {
      settings = Object.assign({}, settings, JSON.parse(cached));
    }
  } catch (e) {
    console.error("Failed to load cached second hero settings:", e);
  }

  window.secondHeroSettings = settings;

  function applySecondHeroSettings() {
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    const imgL = document.getElementById("secImgL");
    const imgR = document.getElementById("secImgR");
    const hero = document.getElementById("secondHero");

    if (!imgL || !hero) return;

    const imageSrc = isMobile
      ? (settings.mobileImage || settings.leftImage || "images/second-hero/studio-extrait-perfumes.avif")
      : (settings.leftImage || "images/second-hero/studio-extrait-perfumes.avif");

    imgL.onerror = function () {
      this.onerror = null;
      this.src = "images/second-hero/studio-extrait-perfumes.avif";
    };

    if (imgL.getAttribute("src") !== imageSrc) {
      imgL.src = imageSrc;
    }
    imgL.style.display = "block";

    const scale = isMobile ? (settings.mobileScale || 1.0) : (settings.leftScale || 1.0);
    const posX = isMobile ? (settings.mobileX || 50) : (settings.leftX || 50);
    const posY = isMobile ? (settings.mobileY || 50) : (settings.leftY || 50);

    imgL.style.transform = `scale(${scale})`;
    imgL.style.objectPosition = `${posX}% ${posY}%`;
    imgL.style.transformOrigin = `${posX}% ${posY}%`;

    if (imgR) {
      imgR.style.display = "none";
    }
  }

  window.addEventListener("resize", applySecondHeroSettings);
  document.addEventListener("DOMContentLoaded", applySecondHeroSettings);

  window.applySecondHeroSettings = function (newSettings) {
    settings = Object.assign({}, settings, newSettings);
    window.secondHeroSettings = settings;
    applySecondHeroSettings();
    if (typeof window.updateLogoPosition === 'function') {
      window.updateLogoPosition();
    }
  };

  applySecondHeroSettings();
})();


// ==========================================
// 3. BACKGROUND HERO SETTINGS FETCHERS
// ==========================================
setTimeout(async () => {
  try {
    const response = await fetch("hero_settings.json?t=" + Date.now());
    if (response.ok) {
      const data = await response.json();
      const liveSettings = {
        leftImage: data.leftImage || "images/hero/studio-extrait-clone-fragrances.avif",
        rightImage: data.rightImage || "images/hero/right.png",
        mobileImage: data.mobileImage || "images/hero/studio-extrait-clone-fragrances-2.avif",
        leftFlex: data.leftFlex !== undefined ? Number(data.leftFlex) : 1.3,
        leftScale: data.leftScale !== undefined ? Number(data.leftScale) : 1.0,
        leftX: data.leftX !== undefined ? Number(data.leftX) : 50,
        leftY: data.leftY !== undefined ? Number(data.leftY) : 50,
        rightScale: data.rightScale !== undefined ? Number(data.rightScale) : 1.0,
        rightX: data.rightX !== undefined ? Number(data.rightX) : 80,
        rightY: data.rightY !== undefined ? Number(data.rightY) : 50,
        desktopHeight: data.desktopHeight || "calc(115vh - 45px)",
        mobileHeight: data.mobileHeight || "auto",
        mobileScale: data.mobileScale !== undefined ? Number(data.mobileScale) : 1.0,
        mobileX: data.mobileX !== undefined ? Number(data.mobileX) : 50,
        mobileY: data.mobileY !== undefined ? Number(data.mobileY) : 50,
        logoDesktopSpawn: data.logoDesktopSpawn !== undefined ? Number(data.logoDesktopSpawn) : 50,
        logoDesktopSpawn2: data.logoDesktopSpawn2 !== undefined ? Number(data.logoDesktopSpawn2) : 65,
        logoDesktopStick: data.logoDesktopStick !== undefined ? Number(data.logoDesktopStick) : 0,
        logoDesktopX: data.logoDesktopX !== undefined ? Number(data.logoDesktopX) : 0,
        logoMobileSpawn: data.logoMobileSpawn !== undefined ? Number(data.logoMobileSpawn) : -50,
        logoMobileSpawn2: data.logoMobileSpawn2 !== undefined ? Number(data.logoMobileSpawn2) : 50,
        logoMobileStick: data.logoMobileStick !== undefined ? Number(data.logoMobileStick) : 0,
        logoMobileX: data.logoMobileX !== undefined ? Number(data.logoMobileX) : -50,
        logoHeaderDesktopHeight: data.logoHeaderDesktopHeight !== undefined ? Number(data.logoHeaderDesktopHeight) : 50,
        logoHeaderMobileHeight: data.logoHeaderMobileHeight !== undefined ? Number(data.logoHeaderMobileHeight) : 36,
        logoHomeDesktopWidth: data.logoHomeDesktopWidth !== undefined ? Number(data.logoHomeDesktopWidth) : 1200,
        logoHomeMobileWidth: data.logoHomeMobileWidth !== undefined ? Number(data.logoHomeMobileWidth) : 88,
        showGiftsButton: data.showGiftsButton !== false,
        hideRightImageDesktop: !!data.hideRightImageDesktop
      };
      localStorage.setItem("minara_hero_settings", JSON.stringify(liveSettings));
      if (window.applyHeroSettings) {
        window.applyHeroSettings(liveSettings);
      }
    }
  } catch (jsonErr) {
    console.warn("Failed to fetch static hero settings:", jsonErr);
  }
}, 0);

setTimeout(async () => {
  try {
    const response = await fetch("second_hero_settings.json?t=" + Date.now());
    if (response.ok) {
      const data = await response.json();
      const liveSettings = {
        leftImage: data.leftImage || "",
        rightImage: data.rightImage || "",
        mobileImage: data.mobileImage || "",
        leftFlex: data.leftFlex !== undefined ? Number(data.leftFlex) : 1.3,
        leftScale: data.leftScale !== undefined ? Number(data.leftScale) : 1.0,
        leftX: data.leftX !== undefined ? Number(data.leftX) : 50,
        leftY: data.leftY !== undefined ? Number(data.leftY) : 50,
        rightScale: data.rightScale !== undefined ? Number(data.rightScale) : 1.0,
        rightX: data.rightX !== undefined ? Number(data.rightX) : 50,
        rightY: data.rightY !== undefined ? Number(data.rightY) : 50,
        desktopHeight: data.desktopHeight || "80vh",
        mobileHeight: data.mobileHeight || "auto",
        mobileScale: data.mobileScale !== undefined ? Number(data.mobileScale) : 1.0,
        mobileX: data.mobileX !== undefined ? Number(data.mobileX) : 50,
        mobileY: data.mobileY !== undefined ? Number(data.mobileY) : 50
      };
      localStorage.setItem("minara_second_hero_settings", JSON.stringify(liveSettings));
      if (window.applySecondHeroSettings) {
        window.applySecondHeroSettings(liveSettings);
      }
    }
  } catch (jsonErr) {
    console.warn("Failed to fetch second_hero_settings.json:", jsonErr);
  }
}, 0);
