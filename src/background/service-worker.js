const { INJECT_CSS, CHECK_IMG } = require('../constants/events')

async function getTabById(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId)
        return tab
    } catch {
        return null
    }
}

function handleInjectCss(css, tabId) {
    chrome.scripting.insertCSS({
        target: {
            tabId
        },
        css,
    }).then(() => {
        console.log('css success')
    }).catch(err => {
        console.log(err)
    })
}
async function handleMessage(msg, { tab }) {
    const currentTab = await getTabById(tab.id)
    if (!currentTab) return

    switch (msg.type) {
        case INJECT_CSS: {
            handleInjectCss(msg.data, currentTab.id)
            break
        }
    }
}
chrome.runtime.onMessage.addListener(handleMessage)

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(
    async function ({ request }) {
        const { tabId, url } = request
        if (url.includes('.awebp')) {
            chrome.tabs.sendMessage(tabId, { type: CHECK_IMG, data: url })
        }
    }
)