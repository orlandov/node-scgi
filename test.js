process.mixin(GLOBAL, require('mjsunit'));
tcp = require("tcp");

scgi = require("./scgi");

var port = 8222;
var req_num = 0;

// replace null bytes with ^@ since some functions don't like being passed
// binary data like this
function escapeNullBytes(str) {
    return str.replace(/\000/g, "^@");
}

// simple function to make us netstrings
// http://cr.yp.to/proto/netstrings.txt
function makeNetstring(str) {
    return str.length + ':' + str + ',';
}

assertEquals('11:hello world,', makeNetstring('hello world'));
assertEquals('0:,', makeNetstring(''));

var server = scgi.createServer(function (env) {
    var cur_req = req_num++;

    assertEquals(env['jsgi.version'], [0, 2]);
    assertEquals(env['jsgi.multithread'], false);
    assertEquals(env['jsgi.multiprocess'], false);
    assertEquals(env['jsgi.run_once'], false);

    if (cur_req == 0) {
        assertEquals('http', env['jsgi.url_scheme']);
        return {
            status: 200,
            headers: {"Content-type": "text/plain"},
            body: ["test 1"]
        };
    }
    else if (cur_req == 1) {
        return {
            status: 200,
            headers: {"Content-type": "text/plain"},
            body: ["test 2"]
        };
    }
    else if (cur_req = 2) {
        assertEquals('https', env['jsgi.url_scheme']);
        return {
            status: 200,
            headers: {"Content-type": "text/plain"},
            body: ["test 3"]
        }
    }

    // Shouldn't really ever get here...
    return {
        status: 500,
        headers: {"Content-type": "text/plain"},
        body: ["Invalid test"]
    }
});

server.listen(port);

function formatSCGIRequest(req) {
    var header_string = "";
    var keys = [];
    var headers = req.headers;
    for (header in req.headers) {
        keys.push(header);
    }

    // sort the header keys so we have a deterministic result
    keys = keys.sort();

    for (idx in keys.sort()) {
        header_string += keys[idx] + "\000" + headers[keys[idx]] + "\000";
    }

    netstring = makeNetstring(header_string);
    return netstring;
};

assertEquals(
    escapeNullBytes("18:BAR\0004\000BAZ\0002\000FOO\0000\000,"),
    escapeNullBytes(formatSCGIRequest({
        headers: { BAR: "4", BAZ: "2", FOO: "0" },
        body: ""
    }))
);

var c = tcp.createConnection(port);

var fns = [
    function () {
        var s = formatSCGIRequest({
            'headers': {
                CONTENT_LENGTH: 0,
                REQUEST_METHOD: 'GET',
                SCGI: '1',
                SCRIPT_NAME: '/myapp/',
                PATH_INFO: '',
                QUERY_STRING: '/foo?bar=420',
                SERVER_NAME: 'mysite.com',
                SERVER_PORT: '80',
                HTTP_X_TEST: 'testing'
            },
            'body': ""
        })
        c.send(s);
    },
    function () {
        var s = formatSCGIRequest({
            'headers': {
                CONTENT_LENGTH: 0,
                REQUEST_METHOD: 'GET',
                SCGI: '1',
                SCRIPT_NAME: '/myapp/',
                PATH_INFO: '',
                QUERY_STRING: '/foo?bar=420',
                SERVER_NAME: 'mysite.com',
                SERVER_PORT: '80',
                HTTP_X_TEST: 'testing'
            },
            'body': ""
        })
        c.send(s);
    },
    function () {
        var s = formatSCGIRequest({
            'headers': {
                CONTENT_LENGTH: 0,
                REQUEST_METHOD: 'GET',
                SCGI: '1',
                SCRIPT_NAME: '/myapp/',
                PATH_INFO: '',
                QUERY_STRING: '/foo?bar=420',
                SERVER_NAME: 'mysite.com',
                SERVER_PORT: '80',
                HTTP_X_TEST: 'testing',
                HTTPS: 'on'
            },
            'body': ""
        })
        c.send(s);
    },
//     function () {},
//     function () {},
//     function () {},
];

c.addListener('eof', function() {
    c.close();
    if (req_num < fns.length) {
        setTimeout(function () {
            c.connect(port);
        }, 100);
    }
    else {
        server.close();
    }
});

c.addListener('connect', function () {
    fns[req_num]();
});

c.addListener('receive', function(chunk) {
    if (req_num == 1) {
        assertEquals(chunk,
            "Status: 200\r\nContent-type: text/plain\r\n\r\ntest 1");
    }
    else if (req_num == 2) {
        assertEquals(chunk,
            "Status: 200\r\nContent-type: text/plain\r\n\r\ntest 2");
    }
});
