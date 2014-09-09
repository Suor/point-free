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
