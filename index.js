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

exports.series = function () {
    var tasks = [].slice.call(arguments);
    var results = [];
    var index = -1;
    var args, callback;

    function handler(err) {
        if (err) return callback(err);
        index++;
        // TODO: handle no results / more than 1 result
        if (index) results.push(arguments[1]);
        if (index >= tasks.length) return callback(null, results);

        tasks[index].apply(null, args.concat([handler]))
    }

    return function () {
        args = [].slice.call(arguments);
        callback = args.pop();

        handler.apply(null, [null].concat(args));
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
