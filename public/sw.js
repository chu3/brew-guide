if(!self.define){let e,s={};const i=(i,n)=>(i=new URL(i+".js",n).href,s[i]||new Promise((s=>{if("document"in self){const e=document.createElement("script");e.src=i,e.onload=s,document.head.appendChild(e)}else e=i,importScripts(i),s()})).then((()=>{let e=s[i];if(!e)throw new Error(`Module ${i} didn’t register its module`);return e})));self.define=(n,a)=>{const c=e||("document"in self?document.currentScript.src:"")||location.href;if(s[c])return;let r={};const t=e=>i(e,c),o={module:{uri:c},exports:r,require:t};s[c]=Promise.all(n.map((e=>o[e]||t(e)))).then((e=>(a(...e),r)))}}define(["./workbox-8232f3e4"],(function(e){"use strict";importScripts(),self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"/_next/static/chunks/233.2066bb1350a2492b.js",revision:"2066bb1350a2492b"},{url:"/_next/static/chunks/251-c0167cd743ae96fc.js",revision:"OYzigqw2qn2xhv9Jwn_ie"},{url:"/_next/static/chunks/300.d869c9a4b16bfc93.js",revision:"d869c9a4b16bfc93"},{url:"/_next/static/chunks/4bd1b696-5a5a3e97935022e6.js",revision:"OYzigqw2qn2xhv9Jwn_ie"},{url:"/_next/static/chunks/63.b968addb0eeb2727.js",revision:"b968addb0eeb2727"},{url:"/_next/static/chunks/647.2c1b76d48b363710.js",revision:"2c1b76d48b363710"},{url:"/_next/static/chunks/684-a138d8070b247569.js",revision:"OYzigqw2qn2xhv9Jwn_ie"},{url:"/_next/static/chunks/766.b3a715acc88c6c8d.js",revision:"b3a715acc88c6c8d"},{url:"/_next/static/chunks/app/_not-found/page-1b09f6ef81a754c6.js",revision:"OYzigqw2qn2xhv9Jwn_ie"},{url:"/_next/static/chunks/app/layout-1d3d10b1da353596.js",revision:"OYzigqw2qn2xhv9Jwn_ie"},{url:"/_next/static/chunks/app/page-0a43a0927fac4895.js",revision:"OYzigqw2qn2xhv9Jwn_ie"},{url:"/_next/static/chunks/framework-859199dea06580b0.js",revision:"OYzigqw2qn2xhv9Jwn_ie"},{url:"/_next/static/chunks/main-8d9975505db129c2.js",revision:"OYzigqw2qn2xhv9Jwn_ie"},{url:"/_next/static/chunks/main-app-9a8285ab7613d71a.js",revision:"OYzigqw2qn2xhv9Jwn_ie"},{url:"/_next/static/chunks/pages/_app-da15c11dea942c36.js",revision:"OYzigqw2qn2xhv9Jwn_ie"},{url:"/_next/static/chunks/pages/_error-cc3f077a18ea1793.js",revision:"OYzigqw2qn2xhv9Jwn_ie"},{url:"/_next/static/chunks/polyfills-42372ed130431b0a.js",revision:"846118c33b2c0e922d7b3a7676f81f6f"},{url:"/_next/static/chunks/webpack-0b0d1d3170b636ea.js",revision:"OYzigqw2qn2xhv9Jwn_ie"},{url:"/_next/static/css/dcc5a18bae9aaf68.css",revision:"dcc5a18bae9aaf68"},{url:"/favicon.ico",revision:"bb40bd5a584246488b8e9b22dcb4bbe7"},{url:"/file.svg",revision:"d09f95206c3fa0bb9bd9fefabfd0ea71"},{url:"/globe.svg",revision:"2aaafa6a49b6563925fe440891e32717"},{url:"/icons/icon-192x192.png",revision:"2949a52894875f42e1823dd9ac398094"},{url:"/icons/icon-512x512.png",revision:"b1c845f773e194dea1f39cb385acdd3f"},{url:"/images/pour-center-motion-1.svg",revision:"9feb5f01705117d7de525f564007a5d8"},{url:"/images/pour-center-motion-2.svg",revision:"c0b7cf81204689f515de989814f68780"},{url:"/images/pour-center-motion-3.svg",revision:"7e1b5a4064857eaeaac19fcc67105ed1"},{url:"/images/pour-spiral-motion-1.svg",revision:"b92248357901573fde29bc4ffdd32226"},{url:"/images/pour-spiral-motion-2.svg",revision:"9012478dbb996c9d963cd4598d625246"},{url:"/images/pour-spiral-motion-3.svg",revision:"22bde6bc612d421f6701beab269ca0f0"},{url:"/images/pour-spiral-motion-4.svg",revision:"ad3fe58b3f2f4f70e2440e6249c751ae"},{url:"/images/v60-base.svg",revision:"04d7963abad95647f17c8c7c7c0ff94c"},{url:"/images/valve-closed.svg",revision:"67ae613e7f51e088ebfd3cc5d823f0d9"},{url:"/images/valve-open.svg",revision:"21e5decb0de1a969ec1a7f5df10d536c"},{url:"/manifest.json",revision:"6b32f3649b5b3b36f888f7ff18ff800e"},{url:"/next.svg",revision:"8e061864f388b47f33a1c3780831193e"},{url:"/sounds/correct.mp3",revision:"8ddaa0402388696e15043167e4a6ae18"},{url:"/sounds/ding.mp3",revision:"bc9adfdc3fee2521ae60d2df94b211a6"},{url:"/sounds/start.mp3",revision:"387e7a9e5dfaf22381e02607a2e0ef8f"},{url:"/sounds/stop.mp3",revision:"1ed29636231464bcd45d97c3f3678e59"},{url:"/sw-dev-unregister.js",revision:"32552e629d7002d221ba03a70188b4b7"},{url:"/vercel.svg",revision:"c0af2f507b369b085b35ef4bbe3bcf1e"},{url:"/window.svg",revision:"a2760511c65806022ad20adf74370ff3"}],{ignoreURLParametersMatching:[]}),e.cleanupOutdatedCaches(),e.registerRoute("/",new e.NetworkFirst({cacheName:"start-url",plugins:[{cacheWillUpdate:async({request:e,response:s,event:i,state:n})=>s&&"opaqueredirect"===s.type?new Response(s.body,{status:200,statusText:"OK",headers:s.headers}):s}]}),"GET"),e.registerRoute(/^https?.*/,new e.NetworkFirst({cacheName:"offline-cache",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:200,maxAgeSeconds:86400}),new e.CacheableResponsePlugin({statuses:[0,200]})]}),"GET"),e.registerRoute(/\/$/,new e.NetworkFirst({cacheName:"html-cache",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:10,maxAgeSeconds:86400}),new e.CacheableResponsePlugin({statuses:[0,200]})]}),"GET"),e.registerRoute(/\/_next\/static\/.*/i,new e.CacheFirst({cacheName:"static-resources",plugins:[new e.ExpirationPlugin({maxEntries:200,maxAgeSeconds:2592e3}),new e.CacheableResponsePlugin({statuses:[0,200]})]}),"GET"),e.registerRoute(/\/_next\/image\?url=.+/i,new e.CacheFirst({cacheName:"next-image",plugins:[new e.ExpirationPlugin({maxEntries:100,maxAgeSeconds:86400}),new e.CacheableResponsePlugin({statuses:[0,200]})]}),"GET"),e.registerRoute(/\.(?:mp3)$/i,new e.CacheFirst({cacheName:"audio",plugins:[new e.ExpirationPlugin({maxEntries:10,maxAgeSeconds:2592e3}),new e.CacheableResponsePlugin({statuses:[0,200]})]}),"GET"),e.registerRoute(/\.(?:png|jpg|jpeg|svg|gif|webp)$/i,new e.CacheFirst({cacheName:"images",plugins:[new e.ExpirationPlugin({maxEntries:100,maxAgeSeconds:2592e3}),new e.CacheableResponsePlugin({statuses:[0,200]})]}),"GET")}));
