# Point free async utilities

This library designed to encourage composition of a program from Node.js style
asynchronous primitives. It provides generally useful combinators -
things that combine several function into one, and decorators -
wrappers that alter async function behavior some way.


## Installation

```
npm install point-free
```


## Combinators

### waterfall(funcs...)

Combines several functions to be executed serially with results of each function
passed to next one. Arguments to resulting function before callback are passed to the first step.
Results of last function will be returned as a result of combined action.
Any error will be passed out immediately, stopping chain of execution.

```js
var pf = require('point-free');

var displayFile = pf.waterfall(
    fs.readFile,
    console.log.bind(console),
);

displayFile('filename.txt', callback)
```

When it's not possible to pass everything to first function `waterfall()` could be enclosed and either called immediately...:

```js
function copyFile(from, to, callback) {
    pf.waterfall(
        fs.readFile.bind(null, from),
        fs.writeFile.bind(null, to),
    )(callback);
}
```

... or passed to other combinator or decorator:

```js
pf.serial(
    action1,
    // Combined subtask
    pf.waterfall(
        fetchData,
        actOnIt
    ),
    // ...
)
```


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

### noop


## Decorators

### retry([options | attempts = 5], func)

### limit([options | limit], func)

### fallback(defaultValue, func)
