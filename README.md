# Point free async utilities

...


## Installation

```
npm install point-free
```


## Usage

Designed to minimize callback and arguments bookkeeping:


```js
var pf = require('point-free');

var displayFile = pf.waterfall(
    fs.readFile,
    console.log.bind(console),
);

displayFile('filename.txt', callback)
```

However, can be easily used in a non point-free manner when needed:

```js
function copyFile(from, to, callback) {
    pf.waterfall(
        fs.readFile.bind(null, from),
        fs.writeFile.bind(null, to),
    )(callback);
}
```

## API

### waterfall(funcs...)

### serial(funcs...)

### parallel(funcs...)

### manual(states)

```js
function cachedGet(url) {
    var filename = __dirname + '/cache/' + url.replace(/\//g, '#');

    return pf.manual({
        // always starts from 'start' state
        start: function (next) {
            fs.exists(filename, function (exists) {
                // go to some new state
                if (exists) next.readCache()
                else next.request();
            });
        },
        request: function (next) {
            // use state transition as callback
            request(url, next.writeCache);
        },
        readCache: function (next) {
            // use next.end to leave state machine
            fs.readFile(filename, 'utf-8', next.end);
        },
        writeCache: function (response, body, next) {
            fs.writeFile(filename, body, 'utf-8', function (error) {
                next.end(error, body);
            });
        }
    });
}

cachedGet('http://...')(function (err, body) {
    ...
})
```

### auto(jobs)

### retry([options | attempts = 5], func)

### limit([options | limit], func)
