// Ideads:
//  - support [arrays] and {objects} in serial() and parallel()
//  - support <flow-func>(tasks, callback) syntax, aka async.compatible
//  - select return value from serial(), parallel(), auto() like
//      serial(...).select(1)    // second
//      parallel(...).select(-1) // last
//      auto(...).select('job')  // named
//      // custom synchronous extractor
//      <flow-func>(...).select(function (res) { return res.... })

exports.waterfall = function () {
    // TODO: check tasks types?
    var tasks = [].slice.call(arguments);
    var index = -1;
    var callback;

    function handler(err) {
        if (err) return callback(err);
        index++;
        if (index >= tasks.length) return callback.apply(null, arguments);

        var args = [].slice.call(arguments, 1);
        tasks[index].apply(null, args.concat([handler]))
    }

    return function () {
        var args = [].slice.call(arguments);
        callback = args.pop();

        handler.apply(null, [null].concat(args));
    }
}

exports.serial = function () {
    var tasks = [].slice.call(arguments);
    var callback;
    var results = [];
    var index = -1;

    function handler(err) {
        if (err) return callback(err);
        index++;
        // TODO: handle no results / more than 1 result
        if (index) results.push(arguments[1]);
        if (index >= tasks.length) return callback(null, results);

        tasks[index](handler);
    }

    return function (_callback) {
        callback = _callback;
        handler(null);
    }
}

exports.parallel = function () {
    var tasks = [].slice.call(arguments);
    var results = [];
    var done = 0;
    var callback;

    function handler(i) {
        return function (err) {
            if (err) return callback(err);
            done++;
            // TODO: handle no results / more than 1 result
            results[i] = arguments[1];
            if (done === tasks.length) return callback(null, results);
        }
    }

    return function (_callback) {
        callback = _callback;

        for (var i = 0; i < tasks.length; i++) {
            tasks[i](handler(i))
        }
    }
}

exports.retry = function (attempts, func) {
    var left = func ? attempts : 5;
    func = func || attempts;

    return function () {
        var args = [].slice.call(arguments);
        var callback = args.pop();

        function retry(err) {
            left--;
            if (err && left)
                return func.apply(null, args.concat([retry]))
            return callback.apply(null, arguments);
        };
        func.apply(null, args.concat([retry]))
    }
}
