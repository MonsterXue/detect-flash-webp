const sharp = require('sharp')

async function checkFlashWebP(webpUrl) {
    const config = {
        brightnessDiffThreshold: 20,  // 适配黑白闪图
        flashFrequencyThreshold: 3,   // 1秒≥3次判定为闪图
        frameScale: 0.2,              // 降采样优化性能
    };

    const response = await fetch(webpUrl);
    if (!response.ok) throw new Error('图片请求失败');
    const arrayBuffer = await response.arrayBuffer();

    const metadata = await sharp(arrayBuffer).metadata();
    console.log(metadata)
    const { pages, width, height, delay } = metadata;
    const scaledWidth = Math.floor(width * config.frameScale);
    const scaledHeight = Math.floor(height * config.frameScale);
    const totalPixelPerFrame = scaledWidth * scaledHeight; // 单帧像素数
    const totalBytesPerFrame = totalPixelPerFrame * 4;     // 单帧字节数（RGBA 4通道）

    // 读取所有帧的拼接像素数据（Buffer 格式）
    const allFramesBuffer = await sharp(arrayBuffer, { pages: -1 })
        .resize(scaledWidth, scaledHeight, { fit: 'fill' })
        .raw()
        .toBuffer();

    // 步骤3：手动拆分每帧的像素数据 + 匹配帧延迟
    const frameDataList = [];
    for (let i = 0; i < pages; i++) {
        // 3.1 截取当前帧的像素数据（从总缓冲区中按索引拆分）
        const frameStart = i * totalBytesPerFrame;
        const frameEnd = frameStart + totalBytesPerFrame;
        const frameBuffer = allFramesBuffer.subarray(frameStart, frameEnd); // 单帧 RGBA 数据

        // 3.2 获取当前帧的延迟时间
        const frameDelay = delay?.[i] || 100; // 默认 100ms 防止异常

        // 3.3 计算当前帧的平均亮度
        let totalBrightness = 0;
        for (let j = 0; j < frameBuffer.length; j += 4) {
            const r = frameBuffer[j];
            const g = frameBuffer[j + 1];
            const b = frameBuffer[j + 2];
            const alpha = frameBuffer[j + 3] / 255;
            totalBrightness += (0.299 * r + 0.587 * g + 0.114 * b) * alpha;
        }
        const avgBrightness = totalBrightness / totalPixelPerFrame;

        frameDataList.push({ brightness: avgBrightness, delay: frameDelay });
    }

    // 步骤4：闪烁频率分析
    const flashEvents = [];
    let currentTime = 0;
    for (let i = 1; i < frameDataList.length; i++) {
        const brightnessDiff = Math.abs(frameDataList[i].brightness - frameDataList[i - 1].brightness);
        const delay = frameDataList[i - 1].delay;

        if (brightnessDiff >= config.brightnessDiffThreshold) {
            flashEvents.push(currentTime + delay);
        }
        currentTime += delay;
    }

    // 步骤5：计算 1 秒内闪烁次数
    const totalDuration = currentTime;
    let flashPerSecond = 0;
    if (totalDuration >= 1000) {
        flashPerSecond = flashEvents.filter(t => t <= 1000).length;
    } else {
        flashPerSecond = flashEvents.length * (1000 / totalDuration);
    }

    return Promise.resolve(flashPerSecond)
}

// 直接测试你的目标URL
const targetUrl = 'https://p6-passport.byteacctimg.com/img/user-avatar/98669d63abafc09749d0931bff97ea43~40x40.awebp';
// const targetUrl = "https://p26-passport.byteacctimg.com/img/user-avatar/9054aaa80b90d68d2af51d794f844e46~40x40.awebp";
// const targetUrl = "https://p6-passport.byteacctimg.com/img/user-avatar/7e509ed6b87e763454fd90cb5a18f72c~50x50.awebp";
checkFlashWebP(targetUrl).then(result => {
    console.log('1s内检测结果：', result);
});