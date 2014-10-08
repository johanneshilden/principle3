(function(){

    var fs     = require('fs');
    var http   = require('http');
    var crypto = require('crypto');
 
    var Conf = {client: null, key: null, responseSent: false};
    
    exports.setClient = function(client, key) {
        Conf.client = client;
        Conf.key    = key;
    };
    
    exports.parseStdin = function() {
        var data = fs.readFileSync('/dev/stdin').toString();
        if (data) {
            return JSON.parse(data);
        } else {
            return null;
        }
    };

    exports.get = function(resource, success) {
        this.simpleRequest('GET', resource, '', success);
    };
    
    exports.post = function(resource, body, success) {
        this.simpleRequest('POST', resource, body, success);
    };

    exports.put = function(resource, body, success) {
        this.simpleRequest('PUT', resource, body, success);
    };
 
    exports.delete = function(resource, body, success) {
        this.simpleRequest('DELETE', resource, body, success);
    };

    exports.patch = function(resource, body, success) {
        this.simpleRequest('PATCH', resource, body, success);
    };

    exports.simpleRequest = function(method, resource, body, success) {
        if (typeof body === 'object') {
            body = JSON.stringify(body);
        }
        this.request({
            resource : resource,
            method   : method,
            body     : body,
            success  : success
        });
    };
  
    exports.request = function(config) {

        if (!config) config = {};
        if (!config.key) config.key = Conf.key;
        if (!config.client) config.client = Conf.client;
    
        var body   = config.body   || '',
            method = config.method || 'GET',
            res    = config.resource.replace(/^\/|\/$/g, ''),
            data   = ['PATCH', 'POST', 'PUT'].indexOf(method) != -1 ? body : '';
    
        var hash = config.key ? crypto.createHmac('sha1', config.key).update(data).digest('hex') : null;
    
        var headers = { 
            'Accept'       : 'application/json; charset=utf-8',
            'Content-Type' : 'application/json; charset=utf-8'
        };
    
        if (config.client && hash) {
            headers['API-Access'] = config.client + ':' + hash.toString();
        }
    
        var options = {
            host    : 'localhost',
            port    : 3010,
            method  : method,
            path    : res,
            headers : headers
        };
    
        var callback = function(response) {
            var str = '';
            response.on('data', function(chunk) {
                str += chunk;
            });
            response.on('end', function() {
                if (config.success) {
                    config.success(str, response.statusCode);
                }
            });
        };
    
        var req = http.request(options, callback);
        req.write(data);
        req.end();
    };

    exports.sendResponse = function(statusCode, data) {
        if (!Conf.responseSent) {
            var obj = {
                statusCode : statusCode,
                body       : (typeof data === 'object' ? JSON.stringify(data) : data)
            };
            console.log(JSON.stringify(obj));
            Conf.responseSent = true;
        }
    };

    exports.accumulator = function(tot, yield) {
        var i = 0, results = [];
        return function(r) {
             if (r) results.push(r);
             if (++i == tot && yield) { 
                 yield(results); 
             }
        };
    };

}());
