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

### retry([attempts = 5], func)
