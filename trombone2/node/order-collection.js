
var util = require('./util.js');

// Parse incoming request object
var req = util.parseStdin();

var pageSize = req.pageSize,
    depotId = req.depotId,
    page = req.page || 1,
    offset = (page - 1) * pageSize;

util.get('order/depot/' + depotId + '/count', function(response, statusCode) {

    var count = JSON.parse(response).count;

    util.get('order/depot/' + depotId + '/limit/' + pageSize + '/offset/' + offset, function(response, statusCode) {

        var items = JSON.parse(response);

        var ids = [];
        var orders = {};
        var products = {};

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.id) {
                ids.push(item.id);
                orders[item.id] = item;
            }
        }

        if (!ids.length) {
            ids = [0];
        }

        util.post('order-product', { orderIds: ids }, function(response, statusCode) {

            var items = JSON.parse(response);
            var orderProducts = {};

            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                if (item.id) {
                    products[item.id] = {
                        id          : item.id,
                        deleted     : item.deleted,
                        description : item.description,
                        name        : item.name,
                        unitSize    : item.unitSize
                    };
                }
                if (item.orderId) {
                    if (!orderProducts.hasOwnProperty(item.orderId)) {
                        orderProducts[item.orderId] = [];
                    }
                    orderProducts[item.orderId].push({
                        productId : item.id,
                        quantity  : item.quantity,
                        price     : item.price 
                    });
                }
            }

            var resp = [];
            for (i = 0; i < ids.length; i++) {
                var id = ids[i];
                if (id) {
                    var order = orders[id];
                    order.products = orderProducts[id] || {};
                    resp.push(order);
                }
            }
 
            util.sendResponse(200, {
                count: count,
                collection: resp,
                products: products
            });

        });

    });

});
