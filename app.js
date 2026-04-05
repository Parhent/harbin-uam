// ===== 哈尔滨空中交通数字孪生系统 - 核心逻辑 =====

// 全局变量
let map;
let uavMarker;
let pathPolyline;
let flightPath = [];
let currentPosition = null;
let animationId = null;
let isFlying = false;
let isPaused = false;
let progress = 0; // 0-1 飞行进度
let currentAltitude = 0;
let currentSpeed = 0;

// 配置参数
const CONFIG = {
    // 起点：防洪纪念塔
    startPoint: { lat: 45.7755, lng: 126.5840, name: "防洪纪念塔" },
    // 终点：哈尔滨大剧院
    endPoint: { lat: 45.8180, lng: 126.5600, name: "哈尔滨大剧院" },
    // 飞行参数
    totalDistance: 0, // 计算得出
    avgSpeed: 80, // km/h
    maxAltitude: 200, // m
    minAltitude: 50, // m
    animationDuration: 15000, // 飞行动画时长 ms
    updateInterval: 50 // 更新间隔 ms
};

// ===== 初始化地图 =====
function initMap() {
    // 创建地图，中心设为哈尔滨
    map = L.map('map', {
        center: [45.7850, 126.5700],
        zoom: 13,
        zoomControl: false,
        attributionControl: false
    });

    // 添加深色地图瓦片（使用CartoDB Dark Matter）
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    // 计算总距离
    CONFIG.totalDistance = calculateDistance(
        CONFIG.startPoint.lat, CONFIG.startPoint.lng,
        CONFIG.endPoint.lat, CONFIG.endPoint.lng
    );

    // 添加标记点
    addWaypoints();

    // 初始化路径
    initFlightPath();

    // 初始化UAV标记
    initUAVMarker();

    // 启动系统时钟
    updateSystemTime();
    setInterval(updateSystemTime, 1000);
}

// ===== 添加航点标记 =====
function addWaypoints() {
    // 起点标记
    const startIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            width: 36px; height: 36px;
            background: linear-gradient(135deg, #00d4ff, #7c3aed);
            border-radius: 50%;
            border: 3px solid #fff;
            box-shadow: 0 0 15px rgba(0, 212, 255, 0.6);
            display: flex; align-items: center; justify-content: center;
            font-size: 16px;
        ">🏁</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });

    L.marker([CONFIG.startPoint.lat, CONFIG.startPoint.lng], { icon: startIcon })
        .addTo(map)
        .bindPopup(`<div style="color: #000; padding: 5px;"><b>起点</b><br>${CONFIG.startPoint.name}</div>`);

    // 终点标记
    const endIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
            width: 36px; height: 36px;
            background: linear-gradient(135deg, #ff6b00, #ff3366);
            border-radius: 50%;
            border: 3px solid #fff;
            box-shadow: 0 0 15px rgba(255, 107, 0, 0.6);
            display: flex; align-items: center; justify-content: center;
            font-size: 16px;
        ">🎭</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });

    L.marker([CONFIG.endPoint.lat, CONFIG.endPoint.lng], { icon: endIcon })
        .addTo(map)
        .bindPopup(`<div style="color: #000; padding: 5px;"><b>终点</b><br>${CONFIG.endPoint.name}</div>`);

    // 添加途经点（模拟航路点）
    const waypoints = [
        { lat: 45.7900, lng: 126.5750, name: "航路点A" },
        { lat: 45.8000, lng: 126.5680, name: "航路点B" },
        { lat: 45.8100, lng: 126.5620, name: "航路点C" }
    ];

    waypoints.forEach((wp, index) => {
        const wpIcon = L.divIcon({
            className: 'waypoint-marker',
            html: `<div style="
                width: 16px; height: 16px;
                background: rgba(124, 58, 237, 0.6);
                border: 2px solid rgba(124, 58, 237, 0.8);
                border-radius: 50%;
            "></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });

        L.marker([wp.lat, wp.lng], { icon: wpIcon })
            .addTo(map)
            .bindPopup(`<div style="color: #000;">${wp.name}</div>`);
    });
}

// ===== 初始化飞行路径 =====
function initFlightPath() {
    // 创建平滑的飞行路径（贝塞尔曲线模拟）
    const start = [CONFIG.startPoint.lat, CONFIG.startPoint.lng];
    const end = [CONFIG.endPoint.lat, CONFIG.endPoint.lng];

    // 生成中间点，模拟真实航路
    const midLat = (start[0] + end[0]) / 2;
    const midLng = (start[1] + end[1]) / 2;

    // 添加一些偏移，创建弧形路径
    flightPath = [
        start,
        [midLat - 0.003, midLng + 0.002],
        [midLat + 0.002, midLng - 0.003],
        [midLat + 0.005, midLng + 0.001],
        end
    ];

    // 绘制路径线
    pathPolyline = L.polyline(flightPath, {
        color: '#00d4ff',
        weight: 3,
        opacity: 0.6,
        dashArray: '10, 5',
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);

    // 自动缩放视图以显示整个路径
    map.fitBounds(pathPolyline.getBounds(), { padding: [50, 50] });
}

// ===== 初始化UAV标记 =====
function initUAVMarker() {
    const uavIcon = L.divIcon({
        className: 'uav-marker',
        html: `<div style="
            width: 44px; height: 44px;
            background: linear-gradient(135deg, #00ff88, #00d4ff);
            border-radius: 50%;
            border: 3px solid #fff;
            box-shadow: 0 0 25px rgba(0, 255, 136, 0.8);
            display: flex; align-items: center; justify-content: center;
            font-size: 20px;
            position: relative;
        ">
            🚁
            <div style="
                position: absolute;
                width: 60px; height: 60px;
                border: 1px solid rgba(0, 255, 136, 0.4);
                border-radius: 50%;
                animation: ripple 2s infinite;
            "></div>
        </div>
        <style>
            @keyframes ripple {
                0% { transform: scale(0.8); opacity: 1; }
                100% { transform: scale(1.5); opacity: 0; }
            }
        </style>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
    });

    uavMarker = L.marker([CONFIG.startPoint.lat, CONFIG.startPoint.lng], {
        icon: uavIcon,
        zIndexOffset: 1000
    }).addTo(map);

    // 初始显示信息
    uavMarker.bindPopup(`<div style="color: #000;"><b>EVTOL-001</b><br>准备起飞</div>`).openPopup();
}

// ===== 计算两点间距离 (km) =====
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 地球半径 km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// ===== 获取路径上任意点的位置 =====
function getPositionOnPath(progress) {
    // 将进度转换为路径上的位置
    const totalSegments = flightPath.length - 1;
    const segmentProgress = progress * totalSegments;
    const segmentIndex = Math.min(Math.floor(segmentProgress), totalSegments - 1);
    const segmentLocalProgress = segmentProgress - segmentIndex;

    const start = flightPath[segmentIndex];
    const end = flightPath[segmentIndex + 1];

    // 线性插值
    const lat = start[0] + (end[0] - start[0]) * segmentLocalProgress;
    const lng = start[1] + (end[1] - start[1]) * segmentLocalProgress;

    return { lat, lng };
}

// ===== 获取当前高度 (基于进度) =====
function getAltitude(progress) {
    // 使用正弦函数创建高度变化：起飞 -> 巡航 -> 降落
    return CONFIG.minAltitude + (CONFIG.maxAltitude - CONFIG.minAltitude) * Math.sin(progress * Math.PI);
}

// ===== 获取当前速度 =====
function getSpeed(progress) {
    // 速度变化：起飞加速 -> 巡航恒定 -> 降落减速
    if (progress < 0.1) {
        return CONFIG.avgSpeed * (progress / 0.1);
    } else if (progress > 0.9) {
        return CONFIG.avgSpeed * ((1 - progress) / 0.1);
    }
    return CONFIG.avgSpeed;
}

// ===== 更新UI显示 =====
function updateUI() {
    const remaining = CONFIG.totalDistance * (1 - progress);
    
    document.getElementById('vehicleId').textContent = 'EVTOL-001';
    document.getElementById('altitude').textContent = `${Math.round(currentAltitude)} m`;
    document.getElementById('speed').textContent = `${Math.round(currentSpeed)} km/h`;
    document.getElementById('remaining').textContent = `${remaining.toFixed(2)} km`;
    
    const statusEl = document.getElementById('flightStatus');
    if (isFlying && !isPaused) {
        statusEl.textContent = progress < 0.1 ? '起飞中' : progress > 0.9 ? '降落中' : '巡航中';
        statusEl.style.color = '#00ff88';
    } else if (isPaused) {
        statusEl.textContent = '已暂停';
        statusEl.style.color = '#ff6b00';
    } else {
        statusEl.textContent = '待起飞';
        statusEl.style.color = '#8899aa';
    }

    // 更新底部状态
    document.getElementById('activeCount').textContent = isFlying ? '1' : '0';
    document.getElementById('todayFlights').textContent = isFlying ? '1' : '0';
}

// ===== 启动飞行 =====
function startFlight() {
    if (isFlying && !isPaused) return;
    
    if (isPaused) {
        // 恢复飞行
        isPaused = false;
        document.getElementById('btnStart').disabled = true;
        document.getElementById('btnPause').disabled = false;
        animate();
        return;
    }

    // 开始新的飞行
    isFlying = true;
    isPaused = false;
    progress = 0;
    
    document.getElementById('btnStart').disabled = true;
    document.getElementById('btnPause').disabled = false;

    animate();
}

// ===== 飞行动画 =====
function animate() {
    if (!isFlying || isPaused) return;

    // 更新进度
    progress += CONFIG.updateInterval / CONFIG.animationDuration;
    
    if (progress >= 1) {
        progress = 1;
        flightComplete();
        return;
    }

    // 更新位置
    currentPosition = getPositionOnPath(progress);
    currentAltitude = getAltitude(progress);
    currentSpeed = getSpeed(progress);

    // 移动标记
    uavMarker.setLatLng([currentPosition.lat, currentPosition.lng]);

    // 更新弹出信息
    const status = progress < 0.1 ? '起飞' : progress > 0.9 ? '降落' : '巡航';
    uavMarker.setPopupContent(`
        <div style="color: #000;">
            <b>EVTOL-001</b><br>
            状态: ${status}<br>
            高度: ${Math.round(currentAltitude)}m<br>
            速度: ${Math.round(currentSpeed)}km/h
        </div>
    `);

    // 更新UI
    updateUI();

    // 继续动画
    animationId = setTimeout(animate, CONFIG.updateInterval);
}

// ===== 飞行完成 =====
function flightComplete() {
    isFlying = false;
    progress = 1;
    
    // 到达终点
    uavMarker.setLatLng([CONFIG.endPoint.lat, CONFIG.endPoint.lng]);
    uavMarker.setPopupContent(`
        <div style="color: #000;">
            <b>EVTOL-001</b><br>
            状态: 已到达<br>
            终点: ${CONFIG.endPoint.name}
        </div>
    `).openPopup();

    currentAltitude = 0;
    currentSpeed = 0;
    updateUI();

    // 重置按钮状态
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnStart').innerHTML = '<span>▶</span> 重新起飞';
    document.getElementById('btnPause').disabled = true;
}

// ===== 暂停飞行 =====
function pauseFlight() {
    if (!isFlying) return;
    
    isPaused = true;
    clearTimeout(animationId);
    
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnStart').innerHTML = '<span>▶</span> 继续';
    document.getElementById('btnPause').disabled = true;
}

// ===== 重置飞行 =====
function resetFlight() {
    isFlying = false;
    isPaused = false;
    progress = 0;
    clearTimeout(animationId);

    // 重置位置
    uavMarker.setLatLng([CONFIG.startPoint.lat, CONFIG.startPoint.lng]);
    uavMarker.setPopupContent(`<div style="color: #000;"><b>EVTOL-001</b><br>准备起飞</div>`);

    currentAltitude = 0;
    currentSpeed = 0;
    updateUI();

    // 重置按钮
    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnStart').innerHTML = '<span>▶</span> 起飞';
    document.getElementById('btnPause').disabled = true;
}

// ===== 更新系统时间 =====
function updateSystemTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('systemTime').textContent = `${hours}:${minutes}:${seconds}`;
}

// ===== 页面加载完成后初始化 =====
document.addEventListener('DOMContentLoaded', initMap);