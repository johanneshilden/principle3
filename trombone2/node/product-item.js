
var util = require('./util.js');

// Parse incoming request object
var req = util.parseStdin();

var id = req.id;

util.get('product/' + id, function(response, statusCode) {

    var product = JSON.parse(response);
    var _stock = {};

    var n = 0;
    var done = function() {
        if (++n === 3) {
            util.sendResponse(200, {
                product: product,
                stock: _stock
            });
        }
    };

    util.get('product-price/product/' + id, function(response, statusCode) {

        var items = JSON.parse(response);

        var price = {};
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.priceCatId && item.price) {
                price[item.priceCatId] = item.price;
            }
        }
        product.price = price;
 
        done();

    });

    util.get('product-stock/product/' + id, function(response, statusCode) {

        var items = JSON.parse(response);

        var stock = {};
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.depotId && item.quantity) {
                stock[item.depotId] = item.quantity;
            }
            if (item.id) {
                _stock[item.id] = item;
            }
        }
        product.stock = stock;
 
        done();

    });

    util.get('product-limit/product/' + id, function(response, statusCode) {

        var items = JSON.parse(response);

        var limit = {};

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.categoryId && item.limit) {
                limit[item.categoryId] = item.limit;
            }
        }
        product.limit = limit;
 
        done();

    });

});
