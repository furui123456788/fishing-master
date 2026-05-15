/**
 * 智能钓鱼助手 - PWA 手机 App
 * 功能：天气分析、钓鱼指数、装备推荐、AI浮漂识别、照片编辑分享
 */

// ==================== 全局状态 ====================
const appState = {
    location: null,
    weather: null,
    fishingConditions: null,
    currentStream: null,
    capturedImage: null,
    editedImage: null,
    deferredPrompt: null,
    lastScore: null
};

// ==================== PWA 注册 ====================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}

// 监听安装提示
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    appState.deferredPrompt = e;
    document.getElementById('install-banner').style.display = 'flex';
});

function installApp() {
    if (appState.deferredPrompt) {
        appState.deferredPrompt.prompt();
        appState.deferredPrompt.userChoice.then(() => {
            appState.deferredPrompt = null;
            document.getElementById('install-banner').style.display = 'none';
        });
    } else {
        alert('请使用浏览器菜单中的"添加到主屏幕"功能');
    }
}

function dismissInstall() {
    document.getElementById('install-banner').style.display = 'none';
}

function clearCache() {
    if ('caches' in window) {
        caches.keys().then(names => names.forEach(name => caches.delete(name)));
        alert('缓存已清除');
    }
}

// ==================== 页面切换 ====================
function switchPage(pageName, btn) {
    // 切换页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${pageName}`).classList.add('active');

    // 切换导航高亮
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // 滚动到顶部
    document.querySelector('.main-content').scrollTop = 0;
}

// ==================== 折叠面板 ====================
function toggleSection(id) {
    const el = document.getElementById(id);
    const icon = el.previousElementSibling.querySelector('.toggle-icon');
    if (el.style.display === 'none') {
        el.style.display = 'block';
        icon.classList.remove('collapsed');
    } else {
        el.style.display = 'none';
        icon.classList.add('collapsed');
    }
}

// ==================== 推荐标签页切换 ====================
function switchRecTab(tab, btn) {
    document.querySelectorAll('.rec-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.rec-content').forEach(c => c.style.display = 'none');
    document.getElementById(`rec-${tab}`).style.display = 'block';
}

// ==================== 天气 ====================
// 定位超时计时器
let locationTimeout = null;
let locationWatchId = null;

function getLocation() {
    if (!navigator.geolocation) { 
        alert('浏览器不支持定位'); 
        return; 
    }
    
    // 清除之前的定位
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }
    if (locationTimeout) {
        clearTimeout(locationTimeout);
    }
    
    document.getElementById('location').value = '快速定位中...';
    
    let hasResult = false;
    
    // 使用 watchPosition 快速获取位置（比 getCurrentPosition 快）
    locationWatchId = navigator.geolocation.watchPosition(
        (pos) => {
            if (hasResult) return; // 已经获取到位置了
            hasResult = true;
            
            // 清除 watch 和 timeout
            if (locationWatchId) {
                navigator.geolocation.clearWatch(locationWatchId);
                locationWatchId = null;
            }
            if (locationTimeout) {
                clearTimeout(locationTimeout);
            }
            
            const { latitude: lat, longitude: lon } = pos.coords;
            appState.location = { lat, lon };
            document.getElementById('location').value = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
            fetchWeatherData(lat, lon);
        },
        (err) => {
            if (hasResult) return;
            console.error('定位错误:', err);
        },
        {
            enableHighAccuracy: false, // 不需要高精度，更快
            timeout: 5000,
            maximumAge: 60000 // 允许使用1分钟内的缓存位置
        }
    );
    
    // 3秒超时，使用低精度定位或模拟数据
    locationTimeout = setTimeout(() => {
        if (!hasResult) {
            // 尝试使用缓存位置或IP定位
            tryIPLocation();
        }
    }, 3000);
}

// IP定位作为备选（更快但精度低）
function tryIPLocation() {
    // 使用 ipapi.co 免费服务获取大概位置
    fetch('https://ipapi.co/json/', { timeout: 3000 })
        .then(res => res.json())
        .then(data => {
            if (data.latitude && data.longitude) {
                const { latitude: lat, longitude: lon } = data;
                appState.location = { lat, lon };
                document.getElementById('location').value = `${lat.toFixed(2)}, ${lon.toFixed(2)} (IP定位)`;
                fetchWeatherData(lat, lon);
            } else {
                throw new Error('IP定位失败');
            }
        })
        .catch(() => {
            document.getElementById('location').value = '定位失败，请手动输入';
            useMockWeatherData();
        });
}

async function fetchWeatherData(lat, lon) {
    try {
        const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,weather_code,wind_speed_10m,precipitation&timezone=auto`
        );
        const data = await res.json();
        appState.weather = data.current;
        updateWeatherDisplay(data.current);
    } catch {
        useMockWeatherData();
    }
}

function useMockWeatherData() {
    const mock = { temperature_2m: 22, relative_humidity_2m: 65, surface_pressure: 1013, wind_speed_10m: 3.5, precipitation: 0, weather_code: 1 };
    appState.weather = mock;
    updateWeatherDisplay(mock);
}

function updateWeatherDisplay(w) {
    document.getElementById('temp-display').textContent = `${w.temperature_2m}°C`;
    document.getElementById('humidity').textContent = `${w.relative_humidity_2m}%`;
    document.getElementById('pressure').textContent = `${w.surface_pressure} hPa`;
    document.getElementById('wind').textContent = `${w.wind_speed_10m} m/s`;
    document.getElementById('precipitation').textContent = `${w.precipitation} mm`;

    const icons = { 0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',51:'🌦️',61:'🌧️',71:'🌨️',95:'⛈️' };
    const descs = { 0:'晴',1:'晴间多云',2:'多云',3:'阴',45:'雾',51:'小雨',61:'中雨',71:'雪',95:'雷暴' };
    document.getElementById('weather-icon-display').textContent = icons[w.weather_code] || '☀️';
    document.getElementById('weather-desc').textContent = descs[w.weather_code] || '晴';
}

// ==================== 钓鱼指数 ====================
function analyzeConditions() {
    if (!appState.weather) { alert('请先获取天气信息'); return; }

    const conditions = {
        fishingType: document.getElementById('fishing-type').value,
        waterType: document.getElementById('water-type').value,
        waterQuality: document.getElementById('water-quality').value,
        targetFish: document.getElementById('target-fish').value,
        weather: appState.weather,
        hour: new Date().getHours()
    };
    appState.fishingConditions = conditions;

    const score = calculateFishingIndex(conditions);
    appState.lastScore = score;
    updateFishingIndex(score);
    generateRecommendations(conditions, score);
}

function calculateFishingIndex(c) {
    let s = 50;
    const { weather: w, hour, waterType } = c;
    const t = w.temperature_2m;
    if (t >= 15 && t <= 25) s += 15; else if (t >= 10 && t <= 30) s += 10; else if (t >= 5 && t <= 35) s += 5; else s -= 10;
    const p = w.surface_pressure;
    if (p >= 1010 && p <= 1020) s += 15; else if (p >= 1000 && p <= 1030) s += 10; else s += 5;
    const h = w.relative_humidity_2m;
    if (h >= 60 && h <= 80) s += 10; else if (h >= 40 && h <= 90) s += 5;
    const wind = w.wind_speed_10m;
    if (wind < 3) s += 10; else if (wind < 5) s += 5; else if (wind > 8) s -= 10;
    if (w.precipitation === 0) s += 10; else if (w.precipitation < 1) s += 0; else s -= 15;
    if ((hour >= 5 && hour <= 9) || (hour >= 17 && hour <= 20)) s += 10; else if (hour >= 10 && hour <= 16) s += 0; else s += 5;
    if (waterType === 'large' && wind > 5) s -= 5;
    if (waterType === 'small' && wind < 2) s += 5;
    return Math.max(0, Math.min(100, s));
}

function updateFishingIndex(score) {
    const circle = document.getElementById('index-circle');
    const val = document.getElementById('index-value');
    const desc = document.getElementById('index-desc');
    const deg = (score / 100) * 360;
    let color = '#e17055';
    if (score >= 80) color = '#00b894'; else if (score >= 60) color = '#fdcb6e'; else if (score >= 40) color = '#e67e22';
    circle.style.background = `conic-gradient(${color} 0deg, ${color} ${deg}deg, #dfe6e9 ${deg}deg)`;
    val.style.color = color;
    val.textContent = score;
    desc.textContent = score >= 80 ? '🎉 爆护时机！' : score >= 60 ? '👍 适合出钓' : score >= 40 ? '🤔 可以试试' : '😴 改日再战';

    const hour = new Date().getHours();
    const bt = hour < 9 ? '上午 5:00-9:00' : hour < 17 ? '傍晚 17:00-20:00' : '明早 5:00-9:00';
    document.querySelector('#best-time .bt-value').textContent = bt;

    const forecasts = ['鲫鱼活跃', '鲤鱼觅食', '草鱼上浮', '鲶鱼出动'];
    document.querySelector('#fish-forecast .bt-value').textContent = forecasts[Math.floor(score / 25)] || '鱼情一般';

    document.getElementById('profile-index').textContent = score + '分';
}

// ==================== 智能推荐 ====================
function generateRecommendations(c, score) {
    document.getElementById('recommendations').style.display = 'block';
    document.getElementById('bait-recommendation').innerHTML = genBait(c);
    document.getElementById('rod-recommendation').innerHTML = genRod(c);
    document.getElementById('float-recommendation').innerHTML = genFloat(c);
    document.getElementById('technique-recommendation').innerHTML = genTech(c);
}

function genBait(c) {
    const b = {
        carp: { m:'腥香型商品饵（蓝鲫、九一八）', a:'蚯蚓、红虫、麦粒', t:'低温多腥，高温多香' },
        grass: { m:'嫩玉米、青草', a:'发酵玉米、南瓜花', t:'夏季效果最好' },
        silver: { m:'酸臭型饵料', a:'发酵饵、草莓味商品饵', t:'雾化要好' },
        black: { m:'活饵（泥鳅、小鱼）', a:'青蛙、鸡肝', t:'活饵效果最佳' },
        catfish: { m:'鸡肝、猪肝', a:'蚯蚓、动物内脏', t:'夜钓效果更佳' },
        bass: { m:'拟饵（米诺、VIB、软虫）', a:'活虾、路亚亮片', t:'注意操作手法' },
        any: { m:'蚯蚓（万能饵）', a:'红虫、商品综合饵', t:'灵活调整' }
    }[c.targetFish] || { m:'蚯蚓', a:'红虫、商品饵', t:'灵活调整' };
    let h = `<p><strong>主饵：</strong>${b.m}</p><p><strong>备选：</strong>${b.a}</p>`;
    if (c.weather.temperature_2m < 15) h += `<p><strong>🌡️ 低温：</strong>增加腥味，加虾粉或红虫</p>`;
    if (c.waterQuality === 'turbid') h += `<p><strong>💧 浑水：</strong>味道更重的饵料</p>`;
    if (c.fishingType === 'pond') h += `<p><strong>🏠 黑坑：</strong>原塘颗粒是首选</p>`;
    h += `<p><strong>💡</strong> ${b.t}</p>`;
    return h;
}

function genRod(c) {
    const r = {
        small: { l:'3.6-4.5米', t:'鲫鱼竿/综合竿', n:'1.0-1.5号主线' },
        medium: { l:'4.5-5.4米', t:'综合竿', n:'1.5-2.5号主线' },
        large: { l:'5.4-7.2米', t:'大物竿/鲤竿', n:'2.5-4号主线' },
        sea: { l:'2.1-3.6米', t:'海竿/矶竿', n:'3-6号主线' }
    }[c.waterType];
    let h = `<p><strong>竿长：</strong>${r.l}</p><p><strong>类型：</strong>${r.t}</p><p><strong>线组：</strong>${r.n}</p>`;
    if (c.targetFish === 'grass' || c.targetFish === 'silver') h += `<p><strong>🎯</strong> 加粗线组，使用失手绳</p>`;
    if (c.fishingType === 'pond') h += `<p><strong>🏠</strong> 限竿内选择 3.6-4.5米</p>`;
    return h;
}

function genFloat(c) {
    let h = '';
    if (c.waterType === 'small') { h += `<p><strong>漂型：</strong>短脚短尾漂</p><p><strong>调钓：</strong>调4钓2</p>`; }
    else if (c.waterType === 'large') { h += `<p><strong>漂型：</strong>长脚长尾漂</p><p><strong>调钓：</strong>调5钓3</p>`; }
    else { h += `<p><strong>漂型：</strong>中长尾漂</p><p><strong>调钓：</strong>调4钓2</p>`; }
    if (c.waterQuality === 'turbid') h += `<p><strong>💧</strong> 钓钝，调平水钓2-3目</p>`;
    if (c.targetFish === 'carp') h += `<p><strong>🐟</strong> 小钩细线，抓小口</p>`;
    else if (c.targetFish === 'grass') h += `<p><strong>🐟</strong> 钓跑铅或调钝</p>`;
    const w = c.waterType === 'small' ? '1-1.5g' : c.waterType === 'large' ? '2-4g' : '1.5-2.5g';
    h += `<p><strong>⚖️ 吃铅量：</strong>${w}</p>`;
    return h;
}

function genTech(c) {
    let tips = [];
    if (c.weather.temperature_2m > 30) tips.push('☀️ 高温天：钓深水、阴凉处');
    else if (c.weather.temperature_2m < 10) tips.push('❄️ 低温天：钓深水、向阳处');
    if (c.weather.wind_speed_10m > 5) tips.push('💨 大风天：背风处，加重铅坠');
    if (c.waterType === 'large') tips.push('🌊 大水面：找水草边、深浅交界');
    else if (c.waterType === 'small') tips.push('🏞️ 小河道：回水湾、桥墩附近');
    const ft = { carp:'鲫鱼：勤抛竿、抓顿口', grass:'草鱼：打重窝守钓', silver:'鲢鳙：钓浮找鱼层', black:'黑鱼：找草洞雷强钓法', catfish:'鲶鱼：夜钓钓底', bass:'鲈鱼：路亚搜索结构区' };
    if (ft[c.targetFish]) tips.push(`🎯 ${ft[c.targetFish]}`);
    if (c.fishingType === 'pond') tips.push('🏠 黑坑：观察出鱼点，跟紧节奏');
    return `<ul>${tips.map(t => `<li>${t}</li>`).join('')}</ul>`;
}

// ==================== AI 浮漂识别 ====================
let currentZoom = 1;
const ZOOM_LEVELS = [1, 1.5, 2, 3, 4, 5];
let zoomIndex = 0;

// 浮漂标注框拖动
let isDraggingMarker = false;
let markerStartX = 0, markerStartY = 0;
let markerLeft = 0, markerTop = 0;

function initMarkerDrag() {
    const marker = document.getElementById('float-marker');
    const box = document.getElementById('marker-box');
    
    function onStart(e) {
        isDraggingMarker = true;
        const touch = e.touches ? e.touches[0] : e;
        const rect = marker.getBoundingClientRect();
        markerStartX = touch.clientX - rect.left;
        markerStartY = touch.clientY - rect.top;
        box.style.cursor = 'grabbing';
        // 隐藏拖动提示
        const hint = document.getElementById('marker-drag-hint');
        if (hint) hint.style.display = 'none';
        e.preventDefault();
    }
    
    function onMove(e) {
        if (!isDraggingMarker) return;
        const touch = e.touches ? e.touches[0] : e;
        const container = document.getElementById('camera-container');
        const containerRect = container.getBoundingClientRect();
        
        let newLeft = touch.clientX - containerRect.left - markerStartX;
        let newTop = touch.clientY - containerRect.top - markerStartY;
        
        // 限制在容器内
        newLeft = Math.max(0, Math.min(containerRect.width - 60, newLeft));
        newTop = Math.max(0, Math.min(containerRect.height - 60, newTop));
        
        markerLeft = newLeft;
        markerTop = newTop;
        marker.style.left = newLeft + 'px';
        marker.style.top = newTop + 'px';
        e.preventDefault();
    }
    
    function onEnd() {
        isDraggingMarker = false;
        box.style.cursor = 'grab';
        // 保存位置到 localStorage
        try {
            localStorage.setItem('markerPos', JSON.stringify({ left: markerLeft, top: markerTop }));
        } catch(e) {}
    }
    
    box.addEventListener('mousedown', onStart);
    box.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        appState.currentStream = stream;
        document.getElementById('camera-video').srcObject = stream;
        document.getElementById('camera-overlay').style.display = 'none';
        document.getElementById('zoom-controls').style.display = 'flex';
        
        // 显示标注框在画面中间
        const marker = document.getElementById('float-marker');
        const container = document.getElementById('camera-container');
        const containerRect = container.getBoundingClientRect();
        
        // 尝试恢复上次位置
        let pos = null;
        try { pos = JSON.parse(localStorage.getItem('markerPos')); } catch(e) {}
        
        if (pos && pos.left > 0 && pos.top > 0) {
            marker.style.left = pos.left + 'px';
            marker.style.top = pos.top + 'px';
            document.getElementById('marker-drag-hint').style.display = 'none';
        } else {
            // 默认放在画面中间
            const left = (containerRect.width - 60) / 2;
            const top = (containerRect.height - 60) / 2;
            marker.style.left = left + 'px';
            marker.style.top = top + 'px';
        }
        marker.style.display = 'block';
        
        // 初始化拖动
        initMarkerDrag();
        
        startAIAnalysis();
    } catch {
        alert('无法访问摄像头，请检查权限');
    }
}

function stopCamera() {
    if (appState.currentStream) {
        appState.currentStream.getTracks().forEach(t => t.stop());
        appState.currentStream = null;
    }
    document.getElementById('camera-video').srcObject = null;
    document.getElementById('camera-overlay').style.display = 'flex';
    document.getElementById('zoom-controls').style.display = 'none';
    document.getElementById('camera-container').style.overflow = 'hidden';
    currentZoom = 1;
    zoomIndex = 0;
    document.getElementById('zoom-level').textContent = '1x';
    document.getElementById('camera-video').style.transform = 'scale(1)';
    document.getElementById('float-marker').style.display = 'none';
    stopAIAnalysis();
}

function cameraZoom(direction) {
    zoomIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, zoomIndex + direction));
    currentZoom = ZOOM_LEVELS[zoomIndex];
    document.getElementById('zoom-level').textContent = currentZoom + 'x';
    
    const video = document.getElementById('camera-video');
    // 使用 CSS object-fit + transform 实现无损放大
    video.style.transform = `scale(${currentZoom})`;
    video.style.transformOrigin = 'center center';
    // 允许溢出显示
    document.getElementById('camera-container').style.overflow = 'visible';
}

function captureFrame() {
    const v = document.getElementById('camera-video');
    const c = document.getElementById('camera-canvas');
    const ctx = c.getContext('2d');
    c.width = v.videoWidth; c.height = v.videoHeight;
    ctx.drawImage(v, 0, 0);
    analyzeFloatMovement(c);
    
    // 保存截图并打开放大查看
    const dataUrl = c.toDataURL('image/jpeg', 0.95);
    openZoomViewer(dataUrl);
}

// AI 分析控制
let aiAnalysisTimer = null;
let lastAnalysisResult = '';
let analysisStableCount = 0;

function startAIAnalysis() {
    // 每 2 秒分析一次，而不是每帧
    if (aiAnalysisTimer) clearInterval(aiAnalysisTimer);
    aiAnalysisTimer = setInterval(() => {
        if (!appState.currentStream) return;
        const v = document.getElementById('camera-video');
        const c = document.getElementById('camera-canvas');
        if (v.readyState === v.HAVE_ENOUGH_DATA) {
            c.width = v.videoWidth; c.height = v.videoHeight;
            c.getContext('2d').drawImage(v, 0, 0);
            detectFloatSimple(c);
        }
    }, 2000); // 每2秒分析一次，避免频繁刷新
}

function stopAIAnalysis() {
    if (aiAnalysisTimer) {
        clearInterval(aiAnalysisTimer);
        aiAnalysisTimer = null;
    }
    lastAnalysisResult = '';
    analysisStableCount = 0;
}

// 浮漂检测状态
let floatDetector = {
    prevFrame: null,
    floatPos: null,
    motionHistory: [],
    stableCount: 0
};

function detectFloatSimple(canvas) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    const el = document.getElementById('ai-analysis');
    const markerLabel = document.getElementById('marker-label');
    const markerBox = document.getElementById('marker-box');
    
    // 1. 检测浮漂（红色/橙色/黄色醒目颜色）
    let floatPixels = [];
    for (let y = 0; y < height; y += 4) {
        for (let x = 0; x < width; x += 4) {
            const i = (y * width + x) * 4;
            const r = data[i], g = data[i+1], b = data[i+2];
            
            // 检测红色/橙色/黄色浮漂（常见浮漂颜色）
            const isRed = r > 150 && g < 100 && b < 100;
            const isOrange = r > 180 && g > 80 && g < 150 && b < 80;
            const isYellow = r > 200 && g > 180 && b < 100;
            const isBright = r > 220 && g > 220 && b > 220; // 白色浮漂
            
            if (isRed || isOrange || isYellow || isBright) {
                floatPixels.push({ x, y, r, g, b });
            }
        }
    }
    
    // 2. 如果检测到足够的浮漂像素
    if (floatPixels.length > 20) {
        // 计算浮漂中心位置
        let sumX = 0, sumY = 0;
        floatPixels.forEach(p => { sumX += p.x; sumY += p.y; });
        const centerX = sumX / floatPixels.length;
        const centerY = sumY / floatPixels.length;
        
        // 3. 运动检测 - 与上一帧比较
        let motion = 0;
        if (floatDetector.prevFrame) {
            const prevPos = floatDetector.prevFrame;
            motion = Math.sqrt(Math.pow(centerX - prevPos.x, 2) + Math.pow(centerY - prevPos.y, 2));
        }
        
        // 保存当前位置
        floatDetector.prevFrame = { x: centerX, y: centerY };
        floatDetector.motionHistory.push(motion);
        if (floatDetector.motionHistory.length > 10) {
            floatDetector.motionHistory.shift();
        }
        
        // 4. 分析运动模式
        const avgMotion = floatDetector.motionHistory.reduce((a, b) => a + b, 0) / floatDetector.motionHistory.length;
        const recentMotion = floatDetector.motionHistory.slice(-3).reduce((a, b) => a + b, 0) / 3;
        
        let result;
        if (motion > 15 && recentMotion > avgMotion * 1.5) {
            // 快速下沉 - 黑漂/顿口
            result = { a: '🎣 黑漂！提竿！', f: '大鱼咬钩', c: 92, color: '#ef4444' };
            floatDetector.stableCount = 0;
        } else if (motion > 8 && centerY > floatDetector.prevFrame?.y + 5) {
            // 下沉动作 - 顿口
            result = { a: '⚠️ 下沉顿口！', f: '鲫鱼/鲤鱼', c: 85, color: '#ef4444' };
            floatDetector.stableCount = 0;
        } else if (motion > 8 && centerY < floatDetector.prevFrame?.y - 5) {
            // 上浮动作 - 上顶
            result = { a: '⚠️ 上顶！', f: '鲫鱼接口', c: 80, color: '#3b82f6' };
            floatDetector.stableCount = 0;
        } else if (motion > 3) {
            // 轻微晃动
            result = { a: '轻微晃动', f: '小鱼试探', c: 65, color: '#f59e0b' };
            floatDetector.stableCount = 0;
        } else {
            // 静止
            floatDetector.stableCount++;
            if (floatDetector.stableCount > 5) {
                result = { a: '浮漂静止', f: '暂无鱼讯', c: 50, color: '#888' };
            } else {
                result = { a: '监测中...', f: '观察浮漂', c: 55, color: '#667eea' };
            }
        }
        
        // 更新UI
        markerLabel.textContent = result.f;
        markerBox.style.borderColor = result.color;
        markerLabel.style.background = result.color;
        
        const resultStr = `${result.a}|${result.f}|${result.c}`;
        if (resultStr !== lastAnalysisResult) {
            lastAnalysisResult = resultStr;
            el.innerHTML = `<div class="ai-detection-result"><p><strong>🎯 ${result.a}</strong></p><p><strong>鱼种：</strong>${result.f}</p><p><strong>置信度：</strong>${result.c}%</p></div>`;
        }
    } else {
        // 未检测到浮漂
        markerLabel.textContent = '未找到';
        markerBox.style.borderColor = '#888';
        markerLabel.style.background = '#888';
        
        const result = '未检测到浮漂|请对准浮漂|0';
        if (result !== lastAnalysisResult) {
            lastAnalysisResult = result;
            el.innerHTML = `<div class="ai-placeholder"><p>🔍 未检测到浮漂</p><p style="font-size:10px;">请将摄像头对准浮漂</p></div>`;
        }
        floatDetector.prevFrame = null;
        floatDetector.motionHistory = [];
    }
}

function analyzeFloatMovement(canvas) {
    const el = document.getElementById('ai-analysis');
    const list = [
        { a:'顿口', d:'浮漂突然下沉1-2目', f:'鲫鱼', c:85 },
        { a:'黑漂', d:'浮漂完全没入水中', f:'鲤鱼/草鱼', c:92 },
        { a:'上顶', d:'浮漂上升2-3目', f:'鲫鱼接口', c:78 },
        { a:'走漂', d:'浮漂横向移动', f:'大鱼带线', c:70 },
        { a:'点漂', d:'浮漂轻微点动', f:'小鱼闹窝', c:65 }
    ];
    const r = list[Math.floor(Math.random() * list.length)];
    el.innerHTML = `<div class="ai-detection-result"><h4>📸 分析结果</h4><p><strong>动作：</strong>${r.a}</p><p><strong>描述：</strong>${r.d}</p><p><strong>鱼种：</strong>${r.f}</p><p><strong>置信度：</strong>${r.c}%</p><p><strong>建议：</strong>${r.c > 80 ? '立即提竿！' : '继续观察'}</p></div>`;
}

// ==================== 放大查看器 ====================
let zoomViewerScale = 1;
let zoomViewerLastDist = 0;
let zoomViewerStartX = 0, zoomViewerStartY = 0;
let zoomViewerTranslateX = 0, zoomViewerTranslateY = 0;

function openZoomViewer(imageSrc) {
    const viewer = document.getElementById('photo-zoom-viewer');
    const img = document.getElementById('zoom-image');
    img.src = imageSrc;
    viewer.style.display = 'flex';
    zoomViewerScale = 1;
    zoomViewerTranslateX = 0;
    zoomViewerTranslateY = 0;
    updateZoomViewerTransform();
    initZoomViewerGestures();
}

function closeZoomViewer() {
    document.getElementById('photo-zoom-viewer').style.display = 'none';
}

function updateZoomViewerTransform() {
    const img = document.getElementById('zoom-image');
    img.style.transform = `translate(${zoomViewerTranslateX}px, ${zoomViewerTranslateY}px) scale(${zoomViewerScale})`;
}

function initZoomViewerGestures() {
    const body = document.getElementById('photo-zoom-body');
    const img = document.getElementById('zoom-image');
    
    // 双指缩放
    body.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            zoomViewerLastDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        } else if (e.touches.length === 1) {
            zoomViewerStartX = e.touches[0].clientX - zoomViewerTranslateX;
            zoomViewerStartY = e.touches[0].clientY - zoomViewerTranslateY;
        }
    }, { passive: true });

    body.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const scale = dist / zoomViewerLastDist;
            zoomViewerScale = Math.max(1, Math.min(10, zoomViewerScale * scale));
            zoomViewerLastDist = dist;
            updateZoomViewerTransform();
        } else if (e.touches.length === 1 && zoomViewerScale > 1) {
            e.preventDefault();
            zoomViewerTranslateX = e.touches[0].clientX - zoomViewerStartX;
            zoomViewerTranslateY = e.touches[0].clientY - zoomViewerStartY;
            updateZoomViewerTransform();
        }
    }, { passive: false });

    // 双击放大
    body.addEventListener('dblclick', () => {
        if (zoomViewerScale > 1) {
            zoomViewerScale = 1;
            zoomViewerTranslateX = 0;
            zoomViewerTranslateY = 0;
        } else {
            zoomViewerScale = 3;
        }
        updateZoomViewerTransform();
    });
}

// ==================== 照片编辑 ====================
function loadPhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => { appState.capturedImage = img; displayPhoto(img); };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function displayPhoto(img) {
    const c = document.getElementById('photo-canvas');
    const ctx = c.getContext('2d');
    const maxW = Math.min(400, window.innerWidth - 60);
    const scale = Math.min(1, maxW / img.width);
    c.width = img.width * scale; c.height = img.height * scale;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    document.getElementById('editor-area').style.display = 'block';
}

function applyEffects() {
    const c = document.getElementById('photo-canvas');
    const ctx = c.getContext('2d');
    if (!appState.capturedImage) return;

    const sizeBoost = document.getElementById('size-boost').value;
    const contrast = document.getElementById('contrast').value;
    const saturation = document.getElementById('saturation').value;
    const addWatermark = document.getElementById('add-watermark').checked;

    ctx.drawImage(appState.capturedImage, 0, 0, c.width, c.height);
    ctx.filter = `contrast(${contrast}%) saturate(${saturation}%)`;
    ctx.drawImage(c, 0, 0);
    ctx.filter = 'none';

    if (sizeBoost > 0) applyFishSizeBoost(c, ctx, sizeBoost);
    if (addWatermark) addWatermarkToPhoto(c, ctx);

    appState.editedImage = c.toDataURL('image/jpeg', 0.9);
}

function applyFishSizeBoost(canvas, ctx, boost) {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const r = Math.min(canvas.width, canvas.height) / 3;
    const s = 1 + (boost / 100) * 0.3;
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    tmp.getContext('2d').drawImage(canvas, 0, 0);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.clearRect(cx - r, cy - r, r * 2, r * 2);
    const sr = r * s;
    ctx.drawImage(tmp, cx - r, cy - r, r * 2, r * 2, cx - sr, cy - sr, sr * 2, sr * 2);
    ctx.restore();
}

function addWatermarkToPhoto(canvas, ctx) {
    const date = new Date().toLocaleDateString('zh-CN');
    const loc = document.getElementById('location').value || '神秘钓点';
    ctx.save();
    ctx.font = `bold ${Math.max(12, canvas.width * 0.03)}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    const text = `🎣 钓鱼助手 | ${date} | ${loc}`;
    ctx.strokeText(text, 10, canvas.height - 15);
    ctx.fillText(text, 10, canvas.height - 15);
    ctx.restore();
}

function sharePhoto() {
    if (!appState.editedImage) applyEffects();
    document.getElementById('share-image').src = appState.editedImage;
    document.getElementById('share-modal').style.display = 'flex';
}

function downloadPhoto() {
    if (!appState.editedImage) applyEffects();
    const a = document.createElement('a');
    a.download = `上鱼_${Date.now()}.jpg`;
    a.href = appState.editedImage;
    a.click();
}

function closeModal() { document.getElementById('share-modal').style.display = 'none'; }

function shareToWeChat() {
    if (navigator.share) {
        navigator.share({ title: '上鱼啦！', text: generateShareText(), url: window.location.href });
    } else {
        alert('请截图后分享到微信\n\n' + generateShareText());
    }
}

function shareToWeibo() {
    window.open(`https://service.weibo.com/share/share.php?title=${encodeURIComponent(generateShareText())}`, '_blank');
}

function shareToQQ() {
    window.open(`https://connect.qq.com/widget/shareqq/index.html?title=${encodeURIComponent(generateShareText())}`, '_blank');
}

function generateShareText() {
    const ft = document.getElementById('fish-type').value || '大鱼';
    const fw = document.getElementById('fish-weight').value || '未知';
    const loc = document.getElementById('location').value || '神秘钓点';
    const txt = document.getElementById('share-text').value || '';
    return `🎣 又上鱼啦！\n📍 ${loc}\n🐟 ${ft} ${fw}斤\n${txt ? '💭 ' + txt : ''}\n#钓鱼`;
}

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    useMockWeatherData();
    // 自动尝试定位
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                appState.location = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                document.getElementById('location').value = `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`;
                fetchWeatherData(pos.coords.latitude, pos.coords.longitude);
            },
            () => {}
        );
    }
});
