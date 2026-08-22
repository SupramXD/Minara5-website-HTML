// Studio Extrait - Product Gallery & Touch Slider Module

(function() {
  let currentSlideIndex = 0;

  function renderProductGallery(images, prod) {
    const track = document.getElementById('sliderTrack') || document.querySelector('.slider-track');
    const sliderWrap = document.getElementById('slider');
    const dotsContainer = document.querySelector('.slider-dots');
    const arrowLeft = document.getElementById("arrowLeft");
    const arrowRight = document.getElementById("arrowRight");
    
    if (!track || !sliderWrap) return;

    if (prod && prod.isBundle) {
      sliderWrap.classList.add('bundle-slider');
    } else {
      sliderWrap.classList.remove('bundle-slider');
    }

    track.innerHTML = "";
    let imgList = images;
    if (!imgList || !Array.isArray(imgList) || imgList.length === 0) {
      imgList = prod && prod.image ? (prod.image.startsWith('data:') ? [prod.image] : prod.image.split(',').map(s => s.trim()).filter(Boolean)) : ["Studio Extrait Icon Svg only logo.svg"];
    }

    imgList.forEach((src, idx) => {
      const cleanSrc = (src || "").trim();
      if (!cleanSrc) return;
      const imgEl = document.createElement('img');
      imgEl.src = cleanSrc;
      imgEl.alt = `${(prod && prod.name) || 'Product'} ${idx + 1}`;
      imgEl.loading = idx === 0 ? "eager" : "lazy";
      imgEl.onerror = () => {
        if (idx === 0 && prod && prod.image) {
          imgEl.src = prod.image.split(',')[0].trim();
        }
      };
      track.appendChild(imgEl);
    });

    const totalSlides = track.children.length;
    currentSlideIndex = 0;

    function goToSlide(index) {
      if (index < 0) index = 0;
      if (index >= totalSlides) index = totalSlides - 1;
      currentSlideIndex = index;

      if (window.innerWidth <= 900) {
        const slideWidth = sliderWrap.offsetWidth || window.innerWidth;
        track.style.transform = `translateX(-${currentSlideIndex * slideWidth}px)`;
      } else {
        track.style.transform = "none";
      }

      if (dotsContainer) {
        const dots = dotsContainer.querySelectorAll('div');
        dots.forEach((d, i) => {
          if (i === currentSlideIndex) d.classList.add('active');
          else d.classList.remove('active');
        });
      }

      if (arrowLeft) arrowLeft.classList.toggle("visible", currentSlideIndex > 0);
      if (arrowRight) arrowRight.classList.toggle("visible", currentSlideIndex < totalSlides - 1);
    }
    window.goToProductSlide = goToSlide;

    // Arrow navigation click handlers
    if (arrowLeft) {
      arrowLeft.onclick = () => goToSlide(currentSlideIndex - 1);
    }
    if (arrowRight) {
      arrowRight.onclick = () => goToSlide(currentSlideIndex + 1);
    }

    // Setup dots for mobile
    if (dotsContainer) {
      if (totalSlides > 1) {
        let dotsHtml = "";
        for (let i = 0; i < totalSlides; i++) {
          dotsHtml += `<div class="${i === 0 ? 'active' : ''}" onclick="window.goToProductSlide(${i})"></div>`;
        }
        dotsContainer.innerHTML = dotsHtml;
      } else {
        dotsContainer.innerHTML = "";
      }
    }

    // Touch swipe listeners for mobile
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let isSwiping = false;

    sliderWrap.ontouchstart = function(e) {
      if (window.innerWidth > 900 || totalSlides <= 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchEndX = touchStartX;
      isSwiping = true;
    };

    sliderWrap.ontouchmove = function(e) {
      if (!isSwiping || window.innerWidth > 900 || totalSlides <= 1) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - touchStartX;
      const diffY = currentY - touchStartY;
      if (Math.abs(diffX) > Math.abs(diffY)) {
        touchEndX = currentX;
      }
    };

    sliderWrap.ontouchend = function() {
      if (!isSwiping || window.innerWidth > 900 || totalSlides <= 1) return;
      isSwiping = false;
      const swipeDiff = touchStartX - touchEndX;
      if (Math.abs(swipeDiff) > 35) {
        if (swipeDiff > 0) {
          goToSlide(currentSlideIndex + 1);
        } else {
          goToSlide(currentSlideIndex - 1);
        }
      }
      touchStartX = 0;
      touchEndX = 0;
    };

    // Auto update slider transform on window resize
    window.addEventListener('resize', () => {
      goToSlide(currentSlideIndex);
    });

    goToSlide(0);
  }

  window.renderProductGallery = renderProductGallery;
})();
