process.mixin(GLOBAL, require('sys'));

exports.createServer = function(requestListener) {
    var server = new process.tcp.Server();
    
    server.addListener('request', requestListener);
    server.addListener('connection', connectionListener);

    return server;
};

function connectionListener(connection) {
    puts('got new connection');

    connection.addListener('receive', receiveListener);
}

function receiveListener(data) {
    puts('got data ' + data);
    var colon_idx = data.indexOf(':');
    var header_len = Number(data.substr(0, colon_idx));
    // TODO assert header_len =~ /\d+/
    
    var headers_chunk = data.substr(colon_idx+1, colon_idx+header_len);
    var headers_list = headers_chunk.split("\000");
    var headers = {}

    // TODO assert headers_list.length % 2 == 0
    for (var i=0; i < headers_list.length; i += 2) {
        headers[headers_list[i]] = headers_list[i+1];
    }
    p(headers);
}

exports.createServer(function () {}).listen('8000');
