scgi = require('../scgi');

var server = scgi.createServer(function (env) {
    var content = "";
    for (header in env) {
        content += header + " => " + env[header] + "\n";
    }

    return {
        status: 200,
        headers: { "Content-type": "text/plain" },
        body: [content]
    }
});

server.listen('8000');
