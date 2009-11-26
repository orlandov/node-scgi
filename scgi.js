/*
    A Javascript SCGI application server for Node.js
    Orlando Vazquez, 2009

    http://www.python.ca/scgi/protocol.txt

    scgi = require('./lib/scgi');
    scgi.createServer(function (env) {
        var content = "";
        for (header in env) {
            content += header + " --> " + env[header] + "\n";
        }

        return {
            status: 200,
            headers: { "Content-type": "text/plain" },
            body: [content]
        }
    });
*/

process.mixin(GLOBAL, require('sys'));

exports.createServer = function(requestListener) {
    var server = new process.tcp.Server();

    server.addListener('request', function (connection, env) {
        var ret = requestListener(env);

        connection.send("Status: " + ret.status + "\r\n");

        // write out headers
        for (header in ret.headers) {
            connection.send(header + ": " + ret.headers[header] + "\r\n");
        }
        connection.send("\r\n");

        // write out body
        // TODO support forEach
        // TODO support 
        for (var i = 0; i < ret.body.length; i++) {
            connection.send(ret.body[i]);
        }
        connection.close();
    });
    server.addListener('connection', connectionListener);

    return server;
};

function getJSGIEnvFromHeaders(headers_list) {
    var env = {};

    // copy the environment
    for (var i=0,l=headers_list.length; i < l; i += 2) {
        env[headers_list[i]] = headers_list[i+1];
    }

    env['jsgi.version']      = [0, 2];
    env['jsgi.multithread']  = false;
    env['jsgi.multiprocess'] = false;
    env['jsgi.run_once']     = false;

    if (env['HTTPS'] && (env['HTTPS'] == "on" || env['HTTPS'] == "1")) {
        env['jsgi.url_scheme'] = 'https';
    }
    else {
        env['jsgi.url_scheme'] = 'http';
    }

    // TODO deal with jsgi.input jsgi.errors

    return env;
}

function connectionListener(connection) {
    // TODO what is the accepted way of dealing with failed assertions?
    debug('got new connection');

    var buffer = '';
    var state = 'READ_NETSTRING_LENGTH';

    var netstring_size;
    var headers = '';

    connection.addListener('receive', function (packet) {
        debug("got a packet");

        // yay state machines
        while (state != 'DONE') {
            buffer += packet;
            switch(state) {
                case 'READ_NETSTRING_LENGTH':
                    var i;
                    while (i = buffer.indexOf(':')) {
                        // if ':' wasn't found, keep reading
                        if (i < 0) break;
                        netstring_size = Number(buffer.slice(0, i));

                        // assert netstring_size =~ /^\d+$/
                        buffer = buffer.slice(i + 1);
                        state = 'READ_NETSTRING';
                        break;
                    }
                    break;

                case 'READ_NETSTRING':
                    while (buffer.length >= netstring_size+1) {
                        // assert that buffer =~ /,$/
                        debug("end of netstring was " + buffer[netstring_size]);
                        headers = buffer.slice(0, netstring_size);
                        var items = headers.split("\000");

                        // pop the last item if it's empty
                        if (items.length && !items.slice(items.length-1)[0]) items.pop();

                        // assert items.length % 2 == 0

                        state = 'DONE';

                        var env = getJSGIEnvFromHeaders(items);
                        connection.server.emit('request', connection, env)
                        break;
                    }
                    break;

                // deal with additional reads if CONTENT_LENGTH > 0
            }
        }
        debug("all done!");
        return;
    });
}

exports.createServer(function (env) {
    var content = "";
    for (header in env) {
        content += header + " => " + env[header] + "\n";
    }

    debug("Haw, got here"+ JSON.stringify(env));

    return {
        status: 200,
        headers: { "Content-type": "text/plain" },
        body: [content]
    }
});
