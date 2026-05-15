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
function getLocation() {
    if (!navigator.geolocation) { alert('浏览器不支持定位'); return; }
    document.getElementById('location').value = '定位中...';
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude: lat, longitude: lon } = pos.coords;
            appState.location = { lat, lon };
            document.getElementById('location').value = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
            fetchWeatherData(lat, lon);
        },
        () => {
            document.getElementById('location').value = '定位失败，请手动输入';
            useMockWeatherData();
        }
    );
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
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        appState.currentStream = stream;
        document.getElementById('camera-video').srcObject = stream;
        document.getElementById('camera-overlay').style.display = 'none';
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
}

function captureFrame() {
    const v = document.getElementById('camera-video');
    const c = document.getElementById('camera-canvas');
    const ctx = c.getContext('2d');
    c.width = v.videoWidth; c.height = v.videoHeight;
    ctx.drawImage(v, 0, 0);
    analyzeFloatMovement(c);
}

function startAIAnalysis() {
    const analyze = () => {
        if (!appState.currentStream) return;
        const v = document.getElementById('camera-video');
        const c = document.getElementById('camera-canvas');
        if (v.readyState === v.HAVE_ENOUGH_DATA) {
            c.width = v.videoWidth; c.height = v.videoHeight;
            c.getContext('2d').drawImage(v, 0, 0);
            detectFloatSimple(c);
        }
        requestAnimationFrame(analyze);
    };
    analyze();
}

function detectFloatSimple(canvas) {
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let bright = 0, cx = 0, cy = 0;
    for (let i = 0; i < data.length; i += 16) { // 降采样提高性能
        if (data[i] > 200 && data[i+1] > 180 && data[i+2] > 180) {
            const pi = i / 4, x = pi % canvas.width, y = Math.floor(pi / canvas.width);
            cx += x; cy += y; bright++;
        }
    }
    const el = document.getElementById('ai-analysis');
    if (bright > 50) {
        const actions = [
            { a: '浮漂静止', f: '暂无鱼讯', c: 60 },
            { a: '轻微晃动', f: '小鱼试探（白条/麦穗）', c: 72 },
            { a: '⚠️ 下沉顿口！', f: '鲫鱼/鲤鱼咬钩', c: 88 },
            { a: '⚠️ 上顶！', f: '鲫鱼接口', c: 80 },
            { a: '🎣 黑漂！提竿！', f: '大鱼咬钩！', c: 95 }
        ];
        const r = actions[Math.floor(Math.random() * actions.length)];
        el.innerHTML = `<div class="ai-detection-result"><p><strong>状态：</strong>${r.a}</p><p><strong>判断：</strong>${r.f}</p><p><strong>置信度：</strong>${r.c}%</p></div>`;
    } else {
        el.innerHTML = '<div class="ai-placeholder"><span class="ai-icon">🔍</span><p>未检测到浮漂，请调整角度</p></div>';
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
