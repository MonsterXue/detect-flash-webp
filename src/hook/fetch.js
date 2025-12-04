const _fetch = window.fetch

window.fetch = async function (url, options) {
    const response = await _fetch.call(this, url, options)

    const respHeaders = {};
    response.headers.forEach((v, k) => { respHeaders[k] = v; });

    if (respHeaders['content-type']?.includes('json')) {
        const json = await response.clone().json()
        document.dispatchEvent(new CustomEvent('xhr-response', {
            detail: {
                url,
                result: json
            }
        }))
    }
    return response
}