
var util = require('./util.js');

// Parse incoming request object
var req = util.parseStdin();

var id = req.id;

util.get('complaint/' + id, function(response, statusCode) {

    var complaint = JSON.parse(response);

    if ('service' === complaint.kind) {
        util.sendResponse(200, complaint);
        return;
    }

    util.post('complaint-product', { complaintIds: [id] }, function(response, statusCode) {

        var items = JSON.parse(response);
        complaint.products = [];

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            complaint.products.push(item);
        }
 
        util.sendResponse(200, complaint);

    });

});
