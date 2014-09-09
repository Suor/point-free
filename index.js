// Ideads:
//  - support [arrays] and {objects} in serial() and parallel()
//  - support <flow-func>(tasks, callback) syntax, aka async.compatible
//  - select return value from serial(), parallel(), auto() like
//      serial(...).select(1)    // second
//      parallel(...).select(-1) // last
//      auto(...).select('job')  // named
//      // custom synchronous extractor
//      <flow-func>(...).select(function (res) { return res.... })
//  - error/handle to handle errors from serial(), parallel(), auto() like
//      serial(...).error(function (err, callback) {....})


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
        if (index) {
            if (arguments.length <= 2) results.push(arguments[1])
            else results.push([].slice.call(arguments, 1))
        }
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
            if (arguments.length <= 2) results[i] = arguments[1]
            else results[i] = [].slice.call(arguments, 1)
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

exports.retry = function (options, func) {
    // handle defaults
    if (typeof options == 'function') {
        func = options
        options = {}
    }
    else if (typeof options == 'number') {
        options = {attempts: options}
    }
    options.attempts = options.attempts || 5;

    // handle timeout
    var timeout = options.timeout;
    var factor = options.factor || 1
    if (typeof options.timeout == 'number') {
        options.timeout = function (attempt) {
            return timeout * Math.pow(factor, attempt - 1)
        }
    }

    var attempt = 0;

    return function () {
        var args = [].slice.call(arguments);
        var callback = args.pop();
        args.push(retry);

        function retry(err) {
            attempt++
            if (err && attempt < options.attempts) {
                if (timeout)
                    setTimeout(function () { func.apply(null, args) }, options.timeout(attempt))
                else
                    func.apply(null, args)
            }
            else
                callback.apply(null, arguments)
        }
        func.apply(null, args)
    }
}
