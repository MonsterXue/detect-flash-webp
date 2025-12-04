const NativeXHR = window.XMLHttpRequest;

class CustomXMLHttpRequest extends NativeXHR {
    constructor() {
        super();

        this.onreadystatechange = function () {
            if (this.readyState === 4 && this.status === 200) {
                console.log(JSON.parse(this.responseText))
            }
        }
    }

    open(method, url, async = true, username = null, password = null) {
        this.method = method;
        this.url = url;
        this.async = async;

        super.open(method, url, async, username, password);
    }

    send(body = null) {
        super.send(body);
    }
}

window.XMLHttpRequest = CustomXMLHttpRequest;