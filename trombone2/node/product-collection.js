
var util = require('./util.js');

// Parse incoming request object
var req = util.parseStdin();

var pageSize = req.pageSize,
    depotId = req.depotId,
    page = req.page || 1,
    offset = (page - 1) * pageSize;

util.get('product/count', function(response, statusCode) {

    var count = JSON.parse(response).count;

    util.get('product/limit/' + pageSize + '/offset/' + offset, function(response, statusCode) {

        var items = JSON.parse(response);

        var ids = [];
        var products = {};
        var stock = {};

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.id) {
                item.stock = {};
                item.price = {};
                item.limit = {};
                ids.push(item.id);
                products[item.id] = item;
            }
        }

        if (!ids.length) {
            ids = [0];
        }

        var n = 0;
        var done = function() {
            if (++n === 3) {
                var resp = [];
                for (i = 0; i < ids.length; i++) {
                    var id = ids[i];
                    if (id) resp.push(products[id]);
                }
                util.sendResponse(200, {
                    count: count,
                    collection: resp,
                    stock: stock
                });
            }
        };

        util.post('product-price', { productIds: ids }, function(response, statusCode) {
            var items = JSON.parse(response);
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var product = products[item.productId];
                if (product && item.price) {
                    product.price[item.priceCatId] = item.price;
                }
            }
            done();
        });

        util.post('product-stock', { productIds: ids, depotId: depotId }, function(response, statusCode) {
            var items = JSON.parse(response);
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var product = products[item.productId];
                if (product && item.quantity) {
                    product.stock[depotId] = item.quantity;
                }
                if (item.id) {
                    stock[item.id] = item;
                }
            }
            done();

        });

        util.post('product-limit', { productIds: ids }, function(response, statusCode) {
            var items = JSON.parse(response);
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var product = products[item.productId];
                if (product && item.categoryId) {
                    product.limit[item.categoryId] = item.limit;
                }
            }
            done();
        });

    });

});
