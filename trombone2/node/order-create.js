
var util = require('./util.js');

// Parse incoming request object
var req = util.parseStdin();

util.post('!order', req, function(response, statusCode) {

    if (200 == statusCode) {

        var order = JSON.parse(response);
    
        util.post('order-weight/' + order.id, {}, function(){});
    
        util.post('order-activity', {
            datetime : req.datetime,
            orderId  : order.id,
            status   : 'placed'
        }, function(){});
    
        util.post('customer-activity', {
            datetime    : req.datetime,
            customerId  : req.customerId,
            description : '',
            kind        : 'order-placed',
            userId      : req.userId,
            contactType : req.type,
            entityId    : order.id
        }, function(){});
    
        var depotTrans = [];
        var orderTrans = [];
    
        for (var key in req.products) {
            var item = req.products[key];
    
            depotTrans.push({
                datetime    : req.datetime,
                depotId     : req.depotId,
                productId   : item.productId,
                quantity    : (-item.quantity),
                type        : 'order-placed'
            });
    
            orderTrans.push({
                datetime    : req.datetime,
                orderId     : order.id,
                productId   : item.productId,
                quantity    : item.quantity,
                type        : 'order-placed'
            });
        }
    
        util.post('stock-transaction/depot', depotTrans, function(){});
    
        util.post('stock-transaction/order', orderTrans, function(){});
    
        util.sendResponse(200, order);

    }

});
