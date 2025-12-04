var WebPFlashDetector = (function () {
	'use strict';

	function getDefaultExportFromCjs (x) {
		return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
	}

	var serviceWorker$1 = {};

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

	var hasRequiredServiceWorker;

	function requireServiceWorker () {
		if (hasRequiredServiceWorker) return serviceWorker$1;
		hasRequiredServiceWorker = 1;
		const { INJECT_CSS, CHECK_IMG } = requireEvents();

		async function getTabById(tabId) {
		    try {
		        const tab = await chrome.tabs.get(tabId);
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
		        console.log('css success');
		    }).catch(err => {
		        console.log(err);
		    });
		}
		async function handleMessage(msg, { tab }) {
		    const currentTab = await getTabById(tab.id);
		    if (!currentTab) return

		    switch (msg.type) {
		        case INJECT_CSS: {
		            handleInjectCss(msg.data, currentTab.id);
		            break
		        }
		    }
		}
		chrome.runtime.onMessage.addListener(handleMessage);

		chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(
		    async function ({ request }) {
		        const { tabId, url } = request;
		        if (url.includes('.awebp')) {
		            chrome.tabs.sendMessage(tabId, { type: CHECK_IMG, data: url });
		        }
		    }
		);
		return serviceWorker$1;
	}

	var serviceWorkerExports = requireServiceWorker();
	var serviceWorker = /*@__PURE__*/getDefaultExportFromCjs(serviceWorkerExports);

	return serviceWorker;

})();
