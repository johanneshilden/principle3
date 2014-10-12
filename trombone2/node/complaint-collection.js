
var util = require('./util.js');

// Parse incoming request object
var req = util.parseStdin();

var customerId = req.customerId,
    includeResolved = req.includeResolved,
    pageSize = req.pageSize,
    page = req.page || 1,
    offset = (page - 1) * pageSize;

var infix = includeResolved ? '' : 'unresolved/';

var countUri = 'complaint/' + infix + 'customer/' + customerId + '/count';

util.get(countUri, function(response, statusCode) {

    var count = JSON.parse(response).count;

    var uri = 'complaint/' + infix + 'customer/' + customerId + '/limit/' + pageSize + '/offset/' + offset;

    util.get(uri, function(response, statusCode) {

        var items = JSON.parse(response);

        var ids = [];
        var complaints = {};

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.id) {
                if ('quality' === item.kind) {
                    item.products = {};
                }
                ids.push(item.id);
                complaints[item.id] = item;
            }
        }

        if (!ids.length) {
            ids = [0];
        }

        util.post('complaint-product', { complaintIds: ids }, function(response, statusCode) {

            var items = JSON.parse(response);
            var complaintProducts = {};

            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                if (item.complaintId) {
                    if (!complaintProducts.hasOwnProperty(item.complaintId)) {
                        complaintProducts[item.complaintId] = [];
                    }
                    complaintProducts[item.complaintId].push(item);
                }
            }

            var resp = [];
            for (i = 0; i < ids.length; i++) {
                var id = ids[i];
                if (id) {
                    var complaint = complaints[id];
                    if (complaintProducts.hasOwnProperty(id)) {
                        complaint.products = complaintProducts[id];
                    }
                    resp.push(complaint);
                }
            }
     
            util.sendResponse(200, {
                count: count,
                collection: resp
            });

        });

    });

});
