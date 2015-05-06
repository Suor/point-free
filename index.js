// Ideas:
//  - select return value from serial(), parallel(), auto() like
//      serial(...).select(1)    // second
//      parallel(...).select(-1) // last
//      auto(...).select('job')  // named
//      // custom synchronous extractor
//      <flow-func>(...).select(function (res) { return res.... })
//  - error/handle to handle errors from serial(), parallel(), auto() like
//      serial(...).error(function (err, callback) {....})


var pf = module.exports = function (func) {
    func.fall = function (next) {
        return pf.waterfall(func, next);
    }
    return func;
}


// Decorators

pf.retry = function (options, func) {
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

    return function () {
        var attempt = 0;
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

pf.limit = function (options, func) {
    // handle defaults
    if (typeof options == 'number') {
        options = {limit: options}
    }

    var states = {};
    var limited = function () {
        var args = [].slice.call(arguments);
        var callback = args.pop();
        var by = options.by ? options.by.apply(null, args) : 'only';
        if (!states[by]) states[by] = {running: 0, queue: []};
        var state = states[by];

        function recheck() {
            if (state.running < options.limit && state.queue.length) {
                state.running++;
                func.apply(null, state.queue.shift());
            }
        }

        function handler() {
            state.running--;
            if (!state.running && !state.queue.length) delete states[by];
            callback.apply(null, arguments);
            recheck(); // TODO: think of immediate recheck
        }
        args.push(handler);

        state.queue.push(args);
        recheck();
    }
    limited.wrapped = func;
    limited.states = states;
    if (!options.by) limited.state = states.only = {running: 0, queue: []};

    limited.emptyQueue = function () {
        Object.keys(states).forEach(function (key) {
            states[key].queue = [];
        });
    }

    return limited;
}

pf.fallback = function (defaultValue, func) {
    return function () {
        var args = [].slice.call(arguments);
        var callback = args.pop();

        function cb(err) {
            if (err) return callback(null, defaultValue);
            callback.apply(null, arguments);
        }
        args.push(cb);

        func.apply(null,  args);
    }
}

// Debugging decorators

pf.logCalls = function (logger, func) {
    if (!func) {
        func = logger;
        logger = console.log.bind(console);
    }

    return function () {
        logger(arguments);
        func.apply(null, arguments);
    }
}

pf.logExits = function (logger, func) {
    if (!func) {
        func = logger;
        logger = console.log.bind(console);
    }

    return function () {
        var args = [].slice.call(arguments);
        var callback = args.pop();

        args.push(function (err) {
            logger(arguments);
            callback.apply(null, arguments);
        })
        func.apply(null, args);
    }
}

pf.logErrors = function (logger, func) {
    if (!func) {
        func = logger;
        logger = console.error.bind(console);
    }

    return function () {
        var args = [].slice.call(arguments);
        var callback = args.pop();

        args.push(function (err) {
            if (err) logger(err.stack || 'Error: ' + err);
            callback.apply(null, arguments);
        })
        func.apply(null, args);
    }
}



// Combinators

pf.waterfall = function () {
    // TODO: check tasks types?
    var tasks = [].slice.call(arguments);

    return function () {
        var args = [].slice.call(arguments);
        var callback = args.pop();
        var index = -1;
        if (typeof callback !== 'function')
            throw TypeError("Can't use " + callback + " as callback")

        function handler(err) {
            if (err) return callback(err);
            index++;
            if (index >= tasks.length) return callback.apply(null, arguments);

            var args = [].slice.call(arguments, 1);
            tasks[index].apply(null, args.concat([handler]))
        }

        handler.apply(null, [null].concat(args));
    }
}

pf.serial = function (tasks) {
    tasks = Array.isArray(tasks) ? tasks : [].slice.call(arguments);

    return function () {
        var args = [].slice.call(arguments);
        var callback = args.pop();
        var results = [];
        var index = -1;
        if (typeof callback !== 'function')
            throw TypeError("Can't use " + callback + " as callback")

        function handler(err) {
            if (err) return callback(err);
            index++;
            if (index) {
                if (arguments.length <= 2) results.push(arguments[1])
                else results.push([].slice.call(arguments, 1))
            }
            if (index >= tasks.length) return callback(null, results);

            tasks[index].apply(null, args.concat([handler]))
        }

        handler.apply(null, [null].concat(args));
    }
}

pf.parallel = function (tasks) {
    tasks = Array.isArray(tasks) ? tasks : [].slice.call(arguments);

    return function () {
        var args = [].slice.call(arguments);
        var callback = args.pop();
        var left = tasks.length;
        var results = [];
        if (typeof callback !== 'function')
            throw TypeError("Can't use " + callback + " as callback")

        function handler(i) {
            return function (err) {
                if (err) return callback(err);
                left--;
                if (arguments.length <= 2) results[i] = arguments[1]
                else results[i] = [].slice.call(arguments, 1)
                if (!left) return callback(null, results);
            }
        }

        for (var i = 0; i < tasks.length; i++) {
            tasks[i].apply(null, args.concat([handler(i)]))
        }
    }
}

pf.manual = function (states) {
    return function () {
        var args = [].slice.call(arguments);
        var next = {};
        var callback = next.end = args.pop();
        if (typeof callback !== 'function')
            throw TypeError("Can't use " + callback + " as callback")

        Object.keys(states).forEach(function (state) {
            next[state] = function (err) {
                if (err) return callback(err)

                var args = [].slice.call(arguments, 1)
                args.push(next)
                states[state].apply(null, args)
            }
        })
        args.push(next);

        states.start.apply(null, args);
    }
}

pf.auto = function (jobs) {
    // TODO: checks if all jobs are reachable
    var defs = {};

    // Parse definition
    Object.keys(jobs).forEach(function (name, i) {
        var def = jobs[name];
        defs[name] = typeof def == 'function'
            ? {deps: [], func: def}
            : {deps: def.slice(0, -1), func: def[def.length - 1]};
    })


    // TODO: handle empty tasks
    return function (callback) {
        var left = Object.keys(jobs).length;
        var run = {};
        var results = {};
        if (typeof callback !== 'function')
            throw TypeError("Can't use " + callback + " as callback")

        function recheck() {
            Object.keys(defs).forEach(function (name) {
                var def = defs[name];
                if (run[name]) return;
                if (def.deps.every(function (dep) { return results.hasOwnProperty(dep) })) {
                    var args = def.deps.map(function (dep) { return results[dep] });
                    args.push(handler(name));
                    run[name] = true;
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

        recheck()
    }
}

// NOTE: if body calls callback directly too many times stack overflow is possible
pf.while = function (test, body) {
    return function loop(callback) {
        if (!test()) return callback(null);

        body(function (err) {
            if (err) return callback(err);
            loop(callback);
        });
    }
}

pf.doWhile = function (body, test) {
    return function loop(callback) {
        body(function (err) {
            if (err) return callback(err);
            if (test()) return loop(callback);
            callback(null);
        });
    }
}


// Primitives

pf.noop = function () {
    var args = [].slice.call(arguments);
    var callback = args.pop();

    args.unshift(null);
    callback.apply(null, args);
}

pf.sleep = function (timeout) {
    return function () {
        var args = [].slice.call(arguments);
        var callback = args.pop();

        args.unshift(null, null);
        setTimeout(callback.bind.apply(callback, args), timeout);
    }
}

pf.clear = function () {
    var callback = arguments[arguments.length - 1];
    callback(null);
}


// Collections

pf.each = function (seq, func) {
    return pf.waterfall(pf.map(seq, func), pf.clear);
}

pf.map = function (seq, func) {
    return pf.parallel(seq.map(function (item) {
        return func.bind(null, item);
    }));
}

pf.chunk = function (size, data, func) {
    return function (callback) {
        var done = 0;
        var results = [];

        pf.waterfall(
            pf.while(
                function () {return done < data.length},
                function (callback) {
                    var chunk = data.slice(done, done + size);

                    func(chunk, function (err, res) {
                        if (err) return callback(err);
                        done += chunk.length;
                        if (Array.isArray(res)) results = results.concat(res);
                        callback()
                    })
                }
            ),
            function (callback) {
                callback(null, results);
            }
        )(callback);
    }
}
