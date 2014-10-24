// Ideas:
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
//  - pf.resend(callback, null, results[1]);
//    pf.resend(results[1], callback)
//    pf.send(job_id, callback)
//    pf.sending(job_id, callback)
//
//  Use continuations everywhere? Not possible?
//  This thing is really works best with returning continuation funcs, not node style.
//  But everything is node style :(
//  Another nail is that writing small funcs really suck in return continuation style.
//
//  - Move to async calling style and rename?
//  - Support both styles?
//  - Move to return continuation style? And write a dead library?

var async = require('async');
var pf = exports;


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

    // TODO: gc states
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
            callback.apply(null, arguments);
            recheck();
        }
        args.push(handler);

        state.queue.push(args);
        recheck();
    }
    limited.states = states;
    if (!options.by) limited.state = states.only = {running: 0, queue: []};

    return limited;
}

pf.fallback = function (defaultValue, func) {
    return function () {
        var args = [].slice.call(arguments);
        var callback = args.pop();

        function cb(err) {
            if (err) return callback(undefined, defaultValue);
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

pf.serial = function () {
    var tasks = [].slice.call(arguments);

    return function (callback) {
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

            tasks[index](handler);
        }

        handler(null);
    }
}

pf.parallel = function () {
    var tasks = [].slice.call(arguments);

    return function (callback) {
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

        // TODO: handle empty tasks
        for (var i = 0; i < tasks.length; i++) {
            tasks[i](handler(i))
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


// Collections

pf.chunk = function (size, data, func) {
    return function (callback) {
        var done = 0;
        var results = [];

        async.whilst(
            function () {return done < data.length},
            function (callback) {
                var chunk = data.slice(done, done + size);

                func(chunk, function (err, res) {
                    if (err) return callback(err);
                    done += chunk.length;
                    if (results && Array.isArray(res) && res.length == chunk.length)
                        results = results.concat(res);
                    else
                        results = undefined;
                    callback()
                })
            },
            function (err) {
                if (err) return callback(err);
                callback(undefined, results);
            }
        )
    }
}

// pf.chunk = function (size, data, func) {
//     var done = 0;
//     var results = [];

//     return pf.serial(
//         pf.while(
//             function () {return done < data.length},
//             function (callback) {
//                 var chunk = data.slice(done, done + size);

//                 func(chunk, function (err, res) {
//                     if (err) return callback(err);
//                     done += chunk.length;
//                     if (results && Array.isArray(res) && res.length == chunk.length)
//                         results = results.concat(res);
//                     else
//                         results = undefined;
//                     callback()
//                 })
//             }
//         ),
//         function (callback) {
//             callback(undefined, results);
//         }
//     )
// }

// pf.chunk = function (size, data, func) {
//     var done = 0;
//     var results = [];

//     return pf.while(
//         function () {return done < data.length},
//         function (callback) {
//             var chunk = data.slice(done, done + size);

//             func(chunk, function (err, res) {
//                 if (err) return callback(err);
//                 done += chunk.length;
//                 if (results && Array.isArray(res) && res.length == chunk.length)
//                     results = results.concat(res);
//                 else
//                     results = undefined;
//                 callback()
//             })
//         }
//     ).serial(function (callback) {
//         callback(undefined, results);
//     })
// }
