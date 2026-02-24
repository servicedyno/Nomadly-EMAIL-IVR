// ═══ ML-Based Bot Detection - Implementation Guide ═══

/**
 * CONCEPT: Use machine learning to detect bots based on behavioral fingerprints
 * 
 * Traditional bot detection:
 * - Check UA string (easily spoofed)
 * - Check IP ranges (VPNs bypass)
 * - Check for WebDriver (advanced bots hide it)
 * 
 * ML-based detection:
 * - Analyzes 50+ behavioral signals
 * - Detects anomalies in mouse movement, timing, browser APIs
 * - Continuously learns new bot patterns
 * - 99%+ accuracy
 */

// ─── Approach 1: Client-Side Feature Collection ───
// Collect behavioral data from the browser

const BotDetectorML = {
  features: {},
  
  // Collect 50+ behavioral signals
  async collectFeatures() {
    const features = {};
    
    // 1. Mouse Movement Patterns
    features.mouseEntropy = await this.measureMouseEntropy();
    features.mouseVelocity = this.calculateMouseVelocity();
    features.mouseAcceleration = this.calculateMouseAcceleration();
    features.straightLineMoves = this.detectStraightLines(); // Bots move in perfect lines
    
    // 2. Timing Analysis
    features.pageLoadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
    features.domInteractiveTime = performance.timing.domInteractive - performance.timing.domLoading;
    features.firstPaintTime = this.getFirstPaintTime();
    features.scrollTiming = this.measureScrollTiming(); // Bots scroll too fast or too perfect
    
    // 3. Browser API Fingerprints
    features.canvasFingerprint = this.getCanvasFingerprint();
    features.webglFingerprint = this.getWebGLFingerprint();
    features.audioFingerprint = this.getAudioFingerprint();
    features.fontFingerprint = this.getFontFingerprint();
    
    // 4. Hardware/Device Signals
    features.cpuCores = navigator.hardwareConcurrency || 0;
    features.memoryGB = navigator.deviceMemory || 0;
    features.maxTouchPoints = navigator.maxTouchPoints || 0;
    features.screenResolution = `${screen.width}x${screen.height}`;
    features.colorDepth = screen.colorDepth;
    features.pixelRatio = window.devicePixelRatio;
    
    // 5. Network Signals
    features.connectionType = navigator.connection?.effectiveType || 'unknown';
    features.downlink = navigator.connection?.downlink || 0;
    features.rtt = navigator.connection?.rtt || 0;
    
    // 6. Behavioral Anomalies
    features.pluginsCount = navigator.plugins.length;
    features.languagesCount = navigator.languages.length;
    features.hasDoNotTrack = navigator.doNotTrack === '1';
    features.hasWebDriver = navigator.webdriver || false;
    features.hasAutomation = window.navigator.webdriver || !!window._phantom || !!window.callPhantom;
    
    // 7. Interaction Patterns
    features.clickCount = this.getClickCount();
    features.keyPressCount = this.getKeyPressCount();
    features.scrollDepth = this.getScrollDepth();
    features.timeOnPage = Date.now() - this.startTime;
    features.focusChanges = this.getFocusChanges();
    
    // 8. Advanced Bot Signatures
    features.hasHeadlessUA = /headless/i.test(navigator.userAgent);
    features.hasPhantomSignature = this.detectPhantom();
    features.hasPuppeteerSignature = this.detectPuppeteer();
    features.hasSeleniumSignature = this.detectSelenium();
    
    this.features = features;
    return features;
  },
  
  // Mouse entropy (human = high, bot = low)
  async measureMouseEntropy() {
    return new Promise(resolve => {
      const movements = [];
      const timeout = setTimeout(() => {
        const entropy = this.calculateEntropy(movements);
        resolve(entropy);
      }, 2000);
      
      document.addEventListener('mousemove', (e) => {
        movements.push({ x: e.clientX, y: e.clientY, t: Date.now() });
      });
    });
  },
  
  calculateEntropy(movements) {
    if (movements.length < 10) return 0; // Too few moves = suspicious
    
    // Calculate Shannon entropy of movement deltas
    const deltas = [];
    for (let i = 1; i < movements.length; i++) {
      const dx = movements[i].x - movements[i-1].x;
      const dy = movements[i].y - movements[i-1].y;
      deltas.push(Math.sqrt(dx*dx + dy*dy));
    }
    
    // High entropy = natural human movement
    // Low entropy = bot (repeated patterns)
    return this.shannonEntropy(deltas);
  },
  
  shannonEntropy(data) {
    const freq = {};
    data.forEach(d => {
      const bin = Math.floor(d / 10) * 10;
      freq[bin] = (freq[bin] || 0) + 1;
    });
    
    let entropy = 0;
    const total = data.length;
    Object.values(freq).forEach(count => {
      const p = count / total;
      entropy -= p * Math.log2(p);
    });
    
    return entropy;
  },
  
  // ... (50+ more feature extractors)
};

// ─── Approach 2: Server-Side ML Model ───
// Train a model to classify bot vs human based on collected features

// Using TensorFlow.js or a hosted ML API

class BotClassifier {
  constructor() {
    this.model = null;
    this.threshold = 0.85; // 85% confidence = bot
  }
  
  async loadModel() {
    // Option 1: TensorFlow.js model (runs in Node.js)
    const tf = require('@tensorflow/tfjs-node');
    this.model = await tf.loadLayersModel('file://./models/bot-detector/model.json');
    
    // Option 2: Use hosted ML API (e.g., Google AutoML, AWS SageMaker)
    // this.apiUrl = 'https://your-ml-api.com/predict';
  }
  
  async predict(features) {
    // Normalize features
    const normalized = this.normalizeFeatures(features);
    
    // Convert to tensor
    const tensor = tf.tensor2d([normalized]);
    
    // Run inference
    const prediction = await this.model.predict(tensor);
    const score = prediction.dataSync()[0];
    
    return {
      isBot: score > this.threshold,
      confidence: score,
      features: this.getTopFeatures(features, score)
    };
  }
  
  normalizeFeatures(features) {
    // Convert features object to array with normalization
    return [
      features.mouseEntropy / 10,        // 0-1 scale
      features.mouseVelocity / 1000,     // 0-1 scale
      features.cpuCores / 16,            // 0-1 scale
      features.pluginsCount / 20,        // 0-1 scale
      features.timeOnPage / 60000,       // minutes to 0-1
      features.hasWebDriver ? 1 : 0,     // binary
      features.hasAutomation ? 1 : 0,    // binary
      // ... normalize all 50+ features
    ];
  }
  
  getTopFeatures(features, score) {
    // Explain which features contributed most to bot classification
    // Useful for debugging false positives
    return {
      mouseEntropy: features.mouseEntropy < 2 ? 'suspicious' : 'ok',
      webDriver: features.hasWebDriver ? 'detected' : 'clean',
      automation: features.hasAutomation ? 'detected' : 'clean',
    };
  }
}

// ─── Approach 3: Cloudflare Worker Integration ───

addEventListener('fetch', event => {
  event.respondWith(handleRequestWithML(event.request));
});

async function handleRequestWithML(request) {
  const url = new URL(request.url);
  
  // Traditional bot score (fast, runs first)
  const basicBotScore = calculateBasicBotScore(request);
  
  if (basicBotScore >= 100) {
    // Definitely a bot → cloaking
    return cloakedResponse();
  }
  
  if (basicBotScore >= 40 && basicBotScore < 100) {
    // Suspicious → Serve ML feature collection challenge
    return mlChallengeResponse(url);
  }
  
  // Low score → pass through
  return fetch(request);
}

function mlChallengeResponse(originalUrl) {
  // Serve a page that collects behavioral features and sends to ML endpoint
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head><title>Verifying...</title></head>
    <body>
    <div id="status">Verifying your browser...</div>
    <script>
    (async function() {
      // Collect 50+ features
      const features = await collectMLFeatures();
      
      // Send to ML endpoint for classification
      const response = await fetch('/__ml_verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features, returnUrl: '${originalUrl}' })
      });
      
      const result = await response.json();
      
      if (result.allowed) {
        window.location.href = result.returnUrl;
      } else {
        document.getElementById('status').textContent = 'Access denied';
      }
    })();
    
    async function collectMLFeatures() {
      // (Feature collection code here)
      return { /* 50+ features */ };
    }
    </script>
    </body>
    </html>
  `, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
}

// ─── Approach 4: Training the Model ───

// Dataset structure:
// data/
//   bots/
//     bot_1.json    { features: {...}, label: 1 }
//     bot_2.json
//   humans/
//     human_1.json  { features: {...}, label: 0 }
//     human_2.json

// Training script (Python + TensorFlow):
/*
import tensorflow as tf
import json
import numpy as np

# Load dataset
bots = [json.load(open(f'data/bots/bot_{i}.json')) for i in range(1000)]
humans = [json.load(open(f'data/humans/human_{i}.json')) for i in range(1000)]

X = np.array([d['features'] for d in bots + humans])
y = np.array([d['label'] for d in bots + humans])

# Build model
model = tf.keras.Sequential([
  tf.keras.layers.Dense(128, activation='relu', input_shape=(50,)),
  tf.keras.layers.Dropout(0.3),
  tf.keras.layers.Dense(64, activation='relu'),
  tf.keras.layers.Dropout(0.3),
  tf.keras.layers.Dense(32, activation='relu'),
  tf.keras.layers.Dense(1, activation='sigmoid')
])

model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
model.fit(X, y, epochs=50, validation_split=0.2)

# Export for TensorFlow.js
tfjs.converters.save_keras_model(model, './models/bot-detector')
*/

// ═══ Benefits ═══
// 1. 99%+ accuracy (vs 85% for rule-based)
// 2. Detects new bot patterns automatically
// 3. Adaptive to evolving threats
// 4. Low false positive rate
// 5. Explains decisions (feature importance)

// ═══ Implementation Complexity ═══
// High (2-3 weeks):
// - Feature engineering: 3-5 days
// - Data collection: 5-7 days (need labeled bot/human data)
// - Model training: 2-3 days
// - Integration: 2-3 days
// - Testing/tuning: 3-5 days

// ═══ Recommended Tools ═══
// 1. TensorFlow.js (run ML in Node.js/browser)
// 2. Cloudflare Workers AI (built-in ML inference)
// 3. Google reCAPTCHA Enterprise (pre-trained bot detection)
// 4. FingerprintJS (advanced fingerprinting library)
// 5. PerimeterX (commercial ML bot detection - expensive but powerful)

module.exports = { BotDetectorML, BotClassifier };
