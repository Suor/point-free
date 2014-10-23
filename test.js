var assert = require('assert')
var pf = require('./index')


describe('waterfall', function () {
    it('should pass arguments', function (done) {
        pf.waterfall(
            function (x, callback) { callback(null, x / 2, x * 2) },
            function (y, z, callback) { callback(null, y + z); }
        )(4, function (err, res) {
            assert.equal(res, 10)
            done()
        })
    })

    it('should pass error', function (done) {
        pf.waterfall(
            function (callback) { callback('an error') },
            function (callback) { callback(null); }
        )(function (err) {
            assert.equal(err, 'an error')
            done()
        })
    })

    it('should work concurrently', function (done) {
        var func = pf.waterfall(function (callback) {
            setTimeout(callback, 10);
        })
        var calls = [];

        func(function () { calls.push(1) })
        func(function () { calls.push(2) })
        setTimeout(function () {
            assert.deepEqual(calls, [1, 2]);
            done();
        }, 10);
    })
})


describe('serial', function () {
    it('should be serial', function (done) {
        var calls = [];

        pf.serial(
            function (callback) { setTimeout(function () {calls.push(1); callback(null)}, 20) },
            function (callback) { setTimeout(function () {calls.push(2); callback(null)}, 10) }
        )(function (err) {
            assert.deepEqual(calls, [1, 2])
            done()
        })
    })

    it('should pass results', function (done) {
        pf.serial(
            function (callback) { callback(null, 1, 2) },
            function (callback) { callback(null, 3) },
            function (callback) { callback(null) }
        )(function (err, res) {
            assert.deepEqual(res, [[1, 2], 3, undefined])
            done()
        })
    })

    it('should pass error', function (done) {
        pf.serial(
            function (callback) { callback('an error') },
            function (callback) { callback(null); }
        )(function (err) {
            assert.equal(err, 'an error')
            done()
        })
    })
})


describe('parallel', function () {
    it('should be parallel', function (done) {
        var calls = [];

        pf.parallel(
            function (callback) { setTimeout(function () {calls.push(1); callback(null)}, 20) },
            function (callback) { setTimeout(function () {calls.push(2); callback(null)}, 10) }
        )(function (err) {
            assert.deepEqual(calls, [2, 1])
            done()
        })
    })

    it('should pass results', function (done) {
        pf.parallel(
            function (callback) { callback(null, 1, 2) },
            function (callback) { callback(null, 3) },
            function (callback) { callback(null) }
        )(function (err, res) {
            assert.deepEqual(res, [[1, 2], 3, undefined])
            done()
        })
    })

    it('should pass error', function (done) {
        pf.parallel(
            function (callback) { callback('an error') },
            function (callback) { callback(null); }
        )(function (err) {
            assert.equal(err, 'an error')
            done()
        })
    })
})


describe('manual', function () {
    it('should waterfall', function (done) {
        pf.manual({
            start: function (x, next) { next.sum(null, x / 2, x * 2) },
            sum: function (y, z, next) { next.end(null, y + z); }
        })(4, function (err, res) {
            assert.equal(res, 10)
            done()
        })
    })

    it('should pass error', function (done) {
        pf.manual({
            start: function (next) { next.other('an error') },
            other: function (next) { next.end(null); }
        })(function (err) {
            assert.equal(err, 'an error')
            done()
        })
    })
})


describe('auto', function () {
    it('should waterfall', function (done) {
        pf.auto({
            start: function (callback) { callback(null, 4) },
            divmul: ['start', function (x, callback) { callback(null, x / 2, x * 2) }],
            sum: ['divmul', function (yz, callback) { callback(null, yz[0] + yz[1]); }]
        })(function (err, res) {
            assert.deepEqual(res, {start: 4, divmul: [2, 8], sum: 10})
            done()
        })
    })

    it('should pass error', function (done) {
        pf.auto({
            auto: function (callback) { callback('an error') },
            other: function (callback) { callback(null); }
        })(function (err) {
            assert.equal(err, 'an error')
            done()
        })
    })

    it('should try parallel', function (done) {
        var calls = [];

        pf.auto({
            1: function (callback) { setTimeout(function () {calls.push(1); callback(null)}, 20) },
            2: function (callback) { setTimeout(function () {calls.push(2); callback(null)}, 10) },
            3: ['1', '2', function (_x, _y, callback) {
                calls.push(3)
                callback(null)
            }]
        })(function (err) {
            assert.deepEqual(calls, [2, 1, 3])
            done()
        })
    })
})

describe('noop', function (done) {
    it('should pass arguments', function (done) {
        pf.noop(42, 'x', function (err, res, res2) {
            assert.ifError(err);
            assert.equal(res, 42);
            assert.equal(res2, 'x');
            done();
        })
    })
})



describe('retry', function () {
    function failing(n, func) {
        var i = 0;

        return function () {
            var callback = arguments[arguments.length-1];

            i++;
            if (i <= n) callback("Error " + i)
            else func.apply(null, arguments)
        }
    }

    it('should retry', function (done) {
        pf.retry(failing(2, pf.noop))(function (err) {
            assert.ifError(err)
            done()
        })
    })

    it('should eventually fail', function (done) {
        pf.retry(2, failing(2, pf.noop))(function (err) {
            assert.equal(err, "Error 2")
            done()
        })
    })

    it('should preserve interface', function (done) {
        function add(x, y, callback) {
            callback(null, x + y);
        }

        pf.retry(failing(2, add))(1, 2, function (err, res) {
            assert.equal(res, 3)
            done()
        })
    })

    describe('timeout', function () {
        it('should take constant', function (done) {
            _time(pf.retry({timeout: 10}, failing(2, pf.noop)))(function (delay) {
                assert(delay >= 20)
                done()
            })
        })

        it('should respect factor', function (done) {
            _time(pf.retry({timeout: 10, factor: 2}, failing(2, pf.noop)))(function (delay) {
                assert(delay >= 30)
                done()
            })
        })

        it('should take function', function (done) {
            function timeout(attempt) {
                return 10 * Math.pow(2, attempt - 1)
            }

            var start = (new Date()).getTime();
            _time(pf.retry({timeout: timeout}, failing(2, pf.noop)))(function (delay) {
                assert(delay >= 30)
                done()
            })
        })
    })

})


describe('limit', function () {
    it('should limit', function (done) {
        var running = 0, max = 0;
        var limited = pf.limit(2, function (callback) {
            running++;
            if (running > max) max = running;
            setTimeout(function () { running--; callback(null) }, 10)
        })

        pf.parallel(limited, limited, limited)(function (err, results) {
            assert.equal(max, 2)
            done()
        })
    })

    it('should limit by', function (done) {
        var running = 0, max = 0;
        var limited = pf.limit({limit: 2, by: function (x) { return x }}, function (x, callback) {
            running++;
            if (running > max) max = running;
            setTimeout(function () { running--; callback(null) }, 10)
        })
        var limited1 = limited.bind(null, 1);
        var limited2 = limited.bind(null, 2);

        pf.parallel(limited1, limited1, limited1, limited2)(function (err, results) {
            assert.equal(max, 3)
            done()
        })
    })

    it('should pass error', function (done) {
        pf.limit(2, function (callback) { callback('an error') })(function (err) {
            assert.equal(err, "an error")
            done()
        })
    })

    it('should preserve interface', function (done) {
        function add(x, y, callback) {
            callback(null, x + y);
        }

        pf.limit(2, add)(1, 2, function (err, res) {
            assert.equal(res, 3)
            done()
        })
    })
})


describe('fallback', function () {
    it('should return default', function (done) {
        pf.fallback(42, function (callback) { callback('err') })(function (err, res) {
            assert.equal(res, 42);
            done();
        })
    })

    it('should pass through', function (done) {
        pf.fallback(42, function (callback) { callback(undefined, 10) })(function (err, res) {
            assert.equal(res, 10);
            done();
        })
    })
})


function _time(func) {
    return function () {
        var args = [].slice.call(arguments);
        var callback = args.pop();

        var start = (new Date()).getTime();
        func.apply(null, args.concat([function () {
            var end = (new Date()).getTime();
            callback(end - start);
        }]))
    }
}
