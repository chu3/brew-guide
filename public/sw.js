if(!self.define){let e,s={};const n=(n,t)=>(n=new URL(n+".js",t).href,s[n]||new Promise((s=>{if("document"in self){const e=document.createElement("script");e.src=n,e.onload=s,document.head.appendChild(e)}else e=n,importScripts(n),s()})).then((()=>{let e=s[n];if(!e)throw new Error(`Module ${n} didn’t register its module`);return e})));self.define=(t,i)=>{const a=e||("document"in self?document.currentScript.src:"")||location.href;if(s[a])return;let c={};const r=e=>n(e,a),o={module:{uri:a},exports:c,require:r};s[a]=Promise.all(t.map((e=>o[e]||r(e)))).then((e=>(i(...e),c)))}}define(["./workbox-8232f3e4"],(function(e){"use strict";importScripts(),self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"/_next/app-build-manifest.json",revision:"dd42d7f6b8d0599bf25e8750ce6bb42a"},{url:"/_next/static/chunks/117-207f633a3a5e85e0.js",revision:"nZnD2VPUWltrAckDJjP0x"},{url:"/_next/static/chunks/844-9c14684aa16f74be.js",revision:"nZnD2VPUWltrAckDJjP0x"},{url:"/_next/static/chunks/app/_not-found/page-221ef7203edcd7a2.js",revision:"nZnD2VPUWltrAckDJjP0x"},{url:"/_next/static/chunks/app/layout-2493805d966ba65b.js",revision:"nZnD2VPUWltrAckDJjP0x"},{url:"/_next/static/chunks/app/page-2711fdd9e3475f32.js",revision:"nZnD2VPUWltrAckDJjP0x"},{url:"/_next/static/chunks/fd9d1056-b11b2651f33aae7f.js",revision:"nZnD2VPUWltrAckDJjP0x"},{url:"/_next/static/chunks/framework-aec844d2ccbe7592.js",revision:"nZnD2VPUWltrAckDJjP0x"},{url:"/_next/static/chunks/main-app-f2e71ef5268d49bc.js",revision:"nZnD2VPUWltrAckDJjP0x"},{url:"/_next/static/chunks/main-e9b87f08267b919b.js",revision:"nZnD2VPUWltrAckDJjP0x"},{url:"/_next/static/chunks/pages/_app-72b849fbd24ac258.js",revision:"nZnD2VPUWltrAckDJjP0x"},{url:"/_next/static/chunks/pages/_error-7ba65e1336b92748.js",revision:"nZnD2VPUWltrAckDJjP0x"},{url:"/_next/static/chunks/polyfills-42372ed130431b0a.js",revision:"846118c33b2c0e922d7b3a7676f81f6f"},{url:"/_next/static/chunks/webpack-c8441f2d519541e3.js",revision:"nZnD2VPUWltrAckDJjP0x"},{url:"/_next/static/css/3d1604a8bd626234.css",revision:"3d1604a8bd626234"},{url:"/_next/static/nZnD2VPUWltrAckDJjP0x/_buildManifest.js",revision:"c155cce658e53418dec34664328b51ac"},{url:"/_next/static/nZnD2VPUWltrAckDJjP0x/_ssgManifest.js",revision:"b6652df95db52feb4daf4eca35380933"},{url:"/file.svg",revision:"d09f95206c3fa0bb9bd9fefabfd0ea71"},{url:"/globe.svg",revision:"2aaafa6a49b6563925fe440891e32717"},{url:"/icons/icon-192x192.png",revision:"2949a52894875f42e1823dd9ac398094"},{url:"/icons/icon-512x512.png",revision:"b1c845f773e194dea1f39cb385acdd3f"},{url:"/manifest.json",revision:"6b32f3649b5b3b36f888f7ff18ff800e"},{url:"/next.svg",revision:"8e061864f388b47f33a1c3780831193e"},{url:"/sounds/correct.mp3",revision:"8ddaa0402388696e15043167e4a6ae18"},{url:"/sounds/ding.mp3",revision:"bc9adfdc3fee2521ae60d2df94b211a6"},{url:"/sounds/start.mp3",revision:"387e7a9e5dfaf22381e02607a2e0ef8f"},{url:"/sounds/stop.mp3",revision:"1ed29636231464bcd45d97c3f3678e59"},{url:"/vercel.svg",revision:"c0af2f507b369b085b35ef4bbe3bcf1e"},{url:"/window.svg",revision:"a2760511c65806022ad20adf74370ff3"}],{ignoreURLParametersMatching:[]}),e.cleanupOutdatedCaches(),e.registerRoute("/",new e.NetworkFirst({cacheName:"start-url",plugins:[{cacheWillUpdate:async({request:e,response:s,event:n,state:t})=>s&&"opaqueredirect"===s.type?new Response(s.body,{status:200,statusText:"OK",headers:s.headers}):s}]}),"GET"),e.registerRoute(/^https?.*/,new e.NetworkFirst({cacheName:"offline-cache",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:200,maxAgeSeconds:86400}),new e.CacheableResponsePlugin({statuses:[0,200]})]}),"GET"),e.registerRoute(/\/$/,new e.NetworkFirst({cacheName:"html-cache",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:10,maxAgeSeconds:86400}),new e.CacheableResponsePlugin({statuses:[0,200]})]}),"GET"),e.registerRoute(/\/_next\/static\/.*/i,new e.CacheFirst({cacheName:"static-resources",plugins:[new e.ExpirationPlugin({maxEntries:200,maxAgeSeconds:2592e3}),new e.CacheableResponsePlugin({statuses:[0,200]})]}),"GET"),e.registerRoute(/\/_next\/image\?url=.+/i,new e.CacheFirst({cacheName:"next-image",plugins:[new e.ExpirationPlugin({maxEntries:100,maxAgeSeconds:86400}),new e.CacheableResponsePlugin({statuses:[0,200]})]}),"GET"),e.registerRoute(/\.(?:mp3)$/i,new e.CacheFirst({cacheName:"audio",plugins:[new e.ExpirationPlugin({maxEntries:10,maxAgeSeconds:2592e3}),new e.CacheableResponsePlugin({statuses:[0,200]})]}),"GET"),e.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp)$/i,new e.CacheFirst({cacheName:"images",plugins:[new e.ExpirationPlugin({maxEntries:100,maxAgeSeconds:2592e3}),new e.CacheableResponsePlugin({statuses:[0,200]})]}),"GET")}));
