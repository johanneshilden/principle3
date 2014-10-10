
var util = require('./util.js');

// Parse incoming request object
var req = util.parseStdin();

var orderId = req.orderId;

util.get('order-product/' + orderId, function(response, statusCode) {

    var resp = JSON.parse(response);

    var qtys = {};
    for (var key in resp) {
        var item = resp[key];
        qtys[item.id] = item.quantity;
    }

    util.put('!order', req, function(response, statusCode) {
    
        var orders = JSON.parse(response);
    
        if (200 == statusCode) {
    
            util.delete('order-weight/' + orderId, {}, function() {
                util.post('order-weight/' + orderId, {}, function(){});
            });
    
            util.post('order-activity', {
                datetime : req.datetime,
                orderId  : orderId,
                status   : 'edit'
            }, function(){});
     
            util.get('order-product/' + orderId, function(response, statusCode) {

                var resp = JSON.parse(response);

                var diff = {};
                for (var key in resp) {
                    var item = resp[key];
                    diff[item.id] = item.quantity;
                }
                for (var key in qtys) {
                    if (!diff.hasOwnProperty(key)) {
                        diff[key] = 0;
                    }
                }
                for (var key in diff) {
                    diff[key] -= (qtys[key] ? qtys[key] : 0);
                }

                var depotTrans = [];
                var orderTrans = [];
            
                for (var key in diff) {
                    var qty = diff[key];
                    if (qty) {
                        depotTrans.push({
                            datetime    : req.datetime,
                            depotId     : req.depotId,
                            productId   : key,
                            quantity    : -qty,
                            type        : 'order-edit'
                        });
                
                        orderTrans.push({
                            datetime    : req.datetime,
                            orderId     : orderId,
                            productId   : key,
                            quantity    : qty,
                            type        : 'order-edit'
                        });
                    }
                }
            
                util.post('stock-transaction/depot', depotTrans, function(){});
            
                util.post('stock-transaction/order', orderTrans, function(){});

                util.sendResponse(200, orders);

            });
    
        }
    
    });

});
