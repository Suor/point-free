# Point free async utilities

This library designed to encourage composition of a program from Node.js style
asynchronous primitives. It provides generally useful:

- decorators - wrappers that alter async function behavior some way,
- combinators - things that combine several functions into one.


## Installation

```
npm install point-free
```

## API

<table>
<tr>
    <th>Decorators</th>
    <th>Combinators</th>
    <th>Control Flow</th>
    <th>Collections</th>
    <th>Primitives</th>
</tr>

<tr>
<td>
    <ul>
    <li><a href="#retry">retry</a></li>
    <li><a href="#limit">limit</a></li>
    <li><a href="#fallback">fallback</a></li>
    <li><a href="#logCalls">logCalls</a></li>
    <li><a href="#logExits">logExits</a></li>
    <li><a href="#logErrors">logErrors</a></li>
    </ul>
</td>

<td>
    <ul>
    <li><a href="#waterfall">waterfall</a></li>
    <li><a href="#serial">serial</a></li>
    <li><a href="#parallel">parallel</a></li>
    <li><a href="#auto">auto</a></li>
    <li><a href="#manual">manual</a></li>
    </ul>
</td>

<td>
    <ul>
    <li><a href="#auto">auto</a></li>
    <li><a href="#manual">manual</a></li>
    <li><a href="#while">while</a></li>
    <li><a href="#doWhile">doWhile</a></li>
    </ul>
</td>

<td>
    <ul>
    <li><a href="#each">each</a></li>
    <li><a href="#map">map</a></li>
    <li><a href="#chunk">chunk</a></li>
    </ul>
</td>

<td>
    <ul>
    <li><a href="#noop">noop</a></li>
    <li><a href="#sleep">sleep</a></li>
    </ul>
</td>

</tr></table>



## Decorators

<a name="retry"></a>
### retry([options | attempts = 5], func)

Makes a function retrying `func` up to `attempts` times, behaving the same otherwise.
If amount of attempts as exceeded then last error is returned.

**Options:**

* `attempts` - number of attempts to run `func`, defaults to 5.
* `timeout` or `timeout(failed)` - a number of milliseconds to wait between tries.
  If specified as function then it is called with a number of failed attempts passed.
* `factor` - timeout will be multiplied by this value for each failed attempt but first.
  A shortcut to implement exponential backoff.

This way one can make `fetchURL` use 5 attempts with timeouts 1, 2, 4, 8 and 16 seconds:

```js
var fetchURL = pf.retry({timeout: 1000, factor: 2}, _fetchURL);
function _fetchURL(url, callback) {
    // ...
}
```


<a name="limit"></a>
### limit([options | limit], func)

Limit number of concurrent executions of a `func`. Excessing calls will be queued and executed in FIFO order.

**Options:**

* `limit` - number of concurrent executions allowed.
* `by` - limit only those calls clashing by values of `by(args..)`.

Here is how you can limit HTTP requests to 4 by domain and 50 overall:

```js
var fetchURL = pf.limit({by: getDomain, limit: 4},
               pf.limit(50, _fetchURL));
function _fetchURL(url, callback) {
    // ...
}
```

By specifying limit to be 1 you can force calls to be sequential. E.g. in `map`:

```js
var mapSerial = pf.map(seq, pf.limit(1, process));
```

TODO: document introspection and .emptyQueue()


<a name="fallback"></a>
### fallback(defaultValue, func)

Returns a version of `func` that never fails, but returns `defaultValue` instead.
E.g. this function returns `'unknown'` if any of waterfall components fail:

```js
var detectPageLanguage = pf.fallback('unknown', pf.waterfall(
    fetchPage,
    getPageText,
    detectTextLanguage
));
```


<a name="logCalls"></a>
### logCalls([logger = console.log], func)

On each function call pass its `arguments` to `logger`. Aimed to use for logging and debugging in a way like:

```js
var fetchURL = logCalls(fetchURL);
// ... use fetchURL same as before, look at urls it's passed.
```


<a name="logExits"></a>
### logExits([logger = console.log], func)

On each function callback call pass its `arguments` to `logger`. Useful to trace async function results.


<a name="logErrors"></a>
### logErrors([logger = console.error], func)

Pass all function errors to `logger`. They are still passed the normal way too. Can be used with a third party logger utility like [debug](https://www.npmjs.com/package/debug):

```js
var debug = require('debug')('my-module');
var shakyFunc = logErrors(debug, shakyFunc);
// ... use shaky func as usual while seeing its errors.
```


## Combinators

<a name="waterfall"></a>
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


<a name="serial"></a>
### serial(funcs... | funcs)

<a name="parallel"></a>
### parallel(funcs... | funcs)


<a name="auto"></a>
### auto(jobs)

<a name="manual"></a>
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

<a name="while"></a>
### while(test, body)

<a name="doWhile"></a>
### doWhile(body, test)


## Primitives

<a name="noop"></a>
### noop

A nice thing when you want to do something conditionally:

```js
pf.waterfall(
    jobs[id] ? pf.noop : pf.loadJob,
    // ...
)
```


<a name="sleep"></a>
### sleep(timeout)

```js
var delayedHandler = pf.waterfall(pf.sleep(1000), handler);
```


## Collections

<a name="each"></a>
### each(seq, func)

<a name="map"></a>
### map(seq, func)

<a name="chunk"></a>
### chunk(size, seq, func)

```js
// Insert links into database in chunks of 1000
pf.chunk(1000, links, function (chunk, callback) {
    db.insert('link', chunk).run(callback);
})(callback)
```


TODO:

- fill in docs
- comparison with async.js
