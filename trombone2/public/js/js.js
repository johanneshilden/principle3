"use strict";
var Queue = (function(){

    var key = '__queue';
    var qid = 0;

    function push(request) {
        var queue = get();
        queue.store[++qid] = request;
        queue.index.push(qid);
        store.set(key, queue);
    }

    function get() {
        var queue = store.get(key);
        if (!queue) {
            queue = {
                index: [],
                store: {}
            };
        }
        return queue;
    }

    function remove(item) {
        var queue = get();
        delete queue.store[item];
        queue.index = _.without(queue.index, item);
        store.set(key, queue);
    }

    function process(key, callback) {

        var queue = get();
        if (_.contains(queue.index, key)) {

            var req = queue.store[key];

            Storage.request($.extend({
                success: function(resp) {
                    remove(key);
                    App.notify('Request processed successfully' + (req.successMsg ? (': ' + req.successMsg) : '.'));
                },
                error: function(e) {
                    var obj = e.responseJSON;
                    if (obj && obj.message) {
                        remove(key);
                        App.notify(errorMsg(req, obj.message, obj.error), 'error');
                    } else if (!e.status) {
                        App.notify('Service unavailable.', 'error');
                    } else {
                        App.notify(e.responseText, 'error');
                    }
                },
                complete: function() {
                    if (callback && typeof callback === "function") { 
                        callback(); 
                    }
                }
            }, req));

        }

    }

    // ~ public
    return {
        push    : push,
        remove  : remove,
        get     : get,
        process : process
    };

}());

var Basket = (function(){

    var items = {};
    var priceCategory = null;

    function insertItem(product, quantity, price) {

        if (!priceCategory) {
            App.errorMsg('No price category: Missing call to Basket.init() in application?');
            return;
        }

        if (!price && product.hasOwnProperty('price')) {
            price = product.price[priceCategory];
        }

        if (price) {

            product.subTotal = price * quantity;
    
            items[product.id] = {
                quantity : quantity,
                product  : product
            };

            return;
        }

        App.notify('ERROR_NO_PRICE_DATA');

    }

    function removeItem(id) {
        delete items[id];
    }

    function updateItem(id, quantity, price) {

        if (!priceCategory) {
            App.errorMsg('No price category: Missing call to Basket.init() in application?');
            return;
        }

        if (items.hasOwnProperty(id)) {

            var item = items[id];
            var product = item.product;

            if (!price && product.hasOwnProperty('price')) {
                price = product.price[priceCategory];
            }

            if (price) {
                item.quantity = quantity;
                product.subTotal = price * quantity;
            }

        }
    }

    function containsItem(id) {
        return items.hasOwnProperty(id);
    }

    function getItemIds() {
        return _.keys(items);
    }

    function getItems() {
        var _items = [];
        _.each(items, function(item) {
            var product = item.product;
            product.quantity = item.quantity;
            _items.push(product);
        });
        return _items;
    }

    function isEmpty() {
        return !(_.keys(items).length);
    }

    function total() {
        var tot = 0;
        _.each(items, function(item) {
            tot += item.product.subTotal;
        });
        return tot;
    }

    function init(categoryId) {
        priceCategory = categoryId;
        items = {};
    }

    // ~ public
    return {
        insertItem    : insertItem,
        removeItem    : removeItem,
        updateItem    : updateItem,
        containsItem  : containsItem,
        getItems      : getItems,
        getItemIds    : getItemIds,
        isEmpty       : isEmpty,
        total         : total,
        init          : init
    };

}());

var Message = {
    AUTHENTICATION_FAILED: {
        text : 'Authentication failed.',
        type : 'error'
    },
    USER_AUTHENTICATED: {
        text : 'User "%1" authenticated.',
        type : 'notice'
    },
    REQUEST_DELAYED: {
        text : 'Service unavailable. A request has been delayed.',
        type : 'important'
    },
    USER_LOGGED_OUT: {
        text : 'User logged out.',
        type : 'notice'
    },
    USER_OFFLINE: {
        text : 'Service unavailable.',
        type : 'error'
    },
    ERROR_GENERIC: {
        text : '%1',
        type : 'error'
    },
    ERROR_INCOMPLETE_STOCK_DATA: {
        text : 'Incomplete product stock data.',
        type : 'error'
    },
    ERROR_NO_PRICE_DATA: {
        text : 'No price information available.',
        type : 'error'
    },
    ERROR_PRODUCT_NOT_ADDED: {
        text : 'Product "%1" could not be added to the order: %2',
        type : 'error'
    },
    IMPORTANT_ORDER_INCOMPLETE: {
        text : 'The order was created, however one or more products were not included.',
        type : 'important'
    },
    NOTICE_ORDER_CREATED: {
        text : 'The order was created.',
        type : 'notice'
    },
    IMPORTANT_ORDER_UPDATE_INCOMPLETE: {
        text : 'The order was updated, however one or more products were not included.',
        type : 'important'
    },
    NOTICE_ORDER_UPDATED: {
        text : 'The order was updated.',
        type : 'notice'
    },
    NOTICE_PLEASE_CONNECT: {
        text : 'You must connect to the internet to complete this action.',
        type : 'notice'
    },
    NOTICE_ITEM_ADDED: {
        text : 'Item was added to the order.',
        type : 'notice'
    },
    NOTICE_ITEM_QTY_UPDATED: {
        text : 'The item quantity was updated.',
        type : 'notice'
    }
};

var App = (function(){

    var router;
    var user;
    var notifications = [];
 
    return {

        init: function(routes) {
            var app = Backbone.Router.extend($.extend(routes, {
                execute: function(callback, args) {
                    if (!App.user()) { 
                        App.login(); 
                        return;
                    }
                    if (callback) callback.apply(this, args);
                }
            }));
            router = new app();
            Backbone.history.start();
        },

        user: function() { 
            return user; 
        },

        dismissNotice: function(index) {

            notifications.splice(index, 1);

            if (router.notify && 'function' === typeof router.notify) { 
                router.notify(notifications); 
            } 

        },

        notify: function(msg) {

            var type = 'notice';

            if (Message.hasOwnProperty(msg)) {
                var m = Message[msg];
                msg   = m.text;
                type  = m.type;
            }

            var i = 1;
            _.each(_.toArray(arguments).splice(1), function(arg) {
                var placeholder = '%' + i++;
                msg = msg.replace(placeholder, arg);
            });

            var last = _.last(notifications);
            if (last && last.message == msg) {
                last.repeat++;
            } else {
                notifications.push({
                    message : msg,
                    type    : type,
                    repeat  : 1
                });
            }

            if (router.notify && 'function' === typeof router.notify) { 
                router.notify(notifications); 
            } 
        },

        login: function() {
            if (router.login && 'function' === typeof router.login) { 
                router.login(); 
            } 
        },

        offline: function() {
            if (router.offline && 'function' === typeof router.offline) { 
                router.offline(); 
            } 
        },
     
        error: function(e) {
            if (router.error && 'function' === typeof router.error) { 
                router.error(e); 
            } 
        },

        errorMsg: function(msg) {
            App.error({
                responseJSON: { message: msg }
            });
        },

        onRequestBegin: function() {
            if (router.onRequestBegin && 'function' === typeof router.onRequestBegin) { 
                router.onRequestBegin(); 
            } 
        },

        onRequestEnd: function() {
            if (router.onRequestEnd && 'function' === typeof router.onRequestEnd) { 
                router.onRequestEnd(); 
            } 
        },
    
        logout: function() {

            user = null;

            App.notify('USER_LOGGED_OUT');
            window.location.hash = '';

        },
  
        refresh: function() {
            // Refresh the current route.
            Backbone.history.stop(); 
            Backbone.history.start();
        },

        paginator: function(url, page, pageSize, count, t, cont) {
    
            var page = page || 1,
                pages = [],
                pageCount = Math.ceil(count / pageSize);
    
            if (pageCount < 2) {
                cont('');
            } else if (page > pageCount) {
                if (url) {
                    var suffix = pageCount == 1 ? '' : '/page/' + pageCount;
                    window.location.hash = url + suffix;
                }
            } else {
    
                for (var i = 1; i <= pageCount; ++i) {
                    pages.push({
                        index   : i,
                        current : i == page,
                        first   : i == 1,
                        last    : i == pageCount
                    });
                }

                cont(t({
                    url     : url,
                    page    : pages,
                    results : count
                }));
    
            }

        },

        authenticate: function(username, password) {

            Storage.request({
                type: 'POST',
                resource: 'authenticate',
                data: {
                    username: username,
                    password: password
                },
                success: function(resp) {
                    user = resp;
                    var cipher = CryptoJS.AES.encrypt(JSON.stringify(user), password);
                    store.set('user.' + username, cipher.toString());
                    App.notify('USER_AUTHENTICATED', username);
                    App.refresh();
                },
                error: function(e) {
                    if (!e.status) {
                        var cached = store.get('user.' + username);
                        if (cached) {
                            try {

                                var msg = CryptoJS.AES.decrypt(cached, password);
                                user = JSON.parse(msg.toString(CryptoJS.enc.Utf8));

                                App.notify('USER_AUTHENTICATED', username);
                                App.refresh();

                            } catch(e) {
                                App.notify('AUTHENTICATION_FAILED');
                            }
                        } else {
                            App.offline();
                        }
                    } else {
                        App.notify('AUTHENTICATION_FAILED');
                    }
                }
            });
            
        }

    };

}());

var Storage = (function($){

    function serial(data) {
        return 'string' === typeof(data) ? data : JSON.stringify(data);
    }

    function request(conf) {

        var source = conf.resource.replace(/^\/|\/$/g, ''),
            host = $(document.body).data('host').replace(/\/$/, ''),
            data = conf.data ? serial(conf.data) : '',
            hash = CryptoJS.HmacSHA1(data, $(document.body).data('key')),
            onComplete = conf.complete;

        delete(conf.data);
        delete(conf.complete);
        $.support.cors = true;

        $.ajax($.extend({
            type         : 'GET',
            url          : host + '/' + source,
            cache        : false,
            data         : data,
            crossDomain  : true,
            dataType     : 'json',
            complete     : function() {
                if (onComplete && 'function' === typeof onComplete) { 
                    onComplete(); 
                } 
                // Event hook
                App.onRequestEnd();
            },
            headers: {
                "Accept"       : "application/json; charset=utf-8",
                "Content-Type" : "application/json; charset=utf-8",
                "API-Access"   : "generic:" + hash.toString()
             }
        }, conf));

        // Event hook
        App.onRequestBegin();

        console.log('@' + host + '/' + source);

    }

    // ~ public
    return {
        request : request
    };

}(jQuery));

var Model = {

    getFromStore: function(key) {
        return store.get(key) || { count: null, index: [], store: {} };
    },
   
    getOfflinePage: function(collection, page, pageSize) {

        if (!collection.hasOwnProperty('count') || 'number' !== typeof collection.count) {
            return null;
        }

        var i = (page - 1) * pageSize,
            j = Math.min(i + pageSize, collection.count),
            res = [];

        while (i < j) {
            var id = collection.index[i++];
            if (!id || !collection.store[id]) {
                return null;
            }
            res.push(collection.store[id]);
        }

        return res;

    },

    errorHandler: function(collection, page, pageSize, cont, offline, e) {

        if (!e.status) {
            var res = Model.getOfflinePage(collection, page, pageSize);
    
            if (null != res) {
                cont(res, collection.count);
            } else {
                var count = collection.count;
                if (offline && 'function' === typeof offline && 'number' === typeof count) { 
                    offline(count); 
                } else {
                    App.offline();
                }
            }
        } else {
            App.error(e);
        }

    },

    getCollectionItem: function(key, id, cont, offline) {

        var collection = Model.getFromStore(key);

        var _store = collection.store;
        if (_store[id]) {
            cont(_store[id]);
            return;
        } 

        if (offline && 'function' === typeof offline) { 
            offline(); 
        } 

    },
 
    getUserDepot: function(cont) {

        var depotId = App.user().depotId;

        if (depotId) {
            cont(depotId);
        } else {
            App.errorMsg('No depot assigned to the current user. Please contact the system administrator.');
        }

    },

    getPriceCategories: function(cont, offline) {

        Storage.request({
            type: 'GET',
            resource: 'price-category',
            error: function(e) {
                if (e.status) {
                    App.error(e);
                } else {

                    var collection = store.get('price-categories.all');

                    if (collection && collection.store) {
                        cont(collection.store);
                    } else {
                        offline();
                    }

                }
            },
            success: function(resp) {

                var _store = {};
                var count = 0;
                var index = [];

                _.each(resp, function(item) {
                    _store[item.id] = item.name;
                    count++;
                    index.push(item.id);
                });

                store.set('price-categories.all', {
                    index: index,
                    store: _store,
                    count: count
                });

                cont(_store);

            }
        });

    },

    getWeightClasses: function(cont, offline) {

        Storage.request({
            type: 'GET',
            resource: 'weight-category',
            error: function(e) {
                if (e.status) {
                    App.error(e);
                } else {

                    var collection = store.get('weight-classes.all');

                    if (collection && collection.store) {
                        cont(collection.store);
                    } else {
                        offline();
                    }

                }
            },
            success: function(resp) {

                var _store = {};
                var count = 0;
                var index = [];

                _.each(resp, function(item) {
                    _store[item.id] = item.name;
                    count++;
                    index.push(item.id);
                });

                store.set('weight-classes.all', {
                    index: index,
                    store: _store,
                    count: count
                });

                cont(_store);

            }
        });

    },

    loadOrderItem: function(id, depotId, cont) {

        var collection = Model.getFromStore('orders.depot.' + depotId);

        Storage.request({
            type: 'POST',
            resource: 'order-item',
            data: { 
                id: id,
                depotId: depotId
            },
            error: function(e) {
                if (!e.status) {
                    cont();
                } else {
                    App.error(e);
                }
            },
            success: function(response) {

                var obj = JSON.parse(response);

                var order = obj.order;
                var products = obj.products;
                var stock = obj.stock;

                collection.store[order.id] = order;

                store.set('orders.depot.' + depotId, collection);

                var productCollection = Model.getFromStore('products.all');

                _.each(products, function(item) {
                    var product = productCollection.store[item.id] || {};
                    product.id          = item.id;
                    product.deleted     = item.deleted;
                    product.description = item.description;
                    product.name        = item.name;
                    product.unitSize    = item.unitSize;
                    product.limit       = item.limit;
                    product.price       = item.price;

                    if (item.stock) {
                        if (!product.stock) {
                            product.stock = {};
                        }
                        for (var key in item.stock) {
                            product.stock[key] = item.stock[key];
                        }
                    }

                    productCollection.store[item.id] = product;
                });

                store.set('products.all', productCollection); 

                var stockCollection = Model.getFromStore('stock.depot.' + depotId);

                _.each(stock, function(item) {
                    if (item.id) {
                        stockCollection.store[item.id] = item;
                    }
                });

                store.set('stock.depot.' + depotId, stockCollection); 

                cont();

            }
        });


    },

    getCustomerOrderCollectionByStatus: function(status, customerId, page, pageSize, cont, offline) {

        var page = page || 1,
            offset = (page - 1) * pageSize;
 
        Model.getUserDepot(function(depotId) {

            var collection = Model.getFromStore('orders.' + status + '.customer.' + customerId);
            var orderCollection = Model.getFromStore('orders.depot.' + depotId);
    
            Storage.request({
                type: 'POST',
                resource: 'customer-order-collection',
                data: {
                    pageSize: pageSize,
                    customerId: customerId,
                    page: page,
                    status: status
                },
                success: function(resp) {
    
                    var obj = JSON.parse(resp),
                        i = offset;
    
                    collection.count = obj.count;
    
                    _.each(obj.collection, function(item) {
                        collection.store[item.id] = item;
                        orderCollection.store[item.id] = item;
                        collection.index[i++] = item.id;
                    });
    
                    var productCollection = Model.getFromStore('products.all');
    
                    _.each(obj.products, function(item) {
                        var product = productCollection.store[item.id] || {};
                        product.id          = item.id;
                        product.deleted     = item.deleted;
                        product.description = item.description;
                        product.name        = item.name;
                        product.unitSize    = item.unitSize;
                        productCollection.store[item.id] = product;
                    });
    
                    cont(obj.collection, obj.count);
    
                    store.set('orders.' + status + '.customer.' + customerId, collection);
                    store.set('orders.depot.' + depotId, orderCollection);
                    store.set('products.all', productCollection);
    
                },
                error: function(e) {
    
                    if (!e.status) {
                        var res = Model.getOfflinePage(collection, page, pageSize);
                
                        if (null != res) {
                            cont(res, collection.count);
                        } else {
                            var count = collection.count;
                            if (offline && 'function' === typeof offline) { 
                                offline(count); 
                            } else {
                                App.offline();
                            }
                        }
                    } else {
                        App.error(e);
                    }
    
                }
            });

        });

    },

    getCustomerComplaintCollection: function(customerId, page, pageSize, cont, offline) {

        var page = page || 1,
            offset = (page - 1) * pageSize;
 
        Model.getUserDepot(function(depotId) {

            var collection = Model.getFromStore('complaints.customer.' + customerId);

            var onError = function(e) {

                if (!e.status) {
                    var res = Model.getOfflinePage(collection, page, pageSize);
            
                    if (null != res) {
                        cont(res, collection.count);
                    } else {
                        var count = collection.count;
                        if (offline && 'function' === typeof offline) { 
                            offline(count); 
                        } else {
                            App.offline();
                        }
                    }
                } else {
                    App.error(e);
                }

            };

            Storage.request({
                type: 'GET',
                resource: 'complaint/customer/' + customerId + '/count',
                error: onError,
                success: function(resp) {

                    collection.count = resp.count;

                    Storage.request({
                        type: 'GET',
                        resource: 'complaint/customer/' + customerId + '/limit/' + pageSize + '/offset/' + offset,
                        success: function(complaints) {

                            var complaintCollection = Model.getFromStore('complaints.all');
            
                            var _store = collection.store || {},
                                index = collection.index || [],
                                i = offset,
                                res = [];
        
                            _.each(complaints, function(item) {
                                _store[item.id] = item;
                                index[i++] = item.id;
                                res.push(item);
                                complaintCollection.store[item.id] = item;
                            });

                            store.set('complaints.customer.' + customerId, collection); 
                            store.set('complaints.all', complaintCollection); 
                            cont(res, collection.count);
            
                        },
                        error: onError
                    });

                }
            });

        });

    },

    getCustomerOrderCollection: function(customerId, page, pageSize, cont, offline) {

        var page = page || 1,
            offset = (page - 1) * pageSize;
 
        Model.getUserDepot(function(depotId) {

            var collection = Model.getFromStore('orders.customer.' + customerId);
            var orderCollection = Model.getFromStore('orders.depot.' + depotId);
    
            Storage.request({
                type: 'POST',
                resource: 'customer-order-collection',
                data: {
                    pageSize: pageSize,
                    customerId: customerId,
                    page: page
                },
                success: function(resp) {
    
                    var obj = JSON.parse(resp),
                        i = offset;
    
                    collection.count = obj.count;
    
                    _.each(obj.collection, function(item) {
                        collection.store[item.id] = item;
                        orderCollection.store[item.id] = item;
                        collection.index[i++] = item.id;
                    });
    
                    var productCollection = Model.getFromStore('products.all');
    
                    _.each(obj.products, function(item) {
                        var product = productCollection.store[item.id] || {};
                        product.id          = item.id;
                        product.deleted     = item.deleted;
                        product.description = item.description;
                        product.name        = item.name;
                        product.unitSize    = item.unitSize;
                        productCollection.store[item.id] = product;
                    });
    
                    cont(obj.collection, obj.count);
    
                    store.set('orders.customer.' + customerId, collection);
                    store.set('orders.depot.' + depotId, orderCollection);
                    store.set('products.all', productCollection);
    
                },
                error: function(e) {
    
                    if (!e.status) {
                        var res = Model.getOfflinePage(collection, page, pageSize);
                
                        if (null != res) {
                            cont(res, collection.count);
                        } else {
                            var count = collection.count;
                            if (offline && 'function' === typeof offline) { 
                                offline(count); 
                            } else {
                                App.offline();
                            }
                        }
                    } else {
                        App.error(e);
                    }
    
                }
            });

        });

    },

    getOrderCollection: function(page, pageSize, cont, offline) {

        var page = page || 1,
            offset = (page - 1) * pageSize;
 
        Model.getUserDepot(function(depotId) {

            var collection = Model.getFromStore('orders.depot.' + depotId);

            Storage.request({
                type: 'POST',
                resource: 'order-collection',
                data: {
                    pageSize: pageSize,
                    depotId: depotId,
                    page: page
                },
                success: function(resp) {

                    var obj = JSON.parse(resp),
                        i = offset;

                    collection.count = obj.count;

                    _.each(obj.collection, function(item) {
                        collection.store[item.id] = item;
                        collection.index[i++] = item.id;
                    });

                    var productCollection = Model.getFromStore('products.all');

                    _.each(obj.products, function(item) {
                        var product = productCollection.store[item.id] || {};
                        product.id          = item.id;
                        product.deleted     = item.deleted;
                        product.description = item.description;
                        product.name        = item.name;
                        product.unitSize    = item.unitSize;
                        productCollection.store[item.id] = product;
                    });

                    cont(obj.collection, obj.count);
    
                    store.set('orders.depot.' + depotId, collection);
                    store.set('products.all', productCollection);

                },
                error: Model.errorHandler.bind(this, collection, page, pageSize, cont, offline),
            });

        });

    },

    getStockCollection: function(page, pageSize, cont, offline) {

        var page = page || 1,
            offset = (page - 1) * pageSize;
 
        Model.getUserDepot(function(depotId) {

            var collection = Model.getFromStore('stock.depot.' + depotId);

            Storage.request({
                type: 'GET',
                resource: 'stock/depot/' + depotId + '/count',
                error: Model.errorHandler.bind(this, collection, page, pageSize, cont, offline),
                success: function(resp) {

                    collection.count = resp.count;

                    Storage.request({
                        type: 'GET',
                        resource: 'stock/depot/' + depotId + '/limit/' + pageSize + '/offset/' + offset,
                        error: Model.errorHandler.bind(this, collection, page, pageSize, cont, offline),
                        success: function(resp) {
        
                            var _store = collection.store || {},
                                index = collection.index || [],
                                i = offset,
                                res = [];
        
                            _.each(resp, function(item) {
                                _store[item.id] = item;
                                index[i++] = item.id;
                                res.push(item);
                            });

                            store.set('stock.depot.' + depotId, collection); 
                            cont(res, collection.count);
    
                        }
                    });

                }
            });

        });

    },

    getCustomerCollection: function(page, pageSize, cont, offline) {

        var page = page || 1,
            offset = (page - 1) * pageSize;
 
        Model.getUserDepot(function(depotId) {
    
            var collection = Model.getFromStore('customers.active.depot.' + depotId);

            Storage.request({
                type: 'GET',
                resource: 'customer/depot/' + depotId + '/count',
                error: Model.errorHandler.bind(this, collection, page, pageSize, cont, offline),
                success: function(resp) {

                    collection.count = resp.count;

                    Storage.request({
                        type: 'GET',
                        resource: 'customer/depot/' + depotId + '/limit/' + pageSize + '/offset/' + offset,
                        error: Model.errorHandler.bind(this, collection, page, pageSize, cont, offline),
                        success: function(resp) {

                            var _store = collection.store || {},
                                index = collection.index || [],
                                i = offset,
                                res = [];
        
                            _.each(resp, function(item) {
                                _store[item.id] = item;
                                index[i++] = item.id;
                                res.push(item);
                            });

                            store.set('customers.active.depot.' + depotId, collection); 
                            cont(res, collection.count);

                        }
                    });

                }
            });

        });

    },

    getProductCollection: function(depotId, page, pageSize, cont, offline) {

        var page = page || 1,
            offset = (page - 1) * pageSize;
 
        var collection = Model.getFromStore('products.all');
        var stockCollection = Model.getFromStore('stock.depot.' + depotId);
    
        var onError = Model.errorHandler.bind(this, collection, page, pageSize, cont, offline);
 
        Storage.request({
            type: 'POST',
            resource: 'product-collection',
            data: {
                pageSize: pageSize,
                depotId: depotId,
                page: page
            },
            success: function(resp) {

                var obj = JSON.parse(resp),
                    i = offset;

                collection.count = obj.count;

                _.each(obj.collection, function(item) {
                    collection.store[item.id] = item;
                    collection.index[i++] = item.id;
                });

                _.each(obj.stock, function(item) {
                    stockCollection.store[item.id] = item;
                });

                cont(obj.collection, obj.count);

                store.set('products.all', collection);
                store.set('stock.depot.' + depotId, stockCollection);

            },
            error: onError
        });

    }

};

var Editor = function(priceCatId, cont, products) {

    Basket.init(priceCatId);

    _.each(products, function(item) {
        Basket.insertItem(item.product, item.quantity);
    });

    var prodQty = {};
    _.each(products, function(item) {
        if (item.product.id) {
            prodQty[item.product.id] = item.quantity;
        }
    });

    Model.getUserDepot(function(depotId) {

        var productList   = $('<div></div>');
        var searchResults = $('<div></div>');
        var controls      = $('<div></div>');
        var message       = $('<div></div>');

        var main = $('#main');

        main.empty();
        main.append('<div><label>Search</label><input type="text" class="search"></div>');

        var div = $('<div style="min-height:200px; border:1px solid #ddd;"></div>');

        div.append(productList);
        div.append(searchResults);

        main.append(div);
        main.append(message);
        main.append(controls);

        var pageSize = 10;

        ////////////////////////////////////////////////////////////////

        var confirmStockAvailability = function(id, quantity, cont) {

            if (quantity <= 0 || quantity % 1 !== 0) {
                message.html('Quantity must be a positive integer value.');
                return;
            }

            Model.getCollectionItem('products.all', id, function(product) {

                var stock = product.stock || {};

                if (stock.hasOwnProperty(depotId)) {
                    var available = stock[depotId];

                    var currentQty = 0;
                    if (prodQty.hasOwnProperty(id)) {
                        currentQty = prodQty[id];
                    }

                    if ('number' === typeof available) {

                        if ((available + currentQty) >= quantity) {
                            cont(product);
                        } else {
                            if (currentQty) {
                                message.html('Insufficient stock. Please specify a quantity no greater than ' + (available + currentQty) + '.');
                            } else {
                                message.html('Insufficient stock. Items available in depot: ' + available + '.');
                            }
                        }

                        // Let's not display any further errors
                        return;
                    } 
                }                         

                App.notify('ERROR_INCOMPLETE_STOCK_DATA');

            }, function() {

                App.notify('NOTICE_PLEASE_CONNECT');

            });

        };

        var refresh = function(page) {

            var buildPaginator = function(count) {
    
                var t = Handlebars.compile($('#inline-paginator').html());
                App.paginator(null, page, pageSize, count, t, function(paginator) {
    
                    productList.append(paginator).find('.inline-index').on('click', function() {
                        refresh($(this).data('id'))
                    });
    
                });

            };

            Model.getProductCollection(depotId, page, pageSize, function(products, count) {
    
                // Disable products that are currenty in the basket
                _.each(products, function(product) {
                    product.disabled = Basket.containsItem(product.id); 
                });
    
                var t = Handlebars.compile($('#order-create-product-index').html());
    
                productList.html(t({
                    product: products,
                    size: pageSize
                }));
    
                buildPaginator(count);
    
            }, function(count) {
    
                productList.html('<p>The selected page is not available offline.</p>');
                buildPaginator(count);
    
            });

            controls.html($('#order-create-controls').html());

            // Basket items
            var t = Handlebars.compile($('#order-create-item-index').html());
            controls.append(t({
                item: Basket.getItems(),
                total: Basket.total()
            }));

            if (!Basket.isEmpty()) {
                var button = $('<button>Submit</button>');
                controls.append($('<div></div>').append(button));
    
                // Submit order 
                button.click(cont);
            }

            // Add item to basket
            controls.find('button.order-item-add').click(function() {
    
                var el = $(this).parent().parent(),
                    select = el.find('select:visible'),
                    input  = el.find('input[name="quantity"]'),
                    id = select.val(), 
                    quantity = Number(input.val());
    
                if (!id) {
                    message.html('No product selected.');
                    return;
                }
    
                confirmStockAvailability(id, quantity, function(product) {
    
                    Basket.insertItem(product, quantity);
                    refresh(page);
                    App.notify('NOTICE_ITEM_ADDED');
    
                });
    
            });

            // Remove item from basket
            $('.item-remove').click(function() {
                Basket.removeItem($(this).data('id'));
                refresh(page);
            });
    
            $('.item-edit').click(function() {
                $(this).parent().hide().next().show();
            });

            $('.item-edit-cancel').click(function() {
                refresh(page);
            });
     
            // Update item quantity
            $('.item-update').click(function() {
    
                var quantity = Number($(this).parent().find('input').val()),
                    id = $(this).data('id');
    
                confirmStockAvailability(id, quantity, function() {
    
                    $(this).parent().hide().prev().show().find('span').html(quantity);
                    Basket.updateItem(id, quantity);
    
                    refresh(page);
                    App.notify('NOTICE_ITEM_QTY_UPDATED');
    
                }.bind(this));
    
            });

            message.empty();

        };

        refresh(1);

        ////////////////////////////////////////////////////////////////
        // Live search 
        ////////////////////////////////////////////////////////////////

        (function(){

            var refreshSearch = function(text, page) {

                var page = page || 1;
                var pageSize = 4;

                var buildPaginator = function(count) {
                    var t = Handlebars.compile($('#inline-paginator').html());
                    App.paginator(null, page, pageSize, count, t, function(paginator) {

                        searchResults.append(paginator).find('.inline-index').on('click', function() {
                            refreshSearch(text, $(this).data('id'));
                        });

                    });
                };

                var onError = function(e) {
                    if (!e.status) {
                        searchResults.html('No service.');
                    } else {
                        App.error(e);
                    }
                };

                var offset = (page - 1) * pageSize;
                var query = { q: '%' + text + '%' };

                Storage.request({
                    type: 'POST',
                    resource: 'product/search/count',
                    data: query,
                    error: onError,
                    success: function(resp) {
                        
                        var count = resp.count;

                        if (!count) {
                            searchResults.html('No matching products found.');
                            return;
                        }

                        Storage.request({
                            type: 'POST',
                            resource: 'product/search/limit/' + pageSize + '/offset/' + offset,
                            data: query,
                            error: onError,
                            success: function(products) {

                                // Disable products that are currenty in the basket
                                _.each(products, function(product) {
                                    product.disabled = Basket.containsItem(product.id); 
                                });

                                var t = Handlebars.compile($('#order-create-product-index').html());

                                searchResults.html(t({
                                    product: products,
                                    size: pageSize
                                }));

                                buildPaginator(count);

                            }
                        });

                    }
                });

            };

            $('input[type="text"].search').on('input', function() {
                var text = $(this).val();
                if (text.length >= 2) {
                    productList.hide();
                    refreshSearch(text, 1);
                } else {
                    productList.show();
                    searchResults.empty();
                }
            });

        }());

    });

};

$(document).ready(function() {

    $.urlParam = function(name) {
        var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
        if (results == null) {
            return null;
        } else {
            return results[1] || 0;
        }
    };

    Handlebars.registerHelper('if_eq', function(a, b, opts) {
        if (a == b) return opts.fn(this);
        else return opts.inverse(this);
    });

    Handlebars.registerHelper('if_ne', function(a, b, opts) {
        if (a != b) return opts.fn(this);
        else return opts.inverse(this);
    });

    Handlebars.registerHelper('when', function(a, opts) {
        if (a && !_.isEmpty(a)) return opts.fn(this);
        else return opts.inverse(this);
    });

    App.init({
        routes: {
            'orders(/page/:page)'                       : 'showOrders',
            'order/:id'                                 : 'viewOrder',
            'stock(/page/:page)'                        : 'showStock',
            'price-list/customer/:id(/page/:page)'      : 'showPriceList',
            'product/:id'                               : 'viewProduct',
            'customers(/page/:page)'                    : 'showCustomers',
            'customer/:id'                              : 'viewCustomer',
            'order/new/:type/customer/:id(/page/:page)' : 'createOrder',
            'order/edit/:id'                            : 'editOrder',
            'queue'                                     : 'offlineQueue',
            'logout'                                    : 'logout',
            'cache/clear'                               : 'clearCache'
        },
        clearCache: function() {
            store.clear();
            $('#main').html('Cache was cleared.');
        },
        offlineQueue: function() {

            var queue = Queue.get();

            var items = [];
            _.each(queue.index, function(index) {
                var obj = queue.store[index];
                obj.index = index;
                items.push(obj);
            });
            
            var t = Handlebars.compile($('#queue').html());

            $('#main').html(t({
                item: items 
            }));

            $('.queue-item-remove').click(function() {
                Queue.remove($(this).data('id'));
                App.refresh();
            });

            $('.queue-item-process').click(function() {
                Queue.process($(this).data('id'), function() {
                    App.refresh();
                });
            });

            $('input[name="queue-item"]').click(function() {
                var value = Boolean($('input[name="queue-item"]:checked').length);
                $('#queue-process-all-wrapper').toggle(value);
            });

            $('.queue-process').click(function() {

                var items = $('input[name="queue-item"]:checked');
                var ids = [];
                _.each(items, function(el) {
                    ids.push($(el).data('id'));
                });

                var process = function() {
                    if (ids.length) {
                        var index = ids[0];
                        ids = _.tail(ids);
                        Queue.process(index, process);
                    } else {
                        App.refresh();
                    }
                }

                process();

            });

        },
        notify: function(notifications) {

            var t = Handlebars.compile($('#notification-list').html());

            for (var key in notifications) {
                notifications[key].index = key;
            }

            $('#notice').html(t({
                notification: notifications
            }));

            $('.notice-dismiss').click(function() {
                var index = $(this).data('id');
                App.dismissNotice(index);
            });

        },
        login: function() {

            var t = Handlebars.compile($('#auth-login').html());

            var form = $('<form></form>').append(t());
            $('#main').html(form);
 
            form.validate({
                rules: {
                    user     : "required",
                    password : "required"
                },
                submitHandler: function(form) {

                    var user = form['user'].value,
                        pass = form['password'].value;
 
                    App.authenticate(user, pass);

                }
            });
 
        },
        onRequestBegin: function() {
            $('#debug').html('Loading...');
        },
        onRequestEnd: function() {
            $('#debug').empty();
        },
        logout: function() {

            App.logout();

        },
        offline: function() {

            var t = Handlebars.compile($('#offline-message').html());

            $('#main').html(t());

            App.notify('USER_OFFLINE');

            $('.offline-refresh').click(function() {
                App.refresh();
            });

        },
        error: function(e) {

            var t = Handlebars.compile($('#error-message').html());

            var message = 'Unknown error.';
            
            if (e) {
                var obj = e.responseJSON;
                if (obj && obj.message) {
                    message = obj.message;
                } else {
                    message = e.responseText;
                }
            }
    
            $('#main').html(t({message: message}));

        },
        showOrders: function(page) {

            var pageSize = 20;

            var buildPaginator = function(count) {
                var t = Handlebars.compile($('#paginator').html());
                App.paginator('orders', page, pageSize, count, t, function(paginator) {
                    $('#main').append(paginator);
                });
            };

            Model.getOrderCollection(page, pageSize, function(orders, count) {

                var t = Handlebars.compile($('#order-index').html());
                $('#main').html(t({
                    order: orders
                }));
    
                buildPaginator(count);
    
            }, function(count) {
    
                $('#main').html('<p>The selected page is not available offline.</p>');
                buildPaginator(count);
    
            });

        },
        viewOrder: function(id) {

            Model.getUserDepot(function(depotId) {

                Model.loadOrderItem(id, depotId, function() {

                    Model.getCollectionItem('orders.depot.' + depotId, id, function(order) {

                        var t = Handlebars.compile($('#order-view').html());
                        $('#main').html(t(order));

                        var productsDiv = $('<div></div>');
                        $('#main').append(productsDiv);

                        $('#main').append('<ul>');

                        if ('placed' === order.status) {
                            $('#main').append('<li><a href="#order/edit/' + id + '">Edit order</a></li>');
                        }

                        // todo VVV order activity log

                        $('#main').append('<li>View order activity log</li>');
                        $('#main').append('</ul>');

                        ////////////////////////////////////////////////////////////////
                        // Order products
                        ////////////////////////////////////////////////////////////////
 
                        var productCollection = Model.getFromStore('products.all');
                        var products = [];

                        _.each(order.products, function(item) {
                            var product = productCollection.store[item.productId];
                            if (product) {
                                product.price = item.price;
                                product.quantity = item.quantity;
                                products.push(product);
                            }
                        });

                        var t = Handlebars.compile($('#order-products').html());
                        productsDiv.append(t({
                            product: products
                        }));

                    }, App.offline);
     
                });
 
            });
 
        },
        showStock: function(page) {

            var pageSize = 10;

            var buildPaginator = function(count) {
                var t = Handlebars.compile($('#paginator').html());
                App.paginator('stock', page, pageSize, count, t, function(paginator) {
                    $('#main').append(paginator);
                });
            };

            Model.getStockCollection(page, pageSize, function(stock, count) {

                var t = Handlebars.compile($('#stock-index').html());
                $('#main').html(t({
                    item : stock
                }));
    
                buildPaginator(count);
    
            }, function(count) {
    
                $('#main').html('<p>The selected page is not available offline.</p>');
                buildPaginator(count);
    
            });

        },
        showPriceList: function(customerId, page) {

            var pageSize = 20;

            var main = $('#main');
            var searchResults = $('<div></div>');
            var productList = $('<div></div>');

            main.empty();
            main.append('<div><label>Search</label><input type="text" class="search"></div>');
            main.append(productList); 
            main.append(searchResults); 

            Model.getUserDepot(function(depotId) {

                var cont = function(customer) {
    
                    var buildPaginator = function(count) {
                        var t = Handlebars.compile($('#paginator').html());
                        App.paginator('price-list/customer/' + customerId, page, pageSize, count, t, function(paginator) {
                            productList.append(paginator);
                        });
                    };

                    Model.getProductCollection(depotId, page, pageSize, function(products, count) {

                        var priceCatId = customer.priceCatId;
            
                        _.each(products, function(product) {
                            product.assignedPrice = product.price[priceCatId] || 'No assigned price';
                        });

                        var t = Handlebars.compile($('#customer-price-list').html());
            
                        productList.append(t({
                            customer : customer,
                            product  : products,
                            size     : pageSize
                        }));
            
                        buildPaginator(count);
            
                    }, function(count) {
            
                        productList.append('<p>The selected page is not available offline.</p>');
                        buildPaginator(count);
            
                    });
    
                    ////////////////////////////////////////////////////////////////
                    // Live search 
                    ////////////////////////////////////////////////////////////////
        
                    (function(){
        
                        var refreshSearch = function(text, page) {
        
                            var page = page || 1;
                            var pageSize = 4;
        
                            var buildPaginator = function(count) {
                                var t = Handlebars.compile($('#inline-paginator').html());
                                App.paginator(null, page, pageSize, count, t, function(paginator) {
        
                                    searchResults.append(paginator);
        
                                    $('.inline-index').on('click', function() {
                                        refreshSearch(text, $(this).data('id'));
                                    });
        
                                });
                            };
        
                            var onError = function(e) {
                                if (!e.status) {
                                    searchResults.html('No service.');
                                } else {
                                    App.error(e);
                                }
                            };
        
                            var offset = (page - 1) * pageSize;
        
                            Storage.request({
                                type: 'POST',
                                resource: 'product/search/count',
                                data: { q: '%' + text + '%' },
                                error: onError,
                                success: function(resp) {
                                    
                                    var count = resp.count;
        
                                    if (!count) {
                                        searchResults.html('No matching products found.');
                                        return;
                                    }
        
                                    var priceCatId = customer.priceCatId;

                                    Storage.request({
                                        type: 'POST',
                                        resource: 'product/search/price/limit/' + pageSize + '/offset/' + offset,
                                        data: {
                                            q: '%' + text + '%', 
                                            priceCatId: priceCatId
                                        },
                                        error: onError,
                                        success: function(products) {
        
                                            _.each(products, function(product) {
                                                if (!product.assignedPrice) {
                                                    product.assignedPrice = 'No assigned price';
                                                }
                                            });
        
                                            var t = Handlebars.compile($('#customer-price-list').html());
        
                                            searchResults.html(t({
                                                product: products,
                                                size: pageSize
                                            }));
        
                                            buildPaginator(count);
        
                                        }
                                    });
        
                                }
                            });
        
                        };
        
                        $('input[type="text"].search').on('input', function() {
                            var text = $(this).val();
                            if (text.length >= 2) {
                                productList.hide();
                                refreshSearch(text, 1);
                            } else {
                                productList.show();
                                searchResults.empty();
                            }
                        });
        
                    }());

                };
    
                Storage.request({
                    type: 'GET',
                    resource: 'customer/' + customerId,
                    error: function(e) {
                        if (!e.status) {
    
                            Model.getCollectionItem('customers.active.depot.' + depotId, customerId, cont, App.offline);
    
                        } else {
                            App.error(e);
                        }
                    },
                    success: function(customer) {

                        var collection = Model.getFromStore('customers.active.depot.' + depotId);
                        collection.store[customer.id] = customer;
                        store.set('customers.active.depot.' + depotId, collection);

                        cont(customer);

                    }
                });

            });

        },
        viewProduct: function(id) {

            Model.getUserDepot(function(depotId) {

                var collection = Model.getFromStore('products.all');
    
                var cont = function() {
    
                    Model.getCollectionItem('products.all', id, function(product) {
        
                        var t = Handlebars.compile($('#product-view').html());
                        $('#main').html(t(product));

                        ////////////////////////////////////////////////////////////////
                        // Product prices
                        ////////////////////////////////////////////////////////////////

                        Model.getPriceCategories(function(categories) {

                            var res = [];
                            for (var key in product.price) {
                                if (categories.hasOwnProperty(key)) {
                                    res.push({
                                        name: categories[key],
                                        price: product.price[key]
                                    });
                                }
                            }

                            var t = Handlebars.compile($('#product-prices').html());
                            $('#main').append(t({ item: res }));

                        }, function() {

                            $('#main').append('Product price data not available.');

                        });

                        ////////////////////////////////////////////////////////////////
                        // Load limits
                        ////////////////////////////////////////////////////////////////

                        Model.getWeightClasses(function(classes) {

                            var res = [];
                            for (var key in product.limit) {
                                if (classes.hasOwnProperty(key)) {
                                    res.push({
                                        name: classes[key],
                                        limit: product.limit[key]
                                    });
                                }
                            }

                            var t = Handlebars.compile($('#product-limits').html());
                            $('#main').append(t({ item: res }));

                        }, function() {

                            $('#main').append('Product load limit data not available.');

                        });
                        
                    }, App.offline);
    
                };
    
                Storage.request({
                    type: 'POST',
                    resource: 'product-item',
                    data: { id: id },
                    error: function(e) {
                        if (!e.status) {
                            cont();
                        } else {
                            App.error(e);
                        }
                    },
                    success: function(resp) {

                        var stockCollection = Model.getFromStore('stock.depot.' + depotId);

                        var obj = JSON.parse(resp);
                        var product = obj.product;
                        var stock = obj.stock;
 
                        _.each(stock, function(item) {
                            if (item.id) {
                                stockCollection.store[item.id] = item;
                            }
                        });

                        collection.store[product.id] = product;
                        store.set('products.all', collection);
                        store.set('stock.depot.' + depotId, stockCollection);
            
                        cont();

                    }
                });

            });

        },
        showCustomers: function(page) {
            
            var pageSize = 25;

            var buildPaginator = function(count) {
                var t = Handlebars.compile($('#paginator').html());
                App.paginator('customers', page, pageSize, count, t, function(paginator) {
                    $('#main').append(paginator);
                });
            };

            Model.getCustomerCollection(page, pageSize, function(customers, count) {

                var t = Handlebars.compile($('#customer-index').html());
                $('#main').html(t({ 
                    customer: customers 
                }));

                buildPaginator(count);

            }, function(count) {

                $('#main').html('<p>The selected page is not available offline.</p>');
                buildPaginator(count);

            });

        },
        viewCustomer: function(id) {

            Model.getUserDepot(function(depotId) {

                var cont = function(customer) {

                    var t = Handlebars.compile($('#customer-view').html());
                    $('#main').html(t(customer));

                    ////////////////////////////////////////////////////////////////
                    // Stats
                    ////////////////////////////////////////////////////////////////

                    ////////////////////////////////////////////////////////////////
                    // Orders
                    ////////////////////////////////////////////////////////////////

                    var loadOrders = function(page) {

                        var pageSize = 4,
                            div = $('#customer-orders-inline');

                        div.html('Loading...');

                        var buildPaginator = function(count) {
                
                            var t = Handlebars.compile($('#inline-paginator').html());
                            App.paginator(null, page, pageSize, count, t, function(paginator) {

                                div.append(paginator).find('.inline-index').on('click', function() {
                                    loadOrders($(this).data('id'))
                                });
                
                            });
            
                        };
    
                        Model.getCustomerOrderCollection(id, page, pageSize, function(orders, count) {
            
                            var t = Handlebars.compile($('#order-index').html());
                            div.html(t({order: orders}));
                            buildPaginator(count);
                
                        }, function(count) {

                            if (count) {
                                div.html('<p>The selected page is not available offline.</p>');
                                buildPaginator(count);
                            } else {
                                div.html('<p>Please connect to remote service.</p>');
                            }
                
                        });

                    };

                    $('a.orders-load-inline').click(function() {
                        loadOrders(1);
                    });

                    ////////////////////////////////////////////////////////////////
                    // Contact Details
                    ////////////////////////////////////////////////////////////////

                    var loadContacts = function() {
                        
                        var div = $('#customer-contacts-inline');
    
                        div.html('Loading...');
    
                        var cont = function(contacts) {
                            var t = Handlebars.compile($('#contact-index').html());
                            div.html(t({contact: _.toArray(contacts)}));
                        };
    
                        Storage.request({
                            type: 'GET',
                            resource: 'contact/customer/' + id,
                            success: function(resp) {
    
                                var _store = {};
                                var count = 0;
                                var index = [];
                
                                _.each(resp, function(item) {
                                    _store[item.id] = item;
                                    count++;
                                    index.push(item.id);
                                });
                
                                store.set('contacts.customer.' + id, {
                                    index: index,
                                    store: _store,
                                    count: count
                                });
    
                                cont(_store);
                
                            },
                            error: function(e) {
                                if (e.status) {
                                    App.error(e);
                                } else {
                
                                    var collection = store.get('contacts.customer.' + id);
                
                                    if (collection && collection.store) {
                                        cont(collection.store);
                                    } else {
                                        div.html('<p>Please connect to remote service.</p>');
                                    }
                
                                }
                            }
    
                        });

                    };

                    $('a.contacts-load-inline').click(function() {
                        loadContacts();
                    });

                    ////////////////////////////////////////////////////////////////
                    // Complaints
                    ////////////////////////////////////////////////////////////////

                    var loadComplaints = function(page) {

                        var pageSize = 4,
                            div = $('#customer-complaints-inline');

                        div.html('Loading...');

                        var buildPaginator = function(count) {
                
                            var t = Handlebars.compile($('#inline-paginator').html());
                            App.paginator(null, page, pageSize, count, t, function(paginator) {

                                div.append(paginator).find('.inline-index').on('click', function() {
                                    loadComplaints($(this).data('id'))
                                });
                
                            });
            
                        };
    
                        Model.getCustomerComplaintCollection(id, page, pageSize, function(complaints, count) {
            
                            var t = Handlebars.compile($('#complaint-index').html());
                            div.html(t({complaint: complaints}));
                            buildPaginator(count);
                
                        }, function(count) {

                            if (count) {
                                div.html('<p>The selected page is not available offline.</p>');
                                buildPaginator(count);
                            } else {
                                div.html('<p>Please connect to remote service.</p>');
                            }
                
                        });
 
                    };

                    $('a.complaints-load-inline').click(function() {
                        loadComplaints(1);
                    });

                    ////////////////////////////////////////////////////////////////
                    // Call Activity
                    ////////////////////////////////////////////////////////////////

                    ////////////////////////////////////////////////////////////////
                    // Tasks
                    ////////////////////////////////////////////////////////////////

                    var loadTasks = function(page) {

                        var pageSize = 4,
                            div = $('#customer-tasks-inline');

                        div.html('Loading...');

                        var buildPaginator = function(count) {
                
                            var t = Handlebars.compile($('#inline-paginator').html());
                            App.paginator(null, page, pageSize, count, t, function(paginator) {

                                div.append(paginator).find('.inline-index').on('click', function() {
                                    loadTasks($(this).data('id'))
                                });
                
                            });
            
                        };
    
                        Model.getCustomerOrderCollectionByStatus('delivered', id, page, pageSize, function(orders, count) {
            
                            var t = Handlebars.compile($('#customer-task-index').html());
                            div.html(t({order: orders}));
                            buildPaginator(count);
                
                        }, function(count) {

                            if (count) {
                                div.html('<p>The selected page is not available offline.</p>');
                                buildPaginator(count);
                            } else {
                                div.html('<p>Please connect to remote service.</p>');
                            }
                
                        });

                    };

                    $('a.tasks-load-inline').click(function() {
                        loadTasks(1);
                    });

                };

                Storage.request({
                    type: 'GET',
                    resource: 'customer/' + id,
                    error: function(e) {
                        if (!e.status) {
    
                            Model.getCollectionItem('customers.active.depot.' + depotId, id, cont, App.offline);
    
                        } else {
                            App.error(e);
                        }
                    },
                    success: function(customer) {

                        var collection = Model.getFromStore('customers.active.depot.' + depotId);
                        collection.store[customer.id] = customer;
                        store.set('customers.active.depot.' + depotId, collection);

                        cont(customer);

                    }

                });
    
            });

        },
        createOrder: function(type, customerId, page) {

            if (!_.contains(['proactive', 'reactive'], type)) {
                App.errorMsg('Invalid action: ' + type);
                return;
            }

            Model.getUserDepot(function(depotId) {

                var cont = function() {

                    Model.getCollectionItem('customers.active.depot.' + depotId, customerId, function(customer) {
            
                        Editor(customer.priceCatId, function() {
            
                            var products = [];
                            _.each(Basket.getItems(), function(item) {
                                products.push({
                                    productId : item.id,
                                    quantity  : item.quantity
                                });
                            });
            
                            var date = new Date(),
                                user = App.user();
            
                            var data = {
                                datetime    : date.toISOString(),
                                customerId  : customerId,
                                depotId     : depotId,
                                userId      : user.id,
                                type        : type,
                                products    : products
                            };
            
                            Storage.request({
                                resource: '!order',
                                type: 'POST',
                                data: data,
                                success: function(resp) {

                                    var errors = false;
                                    var productCollection = Model.getFromStore('products.all');
                                    var products = Array.isArray(resp.products) ? resp.products : [resp.products];

                                    // Check for errors in response
                                    _.each(products, function(item) {
                                        if (false == item.status) {
                                            var product = productCollection.store[item.productId];
                                            App.notify('ERROR_PRODUCT_NOT_ADDED', product.name, item.message);
                                            errors = true;
                                        }
                                    });

                                    if (errors) {
                                        App.notify('IMPORTANT_ORDER_INCOMPLETE');
                                    } else {
                                        App.notify('NOTICE_ORDER_CREATED');
                                    }

                                    window.location.hash = 'order/' + resp.id;

                                },
                                error: function(e) {
        
                                    var obj = e.responseJSON;
        
                                    if (obj && obj.message) {
                                        App.notify('ERROR_GENERIC', obj.message);
                                    } else if (!e.status) {
        
                                        Queue.push({
                                            resource: '!order',
                                            type: 'POST',
                                            data: data,
                                            description: 'Create new order for customer "' + customer.name + '".'
                                        });
        
                                        App.notify('REQUEST_DELAYED');
                                        window.location.hash = 'orders';
        
                                    } else {
                                        App.notify('ERROR_GENERIC', e.responseText);
                                    }
        
                                }
                            });

                        });
    
                    }, App.offline); 

                };

                var collection = Model.getFromStore('customers.active.depot.' + depotId);
    
                Storage.request({
                    type: 'GET',
                    resource: 'customer/depot/' + depotId + '/count',
                    error: function(e) {
                        if (!e.status) {
                            cont();
                        } else {
                            App.error(e);
                        }
                    },
                    success: function(resp) {
    
                        collection.count = resp.count;
    
                        Storage.request({
                            type: 'GET',
                            resource: 'customer/' + customerId,
                            error: function(e) {
                                if (!e.status) {
                                    cont();
                                } else {
                                    App.error(e);
                                }
                            },
                            success: function(customer) {

                                collection.store[customer.id] =  customer;
                                store.set('customers.active.depot.' + depotId, collection);
                                cont();

                            }
                        });

                    }
                });

            });

        },
        editOrder: function(id) {

            Model.getUserDepot(function(depotId) {

                Model.loadOrderItem(id, depotId, function() {
                    Model.getCollectionItem('orders.depot.' + depotId, id, function(order) {

                        if ('placed' !== order.status) {
                            App.errorMsg('Action not allowed.');
                            return;
                        }

                        var cont = function(customer) {

                            var collection = Model.getFromStore('products.all'),
                                _store = collection.store;

                            var products = [];
                            _.each(order.products, function(item) {
                                var product = _store[item.productId];
                                if (product) {
                                    products.push({
                                        product: product,
                                        quantity: item.quantity
                                    });
                                }
                            });

                            Editor(customer.priceCatId, function() {

                                var products = [];
                                _.each(Basket.getItems(), function(item) {
                                    products.push({
                                        productId : item.id,
                                        quantity  : item.quantity
                                    });
                                });

                                var date = new Date(),
                                    user = App.user();
                
                                var data = {
                                    datetime    : date.toISOString(),
                                    customerId  : customer.id,
                                    depotId     : depotId,
                                    orderId     : id,
                                    products    : products
                                };

                                Storage.request({
                                    resource: '!order',
                                    type: 'PUT',
                                    data: data,
                                    success: function(resp) {
    
                                        var errors = false;
                                        var productCollection = Model.getFromStore('products.all');
                                        var products = Array.isArray(resp.products) ? resp.products : [resp.products];
    
                                        // Check for errors in response
                                        _.each(products, function(item) {
                                            if (false == item.status) {
                                                var product = productCollection.store[item.productId];
                                                App.notify('ERROR_PRODUCT_NOT_ADDED', product.name, item.message);
                                                errors = true;
                                            }
                                        });
    
                                        if (errors) {
                                            App.notify('IMPORTANT_ORDER_UPDATE_INCOMPLETE');
                                        } else {
                                            App.notify('NOTICE_ORDER_UPDATED');
                                        }
    
                                        window.location.hash = 'order/' + id;
    
                                    },
                                    error: function(e) {
            
                                        var obj = e.responseJSON;
            
                                        if (obj && obj.message) {
                                            App.notify('ERROR_GENERIC', obj.message);
                                        } else if (!e.status) {
            
                                            Queue.push({
                                                resource: '!order',
                                                type: 'PUT',
                                                data: data,
                                                description: 'Update order #' + id + '.'
                                            });
            
                                            App.notify('REQUEST_DELAYED');
                                            window.location.hash = 'orders';
            
                                        } else {
                                            App.notify('ERROR_GENERIC', e.responseText);
                                        }
            
                                    }
                                });
 
                            }, products);

                        };

                        Storage.request({
                            type: 'GET',
                            resource: 'customer/' + order.customerId,
                            error: function(e) {
                                if (!e.status) {
            
                                    Model.getCollectionItem('customers.active.depot.' + depotId, id, cont, App.offline);
            
                                } else {
                                    App.error(e);
                                }
                            },
                            success: cont
                        });

                    });
                });

            });

        }
    });
    
});

