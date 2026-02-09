/* ===== Neural Paintings Gallery ===== */

(function () {
  'use strict';

  let galleryData = null;
  let imageTitles = {};

  // Separate ordered lists per brush
  const brushPaintings = {};
  const brushStyles = {};

  // Display names for brush types (internal key → label)
  const BRUSH_NAMES = {
    watercolor: 'Watercolor',
    texture: 'Oil Paint',
    rectangle: 'Rectangle',
  };
  const BRUSH_ORDER = ['watercolor', 'texture', 'rectangle'];

  // State
  let activeBrush = 'watercolor';
  let activeSubTab = 'paintings';
  let detailIndex = -1;
  let activeDetailTab = 'painted';
  let isHighlightDetail = false;
  let detailTriggerElement = null;
  let highlightDetailItem = null;

  // Cached DOM references (populated in init)
  var dom = {};

  /* ---- Data Loading ---- */

  async function init() {
    // Cache all stable DOM elements
    dom.highlights = document.getElementById('highlights');
    dom.subTabs = document.getElementById('sub-tabs');
    dom.galleryGrid = document.getElementById('gallery-grid');
    dom.overlay = document.getElementById('detail-overlay');
    dom.closeBtn = document.getElementById('detail-close');
    dom.prevBtn = document.getElementById('detail-prev');
    dom.nextBtn = document.getElementById('detail-next');
    dom.detailTabs = document.getElementById('detail-tabs');
    dom.mainImage = document.getElementById('detail-main-image');
    dom.thumbWrapper = document.getElementById('video-thumbnail-wrapper');
    dom.posterContainer = document.getElementById('video-poster-container');
    dom.video = document.getElementById('detail-video');
    dom.videoTab = document.querySelector('[data-detail-tab="video"]');
    dom.titleEl = document.getElementById('detail-title');
    dom.styleInfo = document.getElementById('detail-style-info');
    dom.brushBadge = document.getElementById('detail-brush-badge');
    dom.source = document.getElementById('detail-source');

    const galleryResp = await fetch('gallery-data.json');
    galleryData = await galleryResp.json();

    // Build image title lookup from gallery data itself
    for (const brush of BRUSH_ORDER) {
      const bd = galleryData.brushes[brush];
      if (!bd) continue;
      for (const p of bd.paintings) {
        if (p.target_image && p.title) imageTitles[p.target_image] = p.title;
      }
      for (const s of bd.styles) {
        if (s.target_image && s.target_title) imageTitles[s.target_image] = s.target_title;
        if (s.style_image && s.style_title) imageTitles[s.style_image] = s.style_title;
      }
    }

    for (const brush of BRUSH_ORDER) {
      const bd = galleryData.brushes[brush];
      if (!bd) continue;
      brushPaintings[brush] = [...bd.paintings];
      brushStyles[brush] = [...bd.styles];
    }

    renderHighlights();
    setupTabEvents();
    setupDetailEvents();

    // Read hash for deep-linking
    const hash = window.location.hash.replace('#', '');
    if (BRUSH_ORDER.includes(hash)) {
      activeBrush = hash;
    }
    syncBrushTabs();
    renderGallery();
  }

  /* ---- Hero Highlights ---- */

  function renderHighlights() {
    if (!dom.highlights) return;

    for (const brush of BRUSH_ORDER) {
      const paintings = brushPaintings[brush] || [];
      const styles = brushStyles[brush] || [];

      const entries = [];
      for (let i = 0; i < Math.min(2, paintings.length); i++) {
        entries.push({ item: paintings[i], subTab: 'paintings', index: i });
      }
      for (let i = 0; i < Math.min(1, styles.length); i++) {
        entries.push({ item: styles[i], subTab: 'styles', index: i });
      }

      if (!entries.length) continue;

      const column = document.createElement('div');
      column.className = 'highlights-column';

      const heading = document.createElement('h2');
      heading.className = 'highlights-brush-name';
      heading.textContent = BRUSH_NAMES[brush] || capitalize(brush);
      column.appendChild(heading);

      const stack = document.createElement('div');
      stack.className = 'highlights-stack';

      entries.forEach(function (entry) {
        stack.appendChild(createCard(entry.item, function () {
          openDetail(entry.item, true);
        }));
      });

      column.appendChild(stack);

      dom.highlights.appendChild(column);
    }
  }

  /* ---- Tab Events ---- */

  function setupTabEvents() {
    // Brush tabs
    document.querySelectorAll('.brush-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeBrush = this.dataset.brush;
        activeSubTab = 'paintings'; // reset to paintings on brush switch
        syncBrushTabs();
        renderGallery();
        window.location.hash = activeBrush;
      });
    });
  }

  function syncBrushTabs() {
    // Update brush tab active state
    document.querySelectorAll('.brush-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.brush === activeBrush);
    });

    // Render sub-tabs with counts
    renderSubTabs();
  }

  function renderSubTabs() {
    if (!dom.subTabs) return;

    const paintings = brushPaintings[activeBrush] || [];
    const styles = brushStyles[activeBrush] || [];

    dom.subTabs.innerHTML =
      '<button class="sub-tab' + (activeSubTab === 'paintings' ? ' active' : '') +
        '" data-sub="paintings">Paintings (' + paintings.length + ')</button>' +
      '<button class="sub-tab' + (activeSubTab === 'styles' ? ' active' : '') +
        '" data-sub="styles">Stylized (' + styles.length + ')</button>';

    dom.subTabs.querySelectorAll('.sub-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeSubTab = this.dataset.sub;
        dom.subTabs.querySelectorAll('.sub-tab').forEach(function (b) {
          b.classList.toggle('active', b.dataset.sub === activeSubTab);
        });
        renderGallery();
      });
    });
  }

  /* ---- Gallery Rendering ---- */

  function getCurrentItems() {
    if (activeSubTab === 'paintings') {
      return brushPaintings[activeBrush] || [];
    }
    return brushStyles[activeBrush] || [];
  }

  function renderGallery() {
    if (!dom.galleryGrid) return;

    dom.galleryGrid.innerHTML = '';
    const items = getCurrentItems();

    items.forEach(function (item, idx) {
      const card = createCard(item, function () { openDetail(idx); });
      card.style.animationDelay = Math.min(idx * 0.04, 0.8) + 's';
      dom.galleryGrid.appendChild(card);
    });
  }

  function createCard(item, onClick) {
    const card = document.createElement('div');
    card.className = 'painting-card' + (item.type === 'style' ? ' is-style' : '');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const title = item.type === 'style' ? item.target_title : item.title;
    let subtitleHtml = '';
    if (item.type === 'style') {
      subtitleHtml = '<div class="card-style-subtitle">styled as ' + escapeHtml(item.style_title) + '</div>';
    }

    card.innerHTML =
      '<div class="card-frame">' +
        '<img class="card-image" src="' + item.final_image + '" alt="' + escapeAttr(title) + '" loading="lazy">' +
      '</div>' +
      '<div class="card-info">' +
        '<div class="card-title">' + escapeHtml(title) + '</div>' +
        subtitleHtml +
      '</div>';

    card.addEventListener('click', onClick);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    });

    return card;
  }

  /* ---- Detail View ---- */

  function openDetail(indexOrItem, fromHighlight) {
    detailTriggerElement = document.activeElement;
    if (typeof indexOrItem === 'object' && indexOrItem !== null) {
      highlightDetailItem = indexOrItem;
      detailIndex = -1;
    } else {
      highlightDetailItem = null;
      detailIndex = indexOrItem;
    }
    isHighlightDetail = !!fromHighlight;
    activeDetailTab = 'painted';
    dom.overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderDetailContent();
    dom.closeBtn.focus();
  }

  function closeDetail() {
    var sel = window.getSelection();
    if (sel) sel.removeAllRanges();
    dom.video.pause();
    dom.posterContainer.classList.remove('playing');
    dom.overlay.classList.remove('open');
    document.body.style.overflow = '';
    highlightDetailItem = null;
    if (detailTriggerElement && detailTriggerElement.focus) {
      detailTriggerElement.focus();
      detailTriggerElement = null;
    }
  }

  function navigateDetail(dir) {
    const items = getCurrentItems();
    if (!items.length) return;
    var newIndex = detailIndex + dir;
    if (newIndex < 0 || newIndex >= items.length) return;
    detailIndex = newIndex;
    renderDetailContent();
  }

  function switchDetailTab(tabName) {
    activeDetailTab = tabName;
    document.querySelectorAll('.detail-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.detailTab === tabName);
    });
    document.querySelectorAll('.detail-pane').forEach(function (pane) {
      pane.classList.toggle('active', pane.id === 'detail-pane-' + tabName);
    });
    // When switching away from video, pause and restore thumbnails
    if (tabName !== 'video') {
      dom.video.pause();
      dom.posterContainer.classList.remove('playing');
    }
  }

  function setupVideoPane(item) {
    dom.thumbWrapper.innerHTML = '';
    dom.posterContainer.classList.remove('playing');
    dom.video.pause();

    var hasVideo = !!item.has_video;
    var allImages = [].concat(item.progression || [], [item.final_image]);
    var labels = getProgressionLabels(item);

    allImages.forEach(function (src, i) {
      var cell = document.createElement('div');
      cell.className = 'video-thumb-cell';

      var img = document.createElement('img');
      img.src = src;
      img.alt = labels[i] || '';
      img.loading = 'lazy';

      var label = document.createElement('span');
      label.className = 'video-thumb-label';
      label.textContent = labels[i] || '';

      cell.appendChild(img);
      cell.appendChild(label);
      dom.thumbWrapper.appendChild(cell);
    });

    if (item.type === 'style') {
      dom.video.removeAttribute('src');
      dom.video.load();
      dom.videoTab.classList.add('disabled');
      dom.videoTab.style.display = 'none';
      dom.detailTabs.classList.add('single-tab');
      if (activeDetailTab === 'video') {
        activeDetailTab = 'painted';
      }
    } else if (hasVideo) {
      dom.videoTab.style.display = '';
      dom.detailTabs.classList.remove('single-tab');
      dom.video.src = item.path + '/painting_progress.mp4';
      dom.video.load();
      dom.videoTab.classList.remove('disabled');
      dom.videoTab.textContent = 'Video';

      // Add play overlay
      var playOverlay = document.createElement('div');
      playOverlay.className = 'video-play-overlay';
      playOverlay.innerHTML = '<div class="video-play-btn"></div>';
      playOverlay.addEventListener('click', function () {
        dom.posterContainer.classList.add('playing');
        dom.video.play();
      });
      dom.thumbWrapper.appendChild(playOverlay);
    } else if (item.progression && item.progression.length > 0) {
      dom.videoTab.style.display = '';
      dom.video.removeAttribute('src');
      dom.video.load();
      dom.videoTab.classList.remove('disabled');
      dom.videoTab.textContent = 'Progression';
    } else {
      dom.videoTab.style.display = '';
      dom.video.removeAttribute('src');
      dom.video.load();
      dom.videoTab.classList.add('disabled');
      dom.videoTab.textContent = 'Video';
      if (activeDetailTab === 'video') {
        activeDetailTab = 'painted';
      }
    }
  }

  function renderDetailContent() {
    var item;
    if (highlightDetailItem) {
      item = highlightDetailItem;
    } else {
      var items = getCurrentItems();
      if (!items.length) return;
      item = items[detailIndex];
    }

    // Painted pane
    dom.mainImage.src = item.final_image;
    dom.mainImage.alt = item.type === 'style' ? item.target_title : item.title;

    // Video pane
    setupVideoPane(item);

    // Title bar
    dom.titleEl.textContent = item.type === 'style' ? item.target_title : item.title;

    if (item.type === 'style') {
      dom.styleInfo.textContent = 'styled as ' + item.style_title;
      dom.styleInfo.style.display = 'block';
    } else {
      dom.styleInfo.style.display = 'none';
    }

    dom.brushBadge.textContent = (BRUSH_NAMES[item.brush] || capitalize(item.brush)) + ' brush';

    // Source images (right side)
    renderSourceImages(item);

    // Activate current tab
    switchDetailTab(activeDetailTab);

    // Show/hide nav arrows at boundaries (hide completely for highlights)
    if (isHighlightDetail) {
      dom.prevBtn.style.display = 'none';
      dom.nextBtn.style.display = 'none';
    } else {
      var galleryItems = getCurrentItems();
      dom.prevBtn.style.display = '';
      dom.nextBtn.style.display = '';
      dom.prevBtn.classList.toggle('disabled', detailIndex === 0);
      dom.nextBtn.classList.toggle('disabled', detailIndex === galleryItems.length - 1);
    }

    // Scroll overlay to top
    dom.overlay.scrollTop = 0;
  }

  function renderSourceImages(item) {
    dom.source.innerHTML = '';

    // Target image (always shown)
    var targetBlock = document.createElement('div');
    targetBlock.className = 'source-block';

    var targetImg = document.createElement('img');
    targetImg.className = 'source-image';
    targetImg.src = 'assets/images/' + item.target_image;
    targetImg.alt = getImageTitle(item.target_image);
    targetImg.loading = 'lazy';

    targetBlock.appendChild(targetImg);
    dom.source.appendChild(targetBlock);

    // Style image (only for style transfers)
    if (item.type === 'style' && item.style_image) {
      var styleBlock = document.createElement('div');
      styleBlock.className = 'source-block';

      var styleImg = document.createElement('img');
      styleImg.className = 'source-image';
      styleImg.src = 'assets/images/' + item.style_image;
      styleImg.alt = getImageTitle(item.style_image);
      styleImg.loading = 'lazy';

      styleBlock.appendChild(styleImg);
      dom.source.appendChild(styleBlock);
    }
  }

  function getImageTitle(filename) {
    return imageTitles[filename] || filename.replace(/\.\w+$/, '').replace(/_/g, ' ');
  }

  function getProgressionLabels(item) {
    var brush = item.brush;
    var labels = [];
    if (brush === 'rectangle') {
      labels.push('5 strokes', '50 strokes');
    } else if (brush === 'texture') {
      labels.push('5 strokes', '50 strokes', '500 strokes');
    } else if (brush === 'watercolor') {
      labels.push('5 strokes', '50 strokes', '200 strokes');
    }
    labels.push('Final');
    return labels;
  }

  /* ---- Detail Events ---- */

  function setupDetailEvents() {
    dom.closeBtn.addEventListener('click', closeDetail);
    dom.prevBtn.addEventListener('click', function () {
      navigateDetail(-1);
    });
    dom.nextBtn.addEventListener('click', function () {
      navigateDetail(1);
    });

    // Click on backdrop closes — track mousedown position to detect drag-select
    var detailMouseDownPos = null;
    dom.overlay.addEventListener('mousedown', function (e) {
      detailMouseDownPos = { x: e.clientX, y: e.clientY };
    });
    dom.overlay.addEventListener('click', function (e) {
      // Don't close when clicking the segmented toggle (detail tabs)
      if (e.target.closest('.detail-tabs')) return;
      // Don't close when clicking the video/progression area
      if (e.target.closest('#video-poster-container')) return;
      // Don't close when clicking nav arrows (they navigate instead)
      if (e.target.closest('.detail-nav')) return;
      // Don't close when user dragged to select text
      if (detailMouseDownPos) {
        var dx = e.clientX - detailMouseDownPos.x;
        var dy = e.clientY - detailMouseDownPos.y;
        if (dx * dx + dy * dy > 25) return;
      }
      closeDetail();
    });

    // Detail tab switching
    document.querySelectorAll('.detail-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!this.classList.contains('disabled')) {
          switchDetailTab(this.dataset.detailTab);
        }
      });
    });

    // Keyboard navigation
    document.addEventListener('keydown', function (e) {
      if (!dom.overlay.classList.contains('open')) return;

      if (e.key === 'Escape') {
        closeDetail();
      } else if (e.key === 'Tab') {
        // Focus trap: keep Tab cycling within the overlay
        var focusable = dom.overlay.querySelectorAll(
          'button:not([disabled]):not([style*="display: none"]):not(.disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        var items = Array.prototype.filter.call(focusable, function (el) {
          return el.offsetParent !== null;
        });
        if (items.length === 0) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      } else if (!isHighlightDetail && e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateDetail(-1);
      } else if (!isHighlightDetail && e.key === 'ArrowRight') {
        e.preventDefault();
        navigateDetail(1);
      }
    });

    // Prevent native video controls from stealing keyboard focus
    dom.overlay.setAttribute('tabindex', '-1');
    var pointerOnVideo = false;

    function refocusIfOnVideo() {
      if (dom.overlay.classList.contains('open') && document.activeElement === dom.video) {
        dom.overlay.focus();
      }
    }

    // Track pointer state so we don't interrupt drag-to-seek
    dom.posterContainer.addEventListener('pointerdown', function () {
      pointerOnVideo = true;
    }, true);

    document.addEventListener('pointerup', function () {
      if (pointerOnVideo) {
        pointerOnVideo = false;
        setTimeout(refocusIfOnVideo, 0);
      }
    });

    // Handle non-pointer focus changes (e.g., Tab somehow reaching the video)
    dom.video.addEventListener('focusin', function () {
      if (!pointerOnVideo) {
        setTimeout(refocusIfOnVideo, 0);
      }
    });

    // Hash change
    window.addEventListener('hashchange', function () {
      var hash = window.location.hash.replace('#', '');
      if (BRUSH_ORDER.includes(hash) && hash !== activeBrush) {
        activeBrush = hash;
        activeSubTab = 'paintings';
        syncBrushTabs();
        renderGallery();
      }
    });
  }

  /* ---- Utilities ---- */

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(s));
    return div.innerHTML;
  }

  function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---- Start ---- */

  document.addEventListener('DOMContentLoaded', init);

})();
