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
    function noop(callback) {
        callback(null);
    }

    it('should retry', function (done) {
        pf.retry(failing(2, noop))(function (err) {
            assert.ifError(err)
            done()
        })
    })

    it('should fail', function (done) {
        pf.retry(2, failing(2, noop))(function (err) {
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
            _time(pf.retry({timeout: 10}, failing(2, noop)))(function (delay) {
                assert(delay >= 20)
                done()
            })
        })

        it('should respect factor', function (done) {
            _time(pf.retry({timeout: 10, factor: 2}, failing(2, noop)))(function (delay) {
                assert(delay >= 30)
                done()
            })
        })

        it('should take function', function (done) {
            function timeout(attempt) {
                return 10 * Math.pow(2, attempt - 1)
            }

            var start = (new Date()).getTime();
            _time(pf.retry({timeout: timeout}, failing(2, noop)))(function (delay) {
                assert(delay >= 30)
                done()
            })
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
