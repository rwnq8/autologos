

// public/service-worker.js

const PROXY_HOST = 'https://autologos-iterative-process-engine-183501038626.us-west1.run.app';
const GEMINI_API_HOST = 'generativelanguage.googleapis.com';
const BROWSE_PROXY_PREFIX = '/browse-proxy/';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim()); // Become available to all pages
});

// Function to handle the Gemini API proxy
const handleGeminiProxy = async (request) => {
  const url = new URL(request.url);
  const proxyUrl = `${PROXY_HOST}/api-proxy${url.pathname}${url.search}`;
  
  const headers = new Headers(request.headers);
  headers.set('X-Forwarded-Host', url.hostname);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000); // 90-second timeout for generative AI call

  try {
    const GeminiRequest = new Request(proxyUrl, {
      method: request.method,
      headers: headers,
      body: (request.method !== 'GET' && request.method !== 'HEAD') ? request.body : null,
      duplex: 'half',
      mode: 'cors',
      signal: controller.signal,
    });

    const response = await fetch(GeminiRequest);
    clearTimeout(timeoutId); // Clear timeout on successful fetch start

    if (!response.ok || response.status === 204) {
      return response;
    }

    const { readable, writable } = new TransformStream();
    response.body.pipeTo(writable);
    
    return new Response(readable, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

  } catch (error) {
    clearTimeout(timeoutId);
    const errorMessage = error.name === 'AbortError' 
      ? `Service Worker: API proxy request timed out after 90 seconds.`
      : `Service Worker: API proxy failed. ${error.message}`;
    
    console.error(`[SW] Error proxying Gemini API request to ${proxyUrl}:`, errorMessage);
    return new Response(JSON.stringify({ error: { message: errorMessage } }), {
      status: error.name === 'AbortError' ? 504 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Function to handle the URL browsing proxy
const handleUrlBrowseProxy = async (request) => {
  const requestUrl = new URL(request.url);
  const targetUrlEncoded = requestUrl.pathname.substring(BROWSE_PROXY_PREFIX.length);
  const targetUrl = decodeURIComponent(targetUrlEncoded);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second timeout for browsing a URL

  try {
    const response = await fetch(targetUrl, { 
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const textContent = await response.text();
    // Return a JSON object for consistency with other tool responses
    return new Response(JSON.stringify({ content: textContent }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

  } catch (error) {
    clearTimeout(timeoutId);
    let errorMessage = `Service Worker: Browse proxy failed for ${targetUrl}. Error: ${error.message}`;
    if (error.name === 'AbortError') {
      errorMessage = `Service Worker: Browse proxy timed out after 20 seconds for ${targetUrl}.`;
    }

    console.error(`[SW] Error in browse proxy for ${targetUrl}:`, error);
    return new Response(JSON.stringify({ error: { message: errorMessage } }), {
      status: error.name === 'AbortError' ? 504 : 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};


self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Intercept Gemini API calls
  if (requestUrl.hostname === GEMINI_API_HOST) {
    event.respondWith(handleGeminiProxy(event.request));
    return;
  }

  // Intercept URL Browse proxy calls
  if (requestUrl.pathname.startsWith(BROWSE_PROXY_PREFIX)) {
    event.respondWith(handleUrlBrowseProxy(event.request));
    return;
  }
  
  // For other requests, do nothing and let the browser handle it.
});