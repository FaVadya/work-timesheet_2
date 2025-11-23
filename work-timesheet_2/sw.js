// sw.js
const CACHE_NAME = 'work-timesheet-v1.2';
const STATIC_CACHE = 'static-v1.1';

// Файлы для кэширования
const STATIC_FILES = [
    './',
    './index.html',
    './404.html',
    './manifest.json',
    './favicon.ico'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker: Установка');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('Service Worker: Кэширование статических файлов');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => self.skipWaiting())
    );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Активация');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME && cache !== STATIC_CACHE) {
                        console.log('Service Worker: Удаление старого кэша', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
    // Пропускаем не-GET запросы и запросы к внешним ресурсам
    if (event.request.method !== 'GET') return;
    
    const url = new URL(event.request.url);
    
    // Пропускаем запросы к API и внешним ресурсам
    if (url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Возвращаем кэшированную версию если есть
                if (response) {
                    return response;
                }

                // Иначе делаем сетевой запрос
                return fetch(event.request)
                    .then((fetchResponse) => {
                        // Кэшируем только успешные ответы и статические файлы
                        if (fetchResponse && fetchResponse.status === 200) {
                            const responseToCache = fetchResponse.clone();
                            caches.open(STATIC_CACHE)
                                .then((cache) => {
                                    // Кэшируем только HTML, CSS, JS
                                    if (event.request.url.match(/\.(html|css|js|json)$/)) {
                                        cache.put(event.request, responseToCache);
                                    }
                                });
                        }
                        return fetchResponse;
                    })
                    .catch(() => {
                        // Fallback для страниц - возвращаем index.html
                        if (event.request.destination === 'document') {
                            return caches.match('./index.html');
                        }
                    });
            })
    );
});

// Фоновая синхронизация (если понадобится)
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('Service Worker: Фоновая синхронизация');
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    // Здесь можно добавить фоновую синхронизацию данных
    console.log('Выполняется фоновая синхронизация');
}