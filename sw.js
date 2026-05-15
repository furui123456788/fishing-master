const CACHE_NAME = 'fishing-master-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/icons/icon-512.png',
    '/icons/icon-192.png'
];

// 安装：缓存核心文件
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// 拦截请求：缓存优先 + 网络回退
self.addEventListener('fetch', (event) => {
    // API 请求走网络
    if (event.request.url.includes('api.open-meteo.com')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('/index.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).then((response) => {
                // 缓存新请求
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            });
        }).catch(() => {
            // 离线回退
            if (event.request.mode === 'navigate') {
                return caches.match('/index.html');
            }
        })
    );
});
