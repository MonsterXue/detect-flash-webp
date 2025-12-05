var WebPFlashDetector = (function () {
	'use strict';

	function getDefaultExportFromCjs (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	var content$1 = {};

	var events;
	var hasRequiredEvents;

	function requireEvents () {
		if (hasRequiredEvents) return events;
		hasRequiredEvents = 1;
		events = {
		    INJECT_CSS: 'inject-css',
		    CHECK_IMG: 'check-img'
		};
		return events;
	}

	var WebPFlashDetector_1;
	var hasRequiredWebPFlashDetector;

	function requireWebPFlashDetector () {
		if (hasRequiredWebPFlashDetector) return WebPFlashDetector_1;
		hasRequiredWebPFlashDetector = 1;
		class WebPFlashDetector {
		    constructor(config = {}) {
		        this.config = {
		            brightnessDiffThreshold: 20,     // 亮度差异阈值
		            samplingStep: 4,                 // 采样步长，优化性能
		            maxFrames: 100,                  // 最大处理帧数，防止过载
		            ...config
		        };

		        this.decoder = null;
		        this.isProcessing = false;

		        this.initCanvas();
		    }

		    initCanvas() {
		        if ('OffscreenCanvas' in window) {
		            try {
		                this.offscreenCanvas = new OffscreenCanvas(1, 1);
		                this.ctx = this.offscreenCanvas.getContext('2d', {
		                    willReadFrequently: true,
		                    alpha: false,
		                    desynchronized: true
		                });
		                this.usingOffscreen = true;
		            } catch (error) {
		                console.warn(error);
		                this.initDomCanvas();
		            }
		        } else {
		            this.initDomCanvas();
		        }
		    }

		    initDomCanvas() {
		        this.canvas = document.createElement('canvas');
		        this.ctx = this.canvas.getContext('2d', {
		            willReadFrequently: true
		        });
		        this.usingOffscreen = false;
		    }

		    /**
		     * 检测WebP图片是否为闪图
		     * @param {string} url
		     * @returns {Promise<number>} 每秒闪烁次数
		     */
		    async detect(url) {
		        if (this.isProcessing) return

		        this.isProcessing = true;

		        try {
		            const response = await fetch(url);
		            if (!response.ok) return 0;
		            const blob = await response.blob();
		            const arrayBuffer = await blob.arrayBuffer();
		            this.decoder = new ImageDecoder({
		                data: arrayBuffer,
		                type: blob.type
		            });

		            await this.decoder.tracks.ready;
		            const track = this.decoder.tracks.selectedTrack;

		            if (!track || track.frameCount === 0 || !track.animated) {
		                return 0;
		            }

		            // 处理所有帧
		            const frameResults = await this.processAllFrames(track);
		            // 分析闪烁事件
		            const flashEvents = this.analyzeFlashEvents(frameResults);
		            // 计算每秒闪烁次数
		            const flashPerSecond = this.calculateFlashPerSecond(flashEvents, frameResults);

		            return flashPerSecond;

		        } catch (error) {
		            console.error('WebP闪图检测失败:', url, error);
		            return 0;
		        } finally {
		            this.cleanup();
		            this.isProcessing = false;
		        }
		    }

		    /**
		     * 处理所有帧
		     */
		    async processAllFrames(track) {
		        const results = [];
		        const frameCount = Math.min(track.frameCount, this.config.maxFrames);

		        for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
		            try {
		                const result = await this.processSingleFrame(frameIndex);
		                results.push(result);

		                if (this.shouldEarlyStop(results)) {
		                    break;
		                }

		            } catch (error) {
		                console.warn(`处理第${frameIndex + 1}帧时出错:`, error);
		            }
		        }

		        return results;
		    }

		    /**
		     * 处理单帧
		     */
		    async processSingleFrame(frameIndex) {
		        const frame = await this.decoder.decode({ frameIndex });
		        const img = await window.createImageBitmap(frame.image);

		        const brightness = await this.processImageBitmap(img);
		        const delayMs = frame.image.duration / 1000;

		        img.close();

		        return {
		            frameIndex,
		            brightness,
		            delay: delayMs
		        };
		    }

		    async processImageBitmap(img) {
		        if (this.usingOffscreen && (this.offscreenCanvas.width !== img.width)) {
		            this.offscreenCanvas.width = img.width;
		            this.offscreenCanvas.height = img.height;
		        } else if (!this.usingOffscreen && (this.canvas.width !== img.width)) {
		            this.canvas.width = img.width;
		            this.canvas.height = img.height;
		        }

		        this.ctx.clearRect(0, 0, img.width, img.height);
		        this.ctx.drawImage(img, 0, 0);

		        const imageData = this.ctx.getImageData(
		            0, 0,
		            img.width, img.height,
		            { colorSpace: 'srgb' }
		        );

		        return this.calculateAverageBrightness(imageData);
		    }

		    calculateAverageBrightness(imageData) {
		        const data = imageData.data;
		        const dataView = new DataView(data.buffer);
		        const pixelCount = imageData.width * imageData.height;
		        const step = this.config.samplingStep;

		        const actualStep = pixelCount > 10000 ? step : 1;

		        let totalBrightness = 0;
		        let sampleCount = 0;

		        for (let i = 0; i < data.length; i += 4 * actualStep) {
		            const r = dataView.getUint8(i);
		            const g = dataView.getUint8(i + 1);
		            const b = dataView.getUint8(i + 2);
		            const a = dataView.getUint8(i + 3) / 255;

		            const brightness = (0.299 * r + 0.587 * g + 0.114 * b) * a;
		            totalBrightness += brightness;
		            sampleCount++;
		        }

		        return sampleCount > 0 ? totalBrightness / sampleCount : 0;
		    }

		    analyzeFlashEvents(frameResults) {
		        if (frameResults.length < 2) {
		            return [];
		        }

		        const flashEvents = [];
		        let accumulatedTime = 0;

		        for (let i = 1; i < frameResults.length; i++) {
		            const prevFrame = frameResults[i - 1];
		            const currFrame = frameResults[i];

		            const brightnessDiff = Math.abs(currFrame.brightness - prevFrame.brightness);

		            if (brightnessDiff >= this.config.brightnessDiffThreshold) {
		                const flashTime = accumulatedTime + prevFrame.delay;
		                flashEvents.push({
		                    time: flashTime,
		                    frameIndex: i,
		                    brightnessDiff: brightnessDiff
		                });
		            }

		            accumulatedTime += prevFrame.delay;
		        }

		        return flashEvents;
		    }

		    /**
		     * 计算每秒闪烁次数
		     */
		    calculateFlashPerSecond(flashEvents, frameResults) {
		        if (flashEvents.length === 0) {
		            return 0;
		        }

		        const totalDuration = frameResults.reduce((sum, frame) => sum + frame.delay, 0);
		        if (totalDuration <= 0) {
		            return 0;
		        }

		        // 只统计前1s内的闪烁次数
		        const cycleDuration = frameResults.reduce((sum, frame) => sum + frame.delay, 0);
		        const cyclesPerSecond = 1000 / cycleDuration;

		        // 计算每个周期的闪烁次数
		        let flashesPerCycle = 0;
		        for (let i = 0; i < frameResults.length; i++) {
		            const current = frameResults[i];
		            const next = frameResults[(i + 1) % frameResults.length];
		            if (Math.abs(next.brightness - current.brightness) >= this.config.brightnessDiffThreshold) {
		                flashesPerCycle++;
		            }
		        }

		        return cyclesPerSecond * flashesPerCycle;
		    }

		    shouldEarlyStop(frameResults) {
		        if (frameResults.length < 2) return false;

		        // 检测近5帧
		        const recentFrames = frameResults.slice(-5);
		        let flashCount = 0;

		        for (let i = 1; i < recentFrames.length; i++) {
		            const brightnessDiff = Math.abs(
		                recentFrames[i].brightness - recentFrames[i - 1].brightness
		            );
		            if (brightnessDiff >= this.config.brightnessDiffThreshold) {
		                flashCount++;
		            }
		        }

		        return flashCount >= 3;
		    }

		    getDetailedReport(frameResults, flashEvents) {
		        if (!frameResults || frameResults.length === 0) {
		            return null;
		        }

		        const totalDuration = frameResults.reduce((sum, frame) => sum + frame.delay, 0);
		        const avgBrightness = frameResults.reduce((sum, frame) => sum + frame.brightness, 0) / frameResults.length;

		        return {
		            frameCount: frameResults.length,
		            totalDuration: totalDuration,
		            averageBrightness: avgBrightness,
		            flashCount: flashEvents.length,
		            flashEvents: flashEvents,
		            brightnessRange: {
		                min: Math.min(...frameResults.map(f => f.brightness)),
		                max: Math.max(...frameResults.map(f => f.brightness))
		            },
		            isPotentialFlash: flashEvents.length > 0
		        };
		    }

		    cleanup() {
		        if (this.usingOffscreen && this.offscreenCanvas) {
		            this.offscreenCanvas.width = 0;
		            this.offscreenCanvas.height = 0;
		        } else if (this.canvas) {
		            this.canvas.width = 0;
		            this.canvas.height = 0;
		        }

		        this.ctx = null;
		        this.decoder = null;
		    }

		    destroy() {
		        this.cleanup();
		    }
		}

		// 使用示例
		async function detectFlashWebP(url) {
		    const detector = new WebPFlashDetector({
		        brightnessDiffThreshold: 20,
		        samplingStep: 1,
		        maxFrames: 100
		    });

		    try {
		        const flashPerSecond = await detector.detect(url);
		        console.log(`检测完成，每秒闪烁次数: ${flashPerSecond}`);
		        if (flashPerSecond) {
		            console.log(url);
		        }
		        return flashPerSecond;
		    } catch (error) {
		        console.error('检测失败:', error);
		        throw error;
		    } finally {
		        detector.destroy();
		    }
		}

		WebPFlashDetector_1 = { WebPFlashDetector, detectFlashWebP };
		return WebPFlashDetector_1;
	}

	var TaskQueue_1;
	var hasRequiredTaskQueue;

	function requireTaskQueue () {
		if (hasRequiredTaskQueue) return TaskQueue_1;
		hasRequiredTaskQueue = 1;
		let taskId = 1;

		/**
		* @param {string} max 并发数
		* @param {function} onComplete
		*/
		class TaskQueue {
		    constructor(ctor) {
		        this.max = ctor?.max || 1;
		        this.queue = [];
		        this.runningCount = 0;
		        this.onComplete = ctor?.onComplete;
		        this.completed = false;
		    }
		    add(cb) {
		        this.queue.push({
		            id: taskId++,
		            cb,
		        });
		        this.completed = false;
		    }
		    delete(id) {
		        const findIndex = this.queue.findIndex((item) => item.id === id);
		        if (findIndex === -1) return;
		        this.queue.splice(findIndex, 1);
		    }
		    run() {
		        while (this.runningCount < this.max && this.queue.length) {
		            const task = this.queue.shift();
		            this.runningCount++;
		            const result = task.cb();
		            if (result && typeof result.finally === 'function') {
		                result.finally(() => {
		                    this.runningCount--;
		                    this.run();
		                    this._checkComplete();
		                });
		            } else {
		                this.runningCount--;
		                this.run();
		                this._checkComplete();
		            }
		        }
		        this._checkComplete();
		    }
		    _checkComplete() {
		        if (!this.queue.length && !this.runningCount && !this.completed) {
		            this.completed = true;
		            this.onComplete?.();
		        }
		    }
		}

		TaskQueue_1 = TaskQueue;
		return TaskQueue_1;
	}

	var hasRequiredContent;

	function requireContent () {
		if (hasRequiredContent) return content$1;
		hasRequiredContent = 1;
		const { INJECT_CSS, CHECK_IMG } = requireEvents();
		const { detectFlashWebP } = requireWebPFlashDetector();
		const TaskQueue = requireTaskQueue();

		const urlCache = new Set();
		const taskQueue = new TaskQueue();

		function injectCss(url) {
		    const css = `img[src="${url}"] {display: none!important;}`;
		    chrome.runtime.sendMessage({
		        type: INJECT_CSS,
		        data: css
		    });
		}

		function handleCheckImg(url) {
		    if (urlCache.has(url)) return
		    urlCache.add(url);
		    taskQueue.add(async () => {
		        const result = await detectFlashWebP(url);
		        if (result < 10) return
		        injectCss(url);
		    });
		    taskQueue.run();
		}

		function handleMessage({ type, data }) {
		    switch (type) {
		        case CHECK_IMG: {
		            handleCheckImg(data);
		            break
		        }
		    }
		}

		chrome.runtime.onMessage.addListener(handleMessage);
		return content$1;
	}

	var contentExports = requireContent();
	var content = /*@__PURE__*/getDefaultExportFromCjs(contentExports);

	return content;

})();
