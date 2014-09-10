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
//
//  Use continuations everywhere? Not possible?
//  This thing is really works best with returning continuation funcs, not node style.
//  But everything is node style :(
//  Another nail is that writing small funcs really suck in return continuation style.
//
//  - Move to async calling style and rename?
//  - Support both styles?
//  - Move to return continuation style? And write a dead library?

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
    var left = tasks.length;
    var callback;

    function handler(i) {
        return function (err) {
            if (err) return callback(err);
            left--;
            if (arguments.length <= 2) results[i] = arguments[1]
            else results[i] = [].slice.call(arguments, 1)
            if (!left) return callback(null, results);
        }
    }

    return function (_callback) {
        callback = _callback;

        // TODO: handle empty tasks
        for (var i = 0; i < tasks.length; i++) {
            tasks[i](handler(i))
        }
    }
}

exports.manual = function (states) {
    var next = {};
    var callback;

    Object.keys(states).forEach(function (state) {
        next[state] = function (err) {
            var args;

            if (err) return callback(err)
            else {
                args = [].slice.call(arguments, 1)
                args.push(next)
                states[state].apply(null, args)
            }
        }
    })

    return function () {
        var args = [].slice.call(arguments);
        next.end = callback = args.pop();
        args.push(next);

        states.start.apply(null, args);
    }
}

exports.auto = function (jobs) {
    // TODO: checks if all jobs are reachable
    var defs = {};
    var left = Object.keys(jobs).length;
    var results = {};
    var callback;

    // Parse definition
    Object.keys(jobs).forEach(function (name, i) {
        var def = jobs[name];
        defs[name] = typeof def == 'function'
            ? {deps: [], func: def}
            : {deps: def.slice(0, -1), func: def[def.length - 1]};
    })


    function recheck() {
        Object.keys(defs).forEach(function (name) {
            var def = defs[name];
            if (def.run) return;
            if (def.deps.every(function (dep) { return results.hasOwnProperty(dep) })) {
                var args = def.deps.map(function (dep) { return results[dep] });
                args.push(handler(name));
                defs[name].run = true;
                def.func.apply(null, args);
            }
        })
    }

    function handler(name) {
        return function (err) {
            if (err) return callback(err);
            left--;

            if (arguments.length <= 2) results[name] = arguments[1]
            else results[name] = [].slice.call(arguments, 1)
            if (left) recheck()
            else callback(null, results);
        }
    }

    // TODO: handle empty tasks
    return function (_callback) {
        callback = _callback;
        recheck()
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

    // State
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

exports.limit = function (options, func) {
    // handle defaults
    if (typeof options == 'number') {
        options = {limit: options}
    }

    var states = {};

    return function () {
        var args = [].slice.call(arguments);
        var callback = args.pop();
        var by = options.by ? options.by.apply(null, args) : '';
        if (!states[by]) states[by] = {running: 0, queue: []};
        var state = states[by];

        function done() {
            state.running--;
            callback.apply(null, arguments);
            if (state.queue.length)
                func.apply(null, state.queue.shift());
        }
        args.push(done);

        if (state.running < options.limit) {
            state.running++;
            func.apply(null, args);
        } else {
            state.queue.push(args);
        }
    }
}
