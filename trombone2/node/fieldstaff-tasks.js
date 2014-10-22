
var util = require('./util.js');

// Parse incoming request object
var req = util.parseStdin();

var depotId = req.depotId,
    contactTimeInterval = req.contactTimeInterval,
    orderTimeInterval = req.orderTimeInterval;

var tasks = [];

var n = 0;
var done = function() {
    if (++n === 4) {
        util.sendResponse(200, tasks);
    }
};
 
util.get('activity/pending/visit', function(response, statusCode) {

    var items = JSON.parse(response);

    for (var i = 0; i < items.length; i++) {
        var task = items[i];
        tasks.push({
            type: 'Scheduled Visit',
            customerName: task.customerName,
            customerId: task.customerId
        });
    }
 
    done();

});

util.get('customer-inactive/' + orderTimeInterval + '/depot/' + depotId, function(response, statusCode) {

    var items = JSON.parse(response);

    for (var i = 0; i < items.length; i++) {
        var task = items[i];
        tasks.push({
            type: 'Inactivity Followup',
            customerName: task.customerName,
            customerId: task.customerId
        });
    }
 
    done();

});

util.get('customer-visit-followup/depot/' + depotId, function(response, statusCode) {

    var items = JSON.parse(response);

    for (var i = 0; i < items.length; i++) {
        var task = items[i];
        tasks.push({
            type: 'Visit Followup',
            customerName: task.customerName,
            customerId: task.customerId
        });
    }
 
    done();

});

util.get('activity-pending-callback/' + depotId, function(response, statusCode) {

    var items = JSON.parse(response);

    for (var i = 0; i < items.length; i++) {
        var task = items[i];
        tasks.push({
            type: 'Scheduled Call Back',
            customerName: task.customerName,
            customerId: task.customerId
        });
    }
 
    done();
 
});

