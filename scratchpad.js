    async.each(_.keys(JOBS), pf.handle(shutdownJob, function (err) {
        debug('Job %d shut down: %s', job_id, err ? err.stack || err : 'OK');
        callback();
    }), function () {
        debug('Queue is shut down.');
        process.exit();
    })

// Passing arguments to particular functions in waterfall
var copyFile = pf.waterfall(
    1, fs.readFile,
    1, fs.writeFile
)

var copyFile = pf.waterfall(
    0, fs.readFile,
    1, fs.writeFile
)

var copyFile = pf.waterfall(
    fs.readFile, 1,
    fs.writeFile, 1
)

var copyFile = pf.waterfall(
    [fs.readFile, 1],
    [fs.writeFile, 1]
)

var copyFile = pf.waterfall(1, fs.readFile, 1, fs.writeFile)
var copyFile = pf.waterfall(fs.readFile, 1, fs.writeFile, 1)
var copyFile = pf.waterfall([fs.readFile, 1], [fs.writeFile, 1])

var copyFile = pf.waterfall(
    'from', fs.readFile,
    'to', fs.writeFile
)

var copyFile = pf.waterfall(
    fs.readFile, 'from',
    fs.writeFile, 'from'
)

var copyFile = pf.waterfall(
    pf.arity(fs.readFile, 1),
    pf.arity(fs.writeFile, 1)
)

