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
        var call = function (value, callback) {
            calls.push(value);
            callback(null, value);
        }

        pf.serial(
            function (callback) { setTimeout(call.bind(null, 1, callback), 20) },
            function (callback) { setTimeout(call.bind(null, 2, callback), 10) }
        )(function (err, res) {
            assert.deepEqual(calls, [1, 2])
            assert.deepEqual(res, [1, 2])
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
        var call = function (value, callback) {
            calls.push(value);
            callback(null, value);
        }

        pf.parallel(
            function (callback) { setTimeout(call.bind(null, 1, callback), 20) },
            function (callback) { setTimeout(call.bind(null, 2, callback), 10) }
        )(function (err, res) {
            assert.deepEqual(calls, [2, 1])
            assert.deepEqual(res, [1, 2])
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
