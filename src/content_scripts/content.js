const { INJECT_CSS, CHECK_IMG } = require('../constants/events')
const { detectFlashWebP } = require('../utils/WebPFlashDetector')
const TaskQueue = require('../utils/TaskQueue')

const urlCache = new Set()
const taskQueue = new TaskQueue()

function injectCss(url) {
    const css = `img[src="${url}"] {display: none!important;}`;
    chrome.runtime.sendMessage({
        type: INJECT_CSS,
        data: css
    })
}

function handleCheckImg(url) {
    if (urlCache.has(url)) return
    urlCache.add(url)
    taskQueue.add(async () => {
        const result = await detectFlashWebP(url)
        if (result < 10) return
        injectCss(url)
    })
    taskQueue.run()
}

function handleMessage({ type, data }) {
    switch (type) {
        case CHECK_IMG: {
            handleCheckImg(data)
            break
        }
    }
}

chrome.runtime.onMessage.addListener(handleMessage)

