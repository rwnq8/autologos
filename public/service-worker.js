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

  try {
    // The original request's body is a stream. To use it in a new fetch,
    // we must pass it directly. We cannot read it first (e.g., with .blob() or .json())
    // because that would consume the stream and break streaming.
    const response = await fetch(proxyUrl, {
      method: request.method,
      headers: headers,
      // Pass the body stream directly if it's not a GET/HEAD request.
      body: (request.method !== 'GET' && request.method !== 'HEAD') ? request.body : null,
      // 'duplex: "half"' is required by some browsers to allow streaming request bodies.
      duplex: 'half',
      mode: 'cors',
    });
    return response;
  } catch (error) {
    console.error(`[SW] Error proxying Gemini API request to ${proxyUrl}:`, error);
    return new Response('Service Worker: API proxy failed', { status: 500 });
  }
};

// Function to handle the URL browsing proxy
const handleUrlBrowseProxy = async (request) => {
  const requestUrl = new URL(request.url);
  // The full target URL is expected to be encoded as the final part of the path
  const targetUrlEncoded = requestUrl.pathname.substring(BROWSE_PROXY_PREFIX.length);
  const targetUrl = decodeURIComponent(targetUrlEncoded);

  try {
    // Attempt a standard fetch. The service worker context can bypass some CORS preflight issues.
    const response = await fetch(targetUrl, { redirect: 'follow' });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const textContent = await response.text();
    return new Response(textContent, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });

  } catch (error) {
    const errorMessage = `Service Worker: Browse proxy failed for ${targetUrl}. The server may be unreachable or has a strict CORS policy. Error: ${error.message}`;
    console.error(`[SW] Error in browse proxy for ${targetUrl}:`, error);
    return new Response(errorMessage, { status: 502 }); // Bad Gateway, as we failed to proxy
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
