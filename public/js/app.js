/**
 * App.js — Main application logic for Hacker House Goa 2026 Builder ID Generator.
 * Handles state transitions, photo validation, API requests, canvas rendering, and X sharing.
 */

import { ApiService } from './apiService.js';
import { IDCardRenderer } from './idCardRenderer.js';

// Application State
const state = {
  step: 'welcome', // 'welcome' | 'info' | 'photo' | 'processing' | 'preview'
  name: '',
  title: '',
  stack: '',
  photoFile: null,
  processedPhotoBase64: null,
  qrCodeBase64: null,
  frontImageBase64: null,
  backImageBase64: null,
  shareUrl: null,
  isFlipped: false,
};

// DOM Elements
const elements = {
  // Stepper nodes
  node1: document.getElementById('node1'),
  node2: document.getElementById('node2'),
  node3: document.getElementById('node3'),
  node4: document.getElementById('node4'),

  // Step Containers
  stepWelcome: document.getElementById('stepWelcome'),
  stepInfo: document.getElementById('stepInfo'),
  stepPhoto: document.getElementById('stepPhoto'),
  stepProcessing: document.getElementById('stepProcessing'),
  stepPreview: document.getElementById('stepPreview'),

  // Alert Box
  alertBox: document.getElementById('alertBox'),

  // Buttons
  btnStartFlow: document.getElementById('btnStartFlow'),
  btnNextToPhoto: document.getElementById('btnNextToPhoto'),
  btnBackToWelcome: document.getElementById('btnBackToWelcome'),
  btnBackToInfo: document.getElementById('btnBackToInfo'),
  btnGenerateID: document.getElementById('btnGenerateID'),
  btnDownloadPDF: document.getElementById('btnDownloadPDF'),
  btnShareX: document.getElementById('btnShareX'),
  btnEditCard: document.getElementById('btnEditCard'),

  // Form Inputs
  inputName: document.getElementById('inputName'),
  inputTitle: document.getElementById('inputTitle'),
  inputStack: document.getElementById('inputStack'),

  // Photo Dropzone
  photoDropzone: document.getElementById('photoDropzone'),
  btnChoosePhoto: document.getElementById('btnChoosePhoto'),
  photoInput: document.getElementById('photoInput'),
  previewBox: document.getElementById('previewBox'),
  photoPreviewImg: document.getElementById('photoPreviewImg'),
  photoFileName: document.getElementById('photoFileName'),

  // Processing Loading
  loadingStatus: document.getElementById('loadingStatus'),
  loadingSubtext: document.getElementById('loadingSubtext'),

  // Card Preview Canvases
  frontCanvasPreview: document.getElementById('frontCanvasPreview'),
  backCanvasPreview: document.getElementById('backCanvasPreview'),
};

/**
 * Displays error or informational alert message to user.
 */
function showAlert(message) {
  if (!message) {
    elements.alertBox.classList.remove('show');
    elements.alertBox.textContent = '';
    return;
  }
  elements.alertBox.textContent = message;
  elements.alertBox.classList.add('show');
}

/**
 * Updates UI view based on current state step.
 */
function setStep(newStep) {
  state.step = newStep;
  showAlert(null); // clear alerts on step change

  // Safely hide all steps
  [elements.stepWelcome, elements.stepInfo, elements.stepPhoto, elements.stepProcessing, elements.stepPreview].forEach(stepEl => {
    if (stepEl) stepEl.classList.remove('active');
  });

  // Safely reset stepper nodes
  [elements.node1, elements.node2, elements.node3, elements.node4].forEach(n => {
    if (n) n.classList.remove('active', 'completed');
  });

  // Activate target step and stepper node
  switch (newStep) {
    case 'info':
      if (elements.stepInfo) elements.stepInfo.classList.add('active');
      if (elements.node1) elements.node1.classList.add('active');
      break;

    case 'photo':
      if (elements.stepPhoto) elements.stepPhoto.classList.add('active');
      if (elements.node1) elements.node1.classList.add('completed');
      if (elements.node2) elements.node2.classList.add('active');
      break;

    case 'processing':
      if (elements.stepProcessing) elements.stepProcessing.classList.add('active');
      if (elements.node1) elements.node1.classList.add('completed');
      if (elements.node2) elements.node2.classList.add('completed');
      if (elements.node3) elements.node3.classList.add('active');
      break;

    case 'preview':
      if (elements.stepPreview) elements.stepPreview.classList.add('active');
      if (elements.node1) elements.node1.classList.add('completed');
      if (elements.node2) elements.node2.classList.add('completed');
      if (elements.node3) elements.node3.classList.add('completed');
      if (elements.node4) elements.node4.classList.add('completed');
      break;

    default:
      if (elements.stepInfo) elements.stepInfo.classList.add('active');
      if (elements.node1) elements.node1.classList.add('active');
      break;
  }
}

/**
 * Validates selected photo file format and size.
 */
function validatePhotoFile(file) {
  if (!file) return 'Please select a photo file.';

  const validTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'image/heic', 'image/heif'
  ];
  const extension = file.name.split('.').pop().toLowerCase();
  const validExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

  if (!validTypes.includes(file.type) && !validExts.includes(extension)) {
    return 'Invalid image type. Please upload a JPG, PNG, WEBP, or HEIC file.';
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return `File size is ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum allowed is 10MB.`;
  }

  return null;
}

/**
 * Handles file selection for photo upload.
 */
function handleFileSelect(file) {
  const err = validatePhotoFile(file);
  if (err) {
    showAlert(err);
    state.photoFile = null;
    elements.btnGenerateID.disabled = true;
    elements.previewBox.style.display = 'none';
    if (elements.btnChoosePhoto) elements.btnChoosePhoto.textContent = 'Choose Photo';
    return;
  }

  showAlert(null);
  state.photoFile = file;
  elements.btnGenerateID.disabled = false;
  if (elements.btnChoosePhoto) elements.btnChoosePhoto.textContent = 'Replace Photo';

  // Render local preview
  const reader = new FileReader();
  reader.onload = (e) => {
    elements.photoPreviewImg.src = e.target.result;
    elements.photoFileName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
    elements.previewBox.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

/**
 * Runs the full ID Card Generation pipeline through backend APIs & HTML5 Canvas.
 */
async function generateIDCardPipeline() {
  setStep('processing');

  try {
    // 1. Process Photo (EXIF auto-rotate + 1:1 crop)
    elements.loadingStatus.textContent = '1/2 Processing Photo...';
    elements.loadingSubtext.textContent = 'Auto-rotating camera orientation and cropping to 1:1 square via Sharp';
    const imageResult = await ApiService.processImage(state.photoFile);
    state.processedPhotoBase64 = imageResult.base64Photo;

    // 2. Render Official Front & Back Canvas Cards
    elements.loadingStatus.textContent = '2/2 Compositing Official ID Cards...';
    elements.loadingSubtext.textContent = 'Rendering official Front and Back ID badges';

    await IDCardRenderer.renderFrontCard(elements.frontCanvasPreview, {
      name: state.name,
      title: state.title,
      stack: state.stack,
      processedPhotoBase64: state.processedPhotoBase64,
    });

    await IDCardRenderer.renderBackCard(elements.backCanvasPreview);

    // Store generated base64 images for PDF & Share
    const cardImages = await IDCardRenderer.generateCardImages({
      name: state.name,
      title: state.title,
      stack: state.stack,
      processedPhotoBase64: state.processedPhotoBase64,
    });

    state.frontImageBase64 = cardImages.frontImageBase64;
    state.backImageBase64 = cardImages.backImageBase64;

    setStep('preview');
  } catch (err) {
    console.error('Generation Error:', err);
    setStep('photo');
    showAlert(`Failed to generate Builder ID: ${err.message}`);
  }
}

/**
 * Triggers native PDF download via POST /api/generate-pdf.
 */
async function handleDownloadPDF() {
  if (!state.frontImageBase64 || !state.backImageBase64) {
    showAlert('Card images are missing. Please re-generate your card.');
    return;
  }

  const originalText = elements.btnDownloadPDF.innerHTML;
  elements.btnDownloadPDF.disabled = true;
  elements.btnDownloadPDF.innerHTML = '⏳ Generating PDF...';

  try {
    const filename = `HH_Goa_2026_Builder_ID_${state.name.replace(/\s+/g, '_')}.pdf`;
    await ApiService.downloadPDF(state.frontImageBase64, state.backImageBase64, filename);
  } catch (err) {
    showAlert(`PDF Download Error: ${err.message}`);
  } finally {
    elements.btnDownloadPDF.disabled = false;
    elements.btnDownloadPDF.innerHTML = originalText;
  }
}

/**
 * Creates share link via POST /api/create-share-link and opens X Tweet Intent.
 */
async function handleShareOnX() {
  if (!state.frontImageBase64 || !state.backImageBase64) {
    showAlert('Card images are missing. Please re-generate your card.');
    return;
  }

  const originalText = elements.btnShareX.innerHTML;
  elements.btnShareX.disabled = true;
  elements.btnShareX.innerHTML = '⏳ Creating Share Link...';

  try {
    const result = await ApiService.createShareLink(state.frontImageBase64, state.backImageBase64);
    state.shareUrl = result.shareUrl;

    // Build Twitter Tweet Intent text with EXACT required hashtag #FrameInGOA
    const tweetText = 'Just claimed my official Hacker House Goa 2026 Builder ID! #FrameInGOA';
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(state.shareUrl)}`;

    // Open X Share Window
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
  } catch (err) {
    showAlert(`Share Link Error: ${err.message}`);
  } finally {
    elements.btnShareX.disabled = false;
    elements.btnShareX.innerHTML = originalText;
  }
}

// ----------------------------------------------------------------------------
// Event Listeners & Initialization
// ----------------------------------------------------------------------------
function initEventListeners() {
  // Navigation Flow
  if (elements.btnStartFlow) {
    elements.btnStartFlow.addEventListener('click', () => setStep('info'));
  }
  if (elements.btnBackToWelcome) {
    elements.btnBackToWelcome.addEventListener('click', () => setStep('info'));
  }

  if (elements.btnNextToPhoto) {
    elements.btnNextToPhoto.addEventListener('click', () => {
      state.name = elements.inputName ? elements.inputName.value.trim() : '';
      state.title = elements.inputTitle ? elements.inputTitle.value.trim() : '';
      state.stack = elements.inputStack ? elements.inputStack.value.trim() : '';

      if (!state.name || !state.title) {
        showAlert('Please fill in both Full Name and Builder Title before proceeding.');
        return;
      }

      setStep('photo');
    });
  }

  if (elements.btnBackToInfo) {
    elements.btnBackToInfo.addEventListener('click', () => {
      if (elements.inputName) elements.inputName.value = state.name;
      if (elements.inputTitle) elements.inputTitle.value = state.title;
      setStep('info');
    });
  }

  if (elements.btnEditCard) {
    elements.btnEditCard.addEventListener('click', () => {
      if (elements.inputName) elements.inputName.value = state.name;
      if (elements.inputTitle) elements.inputTitle.value = state.title;
      setStep('info');
    });
  }

  // Photo Dropzone & File Picker Events
  if (elements.btnChoosePhoto) {
    elements.btnChoosePhoto.addEventListener('click', (e) => {
      e.stopPropagation();
      if (elements.photoInput) elements.photoInput.click();
    });
  }

  if (elements.photoDropzone) {
    elements.photoDropzone.addEventListener('click', (e) => {
      if (e.target !== elements.photoInput && e.target !== elements.btnChoosePhoto) {
        if (elements.photoInput) elements.photoInput.click();
      }
    });

    elements.photoDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      elements.photoDropzone.classList.add('dragover');
    });

    elements.photoDropzone.addEventListener('dragleave', () => {
      elements.photoDropzone.classList.remove('dragover');
    });

    elements.photoDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      elements.photoDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });
  }

  if (elements.photoInput) {
    elements.photoInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
      e.target.value = ''; // Reset value to allow selecting the same file again
    });
  }

  // Generate Action
  if (elements.btnGenerateID) {
    elements.btnGenerateID.addEventListener('click', generateIDCardPipeline);
  }

  // Action Buttons
  if (elements.btnDownloadPDF) {
    elements.btnDownloadPDF.addEventListener('click', handleDownloadPDF);
  }
  if (elements.btnShareX) {
    elements.btnShareX.addEventListener('click', handleShareOnX);
  }
}

// Check Backend Health on App Boot
document.addEventListener('DOMContentLoaded', async () => {
  initEventListeners();
  const health = await ApiService.checkHealth();
  if (health.status !== 'healthy') {
    showAlert('Note: Express backend service appears offline. Ensure server.js is running on port 3000.');
  }
});
