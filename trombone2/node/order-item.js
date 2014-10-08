
var util = require('./util.js');

// Parse incoming request object
var req = util.parseStdin();

var id = req.id;
var depotId = req.depotId;

util.get('order/' + id, function(response, statusCode) {

    var order = JSON.parse(response);
    order.products = [];

    util.get('order-product/' + id, function(response, statusCode) {

        var items = JSON.parse(response);

        var products = {};
        var stock = {};
        var ids = [];

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.id) {
                ids.push(item.id);
                products[item.id] = {
                    id          : item.id,
                    deleted     : item.deleted,
                    description : item.description,
                    name        : item.name,
                    unitSize    : item.unitSize,
                    price       : {},
                    limit       : {},
                    stock       : {}
                };
                order.products.push({
                    productId : item.id,
                    quantity  : item.quantity,
                    price     : item.price
                });
            }
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
                    order: order,
                    products: products,
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

